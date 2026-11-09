// laser_driver.cpp
// Driver ROS2 pour opensw lidar — version améliorée avec debug et compensator FOV-aware.

#include <chrono>
#include <limits>
#include <string>
#include <sstream>
#include <algorithm>

#include <rclcpp/rclcpp.hpp>
#include <rcl_interfaces/msg/set_parameters_result.hpp>
#include <sensor_msgs/msg/laser_scan.hpp>

#include <hatchbed_common/param_handler.h>
#include <opensw/client.h>
#include <opensw_ros/logger.h>

#include "angle_compensator.h"

using namespace std::chrono_literals;
using namespace std;                // selon ta préférence précédente
using namespace opensw_ros;

int main(int argc, char **argv)
{
    rclcpp::init(argc, argv);
    auto node = std::make_shared<rclcpp::Node>("opensw_laser_driver");
    RCLCPP_INFO(node->get_logger(), "Initializing opensw laser driver ...");

    hatchbed_common::ParamHandler params(node);
    params.register_verbose_logging_param();

    // redirige les logs opensw vers ros
    LogBridge log_bridge("opensw", node);

    // paramètres statiques / init
    auto host_param = params.param("host", std::string("192.168.11.11"), "Host to connect to");
    auto port_param = params.param("port", 1445, "TCP port to connect to");
    auto frame_id_param = params.param("frame_id", std::string("laser"), "Frame to use for the published messages");
    auto rate_param = params.param("rate", 10.0, "Publish rate");

    // paramètres dynamiques
    auto min_range_param = params.param("min_range", 0.1, "Min sensor range in meters").min(0.0).max(10.0).dynamic().declare();
    auto max_range_param = params.param("max_range", 40.0, "Max sensor range in meters").min(1.0).max(100.0).dynamic().declare();
    auto enable_compensation_param = params.param("enable_angle_compensation", true, "Enable angle compensation for fixed output").dynamic().declare();
    auto target_points_param = params.param("target_points", 920, "Target number of points per scan when compensation is enabled").min(180).max(1440).dynamic().declare();

    // Extraire valeurs
    std::string host = host_param.declare().value();
    int port = port_param.declare().value();
    std::string frame_id = frame_id_param.declare().value();
    double rate = rate_param.declare().value();

    // Publisher
    auto qos = rclcpp::QoS(rclcpp::KeepLast(10));
    qos.reliability(rclcpp::ReliabilityPolicy::Reliable);
    qos.durability(rclcpp::DurabilityPolicy::Volatile);
    auto scan_pub = node->create_publisher<sensor_msgs::msg::LaserScan>("scan", qos);

    opensw::Client client;

    // AngleCompensator initial
    size_t current_target_points = static_cast<size_t>(target_points_param.value());
    auto compensator = std::make_unique<opensw_ros::AngleCompensator>(current_target_points);

    // Callback pour mise à jour dynamique quand target_points change
    auto param_callback = [
        &compensator, &current_target_points, node
    ](const std::vector<rclcpp::Parameter> &params) -> rcl_interfaces::msg::SetParametersResult {
        rcl_interfaces::msg::SetParametersResult result;
        result.successful = true;

        for (const auto &p : params) {
            if (p.get_name() == "target_points") {
                int new_tp = p.as_int();
                if (new_tp < 1) new_tp = 1;
                size_t new_tp_sz = static_cast<size_t>(new_tp);
                if (new_tp_sz != current_target_points) {
                    compensator = std::make_unique<opensw_ros::AngleCompensator>(new_tp_sz);
                    current_target_points = new_tp_sz;
                    RCLCPP_INFO(node->get_logger(), "AngleCompensator updated: target_points=%zu", new_tp_sz);
                }
            }
            // on pourrait aussi traiter enable_angle_compensation ici si besoin
        }

        return result;
    };
    auto param_callback_handle = node->add_on_set_parameters_callback(param_callback);

    rclcpp::Time last_stamp = node->now();
    rclcpp::Rate spin_rate(rate);

    // diagnostics
    size_t total_scans = 0;
    size_t total_gaps = 0;
    size_t max_gaps = 0;
    size_t scans_with_gaps = 0;
    const size_t diag_interval = 100;

    while (rclcpp::ok()) {
        rclcpp::spin_some(node);

        if (!client.connected()) {
            RCLCPP_INFO(node->get_logger(),"Connecting to device ...");
            if (!client.connect(host, port, 500)) {
                RCLCPP_WARN(node->get_logger(),"Failed to connect to device.");
                rclcpp::sleep_for(1s);
                continue;
            }
        }

        auto scan = client.getLaserScan();
        if (!scan || scan->points.size() < 2) {
            RCLCPP_WARN(node->get_logger(),"Failed to get laser scan.  Disconnecting...");
            client.disconnect();
            continue;
        }

        // DEBUG: résumé du scan brut (avant compensation)
        size_t raw_valid = 0;
        float raw_min_ang = numeric_limits<float>::infinity();
        float raw_max_ang = -numeric_limits<float>::infinity();
        for (const auto &p : scan->points) {
            if (!p.valid) continue;
            raw_valid++;
            raw_min_ang = min(raw_min_ang, p.angle);
            raw_max_ang = max(raw_max_ang, p.angle);
        }
        RCLCPP_INFO(node->get_logger(),
            "RAW scan: total=%zu valid=%zu angle_first=%.6f angle_last=%.6f min=%.6f max=%.6f",
            scan->points.size(), raw_valid,
            scan->points.front().angle, scan->points.back().angle,
            raw_valid ? raw_min_ang : 0.0f, raw_valid ? raw_max_ang : 0.0f);

        // Choisir si on applique la compensation (param dynamique)
        bool enable_compensation = enable_compensation_param.value();
        // Si tu préfères forcer la lecture depuis le serveur de paramètres:
        // rclcpp::Parameter p; if (node->get_parameter("enable_angle_compensation", p)) enable_compensation = p.as_bool();

        std::vector<opensw::LaserPoint> processed_points;
        if (enable_compensation) {
            processed_points = compensator->compensate(scan->points);
        } else {
            processed_points = scan->points;
        }

        // DEBUG: résumé après compensation
        size_t proc_valid = 0;
        float proc_min_ang = numeric_limits<float>::infinity();
        float proc_max_ang = -numeric_limits<float>::infinity();
        for (const auto &p : processed_points) {
            if (!p.valid) continue;
            proc_valid++;
            proc_min_ang = min(proc_min_ang, p.angle);
            proc_max_ang = max(proc_max_ang, p.angle);
        }
        RCLCPP_INFO(node->get_logger(),
            "PROC scan: size=%zu valid=%zu angle_first=%.6f angle_last=%.6f min=%.6f max=%.6f enabled=%s target_points=%zu",
            processed_points.size(), proc_valid,
            processed_points.front().angle, processed_points.back().angle,
            proc_valid ? proc_min_ang : 0.0f, proc_valid ? proc_max_ang : 0.0f,
            enable_compensation ? "true" : "false",
            current_target_points);

        // Protection: si processed_points vide -> sauter
        if (processed_points.empty()) {
            RCLCPP_WARN(node->get_logger(), "Processed points empty, skipping publish.");
            continue;
        }

        // Construire le message LaserScan
        sensor_msgs::msg::LaserScan msg;
        rclcpp::Time stamp = node->now();
        msg.header.stamp = stamp;
        msg.header.frame_id = frame_id;

        // angle_min / angle_max et increment ; protéger cas N==1
        msg.angle_min = processed_points.front().angle;
        msg.angle_max = processed_points.back().angle;
        size_t N = processed_points.size();
        if (N > 1) {
            msg.angle_increment = (msg.angle_max - msg.angle_min) / static_cast<double>(N - 1);
            msg.time_increment = 0.0;
        } else {
            msg.angle_increment = 0.0;
            msg.time_increment = 0.0;
        }

        // scan_time et limites
        double scan_time = (stamp - last_stamp).seconds();
        last_stamp = stamp;
        msg.scan_time = scan_time;
        // time_increment est approximé si N>1
        if (N > 1) msg.time_increment = scan_time / static_cast<double>(N - 1);
        msg.range_min = min_range_param.value();
        msg.range_max = max_range_param.value();

        msg.ranges.resize(N, std::numeric_limits<float>::infinity());

        // Détection de gaps et remplissage des ranges
        size_t gap_count = 0;
        double expected_increment = (N > 1) ? ((msg.angle_max - msg.angle_min) / static_cast<double>(N - 1)) : 0.0;
        for (size_t i = 0; i < N; ++i) {
            const auto &pt = processed_points[i];
            float distance = pt.distance;
            bool is_valid = pt.valid;

            if (!is_valid || distance >= 99999.0f || distance <= 0.001f ||
                distance < msg.range_min || distance > msg.range_max) {
                msg.ranges[i] = std::numeric_limits<float>::infinity();
            } else {
                msg.ranges[i] = distance;
            }

            if (i > 0) {
                double actual_increment = static_cast<double>(processed_points[i].angle - processed_points[i - 1].angle);
                if (N > 1 && std::abs(actual_increment - expected_increment) > expected_increment * 1.5) {
                    gap_count++;
                    RCLCPP_DEBUG(node->get_logger(),
                        "Gap detected: idx %zu→%zu, Δangle=%.6f (rad), expected=%.6f, diff=%.6f",
                        i - 1, i, actual_increment, expected_increment, std::abs(actual_increment - expected_increment));
                }
            }
        }

        // Diagnostics counters
        total_scans++;
        total_gaps += gap_count;
        if (gap_count > 0) {
            scans_with_gaps++;
            if (gap_count > max_gaps) max_gaps = gap_count;
            RCLCPP_DEBUG(node->get_logger(), "Scan contains %zu gaps.", gap_count);
        }

        // Optionnel : affichage complet des points (utile pour debug mais verbeux)
        // Si c'est trop verbeux, commente cette section.
        {
            std::ostringstream oss;
            oss.setf(std::ios::fixed);
            oss.precision(4);
            for (size_t i = 0; i < processed_points.size(); ++i) {
                const auto &pt = processed_points[i];
                oss << "{ angle: " << pt.angle
                    << ", distance: " << (std::isinf(pt.distance) ? NAN : pt.distance)
                    << ", valid: " << (pt.valid ? "true" : "false") << " }\n";
            }
            RCLCPP_INFO(node->get_logger(), "\n%s", oss.str().c_str());
        }

        // Publier
        scan_pub->publish(msg);

        // Simple diagnostic périodique
        if ((total_scans % diag_interval) == 0) {
            RCLCPP_INFO(node->get_logger(),
                "Diagnostics: total_scans=%zu total_gaps=%zu scans_with_gaps=%zu max_gaps=%zu",
                total_scans, total_gaps, scans_with_gaps, max_gaps);
        }

        spin_rate.sleep();
    }

    return 0;
}

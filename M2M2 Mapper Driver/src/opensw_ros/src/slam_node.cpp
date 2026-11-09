#include "opensw_ros/slam_manager.h"
#include <rclcpp/rclcpp.hpp>

int main(int argc, char** argv) {
    rclcpp::init(argc, argv);
    
    auto slam_node = std::make_shared<opensw_ros::SlamManager>();
    
    RCLCPP_INFO(slam_node->get_logger(), "Starting SLAM Manager...");
    
    try {
        rclcpp::spin(slam_node);
    } catch (const std::exception& e) {
        RCLCPP_ERROR(slam_node->get_logger(), "SLAM Manager crashed: %s", e.what());
        return 1;
    }
    
    rclcpp::shutdown();
    return 0;
}
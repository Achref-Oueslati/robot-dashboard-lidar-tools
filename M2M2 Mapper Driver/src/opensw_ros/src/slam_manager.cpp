#include "opensw_ros/slam_manager.h"
#include <tf2/LinearMath/Quaternion.h>
#include <tf2/LinearMath/Matrix3x3.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>
#include <cmath>
#include <algorithm>

namespace opensw_ros {

    MapHolder::MapHolder(float resolution) 
        : resolution_(resolution), width_(DEFAULT_WIDTH), height_(DEFAULT_HEIGHT),
          origin_x_(-DEFAULT_WIDTH * resolution / 2.0), 
          origin_y_(-DEFAULT_HEIGHT * resolution / 2.0) {
        map_data_.resize(width_ * height_, UNKNOWN);
        hit_count_.resize(width_ * height_, 0);
        miss_count_.resize(width_ * height_, 0);
    }

    void MapHolder::clear() {
        std::lock_guard<std::mutex> lock(map_mutex_);
        std::fill(map_data_.begin(), map_data_.end(), UNKNOWN);
        std::fill(hit_count_.begin(), hit_count_.end(), 0);
        std::fill(miss_count_.begin(), miss_count_.end(), 0);
    }

    void MapHolder::resize(int width, int height) {
        std::lock_guard<std::mutex> lock(map_mutex_);
        width_ = width;
        height_ = height;
        map_data_.resize(width_ * height_, UNKNOWN);
        hit_count_.resize(width_ * height_, 0);
        miss_count_.resize(width_ * height_, 0);
    }

    bool MapHolder::worldToMap(double wx, double wy, int& mx, int& my) const {
        mx = static_cast<int>((wx - origin_x_) / resolution_);
        my = static_cast<int>((wy - origin_y_) / resolution_);
        return isValidMapCoordinate(mx, my);
    }

    bool MapHolder::mapToWorld(int mx, int my, double& wx, double& wy) const {
        if (!isValidMapCoordinate(mx, my)) return false;
        wx = origin_x_ + mx * resolution_;
        wy = origin_y_ + my * resolution_;
        return true;
    }

    bool MapHolder::isValidMapCoordinate(int mx, int my) const {
        return mx >= 0 && mx < width_ && my >= 0 && my < height_;
    }

    void MapHolder::setMapValue(int mx, int my, int8_t value) {
        if (!isValidMapCoordinate(mx, my)) return;
        std::lock_guard<std::mutex> lock(map_mutex_);
        map_data_[getIndex(mx, my)] = value;
    }

    int8_t MapHolder::getMapValue(int mx, int my) const {
        if (!isValidMapCoordinate(mx, my)) return UNKNOWN;
        std::lock_guard<std::mutex> lock(map_mutex_);
        return map_data_[getIndex(mx, my)];
    }

    void MapHolder::updateFromLaserScan(const sensor_msgs::msg::LaserScan& scan, 
                                       const geometry_msgs::msg::Pose& robot_pose) {
        std::lock_guard<std::mutex> lock(map_mutex_);
        
        // Convert robot position to map coordinates
        int robot_mx, robot_my;
        if (!worldToMap(robot_pose.position.x, robot_pose.position.y, robot_mx, robot_my)) {
            return; // Robot outside map bounds
        }

        // Extract robot yaw
        tf2::Quaternion q(robot_pose.orientation.x, robot_pose.orientation.y, 
                         robot_pose.orientation.z, robot_pose.orientation.w);
        tf2::Matrix3x3 m(q);
        double roll, pitch, yaw;
        m.getRPY(roll, pitch, yaw);

        // Process each laser ray
        for (size_t i = 0; i < scan.ranges.size(); ++i) {
            float range = scan.ranges[i];
            
            // Skip invalid readings - be more strict with filtering
            if (range < scan.range_min || range > scan.range_max || 
                std::isnan(range) || std::isinf(range) || 
                range > 15.0 || range < 0.15) {  // Additional filtering for realistic ranges
                continue;
            }

            // Skip readings that are clearly sensor noise (very high values that passed initial filter)
            if (range > 10.0) {  // Most indoor environments don't have walls > 10m away
                continue;
            }

            // Calculate beam angle
            double beam_angle = yaw + scan.angle_min + i * scan.angle_increment;
            
            // Calculate end point of the laser beam
            double end_x = robot_pose.position.x + range * cos(beam_angle);
            double end_y = robot_pose.position.y + range * sin(beam_angle);
            
            int end_mx, end_my;
            if (!worldToMap(end_x, end_y, end_mx, end_my)) {
                continue; // End point outside map
            }

            // Use Bresenham's line algorithm to trace the beam
            std::vector<std::pair<int, int>> line_points;
            bresenhamLine(robot_mx, robot_my, end_mx, end_my, line_points);

            // Mark all points along the line as free (miss), except the last one
            for (size_t j = 0; j < line_points.size() - 1; ++j) {
                int mx = line_points[j].first;
                int my = line_points[j].second;
                if (isValidMapCoordinate(mx, my)) {
                    int idx = getIndex(mx, my);
                    miss_count_[idx]++;
                    
                    // Update occupancy based on hit/miss ratio
                    int total_obs = hit_count_[idx] + miss_count_[idx];
                    if (total_obs >= 3) {  // Need minimum observations
                        float hit_ratio = static_cast<float>(hit_count_[idx]) / total_obs;
                        if (hit_ratio < 0.2) {  // Low hit ratio = free space
                            map_data_[idx] = FREE;
                        }
                    }
                }
            }

            // Mark the end point as occupied (hit) if we have a valid reading
            if (range < scan.range_max && isValidMapCoordinate(end_mx, end_my)) {
                int idx = getIndex(end_mx, end_my);
                hit_count_[idx]++;
                
                // Update occupancy based on hit/miss ratio  
                int total_obs = hit_count_[idx] + miss_count_[idx];
                if (total_obs >= 2) {  // Need minimum observations
                    float hit_ratio = static_cast<float>(hit_count_[idx]) / total_obs;
                    if (hit_ratio > 0.6) {  // High hit ratio = occupied
                        map_data_[idx] = OCCUPIED;
                    }
                }
            }
        }
    }

    void MapHolder::bresenhamLine(int x0, int y0, int x1, int y1, 
                                 std::vector<std::pair<int, int>>& points) const {
        points.clear();
        
        int dx = abs(x1 - x0);
        int dy = abs(y1 - y0);
        int sx = (x0 < x1) ? 1 : -1;
        int sy = (y0 < y1) ? 1 : -1;
        int err = dx - dy;

        int x = x0, y = y0;
        
        while (true) {
            points.emplace_back(x, y);
            
            if (x == x1 && y == y1) break;
            
            int e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

    void MapHolder::fillOccupancyGrid(nav_msgs::msg::OccupancyGrid& grid) const {
        std::lock_guard<std::mutex> lock(map_mutex_);
        
        grid.header.frame_id = "map";
        grid.header.stamp = rclcpp::Clock().now();
        
        grid.info.resolution = resolution_;
        grid.info.width = width_;
        grid.info.height = height_;
        grid.info.origin.position.x = origin_x_;
        grid.info.origin.position.y = origin_y_;
        grid.info.origin.position.z = 0.0;
        grid.info.origin.orientation.w = 1.0;
        
        grid.data = map_data_;
    }

    void MapHolder::fillMapMetaData(nav_msgs::msg::MapMetaData& metadata) const {
        std::lock_guard<std::mutex> lock(map_mutex_);
        
        metadata.resolution = resolution_;
        metadata.width = width_;
        metadata.height = height_;
        metadata.origin.position.x = origin_x_;
        metadata.origin.position.y = origin_y_;
        metadata.origin.position.z = 0.0;
        metadata.origin.orientation.w = 1.0;
        metadata.map_load_time = rclcpp::Clock().now();
    }

    // ========== SlamManager Implementation ==========

    SlamManager::SlamManager() 
        : Node("slam_manager"), is_initialized_(false) {
        
        initializeParameters();
        
        // Initialize map holder
        map_holder_ = std::make_unique<MapHolder>(0.05f); // 5cm resolution
        
        // Initialize TF components
        tf_broadcaster_ = std::make_unique<tf2_ros::TransformBroadcaster>(*this);
        tf_buffer_ = std::make_unique<tf2_ros::Buffer>(this->get_clock());
        tf_listener_ = std::make_unique<tf2_ros::TransformListener>(*tf_buffer_);

        // Initialize pose
        current_pose_.position.x = 0.0;
        current_pose_.position.y = 0.0;
        current_pose_.position.z = 0.0;
        current_pose_.orientation.w = 1.0;

        // Create subscribers
        laser_sub_ = this->create_subscription<sensor_msgs::msg::LaserScan>(
            "scan", 10, 
            std::bind(&SlamManager::laserScanCallback, this, std::placeholders::_1));
            
        imu_sub_ = this->create_subscription<sensor_msgs::msg::Imu>(
            "imu/data", 10,
            std::bind(&SlamManager::imuCallback, this, std::placeholders::_1));

        // Create publishers
        map_pub_ = this->create_publisher<nav_msgs::msg::OccupancyGrid>("map", 1);
        map_metadata_pub_ = this->create_publisher<nav_msgs::msg::MapMetaData>("map_metadata", 1);
        odom_pub_ = this->create_publisher<nav_msgs::msg::Odometry>("odom", 10);
        pose_pub_ = this->create_publisher<geometry_msgs::msg::PoseStamped>("robot_pose", 10);

        // Create timers
        map_update_timer_ = this->create_wall_timer(
            std::chrono::milliseconds(static_cast<int>(1000.0 / map_update_frequency_)),
            std::bind(&SlamManager::mapUpdateTimerCallback, this));
            
        localization_timer_ = this->create_wall_timer(
            std::chrono::milliseconds(static_cast<int>(1000.0 / localization_frequency_)),
            std::bind(&SlamManager::localizationTimerCallback, this));

        RCLCPP_INFO(this->get_logger(), "SLAM Manager initialized");
        RCLCPP_INFO(this->get_logger(), "Map frame: %s, Base frame: %s, Laser frame: %s", 
                   map_frame_.c_str(), base_frame_.c_str(), laser_frame_.c_str());
    }

    void SlamManager::initializeParameters() {
        // Frame parameters
        this->declare_parameter("laser_frame", "laser");
        this->declare_parameter("base_frame", "base_link");
        this->declare_parameter("odom_frame", "odom");
        this->declare_parameter("map_frame", "map");
        
        // Frequency parameters
        this->declare_parameter("map_update_frequency", 5.0);
        this->declare_parameter("localization_frequency", 20.0);
        
        // Laser parameters
        this->declare_parameter("laser_max_range", 12.0);
        this->declare_parameter("laser_min_range", 0.12);

        // Get parameters
        laser_frame_ = this->get_parameter("laser_frame").as_string();
        base_frame_ = this->get_parameter("base_frame").as_string();
        odom_frame_ = this->get_parameter("odom_frame").as_string();
        map_frame_ = this->get_parameter("map_frame").as_string();
        
        map_update_frequency_ = this->get_parameter("map_update_frequency").as_double();
        localization_frequency_ = this->get_parameter("localization_frequency").as_double();
        
        laser_max_range_ = this->get_parameter("laser_max_range").as_double();
        laser_min_range_ = this->get_parameter("laser_min_range").as_double();
    }

    void SlamManager::laserScanCallback(const sensor_msgs::msg::LaserScan::SharedPtr msg) {
        last_laser_time_ = msg->header.stamp;
        
        if (!is_initialized_) {
            // For the first scan, initialize robot at origin
            std::lock_guard<std::mutex> lock(pose_mutex_);
            current_pose_.position.x = 0.0;
            current_pose_.position.y = 0.0;
            current_pose_.position.z = 0.0;
            current_pose_.orientation.w = 1.0;
            current_pose_.orientation.x = 0.0;
            current_pose_.orientation.y = 0.0;
            current_pose_.orientation.z = 0.0;
            
            is_initialized_ = true;
            RCLCPP_INFO(this->get_logger(), "SLAM initialized with first laser scan at origin");
        }

        // Update the map with new laser data
        updateMap(*msg);
    }

    void SlamManager::imuCallback(const sensor_msgs::msg::Imu::SharedPtr msg) {
        // For now, we'll use IMU data for future improvements
        // Can be used for better motion prediction and localization
    }

    void SlamManager::updateMap(const sensor_msgs::msg::LaserScan& scan) {
        std::lock_guard<std::mutex> lock(pose_mutex_);
        map_holder_->updateFromLaserScan(scan, current_pose_);
    }

    void SlamManager::mapUpdateTimerCallback() {
        if (!is_initialized_) return;
        publishMap();
    }

    void SlamManager::localizationTimerCallback() {
        if (!is_initialized_) return;
        
        updateLocalization();
        publishTransforms();
        publishOdometry();
    }

    void SlamManager::updateLocalization() {
        // Simple odometry-based localization for now
        // In future: implement particle filter or EKF-based localization
        
        // For now, assume robot stays at origin
        // This will be improved with proper SLAM algorithms
    }

    void SlamManager::publishTransforms() {
        auto now = this->get_clock()->now();
        
        // Publish map -> odom transform
        geometry_msgs::msg::TransformStamped map_to_odom;
        map_to_odom.header.stamp = now;
        map_to_odom.header.frame_id = map_frame_;
        map_to_odom.child_frame_id = odom_frame_;
        map_to_odom.transform.translation.x = 0.0;
        map_to_odom.transform.translation.y = 0.0;
        map_to_odom.transform.translation.z = 0.0;
        map_to_odom.transform.rotation.w = 1.0;
        
        tf_broadcaster_->sendTransform(map_to_odom);

        // Publish odom -> base_link transform
        geometry_msgs::msg::TransformStamped odom_to_base;
        odom_to_base.header.stamp = now;
        odom_to_base.header.frame_id = odom_frame_;
        odom_to_base.child_frame_id = base_frame_;
        
        {
            std::lock_guard<std::mutex> lock(pose_mutex_);
            odom_to_base.transform.translation.x = current_pose_.position.x;
            odom_to_base.transform.translation.y = current_pose_.position.y;
            odom_to_base.transform.translation.z = current_pose_.position.z;
            odom_to_base.transform.rotation = current_pose_.orientation;
        }
        
        tf_broadcaster_->sendTransform(odom_to_base);
    }

    void SlamManager::publishMap() {
        nav_msgs::msg::OccupancyGrid map_msg;
        map_holder_->fillOccupancyGrid(map_msg);
        map_pub_->publish(map_msg);

        nav_msgs::msg::MapMetaData metadata_msg;
        map_holder_->fillMapMetaData(metadata_msg);
        map_metadata_pub_->publish(metadata_msg);
    }

    void SlamManager::publishOdometry() {
        nav_msgs::msg::Odometry odom_msg;
        odom_msg.header.stamp = this->get_clock()->now();
        odom_msg.header.frame_id = odom_frame_;
        odom_msg.child_frame_id = base_frame_;
        
        {
            std::lock_guard<std::mutex> lock(pose_mutex_);
            odom_msg.pose.pose = current_pose_;
            odom_msg.twist.twist = current_velocity_;
        }
        
        odom_pub_->publish(odom_msg);

        // Also publish pose stamped
        geometry_msgs::msg::PoseStamped pose_msg;
        pose_msg.header = odom_msg.header;
        pose_msg.header.frame_id = map_frame_;
        pose_msg.pose = current_pose_;
        pose_pub_->publish(pose_msg);
    }

    bool SlamManager::getLaserPose(const std::string& frame, geometry_msgs::msg::Pose& pose, 
                                  const rclcpp::Time& time) {
        try {
            // First try to get laser pose relative to base_link
            auto base_to_laser = tf_buffer_->lookupTransform(base_frame_, frame, time, 
                                                           rclcpp::Duration::from_nanoseconds(100000000));
            
            // Get current robot pose in map frame (from our SLAM estimation)
            geometry_msgs::msg::Pose robot_pose_in_map;
            {
                std::lock_guard<std::mutex> lock(pose_mutex_);
                robot_pose_in_map = current_pose_;
            }
            
            // Combine robot pose with laser offset to get laser pose in map
            // For simplicity, assuming laser is at the same position as base_link for now
            pose = robot_pose_in_map;
            
            return true;
        } catch (tf2::TransformException& ex) {
            RCLCPP_WARN_THROTTLE(this->get_logger(), *this->get_clock(), 5000,
                                "Could not get transform from %s to %s: %s", 
                                base_frame_.c_str(), frame.c_str(), ex.what());
            return false;
        }
    }

} // namespace opensw_ros
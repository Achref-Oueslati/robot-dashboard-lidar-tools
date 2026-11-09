#pragma once

#include <rclcpp/rclcpp.hpp>
#include <tf2_ros/transform_broadcaster.h>
#include <tf2_ros/buffer.h>
#include <tf2_ros/transform_listener.h>

#include <sensor_msgs/msg/laser_scan.hpp>
#include <sensor_msgs/msg/imu.hpp>
#include <nav_msgs/msg/occupancy_grid.hpp>
#include <nav_msgs/msg/map_meta_data.hpp>
#include <nav_msgs/msg/odometry.hpp>
#include <geometry_msgs/msg/pose_stamped.hpp>
#include <geometry_msgs/msg/transform_stamped.hpp>

#include <vector>
#include <memory>
#include <mutex>
#include <atomic>

namespace opensw_ros {

    /**
     * @brief Grid-based occupancy map holder similar to slamware's ServerMapHolder
     */
    class MapHolder {
    public:
        static constexpr float DEFAULT_RESOLUTION = 0.05f;
        static constexpr int DEFAULT_WIDTH = 1000;
        static constexpr int DEFAULT_HEIGHT = 1000;
        static constexpr int8_t UNKNOWN = -1;
        static constexpr int8_t FREE = 0;
        static constexpr int8_t OCCUPIED = 100;

        struct Point2D {
            double x, y;
            Point2D(double x = 0.0, double y = 0.0) : x(x), y(y) {}
        };

        struct Rectangle {
            double x, y, width, height;
            Rectangle(double x = 0.0, double y = 0.0, double w = 0.0, double h = 0.0) 
                : x(x), y(y), width(w), height(h) {}
            bool empty() const { return width <= 0.0 || height <= 0.0; }
        };

    private:
        std::vector<int8_t> map_data_;
        std::vector<int> hit_count_;    // Count of hits for each cell
        std::vector<int> miss_count_;   // Count of misses for each cell
        int width_, height_;
        float resolution_;
        double origin_x_, origin_y_;
        mutable std::mutex map_mutex_;

    public:
        MapHolder(float resolution = DEFAULT_RESOLUTION);
        ~MapHolder() = default;

        // Map management
        void clear();
        void resize(int width, int height);
        void setResolution(float resolution) { resolution_ = resolution; }
        void setOrigin(double x, double y) { origin_x_ = x; origin_y_ = y; }

        // Data access
        float getResolution() const { return resolution_; }
        int getWidth() const { return width_; }
        int getHeight() const { return height_; }
        double getOriginX() const { return origin_x_; }
        double getOriginY() const { return origin_y_; }
        const std::vector<int8_t>& getData() const { return map_data_; }

        // Coordinate conversion
        bool worldToMap(double wx, double wy, int& mx, int& my) const;
        bool mapToWorld(int mx, int my, double& wx, double& wy) const;
        
        // Map operations
        void setMapValue(int mx, int my, int8_t value);
        int8_t getMapValue(int mx, int my) const;
        void updateFromLaserScan(const sensor_msgs::msg::LaserScan& scan, 
                                const geometry_msgs::msg::Pose& robot_pose);

        // ROS integration
        void fillOccupancyGrid(nav_msgs::msg::OccupancyGrid& grid) const;
        void fillMapMetaData(nav_msgs::msg::MapMetaData& metadata) const;

    private:
        int getIndex(int mx, int my) const { return my * width_ + mx; }
        bool isValidMapCoordinate(int mx, int my) const;
        void expandMapIfNeeded(int mx, int my);
        void bresenhamLine(int x0, int y0, int x1, int y1, 
                          std::vector<std::pair<int, int>>& points) const;
    };

    /**
     * @brief Main SLAM manager class
     */
    class SlamManager : public rclcpp::Node {
    public:
        SlamManager();
        ~SlamManager() = default;

    private:
        // ROS2 components
        rclcpp::Subscription<sensor_msgs::msg::LaserScan>::SharedPtr laser_sub_;
        rclcpp::Subscription<sensor_msgs::msg::Imu>::SharedPtr imu_sub_;
        
        rclcpp::Publisher<nav_msgs::msg::OccupancyGrid>::SharedPtr map_pub_;
        rclcpp::Publisher<nav_msgs::msg::MapMetaData>::SharedPtr map_metadata_pub_;
        rclcpp::Publisher<nav_msgs::msg::Odometry>::SharedPtr odom_pub_;
        rclcpp::Publisher<geometry_msgs::msg::PoseStamped>::SharedPtr pose_pub_;

        std::unique_ptr<tf2_ros::TransformBroadcaster> tf_broadcaster_;
        std::unique_ptr<tf2_ros::Buffer> tf_buffer_;
        std::unique_ptr<tf2_ros::TransformListener> tf_listener_;

        rclcpp::TimerBase::SharedPtr map_update_timer_;
        rclcpp::TimerBase::SharedPtr localization_timer_;

        // SLAM components
        std::unique_ptr<MapHolder> map_holder_;
        
        // Robot state
        geometry_msgs::msg::Pose current_pose_;
        geometry_msgs::msg::Twist current_velocity_;
        std::mutex pose_mutex_;

        // Configuration
        std::string laser_frame_;
        std::string base_frame_;
        std::string odom_frame_;
        std::string map_frame_;
        
        double map_update_frequency_;
        double localization_frequency_;
        double laser_max_range_;
        double laser_min_range_;
        
        // State
        std::atomic<bool> is_initialized_;
        rclcpp::Time last_laser_time_;

        // Callbacks
        void laserScanCallback(const sensor_msgs::msg::LaserScan::SharedPtr msg);
        void imuCallback(const sensor_msgs::msg::Imu::SharedPtr msg);
        void mapUpdateTimerCallback();
        void localizationTimerCallback();

        // SLAM functions
        void updateMap(const sensor_msgs::msg::LaserScan& scan);
        void updateLocalization();
        void publishTransforms();
        void publishMap();
        void publishOdometry();

        // Utility functions
        bool getLaserPose(const std::string& frame, geometry_msgs::msg::Pose& pose, 
                         const rclcpp::Time& time);
        void initializeParameters();
    };

} // namespace opensw_ros
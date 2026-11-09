# M2M2 Mapper Driver Overview

## Folder Structure & Purpose

The `M2M2 Mapper Driver` folder contains source code, configuration, and launch files for a modular ROS2-based robot driver and mapping system. It is organized into several submodules:

- **asyncapi_gencpp/**: Tools and code for async API generation and integration.
- **hatchbed_common/**: Common utilities, parameter handling, and profiling tools for ROS2 nodes.
- **opensw/**: Core driver implementation, including communication protocols, client logic, and command-line tools.
- **opensw_ros/**: ROS2 integration layer, including launch files, configuration, and ROS2 node implementations for SLAM, IMU, and laser drivers.

## Key Features
- Device communication and protocol handling
- ROS2 node implementations for SLAM, IMU, and laser drivers
- Launch files for easy startup and configuration
- Example code and tests for validation

## How to Use
1. **Build the workspace:**
   ```bash
   cd /home/ros2_ws
   colcon build
   source install/setup.bash
   ```
2. **Launch a driver or SLAM node:**
   ```bash
   ros2 launch opensw_ros full_driver.launch.py
   ```
3. **Explore source code and tests:**
   - See `opensw/src/` for driver logic
   - See `opensw_ros/launch/` for launch files
   - See `opensw_ros/src/` for ROS2 node implementations
   - See `opensw/test/` for test data and validation
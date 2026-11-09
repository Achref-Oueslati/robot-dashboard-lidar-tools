cmake_minimum_required(VERSION 3.5)
project(opensw_ros VERSION 0.1.0)

find_package(ament_cmake REQUIRED)
find_package(hatchbed_common REQUIRED)
find_package(rclcpp REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(tf2 REQUIRED)
find_package(tf2_ros REQUIRED)
find_package(tf2_geometry_msgs REQUIRED)

find_package(PkgConfig)
pkg_check_modules(opensw REQUIRED opensw)
link_directories(${opensw_LIBRARY_DIRS})

include_directories(
  include
  ${opensw_INCLUDE_DIRS}
)

add_executable(imu_driver src/imu_driver.cpp src/logger.cpp)
target_link_libraries(imu_driver ${opensw_LIBRARIES} fmt::fmt)
set_property(TARGET imu_driver PROPERTY CXX_STANDARD 17)
ament_target_dependencies(imu_driver hatchbed_common rclcpp sensor_msgs fmt)

add_executable(laser_driver src/laser_driver.cpp src/logger.cpp)
target_link_libraries(laser_driver ${opensw_LIBRARIES} fmt::fmt)
set_property(TARGET laser_driver PROPERTY CXX_STANDARD 17)
ament_target_dependencies(laser_driver hatchbed_common rclcpp sensor_msgs fmt)

# SLAM Manager
add_executable(slam_node src/slam_node.cpp src/slam_manager.cpp src/logger.cpp)
target_link_libraries(slam_node ${opensw_LIBRARIES} fmt::fmt)
set_property(TARGET slam_node PROPERTY CXX_STANDARD 17)
ament_target_dependencies(slam_node 
  hatchbed_common 
  rclcpp 
  sensor_msgs 
  nav_msgs 
  geometry_msgs 
  tf2 
  tf2_ros 
  tf2_geometry_msgs
  fmt)

install(
  TARGETS 
    imu_driver
    laser_driver
    slam_node
  DESTINATION lib/${PROJECT_NAME})

ament_package()
install(DIRECTORY launch/ DESTINATION share/${PROJECT_NAME}/launch)

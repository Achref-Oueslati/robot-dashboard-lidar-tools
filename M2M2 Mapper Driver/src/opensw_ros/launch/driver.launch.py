#!/usr/bin/env python3

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        # Declare launch arguments
        DeclareLaunchArgument(
            'host',
            default_value='192.168.11.1',
            description='Host IP address of the SlamTec device'
        ),
        DeclareLaunchArgument(
            'port',
            default_value='1445',
            description='TCP port of the SlamTec device'
        ),
        DeclareLaunchArgument(
            'use_raw_data',
            default_value='false',
            description='Use raw IMU data fields'
        ),

        # Launch laser driver
        Node(
            package='opensw_ros',
            executable='laser_driver',
            name='laser_driver',
            parameters=[{
                'host': LaunchConfiguration('host'),
                'port': LaunchConfiguration('port'),
                'frame_id': 'laser',
                'rate': 10.0,
                'min_range': 0.1,
                'max_range': 40.0
            }],
            output='screen'
        ),

        # Launch IMU driver
        Node(
            package='opensw_ros',
            executable='imu_driver',
            name='imu_driver',
            parameters=[{
                'host': LaunchConfiguration('host'),
                'port': LaunchConfiguration('port'),
                'frame_id': 'imu',
                'rate': 50.0,
                'use_raw_data': LaunchConfiguration('use_raw_data')
            }],
            output='screen'
        ),

        # Static transform publisher for RViz visualization
        # Publishes transform from base_link to laser frame
        Node(
            package='tf2_ros',
            executable='static_transform_publisher',
            name='base_to_laser_tf',
            arguments=['--x', '0', '--y', '0', '--z', '0', 
                      '--roll', '0', '--pitch', '0', '--yaw', '0',
                      '--frame-id', 'base_link', '--child-frame-id', 'laser'],
            output='screen'
        ),

        # Static transform publisher for IMU frame
        Node(
            package='tf2_ros',
            executable='static_transform_publisher', 
            name='base_to_imu_tf',
            arguments=['--x', '0', '--y', '0', '--z', '0',
                      '--roll', '0', '--pitch', '0', '--yaw', '0', 
                      '--frame-id', 'base_link', '--child-frame-id', 'imu'],
            output='screen'
        ),
    ])
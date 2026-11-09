#!/usr/bin/env python3

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        # Launch arguments
        DeclareLaunchArgument(
            'use_sim_time',
            default_value='false',
            description='Use simulation time'
        ),
        
        DeclareLaunchArgument(
            'laser_frame',
            default_value='laser',
            description='Frame ID for laser scanner'
        ),
        
        DeclareLaunchArgument(
            'base_frame', 
            default_value='base_link',
            description='Base frame ID'
        ),
        
        DeclareLaunchArgument(
            'map_frame',
            default_value='map', 
            description='Map frame ID'
        ),

        DeclareLaunchArgument(
            'odom_frame',
            default_value='odom',
            description='Odometry frame ID' 
        ),

        # Static transform: base_link -> laser
        Node(
            package='tf2_ros',
            executable='static_transform_publisher',
            name='base_to_laser_tf',
            arguments=[
                '0.0', '0.0', '0.1',  # x, y, z translation
                '0.0', '0.0', '0.0',  # roll, pitch, yaw rotation
                LaunchConfiguration('base_frame'),
                LaunchConfiguration('laser_frame')
            ],
            parameters=[{'use_sim_time': LaunchConfiguration('use_sim_time')}]
        ),

        # IMU Driver
        Node(
            package='opensw_ros',
            executable='imu_driver',
            name='imu_driver',
            output='screen',
            parameters=[{'use_sim_time': LaunchConfiguration('use_sim_time')}],
            remappings=[
                ('imu/data', 'imu/data')
            ]
        ),

        # Laser Driver  
        Node(
            package='opensw_ros',
            executable='laser_driver',
            name='laser_driver',
            output='screen',
            parameters=[{'use_sim_time': LaunchConfiguration('use_sim_time')}],
            remappings=[
                ('scan', 'scan')
            ]
        ),

        # SLAM Manager
        Node(
            package='opensw_ros',
            executable='slam_node',
            name='slam_manager',
            output='screen',
            parameters=[
                {
                    'use_sim_time': LaunchConfiguration('use_sim_time'),
                    'laser_frame': LaunchConfiguration('laser_frame'),
                    'base_frame': LaunchConfiguration('base_frame'),
                    'map_frame': LaunchConfiguration('map_frame'),
                    'odom_frame': LaunchConfiguration('odom_frame'),
                    'map_update_frequency': 5.0,
                    'localization_frequency': 20.0,
                    'laser_max_range': 12.0,
                    'laser_min_range': 0.12
                }
            ],
            remappings=[
                ('scan', 'scan'),
                ('imu/data', 'imu/data'),
                ('map', 'map'),
                ('map_metadata', 'map_metadata'),
                ('odom', 'odom'),
                ('robot_pose', 'robot_pose')
            ]
        )
    ])
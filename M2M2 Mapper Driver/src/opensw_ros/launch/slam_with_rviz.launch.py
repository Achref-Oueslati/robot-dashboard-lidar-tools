#!/usr/bin/env python3

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare

def generate_launch_description():
    # Find package share directory
    opensw_ros_dir = FindPackageShare('opensw_ros')
    
    return LaunchDescription([
        # Launch arguments
        DeclareLaunchArgument(
            'use_rviz',
            default_value='true',
            description='Start RViz for visualization'
        ),
        
        DeclareLaunchArgument(
            'rviz_config',
            default_value=PathJoinSubstitution([opensw_ros_dir, 'config', 'slam_config.rviz']),
            description='RViz configuration file'
        ),

        # Include the SLAM launch file
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource([
                PathJoinSubstitution([opensw_ros_dir, 'launch', 'slam.launch.py'])
            ])
        ),

        # RViz
        Node(
            condition=IfCondition(LaunchConfiguration('use_rviz')),
            package='rviz2',
            executable='rviz2',
            name='rviz2',
            output='screen',
            arguments=['-d', LaunchConfiguration('rviz_config')],
            parameters=[{'use_sim_time': LaunchConfiguration('use_sim_time', default='false')}]
        )
    ])
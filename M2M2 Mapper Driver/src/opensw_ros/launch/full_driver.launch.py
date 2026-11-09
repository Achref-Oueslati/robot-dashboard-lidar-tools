#!/usr/bin/env python3

from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    # Declare launch arguments
    host_arg = DeclareLaunchArgument(
        'host', default_value='192.168.11.1', description='Host IP address of the M2M2 lidar')
    port_arg = DeclareLaunchArgument(
        'port', default_value='1445', description='Port of the M2M2 lidar')
    use_sim_time_arg = DeclareLaunchArgument(
        'use_sim_time', default_value='false', description='Use simulation time')
    laser_frame_arg = DeclareLaunchArgument(
        'laser_frame', default_value='laser', description='Laser frame')
    base_frame_arg = DeclareLaunchArgument(
        'base_frame', default_value='base_link', description='Base frame')
    map_frame_arg = DeclareLaunchArgument(
        'map_frame', default_value='map', description='Map frame')
    odom_frame_arg = DeclareLaunchArgument(
        'odom_frame', default_value='odom', description='Odom frame')

    # Static transforms
    static_tf_laser = Node(
        package='tf2_ros', executable='static_transform_publisher', name='base_to_laser_tf',
        arguments=['0', '0', '0.1', '0', '0', '0', LaunchConfiguration('base_frame'), LaunchConfiguration('laser_frame')],
        parameters=[{'use_sim_time': LaunchConfiguration('use_sim_time')}]
    )
    static_tf_imu = Node(
        package='tf2_ros', executable='static_transform_publisher', name='base_to_imu_tf',
        arguments=['0', '0', '0', '0', '0', '0', LaunchConfiguration('base_frame'), 'imu'],
        parameters=[{'use_sim_time': LaunchConfiguration('use_sim_time')}]
    )

    # IMU driver node
    imu_driver_node = Node(
        package='opensw_ros', executable='imu_driver', name='imu_driver',
        parameters=[
            {'host': LaunchConfiguration('host')},
            {'port': LaunchConfiguration('port')},
            {'frame_id': 'imu'},
            {'rate': 50.0},
            {'use_raw_data': False},
            {'use_sim_time': LaunchConfiguration('use_sim_time')}
        ],
        remappings=[('imu/data', 'imu/data')],
        output='screen'
    )

    # Laser driver node
    laser_driver_node = Node(
        package='opensw_ros', executable='laser_driver', name='laser_driver',
        parameters=[
            {'host': LaunchConfiguration('host')},
            {'port': LaunchConfiguration('port')},
            {'frame_id': LaunchConfiguration('laser_frame')},
            {'rate': 10.0},
            {'min_range': 0.15},  # Stricter minimum range
            {'max_range': 12.0},  # More realistic maximum range for indoor SLAM
            {'use_sim_time': LaunchConfiguration('use_sim_time')}
        ],
        remappings=[('scan', 'scan')],
        output='screen'
    )

    # SLAM node
    slam_node = Node(
        package='opensw_ros', executable='slam_node', name='slam_manager',
        parameters=[
            {'use_sim_time': LaunchConfiguration('use_sim_time')},
            {'laser_frame': LaunchConfiguration('laser_frame')},
            {'base_frame': LaunchConfiguration('base_frame')},
            {'map_frame': LaunchConfiguration('map_frame')},
            {'odom_frame': LaunchConfiguration('odom_frame')},
            {'map_update_frequency': 10.0},  # Faster map updates
            {'localization_frequency': 50.0},  # Faster localization
            {'laser_max_range': 10.0},  # Match laser driver setting
            {'laser_min_range': 0.15}
        ],
        remappings=[
            ('scan', 'scan'),
            ('imu/data', 'imu/data'),
            ('map', 'map'),
            ('map_metadata', 'map_metadata'),
            ('odom', 'odom'),
            ('robot_pose', 'robot_pose')
        ],
        output='screen'
    )

    return LaunchDescription([
        host_arg,
        port_arg,
        use_sim_time_arg,
        laser_frame_arg,
        base_frame_arg,
        map_frame_arg,
        odom_frame_arg,
        static_tf_laser,
        static_tf_imu,
        imu_driver_node,
        laser_driver_node,
        slam_node
    ])
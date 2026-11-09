# ROS2 rosbridge_suite Installation & Usage

**Install via apt**
```bash
sudo apt update
sudo apt install ros-humble-rosbridge-suite
```

## Running rosbridge WebSocket Node

**Launch the WebSocket server:**
```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

## Notes

- Default port is `9090`.
- customize the port by modifying the launch file or using command-line arguments.

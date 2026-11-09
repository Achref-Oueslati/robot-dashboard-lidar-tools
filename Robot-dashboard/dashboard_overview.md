# Robot-Dashboard Overview & Usage

## What Does the Dashboard Do?

The Robot-Dashboard is a web-based interface for monitoring and interacting with ROS2 robot system. It provides:
- Real-time visualization of ROS2 topics (Robot movements and joints,laser scans, images, system status ...)
- Connection management to ROS2 via rosbridge WebSocket
- Interactive widgets for data display and control
- Topic tree and debug console for advanced users

## How to Run the Dashboard
2. **Prerequisites:**
 check the readme in the Robot-Dashboard folder for dependencies.
 RQ: everything should be installed in the Robot-Dashboard folder.
1. **Install dependencies(if necessary):**
   ```bash
   cd ros2_ws/Robot-Dashboard/
   npm install
   ```
2. **Start the development server:**
   ```bash
   cd ros2_ws/Robot-Dashboard/
   npm run dev
   ```
   The dashboard will be available at `http://localhost:3000` in the browser.

3. **Connect to ROS2:**
   - Make sure `rosbridge_suite` is running on the ROS2 system:
     ```bash
     ros2 launch rosbridge_server rosbridge_websocket_launch.xml
     ```
   - Enter the WebSocket URL (default: `ws://localhost:9090`) in the dashboard connection panel.

## Notes
- Widgets and panels can be customized to suit any workflow.
- For production deployment, use `npm run build` and `npm start`.

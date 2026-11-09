# LaserScan Viewer

A standalone web application for visualizing ROS2 LaserScan data with support for both live ROS2 data via rosbridge and CSV replay functionality.

## Features

### Live Data Visualization
- **Real-time ROS2 LaserScan Data**: Connects to ROS2 via rosbridge WebSocket
- **Auto-topic Discovery**: Automatically finds and subscribes to `/scan` or other LaserScan topics
- **Compressed & Uncompressed Support**: Handles both standard and compressed LaserScan messages

### Data Processing & Visualization
- **Interactive Canvas**: Pan (drag), zoom (scroll), and click to highlight points
- **Range-based Coloring**: Color points by distance (blue=close, red=far) or uniform color
- **Statistical Information**: Real-time stats (valid/invalid points, range min/max/avg)
- **Mobile Support**: Touch controls for pan and pinch-to-zoom

### Recording & Replay
- **Live Recording**: Record LaserScan frames to CSV format
- **CSV Export**: Export recorded data with timestamp, frame, point index, angle, range, x, y
- **CSV Import & Replay**: Upload and replay previously recorded scan sessions
- **Mode Toggle**: Switch between Live and Replay modes without mixing data

### Data Analysis
- **Raw Data Console**: View parsed LaserScan points in tabular format
- **Point Inspector**: Click points to see exact coordinates and range values
- **Grid & Reference Circles**: Visual aids for distance estimation

### Offline/Online Modes
- **With rosbridge**: Live data from ROS2 topics + CSV functionality
- **Without rosbridge**: CSV-only mode for offline analysis and replay

## Getting Started

### Prerequisites
- Node.js 18+ (for development)
- ROS2 (for live data)
- rosbridge_server (for live data)

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### ROS2 Setup (for live data)
```bash
# Install rosbridge (if not already installed)
sudo apt install ros-humble-rosbridge-server

# Start rosbridge WebSocket server
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# In another terminal, start your LaserScan publisher
ros2 launch your_robot_package laser_driver.launch.py
```

### Usage

#### Live Mode (with ROS2)
1. Start rosbridge server
2. Open the app at `http://localhost:3000`
3. Ensure "Auto-connect" is enabled
4. The app will automatically connect and subscribe to available LaserScan topics

#### Offline Mode (CSV only)
1. Open the app
2. Disable "Auto-connect" 
3. Use "Upload CSV" to load previously recorded scan data
4. Use "Replay" to animate the scan data

#### Recording & Export
1. In Live mode, click "Start Recording"
2. Let it capture frames (you'll see the count increase)
3. Click "Stop Recording"
4. Click "Export CSV" to download the data

## Technical Details

### Supported Message Types
- `sensor_msgs/LaserScan`
- `sensor_msgs/msg/LaserScan` 

### CSV Format
```
timestamp,frameIndex,pointIndex,angleDeg,range,x,y
1635724800000,0,0,0.0,2.5,2.5,0.0
1635724800000,0,1,0.25,2.3,2.29,0.11
...
```

### Architecture
- **Frontend**: React + TypeScript + Vite
- **Real-time Communication**: WebSocket via rosbridge_server
- **Data Processing**: Optimized Float32Array for point clouds
- **Rendering**: HTML5 Canvas with efficient redraw cycles

### Performance
- **Low Latency**: Direct WebSocket connection with minimal throttling
- **Efficient Rendering**: Canvas-based visualization with viewport culling
- **Memory Optimized**: Efficient data structures for large point clouds

## Controls

### Canvas Interaction
- **Pan**: Click and drag
- **Zoom**: Mouse wheel or pinch (mobile)
- **Point Inspector**: Click on points to see details
- **Reset View**: Button to return to default zoom/pan

### Interface Controls
- **Live/Replay Toggle**: Switch data sources
- **Recording**: Start/stop recording live sessions
- **CSV Import/Export**: Upload and download scan data
- **Color Modes**: Uniform or range-based coloring
- **Console View**: Toggle raw data table view

## Configuration

### ROS Bridge URL
Default: `ws://localhost:9090`
Can be changed in the UI or by modifying the default in `App.tsx`

### Throttling
Default: No throttling (real-time)
Can be configured in the rosbridge subscription options

## Troubleshooting

### "No ROS Bridge Connection"
- Ensure rosbridge_server is running: `ros2 launch rosbridge_server rosbridge_websocket_launch.xml`
- Check the WebSocket URL (default: ws://localhost:9090)
- Verify your ROS2 environment is sourced

### "No scan topics found"
- Ensure your LaserScan publisher is running
- Check topic names: `ros2 topic list | grep scan`
- Verify message type: `ros2 topic info /scan`

### CSV Replay Issues
- Ensure CSV follows the expected format (timestamp,frameIndex,pointIndex,angleDeg,range,x,y)
- Check that range values are numeric (not string)
- Verify the CSV has data rows (not just header)

## Building for Production

```bash
npm run build
```

Serve the `dist/` folder with any static web server.

## License

This project is part of the ROS2 workspace and follows the same licensing as the parent project.
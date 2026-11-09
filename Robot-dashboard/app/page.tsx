"use client"

import { useState } from "react"
import { ConnectionConfig } from "@/components/connection-config"
import { SidePanel } from "@/components/side-panel"
import { WidgetGrid } from "@/components/widget-grid"
// import { DebugConsole } from "@/components/debug-console"
import { getVisualizerForTopic } from "@/components/visualizers"
import { useRosbridge } from "@/hooks/use-rosbridge"
import type { Topic } from "@/lib/rosbridge"
import type { WidgetConfig } from "@/lib/widget-types"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

const DEMO_TOPICS: Topic[] = [
  // Camera IMU topics
  { name: "/camera/camera/accel/sample", type: "sensor_msgs/Imu" },
  { name: "/camera/camera/gyro/sample", type: "sensor_msgs/Imu" },
  { name: "/camera/camera/imu", type: "sensor_msgs/Imu" },

  // Camera color image topics
  { name: "/camera/camera/color/image_raw", type: "sensor_msgs/Image" },
  { name: "/camera/camera/color/image_raw/compressed", type: "sensor_msgs/CompressedImage" },
  { name: "/camera/camera/color/camera_info", type: "sensor_msgs/CameraInfo" },

  // Camera depth topics
  { name: "/camera/camera/depth/image_rect_raw", type: "sensor_msgs/Image" },
  { name: "/camera/camera/depth/image_rect_raw/compressed", type: "sensor_msgs/CompressedImage" },
  { name: "/camera/camera/depth/camera_info", type: "sensor_msgs/CameraInfo" },

  // Aligned depth to color
  { name: "/camera/camera/aligned_depth_to_color/image_raw", type: "sensor_msgs/Image" },
  { name: "/camera/camera/aligned_depth_to_color/camera_info", type: "sensor_msgs/CameraInfo" },

  // Point cloud
  { name: "/camera/camera/depth/color/points", type: "sensor_msgs/PointCloud2" },

  // Differential drive controller
  { name: "/diff_drive_controller/cmd_vel", type: "geometry_msgs/TwistStamped" },
  { name: "/diff_drive_controller/odom", type: "nav_msgs/Odometry" },

  // Joint states
  { name: "/joint_states", type: "sensor_msgs/JointState" },
  { name: "/dynamic_joint_states", type: "control_msgs/DynamicJointState" },

  // Navigation topics
  { name: "/goal_pose", type: "geometry_msgs/PoseStamped" },
  { name: "/initialpose", type: "geometry_msgs/PoseWithCovarianceStamped" },
  { name: "/clicked_point", type: "geometry_msgs/PointStamped" },

  // TF topics
  { name: "/tf", type: "tf2_msgs/TFMessage" },
  { name: "/tf_static", type: "tf2_msgs/TFMessage" },
]

const DEMO_WIDGETS: WidgetConfig[] = [
  // Depth Image (Compressed) - Top Left
  {
    id: "depth-compressed",
    topic: { name: "/camera/camera/aligned_depth_to_color/image_raw/compressedDepth", type: "sensor_msgs/CompressedImage" },
    position: { x: 20, y: 20 },
    size: { width: 400, height: 300 },
    minimized: false,
  },
  // Color Camera (Compressed) - Top Middle
  {
    id: "color-camera",
    topic: { name: "/camera/camera/color/image_raw/compressed", type: "sensor_msgs/CompressedImage" },
    position: { x: 440, y: 20 },
    size: { width: 400, height: 300 },
    minimized: false,
  },
  // System Monitor - Top Right
  {
    id: "system-monitor",
    topic: { name: "__system_monitor__", type: "system_monitor" },
    position: { x: 860, y: 20 },
    size: { width: 350, height: 300 },
    minimized: false,
  },
  // IMU - Middle Left
  {
    id: "imu-sensor",
    topic: { name: "/camera/camera/imu", type: "sensor_msgs/Imu" },
    position: { x: 20, y: 340 },
    size: { width: 400, height: 280 },
    minimized: false,
  },
  // Velocity Commands - Middle Center
  {
    id: "cmd-vel",
    topic: { name: "/diff_drive_controller/cmd_vel", type: "geometry_msgs/TwistStamped" },
    position: { x: 440, y: 340 },
    size: { width: 400, height: 280 },
    minimized: false,
  },
  // Odometry - Middle Right
  {
    id: "odometry",
    topic: { name: "/diff_drive_controller/odom", type: "nav_msgs/Odometry" },
    position: { x: 860, y: 340 },
    size: { width: 400, height: 280 },
    minimized: false,
  },
  // Joint States - Bottom Center
  {
    id: "joint-states",
    topic: { name: "/joint_states", type: "sensor_msgs/JointState" },
    position: { x: 320, y: 640 },
    size: { width: 600, height: 250 },
    minimized: false,
  },
]

export default function Home() {
  const [rosbridgeUrl, setRosbridgeUrl] = useState<string>()
  const { status, topics, refreshTopics, subscribe } = useRosbridge(rosbridgeUrl)
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEMO_WIDGETS)
  const [showConnectionConfig, setShowConnectionConfig] = useState(false)

  const displayTopics = rosbridgeUrl && status.connected ? topics : DEMO_TOPICS
  const isDemoMode = !rosbridgeUrl || !status.connected

  const handleAddWidget = (topic: Topic) => {
    const newWidget: WidgetConfig = {
      id: `${topic.name}-${Date.now()}`,
      topic,
      position: {
        x: 50 + widgets.length * 30,
        y: 50 + widgets.length * 30,
      },
      size: { width: 400, height: 300 },
      minimized: false,
    }
    setWidgets((prev) => [...prev, newWidget])
  }

  const handleUpdateWidget = (id: string, updates: Partial<WidgetConfig>) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)))
  }

  const handleRemoveWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="flex h-screen bg-background">
      <SidePanel
        topics={displayTopics}
        status={isDemoMode ? { connected: false, reconnecting: false } : status}
        onAddWidget={handleAddWidget}
        onRefreshTopics={refreshTopics}
        isDemoMode={isDemoMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {isDemoMode && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium">Demo Mode</span>
              <span className="text-xs text-muted-foreground">Connect to rosbridge to see live data</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowConnectionConfig(!showConnectionConfig)}>
              <Settings className="h-4 w-4 mr-2" />
              Connect
            </Button>
          </div>
        )}

        {showConnectionConfig && (
          <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex items-center justify-center">
            <div className="space-y-8 text-center max-w-md">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">ROS2 Dashboard</h1>
                <p className="text-muted-foreground mt-2">Real-time robotics data visualization</p>
              </div>
              <ConnectionConfig
                onConnect={(url) => {
                  setRosbridgeUrl(url)
                  setShowConnectionConfig(false)
                }}
                isConnected={status.connected}
              />
              <Button variant="ghost" onClick={() => setShowConnectionConfig(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className={isDemoMode ? "pt-12" : ""}>
          {widgets.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">No widgets added yet</p>
                <p className="text-sm text-muted-foreground">Click the + button next to a topic in the sidebar</p>
              </div>
            </div>
          ) : (
            <WidgetGrid
              widgets={widgets}
              onUpdateWidget={handleUpdateWidget}
              onRemoveWidget={handleRemoveWidget}
              subscribe={subscribe}
              isDemoMode={isDemoMode}
            >
              {(config, data) => getVisualizerForTopic(config, data)}
            </WidgetGrid>
          )}
        </div>
      </main>

      {/* Debug Console - Temporarily Disabled */}
      {/* <DebugConsole /> */}
    </div>
  )
}

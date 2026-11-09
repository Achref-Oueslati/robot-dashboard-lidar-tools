import { ImageViewer } from "./image-viewer"
import { CompressedImageViewer } from "./compressed-image-viewer"
import { IMUViewer } from "./imu-viewer"
import { Odometry2DViewer } from "./odometry-2d-viewer"
import { TwistViewer } from "./twist-viewer"
import { TwistStampedViewer } from "./twist-stamped-viewer"
import { JointStateViewer } from "./joint-state-viewer"
import { CameraInfoViewer } from "./camera-info-viewer"
import { PoseViewer } from "./pose-viewer"
import { DepthImageViewer } from "./depth-image-viewer"
import { CompressedDepthViewer } from "./compressed-depth-viewer"
import { PointCloud2DViewer } from "./point-cloud-2d-viewer"
import { PointCloudViewer } from "./point-cloud-viewer"
import { DepthToPointCloudViewer } from "./depth-to-pointcloud-viewer"
import { SystemMonitor } from "./system-monitor"
import { JSONViewer } from "./json-viewer"
import { LaserScanViewer } from "./laser-scan-viewer"
import { LaserScanOrbitViewer } from "./laser-scan-orbit-viewer"
import { LaserScanCombinedViewer } from "./laser-scan-combined-viewer"
import { OccupancyGridViewer } from "./occupancy-grid-viewer"
import type { WidgetConfig } from "@/lib/widget-types"

export function getVisualizerForTopic(config: WidgetConfig, data: any) {
  const messageType = config.topic.type
  const topicName = config.topic.name

  // Handle system monitor (special case)
  if (messageType === "system_monitor" || topicName === "__system_monitor__") {
    return <SystemMonitor />
  }

  if (messageType.includes("sensor_msgs") && messageType.includes("LaserScan")) {
    // Combined viewer with 2D and 3D orbit views
    return <LaserScanViewer data={data} />
  }

  if (messageType.includes("nav_msgs") && messageType.includes("OccupancyGrid")) {
    return <OccupancyGridViewer data={data} />
  }

  if (messageType.includes("sensor_msgs") && messageType.includes("Image") && !messageType.includes("Compressed")) {
    // Check if it's a depth image by encoding or topic name
    const encoding = data?.encoding || ""
    const isDepth = encoding.includes("16UC1") || encoding.includes("32FC1") || topicName.includes("/depth/")

    if (isDepth) {
      // For depth images, you can choose between:
      // 1. 2D depth visualization (default):
      // return <DepthImageViewer data={data} />
      // 2. 3D point cloud generated from depth:
     return <DepthToPointCloudViewer data={data} />
    }
    return <ImageViewer data={data} />
  }

  if (topicName.includes("/compressedDepth") || messageType.includes("CompressedDepth")) {
    return <CompressedDepthViewer data={data} />
  }

  if (messageType.includes("sensor_msgs") && messageType.includes("CompressedImage")) {
    return <CompressedImageViewer data={data} />
  }

  if (messageType.includes("sensor_msgs") && messageType.includes("Imu")) {
    return <IMUViewer data={data} />
  }

  if (messageType.includes("nav_msgs") && messageType.includes("Odometry")) {
    return <Odometry2DViewer data={data} />
  }

  if (messageType.includes("geometry_msgs") && (messageType.includes("Pose") || messageType.includes("Point"))) {
    return <PoseViewer data={data} />
  }

  if (messageType.includes("geometry_msgs") && messageType.includes("TwistStamped")) {
    return <TwistStampedViewer data={data} />
  }

  if (messageType.includes("geometry_msgs") && messageType.includes("Twist")) {
    return <TwistViewer data={data} />
  }

  if (messageType.includes("sensor_msgs") && messageType.includes("JointState")) {
    return <JointStateViewer data={data} />
  }

  if (messageType.includes("sensor_msgs") && messageType.includes("CameraInfo")) {
    return <CameraInfoViewer data={data} />
  }

  if (messageType.includes("sensor_msgs") && messageType.includes("PointCloud2")) {
    // Note: rosbridge has issues with large PointCloud2 messages
    // Using 2D viewer which handles compressed data better
    return <PointCloud2DViewer data={data} />
    // For 3D interactive visualization (if rosbridge supports it):
    // return <PointCloudViewer data={data} />
  }

  // Default to JSON viewer for unknown types
  return <JSONViewer data={data} />
}

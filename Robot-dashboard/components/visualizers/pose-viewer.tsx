"use client"

import { useEffect, useRef, useState } from "react"

interface PoseViewerProps {
  data: any
}

export function PoseViewer({ data }: PoseViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [points, setPoints] = useState<number[]>(new Array(1000).fill(Number.NaN))
  const [ptr, setPtr] = useState(0)
  const [bounds, setBounds] = useState({ xmin: -10, xmax: 10, ymin: -10, ymax: 10 })

  const quatToEuler = (q: any) => {
    const siny_cosp = 2 * (q.w * q.z + q.x * q.y)
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z)
    const yaw = Math.atan2(siny_cosp, cosy_cosp)
    return { yaw }
  }

  useEffect(() => {
    if (!data || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Extract position and orientation from different message types
    let x, y, orientation
    if (data.pose?.pose) {
      // PoseWithCovarianceStamped
      x = data.pose.pose.position.x
      y = data.pose.pose.position.y
      orientation = data.pose.pose.orientation
    } else if (data.pose) {
      // PoseStamped or PoseWithCovariance
      x = data.pose.position?.x || data.position?.x
      y = data.pose.position?.y || data.position?.y
      orientation = data.pose.orientation || data.orientation
    } else if (data.point) {
      // PointStamped
      x = data.point.x
      y = data.point.y
      orientation = null
    } else {
      // Pose or Point
      x = data.position?.x || data.x || 0
      y = data.position?.y || data.y || 0
      orientation = data.orientation
    }

    const angles = orientation ? quatToEuler(orientation) : null

    // Update trajectory
    const newPoints = [...points]
    newPoints[ptr] = x
    newPoints[ptr + 1] = y
    const newPtr = (ptr + 2) % 1000
    setPtr(newPtr)
    setPoints(newPoints)

    // Auto-center on first data
    if (ptr === 0) {
      setBounds({
        xmin: x - 20,
        xmax: x + 20,
        ymin: y - 20,
        ymax: y + 20,
      })
    }

    // Draw
    const size = 500
    const x2px = (xVal: number) => Math.floor(size * ((xVal - bounds.xmin) / (bounds.xmax - bounds.xmin)))
    const y2py = (yVal: number) => Math.floor(size * (1 - (yVal - bounds.ymin) / (bounds.ymax - bounds.ymin)))

    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "#18181b"
    ctx.fillRect(0, 0, size, size)

    // Grid
    ctx.lineWidth = 1
    ctx.strokeStyle = "#27272a"
    ctx.beginPath()
    for (let gx = Math.floor(bounds.xmin); gx <= Math.ceil(bounds.xmax); gx += 1) {
      ctx.moveTo(x2px(gx), y2py(bounds.ymin))
      ctx.lineTo(x2px(gx), y2py(bounds.ymax))
    }
    for (let gy = Math.floor(bounds.ymin); gy <= Math.ceil(bounds.ymax); gy += 1) {
      ctx.moveTo(x2px(bounds.xmin), y2py(gy))
      ctx.lineTo(x2px(bounds.xmax), y2py(gy))
    }
    ctx.stroke()

    // Trajectory
    ctx.strokeStyle = "#71717a"
    ctx.lineWidth = 1
    ctx.beginPath()
    let started = false
    const pointsSlice = newPoints.slice(newPtr, 1000).concat(newPoints.slice(0, newPtr))
    for (let i = 0; i < pointsSlice.length / 2; i++) {
      const px = pointsSlice[2 * i]
      const py = pointsSlice[2 * i + 1]
      if (!isNaN(px) && !isNaN(py)) {
        if (!started) {
          ctx.moveTo(x2px(px), y2py(py))
          started = true
        } else {
          ctx.lineTo(x2px(px), y2py(py))
        }
      }
    }
    ctx.stroke()

    // Current point
    ctx.fillStyle = "#3b82f6"
    ctx.fillRect(x2px(x) - 2, y2py(y) - 2, 5, 5)

    // Orientation arrow if available
    if (angles) {
      const yaw = angles.yaw
      const arrowLen = 2
      const arrowX = x + arrowLen * Math.cos(yaw)
      const arrowY = y + arrowLen * Math.sin(yaw)

      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x2px(x), y2py(y))
      ctx.lineTo(x2px(arrowX), y2py(arrowY))
      ctx.stroke()
    }
  }, [data, bounds, points, ptr])

  if (!data) {
    return <div className="text-sm text-muted-foreground">Waiting for pose data...</div>
  }

  return (
    <div className="w-full aspect-square bg-zinc-900 rounded relative overflow-hidden">
      <canvas ref={canvasRef} width={500} height={500} className="w-full h-full" />
    </div>
  )
}

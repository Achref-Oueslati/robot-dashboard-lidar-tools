"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"

interface Odometry2DViewerProps {
  data: any
}

export function Odometry2DViewer({ data }: Odometry2DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [points, setPoints] = useState<number[]>(new Array(1000).fill(Number.NaN))
  const [ptr, setPtr] = useState(0)
  const [bounds, setBounds] = useState({ xmin: -10, xmax: 10, ymin: -10, ymax: 10 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })

  const boundsRef = useRef(bounds)
  const pointsRef = useRef(points)
  const ptrRef = useRef(ptr)

  // Update refs when state changes
  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds])

  useEffect(() => {
    pointsRef.current = points
  }, [points])

  useEffect(() => {
    ptrRef.current = ptr
  }, [ptr])

  // Quaternion to Euler conversion
  const quatToEuler = (q: any) => {
    const sinr_cosp = 2 * (q.w * q.x + q.y * q.z)
    const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y)
    const roll = Math.atan2(sinr_cosp, cosr_cosp)

    let pitch
    const sinp = 2 * (q.w * q.y - q.z * q.x)
    if (Math.abs(sinp) >= 1) {
      pitch = sinp > 0 ? Math.PI / 2 : -Math.PI / 2
    } else {
      pitch = Math.asin(sinp)
    }

    const siny_cosp = 2 * (q.w * q.z + q.x * q.y)
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z)
    const yaw = Math.atan2(siny_cosp, cosy_cosp)

    return { roll, pitch, yaw }
  }

  useEffect(() => {
    if (!data || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Extract position and orientation
    const x = data.pose?.pose?.position?.x || 0
    const y = data.pose?.pose?.position?.y || 0
    const orientation = data.pose?.pose?.orientation
    const angles = orientation ? quatToEuler(orientation) : { yaw: 0 }

    // Update trajectory points using functional updates
    setPoints((prevPoints) => {
      const newPoints = [...prevPoints]
      newPoints[ptrRef.current] = x
      newPoints[ptrRef.current + 1] = y
      return newPoints
    })

    setPtr((prevPtr) => {
      const newPtr = (prevPtr + 2) % 1000

      // Auto-center view on first data
      if (prevPtr === 0) {
        setBounds({
          xmin: x - 20,
          xmax: x + 20,
          ymin: y - 20,
          ymax: y + 20,
        })
      }

      return newPtr
    })

    // Use current bounds from ref for drawing
    const currentBounds = boundsRef.current
    const currentPoints = pointsRef.current
    const currentPtr = ptrRef.current

    // Drawing functions
    const size = 500
    const x2px = (xVal: number) =>
      Math.floor(size * ((xVal - currentBounds.xmin) / (currentBounds.xmax - currentBounds.xmin)))
    const y2py = (yVal: number) =>
      Math.floor(size * (1 - (yVal - currentBounds.ymin) / (currentBounds.ymax - currentBounds.ymin)))

    // Clear canvas
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "#18181b"
    ctx.fillRect(0, 0, size, size)

    // Draw grid
    ctx.lineWidth = 1
    ctx.strokeStyle = "#27272a"
    ctx.beginPath()
    for (let gx = Math.floor(currentBounds.xmin); gx <= Math.ceil(currentBounds.xmax); gx += 1) {
      ctx.moveTo(x2px(gx), y2py(currentBounds.ymin))
      ctx.lineTo(x2px(gx), y2py(currentBounds.ymax))
    }
    for (let gy = Math.floor(currentBounds.ymin); gy <= Math.ceil(currentBounds.ymax); gy += 1) {
      ctx.moveTo(x2px(currentBounds.xmin), y2py(gy))
      ctx.lineTo(x2px(currentBounds.xmax), y2py(gy))
    }
    ctx.stroke()

    // Draw 5m grid
    ctx.strokeStyle = "#3f3f46"
    ctx.beginPath()
    for (let gx = Math.floor(currentBounds.xmin / 5) * 5; gx <= Math.ceil(currentBounds.xmax / 5) * 5; gx += 5) {
      ctx.moveTo(x2px(gx), y2py(currentBounds.ymin))
      ctx.lineTo(x2px(gx), y2py(currentBounds.ymax))
    }
    for (let gy = Math.floor(currentBounds.ymin / 5) * 5; gy <= Math.ceil(currentBounds.ymax / 5) * 5; gy += 5) {
      ctx.moveTo(x2px(currentBounds.xmin), y2py(gy))
      ctx.lineTo(x2px(currentBounds.xmax), y2py(gy))
    }
    ctx.stroke()

    // Draw axes
    ctx.lineWidth = 2
    ctx.strokeStyle = "#22c55e"
    ctx.beginPath()
    ctx.moveTo(x2px(0), y2py(0))
    ctx.lineTo(x2px(1), y2py(0))
    ctx.stroke()

    ctx.strokeStyle = "#ef4444"
    ctx.beginPath()
    ctx.moveTo(x2px(0), y2py(0))
    ctx.lineTo(x2px(0), y2py(1))
    ctx.stroke()

    // Draw trajectory path
    ctx.strokeStyle = "#71717a"
    ctx.lineWidth = 1
    ctx.beginPath()
    let started = false
    const pointsSlice = currentPoints.slice(currentPtr, 1000).concat(currentPoints.slice(0, currentPtr))
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

    // Draw current position
    ctx.fillStyle = "#f97316"
    ctx.fillRect(x2px(x) - 2, y2py(y) - 2, 5, 5)

    // Draw orientation arrow
    const yaw = angles.yaw
    const arrowLen = 2
    const arrowX = x + arrowLen * Math.cos(yaw)
    const arrowY = y + arrowLen * Math.sin(yaw)

    ctx.strokeStyle = "#f97316"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x2px(x), y2py(y))
    ctx.lineTo(x2px(arrowX), y2py(arrowY))
    ctx.stroke()

    // Arrow head
    const headLen = 0.5
    ctx.beginPath()
    ctx.moveTo(
      x2px(arrowX + headLen * Math.cos((13 * Math.PI) / 12 + yaw)),
      y2py(arrowY + headLen * Math.sin((13 * Math.PI) / 12 + yaw)),
    )
    ctx.lineTo(x2px(arrowX), y2py(arrowY))
    ctx.lineTo(
      x2px(arrowX + headLen * Math.cos((-13 * Math.PI) / 12 + yaw)),
      y2py(arrowY + headLen * Math.sin((-13 * Math.PI) / 12 + yaw)),
    )
    ctx.stroke()
  }, [data])

  // Pan and zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.25 : 0.8

    setBounds((prevBounds) => {
      const xcenter = (prevBounds.xmin + prevBounds.xmax) / 2
      const ycenter = (prevBounds.ymin + prevBounds.ymax) / 2
      const xspan = prevBounds.xmax - prevBounds.xmin
      const yspan = prevBounds.ymax - prevBounds.ymin

      return {
        xmin: xcenter - (xspan / 2) * factor,
        xmax: xcenter + (xspan / 2) * factor,
        ymin: ycenter - (yspan / 2) * factor,
        ymax: ycenter + (yspan / 2) * factor,
      }
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setLastPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const deltax = e.clientX - lastPos.x
    const deltay = e.clientY - lastPos.y

    setBounds((prevBounds) => {
      const panX = (-deltax * (prevBounds.xmax - prevBounds.xmin)) / 500
      const panY = (deltay * (prevBounds.ymax - prevBounds.ymin)) / 500

      return {
        xmin: prevBounds.xmin + panX,
        xmax: prevBounds.xmax + panX,
        ymin: prevBounds.ymin + panY,
        ymax: prevBounds.ymax + panY,
      }
    })

    setLastPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Waiting for odometry data...</div>
  }

  return (
    <div className="w-full aspect-square bg-zinc-900 rounded relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className="w-full h-full cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute bottom-2 left-2 text-xs text-zinc-400 bg-black/30 px-2 py-1 rounded">
        Drag to pan • Scroll to zoom
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RotateCcw, ZoomIn, ZoomOut, Move3D } from "lucide-react"

interface LaserScanOrbitViewerProps {
  data: any
}

interface OrbitControls {
  azimuth: number    // Horizontal rotation (0-360°)
  elevation: number  // Vertical rotation (-90° to 90°)
  distance: number   // Zoom distance
  centerX: number    // Pan X
  centerY: number    // Pan Y
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  lastAzimuth: number
  lastElevation: number
}

export function LaserScanOrbitViewer({ data }: LaserScanOrbitViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const [scanPoints, setScanPoints] = useState<Array<{ x: number; y: number; intensity?: number }>>([])
  const [controls, setControls] = useState<OrbitControls>({
    azimuth: 0,        // Start from top-down view
    elevation: -45,    // Slight 3D angle
    distance: 1.0,
    centerX: 0,
    centerY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    lastAzimuth: 0,
    lastElevation: -45
  })

  // Convert LaserScan to cartesian points
  useEffect(() => {
    if (!data?.ranges) return

    const points: Array<{ x: number; y: number; intensity?: number }> = []
    const ranges = data.ranges
    const angleMin = data.angle_min || 0
    const angleIncrement = data.angle_increment || (Math.PI / 180) // 1 degree default
    const rangeMax = data.range_max || 10

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      
      // Skip invalid ranges
      if (range <= 0 || range > rangeMax || !isFinite(range)) continue
      
      const angle = angleMin + i * angleIncrement
      const x = range * Math.cos(angle)
      const y = range * Math.sin(angle)
      
      // Add intensity if available
      const intensity = data.intensities?.[i] || 1.0
      
      points.push({ x, y, intensity })
    }

    setScanPoints(points)
  }, [data])

  // 3D transformation functions
  const transformPoint = useCallback((x: number, y: number, z: number = 0) => {
    const { azimuth, elevation, distance, centerX, centerY } = controls
    
    // Convert to radians
    const azRad = (azimuth * Math.PI) / 180
    const elRad = (elevation * Math.PI) / 180
    
    // Apply 3D rotation (azimuth around Z, elevation around X)
    // First rotate around Z-axis (azimuth)
    const x1 = x * Math.cos(azRad) - y * Math.sin(azRad)
    const y1 = x * Math.sin(azRad) + y * Math.cos(azRad)
    const z1 = z
    
    // Then rotate around X-axis (elevation)
    const x2 = x1
    const y2 = y1 * Math.cos(elRad) - z1 * Math.sin(elRad)
    const z2 = y1 * Math.sin(elRad) + z1 * Math.cos(elRad)
    
    // Apply perspective projection
    const scale = distance
    const perspectiveFactor = 1 / (1 + z2 * 0.1) // Subtle perspective
    
    return {
      x: (x2 * scale * perspectiveFactor) + centerX,
      y: (y2 * scale * perspectiveFactor) + centerY,
      z: z2
    }
  }, [controls])

  // Render the scan
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || scanPoints.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    // Find bounds for auto-scaling
    const transformedPoints = scanPoints.map(p => transformPoint(p.x, p.y, 0))
    const xs = transformedPoints.map(p => p.x)
    const ys = transformedPoints.map(p => p.y)
    
    if (xs.length === 0) return
    
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const maxRange = Math.max(rangeX, rangeY)
    
    // Scale and center
    const scale = Math.min(width, height) * 0.4 / maxRange
    const offsetX = width / 2
    const offsetY = height / 2

    // Draw grid
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1
    
    // Grid lines
    const gridSize = 1 // 1 meter grid
    const gridLines = 20
    
    for (let i = -gridLines; i <= gridLines; i++) {
      // Vertical lines
      const startV = transformPoint(i * gridSize, -gridLines * gridSize, 0)
      const endV = transformPoint(i * gridSize, gridLines * gridSize, 0)
      
      ctx.beginPath()
      ctx.moveTo(startV.x * scale + offsetX, startV.y * scale + offsetY)
      ctx.lineTo(endV.x * scale + offsetX, endV.y * scale + offsetY)
      ctx.stroke()
      
      // Horizontal lines
      const startH = transformPoint(-gridLines * gridSize, i * gridSize, 0)
      const endH = transformPoint(gridLines * gridSize, i * gridSize, 0)
      
      ctx.beginPath()
      ctx.moveTo(startH.x * scale + offsetX, startH.y * scale + offsetY)
      ctx.lineTo(endH.x * scale + offsetX, endH.y * scale + offsetY)
      ctx.stroke()
    }

    // Draw coordinate axes
    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 2
    
    // X axis (red)
    const xAxis = transformPoint(2, 0, 0)
    const origin = transformPoint(0, 0, 0)
    ctx.beginPath()
    ctx.moveTo(origin.x * scale + offsetX, origin.y * scale + offsetY)
    ctx.lineTo(xAxis.x * scale + offsetX, xAxis.y * scale + offsetY)
    ctx.stroke()
    
    // Y axis (green)
    ctx.strokeStyle = '#00ff00'
    const yAxis = transformPoint(0, 2, 0)
    ctx.beginPath()
    ctx.moveTo(origin.x * scale + offsetX, origin.y * scale + offsetY)
    ctx.lineTo(yAxis.x * scale + offsetX, yAxis.y * scale + offsetY)
    ctx.stroke()

    // Draw robot center
    ctx.fillStyle = '#00ffff'
    ctx.beginPath()
    ctx.arc(origin.x * scale + offsetX, origin.y * scale + offsetY, 4, 0, 2 * Math.PI)
    ctx.fill()

    // Draw scan points
    transformedPoints.forEach((point, i) => {
      const intensity = scanPoints[i].intensity || 1.0
      const alpha = Math.max(0.3, Math.min(1.0, intensity))
      
      // Color based on distance from origin
      const distance = Math.sqrt(scanPoints[i].x ** 2 + scanPoints[i].y ** 2)
      const hue = Math.max(0, Math.min(240, 240 - distance * 20)) // Blue to red
      
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`
      
      const screenX = point.x * scale + offsetX
      const screenY = point.y * scale + offsetY
      
      // Point size based on z-depth (perspective)
      const pointSize = Math.max(1, 3 - point.z * 0.5)
      
      ctx.beginPath()
      ctx.arc(screenX, screenY, pointSize, 0, 2 * Math.PI)
      ctx.fill()
    })

    // Draw view info
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.fillText(`Azimuth: ${controls.azimuth.toFixed(1)}°`, 10, 20)
    ctx.fillText(`Elevation: ${controls.elevation.toFixed(1)}°`, 10, 35)
    ctx.fillText(`Zoom: ${(1/controls.distance).toFixed(2)}x`, 10, 50)
    ctx.fillText(`Points: ${scanPoints.length}`, 10, 65)

  }, [scanPoints, controls, transformPoint])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render()
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  // Mouse controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault() // Prevent middle-click scroll
    
    setControls(prev => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX,
      dragStartY: e.clientY,
      lastAzimuth: prev.azimuth,
      lastElevation: prev.elevation
    }))
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!controls.isDragging) return

    const deltaX = e.clientX - controls.dragStartX
    const deltaY = e.clientY - controls.dragStartY

    if (e.buttons === 1) { // Left mouse button - rotate
      setControls(prev => ({
        ...prev,
        azimuth: prev.lastAzimuth + deltaX * 0.5,
        elevation: Math.max(-89, Math.min(89, prev.lastElevation - deltaY * 0.5))
      }))
    } else if (e.buttons === 4 || e.buttons === 2) { // Middle or right mouse button - pan
      setControls(prev => ({
        ...prev,
        centerX: prev.centerX + deltaX * 2,
        centerY: prev.centerY + deltaY * 2
      }))
    }
  }

  const handleMouseUp = () => {
    setControls(prev => ({ ...prev, isDragging: false }))
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
    
    setControls(prev => ({
      ...prev,
      distance: Math.max(0.1, Math.min(5.0, prev.distance * zoomFactor))
    }))
  }

  const resetView = () => {
    setControls(prev => ({
      ...prev,
      azimuth: 0,
      elevation: -45,
      distance: 1.0,
      centerX: 0,
      centerY: 0
    }))
  }

  const setTopView = () => {
    setControls(prev => ({ ...prev, elevation: -89, azimuth: 0 }))
  }

  const setSideView = () => {
    setControls(prev => ({ ...prev, elevation: 0, azimuth: 0 }))
  }

  const setIsometricView = () => {
    setControls(prev => ({ ...prev, elevation: -35, azimuth: 45 }))
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Laser Scan - Orbit View</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={setTopView} title="Top View">
              Top
            </Button>
            <Button variant="ghost" size="sm" onClick={setSideView} title="Side View">
              Side
            </Button>
            <Button variant="ghost" size="sm" onClick={setIsometricView} title="Isometric View">
              3D
            </Button>
            <Button variant="ghost" size="sm" onClick={resetView} title="Reset View">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Left drag: rotate • Middle/Right drag: pan • Scroll: zoom
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4">
        <div className="relative w-full h-full">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full border rounded bg-black cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
          
          {scanPoints.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">
                Waiting for laser scan data...
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
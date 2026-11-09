"use client"

import { useEffect, useRef, useState } from "react"

interface OccupancyGridViewerProps {
  data: any
}

export function OccupancyGridViewer({ data }: OccupancyGridViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>()
  const [mapInfo, setMapInfo] = useState<{
    width: number
    height: number
    resolution: number
    origin: { x: number; y: number; orientation: number }
  } | null>(null)
  const [viewBounds, setViewBounds] = useState({ 
    xmin: -10, 
    xmax: 10, 
    ymin: -10, 
    ymax: 10 
  })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [showInfo, setShowInfo] = useState(true)

  // Convert base64 to Uint8Array
  const base64decode = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  // Pan the view
  const pan = (deltax: number, deltay: number) => {
    setViewBounds(prev => ({
      xmin: prev.xmin + deltax,
      xmax: prev.xmax + deltax,
      ymin: prev.ymin + deltay,
      ymax: prev.ymax + deltay
    }))
  }

  // Zoom the view
  const zoom = (factor: number, centerX?: number, centerY?: number) => {
    setViewBounds(prev => {
      if (((prev.xmax - prev.xmin) > 1000 || (prev.ymax - prev.ymin) > 1000) && factor > 1) return prev
      if (((prev.xmax - prev.xmin) < 0.1 || (prev.ymax - prev.ymin) < 0.1) && factor < 1) return prev
      
      const xcenter = centerX ?? (prev.xmin + prev.xmax) / 2
      const ycenter = centerY ?? (prev.ymin + prev.ymax) / 2
      const xspan = prev.xmax - prev.xmin
      const yspan = prev.ymax - prev.ymin
      
      return {
        xmin: xcenter - (xspan / 2) * factor,
        xmax: xcenter + (xspan / 2) * factor,
        ymin: ycenter - (yspan / 2) * factor,
        ymax: ycenter + (yspan / 2) * factor
      }
    })
  }

  // Handle mouse events for panning
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 0) { // Left mouse button
      setIsDragging(true)
      setLastMousePos({ x: event.clientX, y: event.clientY })
    }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && mapInfo) {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const deltax = event.clientX - lastMousePos.x
      const deltay = event.clientY - lastMousePos.y
      pan(
        (-deltax * (viewBounds.xmax - viewBounds.xmin)) / canvas.width,
        (deltay * (viewBounds.ymax - viewBounds.ymin)) / canvas.height
      )
      setLastMousePos({ x: event.clientX, y: event.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Handle scroll for zooming
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const zoomFactor = event.deltaY > 0 ? 1.25 : 0.8
    zoom(zoomFactor)
  }

  // Fit the map to view
  const fitToView = () => {
    if (!mapInfo) return
    
    const mapWorldWidth = mapInfo.width * mapInfo.resolution
    const mapWorldHeight = mapInfo.height * mapInfo.resolution
    const padding = Math.max(mapWorldWidth, mapWorldHeight) * 0.1
    
    setViewBounds({
      xmin: mapInfo.origin.x - padding,
      xmax: mapInfo.origin.x + mapWorldWidth + padding,
      ymin: mapInfo.origin.y - padding,
      ymax: mapInfo.origin.y + mapWorldHeight + padding
    })
  }

  // Draw the occupancy grid
  const draw = (gridData: Uint8Array, info: typeof mapInfo) => {
    const canvas = canvasRef.current
    if (!canvas || !info) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const canvasSize = 600
    canvas.width = canvasSize
    canvas.height = canvasSize

    // Clear background
    ctx.fillStyle = "#2a2a2a"
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Calculate world coordinates for the map
    const mapWorldWidth = info.width * info.resolution
    const mapWorldHeight = info.height * info.resolution

    // Coordinate conversion functions
    const worldToCanvas = (worldX: number, worldY: number) => {
      const canvasX = ((worldX - viewBounds.xmin) / (viewBounds.xmax - viewBounds.xmin)) * canvasSize
      const canvasY = (1 - (worldY - viewBounds.ymin) / (viewBounds.ymax - viewBounds.ymin)) * canvasSize
      return { x: canvasX, y: canvasY }
    }

    // Create image data for the occupancy grid
    const imageData = ctx.createImageData(info.width, info.height)
    const pixels = imageData.data

    for (let i = 0; i < gridData.length; i++) {
      const pixelIndex = i * 4
      let value = gridData[i]
      
      // Convert occupancy grid values to grayscale
      // -1 (255) = unknown = gray (128)
      // 0 = free = white (255)
      // 100 = occupied = black (0)
      let gray: number
      if (value === 255) { // Unknown (-1 in signed, 255 in unsigned)
        gray = 128 // Gray for unknown
      } else if (value === 0) {
        gray = 255 // White for free space
      } else {
        gray = Math.max(0, 255 - (value * 255 / 100)) // Scale occupied space
      }

      pixels[pixelIndex] = gray     // Red
      pixels[pixelIndex + 1] = gray // Green  
      pixels[pixelIndex + 2] = gray // Blue
      pixels[pixelIndex + 3] = 255  // Alpha
    }

    // Create a temporary canvas to draw the image data
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = info.width
    tempCanvas.height = info.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCtx.putImageData(imageData, 0, 0)

    // Calculate where to draw the map on the main canvas
    const topLeft = worldToCanvas(info.origin.x, info.origin.y + mapWorldHeight)
    const bottomRight = worldToCanvas(info.origin.x + mapWorldWidth, info.origin.y)

    const drawWidth = bottomRight.x - topLeft.x
    const drawHeight = bottomRight.y - topLeft.y

    // Only draw if the map is visible
    if (topLeft.x < canvasSize && topLeft.y < canvasSize && 
        bottomRight.x > 0 && bottomRight.y > 0) {
      ctx.save()
      ctx.imageSmoothingEnabled = false // Keep crisp pixels
      ctx.drawImage(tempCanvas, topLeft.x, topLeft.y, drawWidth, drawHeight)
      ctx.restore()
    }

    // Draw coordinate frame at origin
    const origin = worldToCanvas(0, 0)
    if (origin.x >= 0 && origin.x <= canvasSize && origin.y >= 0 && origin.y <= canvasSize) {
      const axisLength = 20 // pixels
      
      // X axis (red)
      ctx.strokeStyle = "#ff0000"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(origin.x, origin.y)
      ctx.lineTo(origin.x + axisLength, origin.y)
      ctx.stroke()
      
      // Y axis (green)
      ctx.strokeStyle = "#00ff00"
      ctx.beginPath()
      ctx.moveTo(origin.x, origin.y)
      ctx.lineTo(origin.x, origin.y - axisLength)
      ctx.stroke()
    }

    // Draw map origin frame
    const mapOrigin = worldToCanvas(info.origin.x, info.origin.y)
    if (mapOrigin.x >= 0 && mapOrigin.x <= canvasSize && mapOrigin.y >= 0 && mapOrigin.y <= canvasSize) {
      ctx.strokeStyle = "#00ffff"
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.strokeRect(mapOrigin.x - 2, mapOrigin.y - 2, 4, 4)
      ctx.setLineDash([])
    }

    // Draw grid if zoomed in enough
    const cellSize = (info.resolution * canvasSize) / (viewBounds.xmax - viewBounds.xmin)
    if (cellSize > 10) {
      ctx.strokeStyle = "#555"
      ctx.lineWidth = 0.5
      ctx.setLineDash([1, 2])
      
      for (let x = Math.floor(viewBounds.xmin / info.resolution) * info.resolution; 
           x <= viewBounds.xmax; 
           x += info.resolution) {
        const canvasX = worldToCanvas(x, 0).x
        if (canvasX >= 0 && canvasX <= canvasSize) {
          ctx.beginPath()
          ctx.moveTo(canvasX, 0)
          ctx.lineTo(canvasX, canvasSize)
          ctx.stroke()
        }
      }
      
      for (let y = Math.floor(viewBounds.ymin / info.resolution) * info.resolution; 
           y <= viewBounds.ymax; 
           y += info.resolution) {
        const canvasY = worldToCanvas(0, y).y
        if (canvasY >= 0 && canvasY <= canvasSize) {
          ctx.beginPath()
          ctx.moveTo(0, canvasY)
          ctx.lineTo(canvasSize, canvasY)
          ctx.stroke()
        }
      }
      ctx.setLineDash([])
    }
  }

  useEffect(() => {
    if (!data || !canvasRef.current) return

    try {
      // Extract map info
      const info = data.info || data
      const mapData = {
        width: info.width,
        height: info.height,
        resolution: info.resolution,
        origin: {
          x: info.origin.position.x,
          y: info.origin.position.y,
          orientation: info.origin.orientation.z
        }
      }

      setMapInfo(mapData)

      // Decode map data
      let gridData: Uint8Array
      if (typeof data.data === 'string') {
        gridData = base64decode(data.data)
      } else if (data.data instanceof Uint8Array) {
        gridData = data.data
      } else if (Array.isArray(data.data)) {
        gridData = new Uint8Array(data.data)
      } else {
        throw new Error("Unsupported data format")
      }

      // Auto-fit view on first load
      if (viewBounds.xmin === -10 && viewBounds.xmax === 10) {
        const mapWorldWidth = mapData.width * mapData.resolution
        const mapWorldHeight = mapData.height * mapData.resolution
        const padding = Math.max(mapWorldWidth, mapWorldHeight) * 0.1
        
        setViewBounds({
          xmin: mapData.origin.x - padding,
          xmax: mapData.origin.x + mapWorldWidth + padding,
          ymin: mapData.origin.y - padding,
          ymax: mapData.origin.y + mapWorldHeight + padding
        })
      } else {
        draw(gridData, mapData)
      }

      setError(undefined)
    } catch (err) {
      console.error("OccupancyGrid error:", err)
      setError(err instanceof Error ? err.message : "Failed to process occupancy grid")
    }
  }, [data, viewBounds])

  if (error) {
    return (
      <div className="text-sm p-4 space-y-2">
        <div className="text-destructive">Error: {error}</div>
        <div className="text-xs text-muted-foreground">Check console for details</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-muted-foreground">
          {mapInfo ? `${mapInfo.width}×${mapInfo.height} (${mapInfo.resolution.toFixed(3)}m/cell)` : "No data"}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
          >
            Info
          </button>
          <button
            onClick={fitToView}
            className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
          >
            Fit
          </button>
        </div>
      </div>
      
      {showInfo && mapInfo && (
        <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/30 rounded space-y-1">
          <div>Resolution: {mapInfo.resolution.toFixed(3)} m/cell</div>
          <div>Origin: ({mapInfo.origin.x.toFixed(2)}, {mapInfo.origin.y.toFixed(2)})</div>
          <div>Size: {(mapInfo.width * mapInfo.resolution).toFixed(1)}×{(mapInfo.height * mapInfo.resolution).toFixed(1)} m</div>
        </div>
      )}
      
      <div className="flex items-center justify-center bg-muted/30 rounded">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        />
      </div>
      
      <div className="text-xs text-muted-foreground px-2 space-y-1">
        <div>White: Free space • Black: Obstacles • Gray: Unknown</div>
        <div>Drag to pan • Scroll to zoom • Red/Green: World origin • Cyan: Map origin</div>
      </div>
    </div>
  )
}
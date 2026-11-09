import { useEffect, useRef, useState } from "react"


// LaserScan message type (partial, extend as needed)
interface LaserScanMsg {
  angle_min: number;
  angle_max: number;
  ranges: number[];
  range_min?: number;
  range_max?: number;
  __comp?: boolean;
  _ranges_uint16?: {
    bounds: [number, number];
    points: string;
  };
  [key: string]: any;
}

interface LaserScanViewerProps {
  data: LaserScanMsg | null;
}

interface LaserScanFramePoint {
  timestamp: number;
  frameIndex: number;
  pointIndex: number;
  angleDeg: number;
  range: number | "";
  x: number | "";
  y: number | "";
}

interface ScanStats {
  totalPoints: number
  validPoints: number
  invalidPoints: number
  minRange: number
  maxRange: number
  avgRange: number
}

export function LaserScanViewer({ data }: LaserScanViewerProps) {
  // Mode state: 'live' or 'replay'
  const [mode, setMode] = useState<'live' | 'replay'>('live')
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedFrames, setRecordedFrames] = useState<LaserScanFramePoint[][]>([])
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Removed unused error state
  const [highlightedPoint, setHighlightedPoint] = useState<[number, number, number] | null>(null) // [x, y, range]
  const [viewBounds, setViewBounds] = useState({ 
    xmin: -10, 
    xmax: 10, 
    ymin: -10, 
    ymax: 10 
  })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [lastPoints, setLastPoints] = useState<Float32Array | null>(null)
  const [scanStats, setScanStats] = useState<ScanStats | null>(null)
  const [colorMode, setColorMode] = useState<'uniform' | 'range' | 'intensity'>('range')
  const [showConsole, setShowConsole] = useState(false)
  const [consoleRows, setConsoleRows] = useState(100) // Limit table rows for performance

  // Replay state
  const [replayFrames, setReplayFrames] = useState<LaserScanFramePoint[][]>([])
  const [isReplaying, setIsReplaying] = useState(false)
  const [replayIndex, setReplayIndex] = useState(0)
  const replayIntervalRef = useRef<number | null>(null)

  // CSV upload handler
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
      if (lines.length < 2) {
  // error state removed: CSV file is empty or invalid
        return
      }
      // Expect CSV format: timestamp,frameIndex,pointIndex,angleDeg,range,x,y
      const frames: LaserScanFramePoint[][] = []
      let currentFrame: LaserScanFramePoint[] = []
      let lastFrameIndex = -1
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',')
        if (row.length < 7) continue
        const frameIndex = parseInt(row[1])
        const point: LaserScanFramePoint = {
          timestamp: parseInt(row[0]),
          frameIndex,
          pointIndex: parseInt(row[2]),
          angleDeg: parseFloat(row[3]),
          range: row[4] === '' ? NaN : parseFloat(row[4]),
          x: row[5] === '' ? NaN : parseFloat(row[5]),
          y: row[6] === '' ? NaN : parseFloat(row[6]),
        }
        if (frameIndex !== lastFrameIndex) {
          if (currentFrame.length > 0) frames.push(currentFrame)
          currentFrame = []
          lastFrameIndex = frameIndex
        }
        currentFrame.push(point)
      }
      if (currentFrame.length > 0) frames.push(currentFrame)
      setReplayFrames(frames)
      setReplayIndex(0)
      setIsReplaying(false)
  // error state removed
    }
    reader.readAsText(file)
  }

  // Start replay
  const startReplay = () => {
    if (replayFrames.length === 0) return
    setIsReplaying(true)
    setReplayIndex(0)
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current)
    replayIntervalRef.current = setInterval(() => {
      setReplayIndex(idx => {
        if (idx + 1 >= replayFrames.length) {
          setIsReplaying(false)
          if (replayIntervalRef.current) clearInterval(replayIntervalRef.current)
          return idx
        }
        return idx + 1
      })
    }, 100) // 10 FPS
  }

  // Stop replay
  const stopReplay = () => {
    setIsReplaying(false)
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current)
  }

  // Render replay frame
  useEffect(() => {
    if (mode !== 'replay' || !isReplaying || replayFrames.length === 0) return
    const frame = replayFrames[replayIndex]
    if (!frame || frame.length === 0) return
    // Convert frame points to Float32Array for drawing
    const points = new Float32Array(frame.length * 3)
    let minRange = Infinity, maxRange = -Infinity, totalRange = 0, validCount = 0
    for (let i = 0; i < frame.length; i++) {
      let { x, y, range } = frame[i]
      // Convert empty string to NaN for calculations
      x = typeof x === 'number' ? x : NaN
      y = typeof y === 'number' ? y : NaN
      range = typeof range === 'number' ? range : NaN
      points[3 * i] = x
      points[3 * i + 1] = y
      points[3 * i + 2] = range
      if (!isNaN(range)) {
        minRange = Math.min(minRange, range)
        maxRange = Math.max(maxRange, range)
        totalRange += range
        validCount++
      }
    }
    setLastPoints(points)
    setScanStats({
      totalPoints: frame.length,
      validPoints: validCount,
      invalidPoints: frame.length - validCount,
      minRange: validCount > 0 ? minRange : 0,
      maxRange: validCount > 0 ? maxRange : 0,
      avgRange: validCount > 0 ? totalRange / validCount : 0
    })
    // Draw replay frame on canvas
    if (!showConsole && canvasRef.current) {
      draw(points)
    }
  }, [isReplaying, replayIndex, replayFrames, mode, showConsole])

  // Convert base64 to ArrayBuffer
  const base64decode = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  // Decode compressed laser scan data (rosbridge format) with enhanced stats
  const decodeCompressed = (msg: any): { points: Float32Array, stats: ScanStats } => {
    const rbounds = msg._ranges_uint16.bounds
    const rdata = base64decode(msg._ranges_uint16.points)
    const rview = new DataView(rdata)
    const numRanges = rdata.byteLength / 2 // uint16

    const points = new Float32Array(numRanges * 3) // x, y, range
    const angleIncr = (msg.angle_max - msg.angle_min) / numRanges
    const rrange = rbounds[1] - rbounds[0]
    const rmin = rbounds[0]

    let validCount = 0
    let invalidCount = 0
    let minRange = Infinity
    let maxRange = -Infinity
    let totalRange = 0

    for (let i = 0; i < numRanges; i++) {
      const offset = i * 2
      const angle = msg.angle_min + i * angleIncr
      const rUint16 = rview.getUint16(offset, true)

      if (rUint16 === 65535) {
        points[3 * i] = NaN
        points[3 * i + 1] = NaN
        points[3 * i + 2] = NaN
        invalidCount++
        continue // nan, -inf, inf mapped to 65535
      }

      const r = (rUint16 / 65534) * rrange + rmin // valid values mapped to 0-65534
      points[3 * i] = r * Math.cos(angle)      // x
      points[3 * i + 1] = r * Math.sin(angle)  // y
      points[3 * i + 2] = r                    // range
      
      validCount++
      minRange = Math.min(minRange, r)
      maxRange = Math.max(maxRange, r)
      totalRange += r
    }

    const stats: ScanStats = {
      totalPoints: numRanges,
      validPoints: validCount,
      invalidPoints: invalidCount,
      minRange: validCount > 0 ? minRange : 0,
      maxRange: validCount > 0 ? maxRange : 0,
      avgRange: validCount > 0 ? totalRange / validCount : 0
    }

    return { points, stats }
  }

  // Decode uncompressed laser scan data with enhanced stats
  const decodeUncompressed = (msg: any): { points: Float32Array, stats: ScanStats } => {
    const angleIncr = (msg.angle_max - msg.angle_min) / msg.ranges.length
    const points = new Float32Array(msg.ranges.length * 3) // x, y, range
    
    let validCount = 0
    let invalidCount = 0
    let minRange = Infinity
    let maxRange = -Infinity
    let totalRange = 0

    for (let i = 0; i < msg.ranges.length; i++) {
      const angle = msg.angle_min + i * angleIncr
      const range = msg.ranges[i]
      
      // Handle different types of invalid readings from your SDK
      const isValid = isFinite(range) && 
                     range >= (msg.range_min || 0.1) && 
                     range <= (msg.range_max || 40.0) && // <-- Accepts up to 40m
                     range > 0.05 // Filter out very close readings that might be noise

      if (isValid) {
        points[3 * i] = range * Math.cos(angle)      // x
        points[3 * i + 1] = range * Math.sin(angle)  // y
        points[3 * i + 2] = range                    // range for coloring
        
        validCount++
        minRange = Math.min(minRange, range)
        maxRange = Math.max(maxRange, range)
        totalRange += range
      } else {
        // Mark invalid points
        points[3 * i] = NaN
        points[3 * i + 1] = NaN
        points[3 * i + 2] = NaN
        invalidCount++
      }
    }

    const stats: ScanStats = {
      totalPoints: msg.ranges.length,
      validPoints: validCount,
      invalidPoints: invalidCount,
      minRange: validCount > 0 ? minRange : 0,
      maxRange: validCount > 0 ? maxRange : 0,
      avgRange: validCount > 0 ? totalRange / validCount : 0
    }

    return { points, stats }
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
      if (((prev.xmax - prev.xmin) > 500 || (prev.ymax - prev.ymin) > 500) && factor > 1) return prev
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

  // Handle canvas click to highlight nearest point
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!lastPoints || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * (viewBounds.xmax - viewBounds.xmin) + viewBounds.xmin
    const y = (1 - (event.clientY - rect.top) / rect.height) * (viewBounds.ymax - viewBounds.ymin) + viewBounds.ymin

    let closestx = -1.0
    let closesty = -1.0
    let closestRange = -1.0
    let closestDist = 1e12

    for (let i = 0; i < lastPoints.length / 3; i++) {
      const pointx = lastPoints[3 * i]
      const pointy = lastPoints[3 * i + 1]
      const range = lastPoints[3 * i + 2]
      if (isNaN(pointx) || isNaN(pointy)) continue
      
      const dist = (pointx - x) ** 2 + (pointy - y) ** 2
      if (dist < closestDist) {
        closestDist = dist
        closestx = pointx
        closesty = pointy
        closestRange = range
      }
    }

    if (closestDist < 2.0) {
      setHighlightedPoint([closestx, closesty, closestRange])
    } else {
      setHighlightedPoint(null)
    }
  }

  // Handle mouse events for panning
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 0) { // Left mouse button
      setIsDragging(true)
      setLastMousePos({ x: event.clientX, y: event.clientY })
    }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const deltax = event.clientX - lastMousePos.x
      const deltay = event.clientY - lastMousePos.y
      pan(
        (-deltax * (viewBounds.xmax - viewBounds.xmin)) / 500,
        (deltay * (viewBounds.ymax - viewBounds.ymin)) / 500
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

  // Touch event support for mobile
  const touchState = useRef<{ x: number; y: number; dragging: boolean; pinchDist: number | null }>({ x: 0, y: 0, dragging: false, pinchDist: null })

  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      touchState.current.dragging = true
      touchState.current.x = touch.clientX
      touchState.current.y = touch.clientY
    } else if (event.touches.length === 2) {
      // Pinch start
      const t0 = event.touches[0]
      const t1 = event.touches[1]
      const dx = t1.clientX - t0.clientX
      const dy = t1.clientY - t0.clientY
      touchState.current.pinchDist = Math.sqrt(dx * dx + dy * dy)
    }
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 1 && touchState.current.dragging) {
      const touch = event.touches[0]
      const deltax = touch.clientX - touchState.current.x
      const deltay = touch.clientY - touchState.current.y
      pan(
        (-deltax * (viewBounds.xmax - viewBounds.xmin)) / 500,
        (deltay * (viewBounds.ymax - viewBounds.ymin)) / 500
      )
      touchState.current.x = touch.clientX
      touchState.current.y = touch.clientY
    } else if (event.touches.length === 2 && touchState.current.pinchDist !== null) {
      // Pinch zoom
      const t0 = event.touches[0]
      const t1 = event.touches[1]
      const dx = t1.clientX - t0.clientX
      const dy = t1.clientY - t0.clientY
      const newDist = Math.sqrt(dx * dx + dy * dy)
      const factor = touchState.current.pinchDist ? newDist / touchState.current.pinchDist : 1
      zoom(1 / factor)
      touchState.current.pinchDist = newDist
    }
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 0) {
      // Tap to highlight
      if (touchState.current.dragging) {
        touchState.current.dragging = false
      } else if (event.changedTouches.length === 1) {
        // Simulate click for highlight
        const touch = event.changedTouches[0]
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect()
          const x = ((touch.clientX - rect.left) / rect.width) * (viewBounds.xmax - viewBounds.xmin) + viewBounds.xmin
          const y = (1 - (touch.clientY - rect.top) / rect.height) * (viewBounds.ymax - viewBounds.ymin) + viewBounds.ymin
          let closestx = -1.0
          let closesty = -1.0
          let closestRange = -1.0
          let closestDist = 1e12
          if (lastPoints) {
            for (let i = 0; i < lastPoints.length / 3; i++) {
              const pointx = lastPoints[3 * i]
              const pointy = lastPoints[3 * i + 1]
              const range = lastPoints[3 * i + 2]
              if (isNaN(pointx) || isNaN(pointy)) continue
              const dist = (pointx - x) ** 2 + (pointy - y) ** 2
              if (dist < closestDist) {
                closestDist = dist
                closestx = pointx
                closesty = pointy
                closestRange = range
              }
            }
            if (closestDist < 2.0) {
              setHighlightedPoint([closestx, closesty, closestRange])
            } else {
              setHighlightedPoint(null)
            }
          }
        }
      }
      touchState.current.pinchDist = null
    }
  }

  // Color helper for range-based coloring
  const getRangeColor = (range: number, minRange: number, maxRange: number): string => {
    if (colorMode === 'uniform') return "#e0e0e0"
    
    const normalized = (range - minRange) / (maxRange - minRange)
    
    if (colorMode === 'range') {
      // Blue (close) to Red (far)
      const r = Math.floor(255 * normalized)
      const b = Math.floor(255 * (1 - normalized))
      return `rgb(${r}, 100, ${b})`
    }
    
    return "#e0e0e0" // fallback
  }

  // Draw the laser scan visualization
  const draw = (points: Float32Array) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 500
    canvas.width = size
    canvas.height = size

    // Coordinate conversion functions
    const x2px = (x: number) => Math.floor(size * ((x - viewBounds.xmin) / (viewBounds.xmax - viewBounds.xmin)))
    const y2py = (y: number) => Math.floor(size * (1 - (y - viewBounds.ymin) / (viewBounds.ymax - viewBounds.ymin)))

    // Clear and fill background
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "#1a1a1a"
    ctx.fillRect(0, 0, size, size)

    // Draw grid
    if (viewBounds.xmax - viewBounds.xmin < 50) {
      ctx.lineWidth = 1
      ctx.strokeStyle = "#333"
      ctx.beginPath()

      for (let x = Math.floor(viewBounds.xmin); x <= Math.ceil(viewBounds.xmax + 0.001); x += 1) {
        ctx.moveTo(x2px(x), y2py(viewBounds.ymin))
        ctx.lineTo(x2px(x), y2py(viewBounds.ymax))
      }

      for (let y = Math.floor(viewBounds.ymin); y <= Math.ceil(viewBounds.ymax + 0.001); y += 1) {
        ctx.moveTo(x2px(viewBounds.xmin), y2py(y))
        ctx.lineTo(x2px(viewBounds.xmax), y2py(y))
      }

      ctx.stroke()
    }

    // Draw 5-unit grid
    ctx.lineWidth = 1
    ctx.strokeStyle = "#555"
    ctx.beginPath()

    for (let x = Math.floor(viewBounds.xmin / 5) * 5; x <= Math.ceil(viewBounds.xmax / 5 + 0.001) * 5; x += 5) {
      ctx.moveTo(x2px(x), y2py(viewBounds.ymin))
      ctx.lineTo(x2px(x), y2py(viewBounds.ymax))
    }

    for (let y = Math.floor(viewBounds.ymin / 5) * 5; y <= Math.ceil(viewBounds.ymax / 5 + 0.001) * 5; y += 5) {
      ctx.moveTo(x2px(viewBounds.xmin), y2py(y))
      ctx.lineTo(x2px(viewBounds.xmax), y2py(y))
    }
    ctx.stroke()

    // Draw axes (X = red, Y = green)
    ctx.lineWidth = 2
    ctx.strokeStyle = "#00f060"
    ctx.beginPath()
    ctx.moveTo(x2px(0), y2py(0))
    ctx.lineTo(x2px(0), y2py(1))
    ctx.stroke()

    ctx.strokeStyle = "#f06060"
    ctx.beginPath()
    ctx.moveTo(x2px(0), y2py(0))
    ctx.lineTo(x2px(1), y2py(0))
    ctx.stroke()

    // Draw laser range circles (for reference)
    if (scanStats && viewBounds.xmax - viewBounds.xmin < 30) {
      ctx.strokeStyle = "#333"
      ctx.lineWidth = 1
      const ranges = [1, 2, 5, 10, 20, 30, 40]
      ranges.forEach(range => {
        if (range <= scanStats.maxRange) {
          ctx.beginPath()
          const centerX = x2px(0)
          const centerY = y2py(0)
          const radius = (range / (viewBounds.xmax - viewBounds.xmin)) * size
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
          ctx.stroke()
        }
      })
    }

    // Draw laser scan points with range-based coloring
    const minRange = scanStats?.minRange || 0.1
    const maxRange = scanStats?.maxRange || 40

    for (let i = 0; i < points.length / 3; i++) {
      const x = points[3 * i]
      const y = points[3 * i + 1]
      const range = points[3 * i + 2]
      
      const isValid = !isNaN(x) && !isNaN(y) && !isNaN(range)
      
      const px = x2px(x) - 1
      const py = y2py(y) - 1
      if (px < -1 || px > size + 1 || py < -1 || py > size + 1) continue
      
      if (isValid) {
        ctx.fillStyle = getRangeColor(range, minRange, maxRange)
        ctx.fillRect(px, py, 3, 3)
      }
    }

    // Draw highlighted point with range info
    if (highlightedPoint) {
      ctx.fillStyle = "#ff5000"
      const px = x2px(highlightedPoint[0]) - 2
      const py = y2py(highlightedPoint[1]) - 2
      ctx.fillRect(px, py, 5, 5)
      
      ctx.fillStyle = "#ff5000"
      ctx.font = "12px monospace"
      const range = highlightedPoint[2]
      ctx.fillText(
        ` (${highlightedPoint[0].toFixed(2)}, ${highlightedPoint[1].toFixed(2)}) r=${range.toFixed(2)}m`,
        x2px(highlightedPoint[0]),
        y2py(highlightedPoint[1]) - 5
      )
    }

    // Draw LIDAR center point
    ctx.fillStyle = "#00ff00"
    const centerPx = x2px(0) - 2
    const centerPy = y2py(0) - 2
    ctx.fillRect(centerPx, centerPy, 4, 4)
  }

  useEffect(() => {
    if (mode !== 'live' || !data) return

    try {
      let result: { points: Float32Array, stats: ScanStats }

      if (data.__comp) {
        result = decodeCompressed(data)
      } else {
        result = decodeUncompressed(data)
      }

      setLastPoints(result.points)
      setScanStats(result.stats)
  // error state removed
      if (!showConsole && canvasRef.current) {
        draw(result.points)
      }

      // Recording logic
      if (isRecording) {
        const timestamp = Date.now()
        const frameIndex = recordedFrames.length
        const angleMin = data?.angle_min || 0
        const angleMax = data?.angle_max || Math.PI * 2
        const numPoints = result.points.length / 3
        const angleIncr = numPoints > 0 ? (angleMax - angleMin) / numPoints : 0
        const framePoints: LaserScanFramePoint[] = []
        for (let i = 0; i < numPoints; i++) {
          const x = result.points[3 * i]
          const y = result.points[3 * i + 1]
          const r = result.points[3 * i + 2]
          const angleRad = angleMin + i * angleIncr
          const angleDeg = (angleRad * 180) / Math.PI
          framePoints.push({
            timestamp,
            frameIndex,
            pointIndex: i,
            angleDeg,
            range: isNaN(r) ? "" : r,
            x: isNaN(x) ? "" : x,
            y: isNaN(y) ? "" : y,
          })
        }
        setRecordedFrames(prev => [...prev, framePoints])
        if (!recordStartTime) setRecordStartTime(timestamp)
      }
    } catch (err) {
      console.error("LaserScan error:", err)
  // error state removed
    }
  }, [data, viewBounds, highlightedPoint, colorMode, showConsole, isRecording, mode])

  // Always render widget UI, even if no scan data
  return (
    <div className="space-y-2 h-full w-full flex flex-col">
      {/* Mode toggle and Recording & Replay controls */}
      <div className="flex gap-2 items-center px-2 py-1">
        {/* ...existing code... */}
        <div className="flex gap-1">
          <button
            aria-label="Show live scan data"
            className={`px-2 py-1 rounded text-xs ${mode === 'live' ? 'bg-green-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
            onClick={() => setMode('live')}
          >
            Live
          </button>
          <button
            aria-label="Show replayed CSV data"
            className={`px-2 py-1 rounded text-xs ${mode === 'replay' ? 'bg-orange-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
            onClick={() => setMode('replay')}
            disabled={replayFrames.length === 0}
          >
            Replay
          </button>
        </div>
        {/* ...existing code... */}
        <button
          aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          className={`px-2 py-1 rounded text-xs ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
          onClick={() => {
            if (!isRecording) {
              setRecordedFrames([])
              setRecordStartTime(null)
            }
            setIsRecording(r => !r)
          }}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        <button
          aria-label="Export scan data as CSV"
          className="px-2 py-1 rounded text-xs bg-blue-500 text-white disabled:opacity-50"
          disabled={recordedFrames.length === 0}
          onClick={() => {
            // ...existing code...
            const allPoints = recordedFrames.flat()
            const header = ['timestamp','frameIndex','pointIndex','angleDeg','range','x','y']
            const rows = [header.join(",")]
            allPoints.forEach(pt => {
              rows.push([
                pt.timestamp,
                pt.frameIndex,
                pt.pointIndex,
                pt.angleDeg,
                pt.range,
                pt.x,
                pt.y
              ].join(","))
            })
            const csvContent = rows.join("\n")
            const blob = new Blob([csvContent], { type: "text/csv" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `scan_converted_export_${recordStartTime || Date.now()}.csv`
            document.body.appendChild(a)
            a.click()
            setTimeout(() => {
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }, 100)
          }}
        >
          Export CSV
        </button>
        {/* ...existing code... */}
        <label className="px-2 py-1 rounded text-xs bg-gray-600 hover:bg-gray-500 cursor-pointer">
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCSVUpload}
            aria-label="Upload CSV for replay"
          />
          Upload CSV
        </label>
        <button
          aria-label="Replay CSV"
          className={`px-2 py-1 rounded text-xs ${isReplaying ? 'bg-orange-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
          disabled={replayFrames.length === 0 || isReplaying}
          onClick={startReplay}
        >
          Replay
        </button>
        <button
          aria-label="Stop Replay"
          className={`px-2 py-1 rounded text-xs ${isReplaying ? 'bg-red-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
          disabled={!isReplaying}
          onClick={stopReplay}
        >
          Stop
        </button>
        {isReplaying && (
          <span className="text-xs text-orange-500">Replaying... ({replayIndex + 1}/{replayFrames.length})</span>
        )}
        {!isReplaying && replayFrames.length > 0 && (
          <span className="text-xs text-green-500">Ready to replay {replayFrames.length} frames</span>
        )}
      </div>
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between px-2 text-xs">
        <div style={{ color: '#888' }}>
          {scanStats ? (
            <div className="space-y-1">
              <div>Points: {scanStats.validPoints}/{scanStats.totalPoints} valid</div>
              <div>Range: {scanStats.minRange.toFixed(2)}m - {scanStats.maxRange.toFixed(2)}m (avg: {scanStats.avgRange.toFixed(2)}m)</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-lg text-muted-foreground py-8">
              <span className="font-semibold">Waiting for scan data...</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-col">
          {/* ...existing code... */}
          <div className="flex gap-1">
            <button
              aria-label="Reset view to default bounds"
              onClick={() => setViewBounds({ xmin: -10, xmax: 10, ymin: -10, ymax: 10 })}
              className="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500"
            >
              Reset View
            </button>
          </div>
          <div className="flex gap-1">
            <button
              aria-label="Set color mode to uniform"
              onClick={() => setColorMode('uniform')}
              className={`px-2 py-1 text-xs rounded ${colorMode === 'uniform' ? 'bg-blue-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              Uniform
            </button>
            <button
              aria-label="Set color mode to range"
              onClick={() => setColorMode('range')}
              className={`px-2 py-1 text-xs rounded ${colorMode === 'range' ? 'bg-blue-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              Range Color
            </button>
          </div>
          <div className="flex gap-1">
            <button
              aria-label={showConsole ? 'Hide Conversion Console' : 'Show Conversion Console'}
              onClick={() => setShowConsole(!showConsole)}
              className={`px-2 py-1 text-xs rounded ${showConsole ? 'bg-orange-500 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              {showConsole ? 'Hide Console' : 'Show Console'}
            </button>
          </div>
        </div>
      </div>

      {/* Main view: canvas or conversion console */}
      {!showConsole ? (
        <div className="flex-1 flex items-center justify-center rounded w-full h-full min-h-[300px]" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full max-w-full max-h-full cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: isDragging ? "grabbing" : "crosshair" }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-black text-xs p-2 rounded overflow-auto w-full h-full min-h-[300px]">
          <div className="font-bold text-orange-400 mb-2">Raw LaserScan Data</div>
          <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto mb-2 text-white" style={{ maxHeight: 200 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
          <div className="font-bold text-orange-400 mb-2">Parsed Points (index, angle°, range, x, y)</div>
          <div className="overflow-auto flex-1 w-full" style={{ maxHeight: '100%' }}>
            <table className="table-auto w-full text-xs">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-2">#</th>
                  <th className="px-2">Angle (°)</th>
                  <th className="px-2">Range (m)</th>
                  <th className="px-2">x</th>
                  <th className="px-2">y</th>
                </tr>
              </thead>
              <tbody>
                {lastPoints && scanStats && (() => {
                  const points = []
                  const numPoints = lastPoints.length / 3
                  const angleMin = data?.angle_min || 0
                  const angleMax = data?.angle_max || Math.PI * 2
                  const angleIncr = numPoints > 0 ? (angleMax - angleMin) / numPoints : 0
                  const maxRows = Math.min(consoleRows, numPoints)
                  for (let i = 0; i < maxRows; i++) {
                    const x = lastPoints[3 * i]
                    const y = lastPoints[3 * i + 1]
                    const r = lastPoints[3 * i + 2]
                    const angleRad = angleMin + i * angleIncr
                    const angleDeg = (angleRad * 180) / Math.PI
                    points.push(
                      <tr key={i} className="bg-gray-900 text-white">
                        <td className="px-2">{i}</td>
                        <td className="px-2">{angleDeg.toFixed(1)}</td>
                        <td className="px-2">{isNaN(r) ? "-" : r.toFixed(2)}</td>
                        <td className="px-2">{isNaN(x) ? "-" : x.toFixed(2)}</td>
                        <td className="px-2">{isNaN(y) ? "-" : y.toFixed(2)}</td>
                      </tr>
                    )
                  }
                  return points
                })()}
              </tbody>
            </table>
            {lastPoints && lastPoints.length / 3 > consoleRows && (
              <div className="flex justify-center mt-2">
                <button
                  aria-label="Show more scan points in console"
                  className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 text-xs"
                  onClick={() => setConsoleRows(consoleRows + 100)}
                >
                  Show More
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer with instructions */}
      <div className="text-xs px-2 space-y-1" style={{ color: '#888' }}>
        {!showConsole ? (
          <>
            <div>
              <span>Click to highlight points</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <span>Drag to pan</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <span>Scroll to zoom</span>
            </div>
            {scanStats && scanStats.invalidPoints > 0 && (
              <div style={{ color: '#f59e0b' }}>
                {scanStats.invalidPoints} invalid readings detected (typical for RPLIDAR at max range)
              </div>
            )}
            <div>
              <span style={{ color: '#00ff00' }}>●</span> <span>LIDAR center</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <span style={{ color: '#f06060' }}>━</span> <span>X-axis (forward, <span style={{ color: '#f06060' }}>red</span>)</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <span style={{ color: '#00f060' }}>┃</span> <span>Y-axis (left, <span style={{ color: '#00f060' }}>green</span>)</span>
            </div>
          </>
        ) : (
          <div style={{ color: '#f59e0b' }}>Live conversion: Each scan frame is parsed and shown above.</div>
        )}
      </div>
    </div>
  )
}
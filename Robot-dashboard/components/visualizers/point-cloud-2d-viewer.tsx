"use client"

import { useEffect, useRef, useState } from "react"

interface PointCloud2DViewerProps {
  data: any
}

export function PointCloud2DViewer({ data }: PointCloud2DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>()
  const [pointCount, setPointCount] = useState(0)
  const [view, setView] = useState<"top" | "front" | "side">("top")

  useEffect(() => {
    console.log("[v0] PointCloud2DViewer data received:", {
      hasData: !!data,
      hasComp: !!data?.__comp,
      hasDataUint16: !!data?._data_uint16,
      dataKeys: data ? Object.keys(data) : [],
    })

    if (!data || !canvasRef.current) return

    const processPointCloud = () => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        canvas.width = 600
        canvas.height = 400

        ctx.fillStyle = "#000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        let points: Float32Array

        if (data.__comp && data._data_uint16) {
          console.log("[v0] Decoding compressed point cloud (rosboard format)")

          const bounds = data._data_uint16.bounds
          const pointsBase64 = data._data_uint16.points

          // Decode base64 to bytes
          const binaryString = atob(pointsBase64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }

          const view = new DataView(bytes.buffer)
          const numPoints = Math.floor(bytes.length / 6) // 3 uint16s per point

          points = new Float32Array(numPoints * 3)

          const xrange = bounds[1] - bounds[0]
          const xmin = bounds[0]
          const yrange = bounds[3] - bounds[2]
          const ymin = bounds[2]
          const zrange = bounds[5] - bounds[4]
          const zmin = bounds[4]

          for (let i = 0; i < numPoints; i++) {
            const offset = i * 6
            points[3 * i] = (view.getUint16(offset, true) / 65535) * xrange + xmin
            points[3 * i + 1] = (view.getUint16(offset + 2, true) / 65535) * yrange + ymin
            points[3 * i + 2] = (view.getUint16(offset + 4, true) / 65535) * zrange + zmin
          }

          console.log("[v0] Decoded", numPoints, "compressed points")
        } else {
          console.log("[v0] Decoding uncompressed point cloud")

          if (!data.data || !data.fields) {
            throw new Error("Missing data or fields in point cloud")
          }

          let bytes: Uint8Array
          if (typeof data.data === "string") {
            const binaryString = atob(data.data)
            bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
          } else if (data.data instanceof Uint8Array) {
            bytes = data.data
          } else if (Array.isArray(data.data)) {
            bytes = new Uint8Array(data.data)
          } else {
            throw new Error("Unsupported data format")
          }

          const xField = data.fields.find((f: any) => f.name === "x")
          const yField = data.fields.find((f: any) => f.name === "y")
          const zField = data.fields.find((f: any) => f.name === "z")

          if (!xField || !yField || !zField) {
            throw new Error("Missing x, y, or z fields")
          }

          const pointStep = data.point_step || 16
          const numPoints = Math.floor(bytes.length / pointStep)

          points = new Float32Array(numPoints * 3)
          let validCount = 0

          for (let i = 0; i < numPoints; i++) {
            const offset = i * pointStep
            const x = new DataView(bytes.buffer, bytes.byteOffset + offset + xField.offset, 4).getFloat32(0, true)
            const y = new DataView(bytes.buffer, bytes.byteOffset + offset + yField.offset, 4).getFloat32(0, true)
            const z = new DataView(bytes.buffer, bytes.byteOffset + offset + zField.offset, 4).getFloat32(0, true)

            if (isFinite(x) && isFinite(y) && isFinite(z)) {
              points[validCount * 3] = x
              points[validCount * 3 + 1] = y
              points[validCount * 3 + 2] = z
              validCount++
            }
          }

          points = points.slice(0, validCount * 3)
          console.log("[v0] Decoded", validCount, "uncompressed points")
        }

        if (points.length === 0) {
          throw new Error("No valid points found")
        }

        let minX = Number.POSITIVE_INFINITY,
          maxX = Number.NEGATIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY,
          maxY = Number.NEGATIVE_INFINITY
        let minZ = Number.POSITIVE_INFINITY,
          maxZ = Number.NEGATIVE_INFINITY

        for (let i = 0; i < points.length; i += 3) {
          minX = Math.min(minX, points[i])
          maxX = Math.max(maxX, points[i])
          minY = Math.min(minY, points[i + 1])
          maxY = Math.max(maxY, points[i + 1])
          minZ = Math.min(minZ, points[i + 2])
          maxZ = Math.max(maxZ, points[i + 2])
        }

        const padding = 40
        const drawWidth = canvas.width - padding * 2
        const drawHeight = canvas.height - padding * 2

        const sampleRate = Math.max(1, Math.floor(points.length / 3 / 5000))

        for (let i = 0; i < points.length; i += 3 * sampleRate) {
          const x = points[i]
          const y = points[i + 1]
          const z = points[i + 2]

          let screenX, screenY, colorValue

          if (view === "top") {
            screenX = ((x - minX) / (maxX - minX)) * drawWidth + padding
            screenY = ((y - minY) / (maxY - minY)) * drawHeight + padding
            colorValue = (z - minZ) / (maxZ - minZ)
          } else if (view === "front") {
            screenX = ((x - minX) / (maxX - minX)) * drawWidth + padding
            screenY = canvas.height - (((z - minZ) / (maxZ - minZ)) * drawHeight + padding)
            colorValue = (y - minY) / (maxY - minY)
          } else {
            screenX = ((y - minY) / (maxY - minY)) * drawWidth + padding
            screenY = canvas.height - (((z - minZ) / (maxZ - minZ)) * drawHeight + padding)
            colorValue = (x - minX) / (maxX - minX)
          }

          const r = Math.floor(colorValue * 255)
          const g = Math.floor((1 - Math.abs(colorValue - 0.5) * 2) * 255)
          const b = Math.floor((1 - colorValue) * 255)
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillRect(screenX, screenY, 2, 2)
        }

        ctx.fillStyle = "#888"
        ctx.font = "12px monospace"
        if (view === "top") {
          ctx.fillText("X →", canvas.width - 30, canvas.height - 10)
          ctx.fillText("Y ↑", 10, 20)
        } else if (view === "front") {
          ctx.fillText("X →", canvas.width - 30, canvas.height - 10)
          ctx.fillText("Z ↑", 10, 20)
        } else {
          ctx.fillText("Y →", canvas.width - 30, canvas.height - 10)
          ctx.fillText("Z ↑", 10, 20)
        }

        setPointCount(points.length / 3)
        setError(undefined)
      } catch (err) {
        console.error("[v0] PointCloud error:", err)
        setError(err instanceof Error ? err.message : "Failed to process point cloud")
        setPointCount(0)
      }
    }

    processPointCloud()
  }, [data, view])

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
        <div className="text-xs text-muted-foreground">{pointCount.toLocaleString()} points</div>
        <div className="flex gap-1">
          <button
            onClick={() => setView("top")}
            className={`px-2 py-1 text-xs rounded ${
              view === "top" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Top
          </button>
          <button
            onClick={() => setView("front")}
            className={`px-2 py-1 text-xs rounded ${
              view === "front" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Front
          </button>
          <button
            onClick={() => setView("side")}
            className={`px-2 py-1 text-xs rounded ${
              view === "side" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Side
          </button>
        </div>
      </div>
      <div className="flex items-center justify-center bg-muted/30 rounded">
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>
    </div>
  )
}

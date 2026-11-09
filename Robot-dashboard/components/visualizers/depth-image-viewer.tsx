"use client"

import { useEffect, useRef, useState } from "react"

interface DepthImageViewerProps {
  data: any
}

export function DepthImageViewer({ data }: DepthImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>()
  const [stats, setStats] = useState<{ min: number; max: number; encoding: string }>()

  useEffect(() => {
    if (!data || !canvasRef.current) return

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      console.log("[v0] Depth image data received:", {
        width: data.width,
        height: data.height,
        encoding: data.encoding,
        dataLength: data.data?.length,
        dataType: typeof data.data,
        hasComp: !!data.__comp,
        hasDataJpeg: !!data._data_jpeg,
        is_bigendian: data.is_bigendian,
        step: data.step,
      })

      const { width, height, encoding, data: imageData } = data

      canvas.width = width
      canvas.height = height

      const imgData = ctx.createImageData(width, height)
      let minDepth = Number.POSITIVE_INFINITY
      let maxDepth = Number.NEGATIVE_INFINITY

      if (encoding === "16UC1") {
        // Convert byte array to 16-bit values
        let depthValues: Uint16Array
        
        if (typeof imageData === "string") {
          // Base64 decoded data from rosbridge
          console.log("[v0] Decoding base64 depth data, length:", imageData.length)
          const binaryString = atob(imageData)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          console.log("[v0] Converted to bytes, length:", bytes.length)
          depthValues = new Uint16Array(bytes.buffer)
        } else if (imageData instanceof ArrayBuffer) {
          depthValues = new Uint16Array(imageData)
        } else if (Array.isArray(imageData)) {
          const bytes = new Uint8Array(imageData)
          depthValues = new Uint16Array(bytes.buffer)
        } else {
          throw new Error("Unsupported depth image data format")
        }

        console.log("[v0] Depth values array length:", depthValues.length, "Expected:", width * height)
        console.log("[v0] First 10 depth values:", Array.from(depthValues.slice(0, 10)))

        // Find min/max for normalization (sample a subset for performance)
        const sampleSize = Math.min(10000, depthValues.length)
        const step = Math.floor(depthValues.length / sampleSize)
        
        for (let i = 0; i < depthValues.length; i += step) {
          const depth = depthValues[i]
          if (depth > 0) {
            // Ignore zero values (invalid depth)
            minDepth = Math.min(minDepth, depth)
            maxDepth = Math.max(maxDepth, depth)
          }
        }

        console.log("[v0] Depth range:", { minDepth, maxDepth })

        // Apply color mapping
        for (let i = 0; i < width * height; i++) {
          const depth = depthValues[i]
          let color = 0

          if (depth > 0 && maxDepth > minDepth) {
            // Normalize to 0-1 range (inverted so closer is brighter)
            const normalized = (depth - minDepth) / (maxDepth - minDepth)
            color = Math.floor((1 - normalized) * 255) // Invert: closer = brighter
          }

          // Apply color map (blue to red gradient for depth)
          const ratio = color / 255
          imgData.data[i * 4] = Math.floor(ratio * 255) // R - closer objects more red
          imgData.data[i * 4 + 1] = Math.floor((1 - Math.abs(ratio - 0.5) * 2) * 255) // G - mid range green
          imgData.data[i * 4 + 2] = Math.floor((1 - ratio) * 255) // B - farther objects more blue
          imgData.data[i * 4 + 3] = depth > 0 ? 255 : 0 // A (transparent for invalid)
        }
      } else if (encoding === "32FC1") {
        let depthValues: Float32Array
        
        if (typeof imageData === "string") {
          // Base64 decoded data
          const binaryString = atob(imageData)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          depthValues = new Float32Array(bytes.buffer)
        } else if (imageData instanceof ArrayBuffer) {
          depthValues = new Float32Array(imageData)
        } else if (Array.isArray(imageData)) {
          const bytes = new Uint8Array(imageData)
          depthValues = new Float32Array(bytes.buffer)
        } else {
          throw new Error("Unsupported depth image data format")
        }

        // Find min/max for normalization
        for (let i = 0; i < depthValues.length; i++) {
          const depth = depthValues[i]
          if (depth > 0 && isFinite(depth)) {
            minDepth = Math.min(minDepth, depth)
            maxDepth = Math.max(maxDepth, depth)
          }
        }

        // Apply color mapping
        for (let i = 0; i < width * height; i++) {
          const depth = depthValues[i]
          let color = 0

          if (depth > 0 && isFinite(depth) && maxDepth > minDepth) {
            const normalized = 1 - (depth - minDepth) / (maxDepth - minDepth)
            color = Math.floor(normalized * 255)
          }

          // Apply color map
          const ratio = color / 255
          imgData.data[i * 4] = Math.floor(ratio * 255)
          imgData.data[i * 4 + 1] = Math.floor((1 - Math.abs(ratio - 0.5) * 2) * 255)
          imgData.data[i * 4 + 2] = Math.floor((1 - ratio) * 255)
          imgData.data[i * 4 + 3] = depth > 0 && isFinite(depth) ? 255 : 0
        }
      } else {
        throw new Error(`Unsupported depth encoding: ${encoding}`)
      }

      ctx.putImageData(imgData, 0, 0)
      setStats({ min: minDepth, max: maxDepth, encoding })
      setError(undefined)
    } catch (err) {
      console.error("[v0] Depth image error:", err)
      setError(err instanceof Error ? err.message : "Failed to render depth image")
    }
  }, [data])

  if (error) {
    return (
      <div className="p-4 space-y-2">
        <div className="text-sm text-destructive">Error: {error}</div>
        <div className="text-xs text-muted-foreground">Encoding: {data?.encoding || "unknown"}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center bg-muted/30 rounded">
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>
      {stats && (
        <div className="text-xs text-muted-foreground px-2">
          Depth range: {stats.min.toFixed(0)} - {stats.max.toFixed(0)} ({stats.encoding})
        </div>
      )}
    </div>
  )
}

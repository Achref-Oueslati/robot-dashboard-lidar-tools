"use client"

import { useEffect, useRef, useState } from "react"

interface ImageViewerProps {
  data: any
}

export function ImageViewer({ data }: ImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>()
  const lastUpdateTime = useRef<number>(0)
  const isProcessing = useRef<boolean>(false)

  useEffect(() => {
    if (!data || !canvasRef.current) return

    // ZERO throttling for real-time performance - process every single frame immediately
    // Skip if already processing (most important to prevent queue buildup)
    if (isProcessing.current) {
      return
    }
    isProcessing.current = true

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d", { 
      alpha: false,           // No transparency for better performance
      desynchronized: true,   // Allow async rendering for smoother updates
      willReadFrequently: false // Optimize for writing, not reading
    })
    if (!ctx) {
      isProcessing.current = false
      return
    }

    try {
      const { width, height, encoding, data: imageData } = data

      canvas.width = width
      canvas.height = height

      // ZERO-DELAY processing - no animation frame queue, direct rendering
      try {
        // Disable image smoothing for maximum performance
        ctx.imageSmoothingEnabled = false
        
        const imgData = ctx.createImageData(width, height)

        // Ultra-optimized pixel processing with typed arrays and direct buffer access
        if (encoding === "rgb8") {
          const src = new Uint8Array(imageData)
          const dst = new Uint8Array(imgData.data.buffer)
          
          // Unrolled loop for maximum speed - process 4 pixels at once when possible
          const pixelCount = width * height
          let i = 0, srcIdx = 0, dstIdx = 0
          
          // Process in chunks of 4 for better CPU cache usage
          for (; i < pixelCount - 3; i += 4, srcIdx += 12, dstIdx += 16) {
            // Pixel 1
            dst[dstIdx] = src[srcIdx]
            dst[dstIdx + 1] = src[srcIdx + 1]
            dst[dstIdx + 2] = src[srcIdx + 2]
            dst[dstIdx + 3] = 255
            // Pixel 2
            dst[dstIdx + 4] = src[srcIdx + 3]
            dst[dstIdx + 5] = src[srcIdx + 4]
            dst[dstIdx + 6] = src[srcIdx + 5]
            dst[dstIdx + 7] = 255
            // Pixel 3
            dst[dstIdx + 8] = src[srcIdx + 6]
            dst[dstIdx + 9] = src[srcIdx + 7]
            dst[dstIdx + 10] = src[srcIdx + 8]
            dst[dstIdx + 11] = 255
            // Pixel 4
            dst[dstIdx + 12] = src[srcIdx + 9]
            dst[dstIdx + 13] = src[srcIdx + 10]
            dst[dstIdx + 14] = src[srcIdx + 11]
            dst[dstIdx + 15] = 255
          }
          // Process remaining pixels
          for (; i < pixelCount; i++, srcIdx += 3, dstIdx += 4) {
            dst[dstIdx] = src[srcIdx]
            dst[dstIdx + 1] = src[srcIdx + 1]
            dst[dstIdx + 2] = src[srcIdx + 2]
            dst[dstIdx + 3] = 255
          }
        } else if (encoding === "bgr8") {
          const src = new Uint8Array(imageData)
          const dst = new Uint8Array(imgData.data.buffer)
          
          for (let i = 0, srcIdx = 0, dstIdx = 0; i < width * height; i++, srcIdx += 3, dstIdx += 4) {
            dst[dstIdx] = src[srcIdx + 2]     // R
            dst[dstIdx + 1] = src[srcIdx + 1] // G
            dst[dstIdx + 2] = src[srcIdx]     // B
            dst[dstIdx + 3] = 255             // A
          }
        } else if (encoding === "mono8") {
          const src = new Uint8Array(imageData)
          const dst = new Uint8Array(imgData.data.buffer)
          
          for (let i = 0, dstIdx = 0; i < width * height; i++, dstIdx += 4) {
            const gray = src[i]
            dst[dstIdx] = gray     // R
            dst[dstIdx + 1] = gray // G
            dst[dstIdx + 2] = gray // B
            dst[dstIdx + 3] = 255  // A
          }
        }

        ctx.putImageData(imgData, 0, 0)
        setError(undefined)
      } catch (renderError) {
        setError("Failed to render image")
      }
      isProcessing.current = false
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image")
      isProcessing.current = false
    }
  }, [data])

  if (error) {
    return <div className="text-sm text-destructive">Error: {error}</div>
  }

  return (
    <div className="flex items-center justify-center bg-muted/30 rounded">
      <canvas ref={canvasRef} className="max-w-full h-auto" />
    </div>
  )
}

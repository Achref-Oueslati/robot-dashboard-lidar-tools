"use client"

import { useEffect, useRef, useState } from "react"

interface CompressedImageViewerProps {
  data: any
}

export function CompressedImageViewer({ data }: CompressedImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>()
  const lastUpdateTime = useRef<number>(0)
  const currentUrl = useRef<string | null>(null)
  const isProcessing = useRef<boolean>(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!data?.data || !canvasRef.current) return

    // Zero throttling for maximum real-time performance - process every frame
    const now = performance.now()
    
    // Skip if already processing to prevent queue buildup (most important for real-time)
    if (isProcessing.current) {
      return
    }
    isProcessing.current = true

    // Clean up previous URL immediately
    if (currentUrl.current) {
      URL.revokeObjectURL(currentUrl.current)
      currentUrl.current = null
    }

    try {
      // Ultra-fast blob creation for compressed images
      let blob: Blob
      
      if (typeof data.data === "string") {
        // Optimized Base64 conversion
        const binaryString = atob(data.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        blob = new Blob([bytes], { type: `image/${data.format || "jpeg"}` })
      } else {
        // Already binary data - direct blob creation
        blob = new Blob([data.data], { type: `image/${data.format || "jpeg"}` })
      }

      const url = URL.createObjectURL(blob)
      currentUrl.current = url

      // Create Image only on client side
      if (!imageRef.current && typeof window !== 'undefined') {
        imageRef.current = new Image()
      }
      
      const img = imageRef.current
      if (!img) {
        isProcessing.current = false
        return
      }
      
      const cleanup = () => {
        URL.revokeObjectURL(url)
        currentUrl.current = null
        isProcessing.current = false
      }

      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) {
          cleanup()
          return
        }
        
        // ZERO-DELAY rendering - direct canvas update without animation frame queue
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d", { 
          alpha: false,           // No transparency for better performance
          desynchronized: true,   // Allow async rendering for smoother updates
          willReadFrequently: false // Optimize for writing, not reading
        })
        if (ctx) {
          // Ultra-fast rendering - no smoothing, direct draw
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(img, 0, 0)
        }
        cleanup()
        setError(undefined)
      }
      
      img.onerror = () => {
        setError("Failed to decode image")
        cleanup()
      }
      
      img.src = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load image")
      isProcessing.current = false
    }

  }, [data])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentUrl.current) {
        URL.revokeObjectURL(currentUrl.current)
        currentUrl.current = null
      }
    }
  }, [])

  if (error) {
    return <div className="text-sm text-destructive">Error: {error}</div>
  }

  return (
    <div className="flex items-center justify-center bg-muted/30 rounded">
      <canvas ref={canvasRef} className="max-w-full h-auto rounded" />
    </div>
  )
}

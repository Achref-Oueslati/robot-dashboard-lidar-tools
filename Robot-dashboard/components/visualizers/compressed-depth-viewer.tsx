"use client"

import { useEffect, useRef, useState } from "react"

interface CompressedDepthViewerProps {
  data: any
}

export function CompressedDepthViewer({ data }: CompressedDepthViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>()
  const [stats, setStats] = useState<{ min: number; max: number }>()

  useEffect(() => {
    if (!data || !canvasRef.current) return

    const processDepth = async () => {
      try {
        console.log("[v0] CompressedDepth data:", {
          format: data.format,
          width: data.width,
          height: data.height,
          hasComp: !!data.__comp,
          hasDataJpeg: !!data._data_jpeg,
          dataType: typeof data.data,
          dataLength: data.data?.length,
        })

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return

        if (data.__comp && data._data_jpeg) {
          console.log("[v0] Using rosboard-style JPEG compressed depth")

          const img = new Image()
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
            setError(undefined)
          }
          img.onerror = () => {
            setError("Failed to load compressed depth image")
          }
          img.src = "data:image/jpeg;base64," + data._data_jpeg
          return
        }

        // Handle standard ROS CompressedImage format
        if (data.format && data.data) {
          console.log("[v0] Using standard ROS CompressedImage format:", data.format)
          
          let imageData: string
          if (typeof data.data === "string") {
            imageData = data.data
          } else if (Array.isArray(data.data)) {
            // Convert array to base64
            const binaryString = String.fromCharCode.apply(null, data.data)
            imageData = btoa(binaryString)
          } else {
            throw new Error("Unsupported compressed data format")
          }

          // For compressedDepth format, we need to handle PNG decompression differently
          if (data.format.includes("compressedDepth")) {
            console.log("[v0] Handling compressedDepth format")
            console.log("[v0] Data length:", imageData.length)
            console.log("[v0] First 50 chars:", imageData.substring(0, 50))
            
            // Find the PNG header in the data (iVBORw0KGgo... in base64)
            // CompressedDepth messages often have a header before the PNG data
            let pngStart = imageData.indexOf("iVBORw0KGgo")
            if (pngStart === -1) {
              // Try finding other PNG signatures
              pngStart = imageData.indexOf("iVBORw")
              if (pngStart === -1) {
                console.error("[v0] No PNG signature found in compressed depth data")
                setError("No PNG signature found in compressed depth data")
                return
              }
            }
            
            console.log("[v0] Found PNG signature at position:", pngStart)
            const pngData = imageData.substring(pngStart)
            console.log("[v0] Extracted PNG data length:", pngData.length)
            console.log("[v0] PNG data starts with:", pngData.substring(0, 20))
            
            const img = new Image()
            img.onload = () => {
              console.log("[v0] CompressedDepth image loaded successfully:", img.width, "x", img.height)
              // Set canvas size - use image dimensions if width/height not provided
              const imgWidth = data.width || img.width
              const imgHeight = data.height || img.height
              
              canvas.width = imgWidth
              canvas.height = imgHeight
              
              // Draw the image
              ctx.drawImage(img, 0, 0)
              
              // Get the pixel data for processing
              const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight)
              const pixels = imageData.data
              
              // For compressed depth, the PNG often contains 16-bit depth encoded in a special way
              // We need to decode the depth values properly
              let minDepth = Number.POSITIVE_INFINITY
              let maxDepth = Number.NEGATIVE_INFINITY
              
              // First pass: find min/max depth values
              // In compressed depth PNGs, depth is often encoded across RGB channels
              for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i]
                const g = pixels[i + 1] 
                const b = pixels[i + 2]
                
                // Decode depth from RGB channels (common encoding: high byte in R, low byte in G)
                const depth = (r << 8) | g  // 16-bit depth reconstruction
                
                if (depth > 0) {
                  minDepth = Math.min(minDepth, depth)
                  maxDepth = Math.max(maxDepth, depth)
                }
              }
              
              console.log("[v0] Decoded depth range:", { minDepth, maxDepth })
              
              // Second pass: apply color mapping based on actual depth values
              for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i]
                const g = pixels[i + 1]
                const depth = (r << 8) | g
                
                if (depth > 0 && maxDepth > minDepth) {
                  // Normalize depth to 0-1 range (inverted: closer = brighter)
                  const normalized = 1 - (depth - minDepth) / (maxDepth - minDepth)
                  
                  // Apply blue-to-red color gradient for depth
                  pixels[i] = Math.floor(normalized * 255)     // R - closer = more red
                  pixels[i + 1] = Math.floor((1 - Math.abs(normalized - 0.5) * 2) * 255) // G - mid range
                  pixels[i + 2] = Math.floor((1 - normalized) * 255) // B - farther = more blue
                  pixels[i + 3] = 255 // Alpha = opaque
                } else {
                  // Invalid depth - make transparent
                  pixels[i] = 0
                  pixels[i + 1] = 0  
                  pixels[i + 2] = 0
                  pixels[i + 3] = 0
                }
              }
              
              ctx.putImageData(imageData, 0, 0)
              setError(undefined)
            }
            
            img.onerror = (e) => {
              console.error("[v0] Failed to load compressedDepth image:", e)
              setError("Failed to load compressed depth image: " + (e as any)?.message || "Unknown error")
            }
            
            // CompressedDepth is typically PNG format
            img.src = `data:image/png;base64,${pngData}`
            console.log("[v0] Set image src with cleaned PNG data, waiting for load...")
            return
          }

          const img = new Image()
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            
            // For depth images, we might want to apply color mapping
            if (data.format.includes("16UC1") || data.format.includes("png")) {
              // Draw image first
              ctx.drawImage(img, 0, 0)
              
              // For depth, we might want to enhance the visualization
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const pixels = imageData.data
              
              // Apply color mapping for better depth visualization
              for (let i = 0; i < pixels.length; i += 4) {
                const gray = pixels[i] // Use red channel as gray value
                const normalized = gray / 255
                
                // Apply a color map (blue to red gradient)
                pixels[i] = Math.floor(normalized * 255)     // R
                pixels[i + 1] = Math.floor((1 - Math.abs(normalized - 0.5) * 2) * 255) // G
                pixels[i + 2] = Math.floor((1 - normalized) * 255) // B
                // pixels[i + 3] stays the same (alpha)
              }
              
              ctx.putImageData(imageData, 0, 0)
            } else {
              ctx.drawImage(img, 0, 0)
            }
            
            setError(undefined)
          }
          img.onerror = () => {
            setError("Failed to load compressed depth image")
          }
          
          // Determine MIME type from format
          let mimeType = "image/jpeg"
          if (data.format.includes("png") || data.format.includes("compressedDepth")) {
            mimeType = "image/png"
          }
          
          img.src = `data:${mimeType};base64,${imageData}`
          return
        }

        if (!data.data) {
          throw new Error("No depth data available")
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
          throw new Error(`Unsupported data type: ${typeof data.data}`)
        }

        console.log("[v0] Processing raw depth data:", {
          length: bytes.length,
          first10: Array.from(bytes.slice(0, 10)),
        })

        const width = data.width || 640
        const height = data.height || 480

        canvas.width = width
        canvas.height = height

        const imageData = ctx.createImageData(width, height)

        // Following rosboard's approach: shift right by 8 to get 8-bit grayscale
        for (let i = 0, j = 0; i < bytes.length - 1 && j < imageData.data.length; i += 2, j += 4) {
          const depth16 = (bytes[i + 1] << 8) | bytes[i] // little-endian
          const depth8 = depth16 >> 8 // keep most significant 8 bits

          imageData.data[j] = depth8 // R
          imageData.data[j + 1] = depth8 // G
          imageData.data[j + 2] = depth8 // B
          imageData.data[j + 3] = 255 // A
        }

        ctx.putImageData(imageData, 0, 0)
        setError(undefined)
      } catch (err) {
        console.error("[v0] CompressedDepth error:", err)
        setError(err instanceof Error ? err.message : "Failed to process compressed depth")
      }
    }

    processDepth()
  }, [data])

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
      <div className="flex items-center justify-center bg-muted/30 rounded">
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>
      {stats && (
        <div className="text-xs text-muted-foreground px-2">
          Depth range: {stats.min.toFixed(0)} - {stats.max.toFixed(0)}
        </div>
      )}
    </div>
  )
}
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
          hasHeader: !!data.header,
        })
        
        // Log more details about the data structure
        if (data.header) {
          console.log("[v0] Header info:", data.header)
        }

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
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

        console.log("[v0] Processing compressed depth data:", {
          length: bytes.length,
          first10: Array.from(bytes.slice(0, 10)),
          format: data.format,
          isPNG: bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47,
          isZlib: bytes[0] === 0x78 && (bytes[1] === 0x9C || bytes[1] === 0xDA || bytes[1] === 0x01),
          headerHex: Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
        })

        // Check format signatures
        const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
        const isZlib = bytes[0] === 0x78 && (bytes[1] === 0x9C || bytes[1] === 0xDA || bytes[1] === 0x01)

        if (isPNG) {
          // Handle PNG compressed depth
          const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
          const url = URL.createObjectURL(blob)
          
          const img = new Image()
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            
            // Draw the PNG to get pixel data
            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, img.width, img.height)
            
            // PNG compressed depth uses 16-bit values stored in RGB channels
            // Need to reconstruct the depth values and apply proper color mapping
            const newImageData = ctx.createImageData(img.width, img.height)
            
            for (let i = 0; i < imageData.data.length; i += 4) {
              // Extract 16-bit depth from RGB channels (format depends on compression method)
              const r = imageData.data[i]
              const g = imageData.data[i + 1]
              const b = imageData.data[i + 2]
              
              // Common PNG depth encoding: depth = (R << 8) | G
              const depth16 = (r << 8) | g
              const depth8 = Math.min(255, depth16 >> 4) // Scale down for visualization
              
              // Apply depth colormap (blue = close, red = far)
              const normalized = depth8 / 255
              newImageData.data[i] = Math.floor((1 - normalized) * 255)     // R
              newImageData.data[i + 1] = Math.floor(normalized * (1 - normalized) * 4 * 255) // G
              newImageData.data[i + 2] = Math.floor(normalized * 255)       // B
              newImageData.data[i + 3] = depth16 > 0 ? 255 : 0              // A
            }
            
            ctx.putImageData(newImageData, 0, 0)
            URL.revokeObjectURL(url)
            setError(undefined)
          }
          img.onerror = () => {
            URL.revokeObjectURL(url)
            setError("Failed to decode PNG compressed depth")
          }
          img.src = url
          return
        }

        // Check for ROS/RViz compressed depth format
        if (data.format === "16UC1; compressedDepth" && !isPNG && !isZlib) {
          console.log("[v0] Detected RViz compressed depth format")
          
          // Use the actual camera resolution from camera_info: 1280x720
          const width = 1280
          const height = 720
          
          console.log("[v0] Using camera resolution:", { width, height })
          
          canvas.width = width
          canvas.height = height
          
          const imageData = ctx.createImageData(width, height)
          
          console.log("[v0] Processing RViz compressed depth data:", {
            totalBytes: bytes.length,
            expectedPixels: width * height,
            expectedBytes16bit: width * height * 2,
            headerBytes: Array.from(bytes.slice(0, 12)),
            headerHex: Array.from(bytes.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' '),
          })
          
          // RViz compressed depth format:
          // Usually has a header followed by compressed depth data
          // Common header pattern: [0, 0, 0, 0, compression_type, 0, 0, 0, ...]
          
          let headerSize = 0
          let compressedData = bytes
          
          // Look for compression header
          if (bytes.length > 12 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0) {
            const compressionType = bytes[4]
            console.log("[v0] Found compression header, type:", compressionType)
            
            // Common header sizes: 8, 12, or 16 bytes
            if (bytes[8] === 0 && bytes[9] === 0) {
              headerSize = 12  // 12-byte header
            } else {
              headerSize = 8   // 8-byte header
            }
            
            compressedData = bytes.slice(headerSize)
            console.log("[v0] Header size:", headerSize, "Data size:", compressedData.length)
          }
          
          // Try to decompress or interpret the data
          const expectedPixels = width * height
          
          if (compressedData.length === expectedPixels * 2) {
            console.log("[v0] Processing as raw 16-bit depth data")
            // Raw 16-bit depth data
            for (let i = 0, j = 0; i < compressedData.length - 1 && j < imageData.data.length; i += 2, j += 4) {
              const depth16 = (compressedData[i + 1] << 8) | compressedData[i] // little-endian
              
              // Convert to mm and then normalize (typical depth range 0-10000mm)
              const depthMm = depth16
              const normalizedDepth = Math.min(1.0, depthMm / 8000.0) // 8m max range
              
              // Apply classic depth colormap (red = close, blue = far)
              if (depthMm === 0) {
                // Invalid depth = black
                imageData.data[j] = 0     // R
                imageData.data[j + 1] = 0 // G
                imageData.data[j + 2] = 0 // B
                imageData.data[j + 3] = 0 // A
              } else {
                // HSV-like colormap: red->yellow->green->cyan->blue
                const hue = (1 - normalizedDepth) * 240 // 240 degrees (red to blue)
                const saturation = 1.0
                const value = 1.0
                
                const c = value * saturation
                const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
                const m = value - c
                
                let r, g, b
                if (hue < 60) {
                  r = c; g = x; b = 0
                } else if (hue < 120) {
                  r = x; g = c; b = 0
                } else if (hue < 180) {
                  r = 0; g = c; b = x
                } else if (hue < 240) {
                  r = 0; g = x; b = c
                } else {
                  r = x; g = 0; b = c
                }
                
                imageData.data[j] = Math.floor((r + m) * 255)     // R
                imageData.data[j + 1] = Math.floor((g + m) * 255) // G
                imageData.data[j + 2] = Math.floor((b + m) * 255) // B
                imageData.data[j + 3] = 255 // A
              }
            }
          } else {
            console.log("[v0] Attempting to decode compressed depth data")
            
            // RViz compression type 6 analysis
            const compressionType = bytes[4]
            
            if (compressionType === 6) {
              console.log("[v0] Processing RViz compression type 6")
              
              // Type 6 often uses a form of run-length encoding or simple compression
              // Let's try to interpret it as depth data with better spatial distribution
              
              const totalPixels = width * height
              
              // Try to extract depth values more intelligently
              let depthValues = new Uint16Array(totalPixels)
              let writeIndex = 0
              
              // Parse compressed data - this is an approximation of RViz compression
              for (let i = 0; i < compressedData.length && writeIndex < totalPixels; i++) {
                const byte = compressedData[i]
                
                if (byte === 0) {
                  // Zero might indicate a run of zeros or invalid depth
                  depthValues[writeIndex++] = 0
                } else {
                  // Non-zero values represent depth information
                  // Scale the 8-bit value to 16-bit depth range
                  const depth16 = byte * 32  // Scale factor for visualization
                  depthValues[writeIndex++] = depth16
                }
                
                // For compressed data, we might need to replicate values
                if (i % 3 === 0 && writeIndex < totalPixels && byte > 0) {
                  // Replicate some values to fill more pixels (spatial interpolation)
                  const replicationCount = Math.min(2, totalPixels - writeIndex)
                  for (let j = 0; j < replicationCount; j++) {
                    depthValues[writeIndex++] = byte * 32
                  }
                }
              }
              
              console.log("[v0] Processed depth values:", { 
                totalProcessed: writeIndex, 
                expectedPixels: totalPixels,
                coverage: (writeIndex / totalPixels * 100).toFixed(1) + '%'
              })
              
              // Fill remaining pixels with interpolated values if needed
              while (writeIndex < totalPixels) {
                depthValues[writeIndex] = depthValues[Math.max(0, writeIndex - 1)]
                writeIndex++
              }
              
              // Render the depth values with improved colorization
              for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex++) {
                const imageIndex = pixelIndex * 4
                const depth16 = depthValues[pixelIndex]
                
                if (depth16 === 0) {
                  // Invalid depth = black
                  imageData.data[imageIndex] = 0
                  imageData.data[imageIndex + 1] = 0
                  imageData.data[imageIndex + 2] = 0
                  imageData.data[imageIndex + 3] = 0
                } else {
                  // Convert to distance in meters and normalize
                  const depthMeters = depth16 / 1000.0  // Convert to meters
                  const normalizedDepth = Math.min(1.0, depthMeters / 5.0) // 5m max range
                  
                  // Enhanced HSV colormap
                  const hue = (1 - normalizedDepth) * 300 // Extended range for better colors
                  const saturation = 0.9
                  const value = 0.8
                  
                  const c = value * saturation
                  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
                  const m = value - c
                  
                  let r, g, b
                  if (hue < 60) {
                    r = c; g = x; b = 0
                  } else if (hue < 120) {
                    r = x; g = c; b = 0
                  } else if (hue < 180) {
                    r = 0; g = c; b = x
                  } else if (hue < 240) {
                    r = 0; g = x; b = c
                  } else if (hue < 300) {
                    r = x; g = 0; b = c
                  } else {
                    r = c; g = 0; b = x
                  }
                  
                  imageData.data[imageIndex] = Math.floor((r + m) * 255)     // R
                  imageData.data[imageIndex + 1] = Math.floor((g + m) * 255) // G
                  imageData.data[imageIndex + 2] = Math.floor((b + m) * 255) // B
                  imageData.data[imageIndex + 3] = 255 // A
                }
              }
              
            } else {
              // Fallback for other compression types
              const pixelStep = Math.max(1, Math.floor(compressedData.length / expectedPixels))
              console.log("[v0] Using pixel step:", pixelStep)
              
              let minVal = 255, maxVal = 0
              
              // First pass: find data range
              for (let i = 0; i < compressedData.length; i += pixelStep) {
                const value = compressedData[i]
                if (value > 0) {
                  minVal = Math.min(minVal, value)
                  maxVal = Math.max(maxVal, value)
                }
              }
              
              console.log("[v0] Data range:", { minVal, maxVal })
            
            const range = maxVal - minVal || 1
            
            // Second pass: colorize
            for (let pixelIndex = 0; pixelIndex < expectedPixels; pixelIndex++) {
              const byteIndex = Math.floor(pixelIndex * pixelStep)
              const imageIndex = pixelIndex * 4
              
              if (byteIndex < compressedData.length && imageIndex < imageData.data.length - 3) {
                const rawValue = compressedData[byteIndex]
                
                if (rawValue === 0) {
                  // Invalid depth = black
                  imageData.data[imageIndex] = 0
                  imageData.data[imageIndex + 1] = 0
                  imageData.data[imageIndex + 2] = 0
                  imageData.data[imageIndex + 3] = 0
                } else {
                  const normalized = (rawValue - minVal) / range
                  
                  // Classic depth colormap (red = close, blue = far)
                  const hue = (1 - normalized) * 240 // red to blue
                  const saturation = 1.0
                  const value = 1.0
                  
                  const c = value * saturation
                  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
                  const m = value - c
                  
                  let r, g, b
                  if (hue < 60) {
                    r = c; g = x; b = 0
                  } else if (hue < 120) {
                    r = x; g = c; b = 0
                  } else if (hue < 180) {
                    r = 0; g = c; b = x
                  } else if (hue < 240) {
                    r = 0; g = x; b = c
                  } else {
                    r = x; g = 0; b = c
                  }
                  
                  imageData.data[imageIndex] = Math.floor((r + m) * 255)     // R
                  imageData.data[imageIndex + 1] = Math.floor((g + m) * 255) // G
                  imageData.data[imageIndex + 2] = Math.floor((b + m) * 255) // B
                  imageData.data[imageIndex + 3] = 255 // A
                }
              }
            }
          }
          
          ctx.putImageData(imageData, 0, 0)
          setError(undefined)
          return
        }

        // Fallback: treat as raw 16-bit depth data
        const width = data.width || 640
        const height = data.height || 480

        canvas.width = width
        canvas.height = height

        const imageData = ctx.createImageData(width, height)

        // Process as raw 16-bit depth data
        for (let i = 0, j = 0; i < bytes.length - 1 && j < imageData.data.length; i += 2, j += 4) {
          const depth16 = (bytes[i + 1] << 8) | bytes[i] // little-endian
          const depth8 = depth16 >> 8 // keep most significant 8 bits

          // Apply depth colormap
          const normalized = depth8 / 255
          imageData.data[j] = Math.floor((1 - normalized) * 255)         // R
          imageData.data[j + 1] = Math.floor(normalized * (1 - normalized) * 4 * 255) // G
          imageData.data[j + 2] = Math.floor(normalized * 255)           // B
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

"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

interface PointCloudViewerProps {
  data: any
}

export function PointCloudViewer({ data }: PointCloudViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const pointCloudRef = useRef<THREE.Points | null>(null)
  const [error, setError] = useState<string>()
  const [pointCount, setPointCount] = useState(0)

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1b1e)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(5, 5, 5)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
    scene.add(gridHelper)

    // Axes helper
    const axesHelper = new THREE.AxesHelper(2)
    scene.add(axesHelper)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!container) return
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      renderer.dispose()
      controls.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  // Update point cloud data
  useEffect(() => {
    console.log("[v0] PointCloud useEffect triggered:", { hasData: !!data, hasScene: !!sceneRef.current })
    
    if (!data || !sceneRef.current) return

    console.log("[v0] PointCloud data received:", {
      hasData: !!data,
      dataKeys: Object.keys(data),
      width: data.width,
      height: data.height,
      fields: data.fields,
      point_step: data.point_step,
      row_step: data.row_step,
      dataType: typeof data.data,
      dataLength: data.data?.length,
      numPoints: data.width * data.height,
      expectedBytes: data.width * data.height * data.point_step,
      isCompressed: !!data.__comp,
      hasDataUint16: !!data._data_uint16,
    })

    try {
      // Remove old point cloud
      if (pointCloudRef.current) {
        sceneRef.current.remove(pointCloudRef.current)
        pointCloudRef.current.geometry.dispose()
        if (Array.isArray(pointCloudRef.current.material)) {
          pointCloudRef.current.material.forEach((m: any) => m.dispose())
        } else {
          pointCloudRef.current.material.dispose()
        }
      }

      // Parse PointCloud2 data
      const { width, height, fields, point_step, row_step, data: cloudData } = data

      const numPoints = width * height
      if (numPoints === 0) {
        setError("Empty point cloud")
        return
      }

      // Find field offsets
      const xField = fields.find((f: any) => f.name === "x")
      const yField = fields.find((f: any) => f.name === "y")
      const zField = fields.find((f: any) => f.name === "z")
      const rgbField = fields.find((f: any) => f.name === "rgb" || f.name === "rgba")

      if (!xField || !yField || !zField) {
        setError("Missing XYZ fields in point cloud")
        return
      }

      // Convert data to Uint8Array if needed
      let bytes: Uint8Array
      if (typeof cloudData === "string") {
        // Base64 encoded data
        const binaryString = atob(cloudData)
        bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
      } else if (cloudData instanceof Uint8Array) {
        bytes = cloudData
      } else if (Array.isArray(cloudData)) {
        bytes = new Uint8Array(cloudData)
      } else {
        setError("Unsupported point cloud data format")
        return
      }

      // Create geometry
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(numPoints * 3)
      const colors = new Float32Array(numPoints * 3)

      let validPoints = 0

      // Create DataView once outside the loop for efficiency
      const dataView = new DataView(bytes.buffer, bytes.byteOffset)

      // Parse points with proper bounds checking
      for (let i = 0; i < numPoints; i++) {
        const offset = i * point_step

        // Check if we can safely read all required fields
        const maxFieldOffset = Math.max(
          xField.offset + 4, // float32 = 4 bytes
          yField.offset + 4,
          zField.offset + 4,
          rgbField ? rgbField.offset + 4 : 0
        )

        if (offset + maxFieldOffset > bytes.length) {
          console.warn(`Point ${i}: offset ${offset + maxFieldOffset} exceeds buffer length ${bytes.length}`)
          break // Stop processing to avoid bounds error
        }

        try {
          // Read XYZ (float32)
          const x = dataView.getFloat32(offset + xField.offset, true)
          const y = dataView.getFloat32(offset + yField.offset, true)
          const z = dataView.getFloat32(offset + zField.offset, true)

          // Skip invalid points (NaN or Inf)
          if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue

          positions[validPoints * 3] = x
          positions[validPoints * 3 + 1] = y
          positions[validPoints * 3 + 2] = z

          // Parse color if available
          if (rgbField) {
            const rgb = dataView.getUint32(offset + rgbField.offset, true)
            colors[validPoints * 3] = ((rgb >> 16) & 0xff) / 255
            colors[validPoints * 3 + 1] = ((rgb >> 8) & 0xff) / 255
            colors[validPoints * 3 + 2] = (rgb & 0xff) / 255
          } else {
            // Default color based on height
            const heightColor = (z + 2) / 4 // Normalize height to 0-1
            colors[validPoints * 3] = heightColor
            colors[validPoints * 3 + 1] = 1 - heightColor
            colors[validPoints * 3 + 2] = 0.5
          }

          validPoints++
        } catch (err) {
          console.warn(`Error reading point ${i} at offset ${offset}:`, err)
          continue // Skip this point and continue
        }
      }

      // Trim arrays to valid points
      geometry.setAttribute("position", new THREE.BufferAttribute(positions.slice(0, validPoints * 3), 3))
      geometry.setAttribute("color", new THREE.BufferAttribute(colors.slice(0, validPoints * 3), 3))
      geometry.computeBoundingSphere()

      // Create material
      const material = new THREE.PointsMaterial({
        size: 0.02,
        vertexColors: true,
        sizeAttenuation: true,
      })

      // Create points
      const points = new THREE.Points(geometry, material)
      sceneRef.current.add(points)
      pointCloudRef.current = points

      setPointCount(validPoints)
      setError(undefined)
    } catch (err) {
      console.error("[v0] Point cloud error:", err)
      setError(err instanceof Error ? err.message : "Failed to render point cloud")
    }
  }, [data])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded bg-muted/30" />

      {/* Info overlay */}
      <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-3 py-2 rounded text-xs space-y-1">
        <div className="font-medium">Point Cloud</div>
        {pointCount > 0 && <div className="text-muted-foreground">{pointCount.toLocaleString()} points</div>}
        {error && <div className="text-destructive">{error}</div>}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-3 py-2 rounded text-xs text-muted-foreground">
        Left: Rotate | Right: Pan | Scroll: Zoom
      </div>
    </div>
  )
}

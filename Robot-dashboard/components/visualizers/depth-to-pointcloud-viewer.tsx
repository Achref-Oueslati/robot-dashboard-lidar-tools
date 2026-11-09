"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

interface DepthToPointCloudViewerProps {
  data: any
}

export function DepthToPointCloudViewer({ data }: DepthToPointCloudViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const pointCloudRef = useRef<THREE.Points | null>(null)
  const [error, setError] = useState<string>()
  const [pointCount, setPointCount] = useState(0)
  const [density, setDensity] = useState(1)

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
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100)
    camera.position.set(0, 0, 3)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Grid helper
    const gridHelper = new THREE.GridHelper(5, 10, 0x444444, 0x222222)
    scene.add(gridHelper)

    // Axes helper
    const axesHelper = new THREE.AxesHelper(1)
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

  // Convert depth image to point cloud
  useEffect(() => {
    if (!data || !sceneRef.current) return

    try {
      console.log("[v0] DepthToPointCloud data received:", {
        width: data.width,
        height: data.height,
        encoding: data.encoding,
        dataLength: data.data?.length,
      })

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

      const { width, height, encoding, data: imageData } = data

      if (!imageData || width <= 0 || height <= 0) {
        setError("Invalid depth image data")
        return
      }

      let depthValues: number[]
      let validDepths: number[] = []

      // Parse depth data based on encoding
      if (encoding === "16UC1") {
        const uint16Array = new Uint16Array(imageData.buffer || imageData)
        depthValues = Array.from(uint16Array)
        validDepths = depthValues.filter(d => d > 0)
      } else if (encoding === "32FC1") {
        const float32Array = new Float32Array(imageData.buffer || imageData)
        depthValues = Array.from(float32Array)
        validDepths = depthValues.filter(d => d > 0 && isFinite(d))
      } else {
        setError(`Unsupported depth encoding: ${encoding}`)
        return
      }

      if (validDepths.length === 0) {
        setError("No valid depth data found")
        return
      }

      // Calculate stats for normalization
      const minDepth = Math.min(...validDepths)
      const maxDepth = Math.max(...validDepths)
      const depthRange = maxDepth - minDepth

      // Camera intrinsics (approximate for visualization)
      const fx = width * 0.8 // rough estimate
      const fy = height * 0.8
      const cx = width / 2
      const cy = height / 2

      // Apply aggressive sampling for performance
      const targetPoints = Math.min(10000, width * height)
      const samplingRate = Math.max(1, Math.floor((width * height) / targetPoints))
      const actualDensity = Math.max(0.1, Math.min(1, density))
      const finalSamplingRate = Math.floor(samplingRate / actualDensity)

      const positions: number[] = []
      const colors: number[] = []

      for (let y = 0; y < height; y += finalSamplingRate) {
        for (let x = 0; x < width; x += finalSamplingRate) {
          const idx = y * width + x
          const depth = depthValues[idx]

          if (depth > 0 && (encoding !== "32FC1" || isFinite(depth))) {
            // Convert pixel coordinates to 3D coordinates
            const depthM = depth * 0.001 // convert mm to meters for 16UC1
            const worldX = (x - cx) * depthM / fx
            const worldY = (y - cy) * depthM / fy
            const worldZ = -depthM // negative Z for camera coordinate system

            positions.push(worldX, worldY, worldZ)

            // Color based on depth
            const colorIntensity = depthRange > 0 ? (depth - minDepth) / depthRange : 0.5
            colors.push(
              1 - colorIntensity, // R: closer = red
              colorIntensity * (1 - colorIntensity) * 4, // G: middle = green
              colorIntensity // B: farther = blue
            )
          }
        }
      }

      if (positions.length === 0) {
        setError("No valid 3D points generated")
        return
      }

      // Create geometry
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3))
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3))
      geometry.computeBoundingSphere()

      // Create material optimized for performance
      const material = new THREE.PointsMaterial({
        size: 0.005,
        vertexColors: true,
        sizeAttenuation: false, // Constant size for better performance
      })

      // Create point cloud
      const points = new THREE.Points(geometry, material)
      sceneRef.current.add(points)
      pointCloudRef.current = points

      setPointCount(positions.length / 3)
      setError(undefined)
    } catch (err) {
      console.error("[v0] DepthToPointCloud error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate point cloud from depth")
    }
  }, [data, density])

  const handleDensityChange = (newDensity: number) => {
    setDensity(newDensity)
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded bg-muted/30" />

      {/* Info overlay */}
      <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-3 py-2 rounded text-xs space-y-1">
        <div className="font-medium">Depth Point Cloud</div>
        {pointCount > 0 && <div className="text-muted-foreground">{pointCount.toLocaleString()} points</div>}
        {error && <div className="text-destructive">{error}</div>}
      </div>

      {/* Density control */}
      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-3 py-2 rounded text-xs space-y-2">
        <div className="font-medium">Density</div>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={density}
          onChange={(e) => handleDensityChange(parseFloat(e.target.value))}
          className="w-20"
        />
        <div className="text-muted-foreground">{Math.round(density * 100)}%</div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-3 py-2 rounded text-xs text-muted-foreground">
        Left: Rotate | Right: Pan | Scroll: Zoom
      </div>
    </div>
  )
}
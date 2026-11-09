"use client"

import { useRef, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface IMUViewerProps {
  data: any
}

// Convert quaternion to Euler angles (roll, pitch, yaw) in degrees
function quaternionToEuler(q: { x: number; y: number; z: number; w: number }) {
  if (!q) return { roll: 0, pitch: 0, yaw: 0 }
  
  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (q.w * q.x + q.y * q.z)
  const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y)
  const roll = Math.atan2(sinr_cosp, cosr_cosp) * 180 / Math.PI

  // Pitch (y-axis rotation)
  const sinp = 2 * (q.w * q.y - q.z * q.x)
  const pitch = Math.abs(sinp) >= 1 
    ? Math.sign(sinp) * 90 
    : Math.asin(sinp) * 180 / Math.PI

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (q.w * q.z + q.x * q.y)
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z)
  const yaw = Math.atan2(siny_cosp, cosy_cosp) * 180 / Math.PI

  return { roll, pitch, yaw }
}

// 3D Device Orientation Visualization Component
function DeviceVisualization({ orientation }: { orientation: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    if (!canvasRef.current || !orientation) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const { roll, pitch, yaw } = quaternionToEuler(orientation)
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const deviceWidth = 80
    const deviceHeight = 40
    
    ctx.save()
    ctx.translate(centerX, centerY)
    
    // Apply rotations (simplified 2D representation)
    ctx.rotate(roll * Math.PI / 180) // Roll rotation
    
    // Draw device outline
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    ctx.fillRect(-deviceWidth/2, -deviceHeight/2, deviceWidth, deviceHeight)
    ctx.strokeRect(-deviceWidth/2, -deviceHeight/2, deviceWidth, deviceHeight)
    
    // Draw orientation indicator (arrow)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -deviceHeight/3)
    ctx.stroke()
    
    // Arrow head
    ctx.beginPath()
    ctx.moveTo(-5, -deviceHeight/3 + 8)
    ctx.lineTo(0, -deviceHeight/3)
    ctx.lineTo(5, -deviceHeight/3 + 8)
    ctx.stroke()
    
    ctx.restore()
    
    // Draw pitch indicator (vertical bar)
    const pitchBarX = 20
    const pitchBarHeight = 100
    const pitchIndicatorY = centerY + (pitch / 90) * (pitchBarHeight / 2)
    
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pitchBarX, centerY - pitchBarHeight/2)
    ctx.lineTo(pitchBarX, centerY + pitchBarHeight/2)
    ctx.stroke()
    
    // Pitch indicator
    ctx.fillStyle = '#10b981'
    ctx.fillRect(pitchBarX - 8, Math.max(centerY - pitchBarHeight/2, Math.min(centerY + pitchBarHeight/2, pitchIndicatorY - 3)), 16, 6)
    
    // Draw yaw indicator (horizontal bar)
    const yawBarY = canvas.height - 30
    const yawBarWidth = 100
    const yawIndicatorX = centerX + (yaw / 180) * (yawBarWidth / 2)
    
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX - yawBarWidth/2, yawBarY)
    ctx.lineTo(centerX + yawBarWidth/2, yawBarY)
    ctx.stroke()
    
    // Yaw indicator
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(Math.max(centerX - yawBarWidth/2, Math.min(centerX + yawBarWidth/2, yawIndicatorX - 3)), yawBarY - 8, 6, 16)
    
  }, [orientation])
  
  return <canvas ref={canvasRef} width={200} height={150} className="border rounded" />
}

// Accelerometer visualization (bubble level style)
function AccelerationBubble({ acceleration }: { acceleration: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    if (!canvasRef.current || !acceleration) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 60
    
    // Draw outer circle (level boundary)
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    ctx.stroke()
    
    // Draw crosshairs
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX - radius, centerY)
    ctx.lineTo(centerX + radius, centerY)
    ctx.moveTo(centerX, centerY - radius)
    ctx.lineTo(centerX, centerY + radius)
    ctx.stroke()
    
    // Calculate bubble position based on X and Y acceleration
    const maxAccel = 10 // m/s² - adjust based on expected range
    const bubbleX = centerX + (acceleration.x / maxAccel) * radius * 0.8
    const bubbleY = centerY - (acceleration.y / maxAccel) * radius * 0.8 // Inverted Y
    
    // Clamp bubble to circle
    const dx = bubbleX - centerX
    const dy = bubbleY - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    let finalX = bubbleX
    let finalY = bubbleY
    
    if (distance > radius * 0.9) {
      const angle = Math.atan2(dy, dx)
      finalX = centerX + Math.cos(angle) * radius * 0.9
      finalY = centerY + Math.sin(angle) * radius * 0.9
    }
    
    // Draw bubble
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(finalX, finalY, 8, 0, 2 * Math.PI)
    ctx.fill()
    
    // Draw Z acceleration indicator (vertical bar)
    const zBarHeight = Math.abs(acceleration.z / maxAccel) * 40
    const zBarY = centerY + radius + 20
    
    ctx.fillStyle = acceleration.z > 0 ? '#10b981' : '#ef4444'
    ctx.fillRect(centerX - 10, zBarY - zBarHeight, 20, zBarHeight)
    
    ctx.strokeStyle = '#6b7280'
    ctx.strokeRect(centerX - 10, zBarY - 40, 20, 40)
    
  }, [acceleration])
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <canvas ref={canvasRef} width={150} height={200} className="border rounded" />
      <div className="text-xs text-muted-foreground text-center">
        Tilt Level<br />
        <span className="text-green-500">●</span> Up <span className="text-red-500">●</span> Down
      </div>
    </div>
  )
}

// Angular velocity indicator (spinning wheel style)
function RotationIndicator({ angularVelocity }: { angularVelocity: any }) {
  const [rotation, setRotation] = useState(0)
  
  useEffect(() => {
    if (!angularVelocity) return
    
    const interval = setInterval(() => {
      setRotation(prev => prev + angularVelocity.z * 2) // Z-axis rotation
    }, 100)
    
    return () => clearInterval(interval)
  }, [angularVelocity])
  
  const speed = Math.abs(angularVelocity?.z || 0)
  const maxSpeed = 5 // rad/s
  const normalizedSpeed = Math.min(speed / maxSpeed, 1)
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative w-20 h-20 border-2 border-gray-300 rounded-full flex items-center justify-center">
        <div 
          className="w-1 h-8 bg-blue-500 absolute origin-bottom"
          style={{ 
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center bottom',
            top: '10px'
          }}
        />
        <div className="w-2 h-2 bg-gray-600 rounded-full absolute" />
      </div>
      <div className="text-xs text-center">
        <div className="font-medium">Rotation</div>
        <div className={`text-sm ${normalizedSpeed > 0.5 ? 'text-red-500' : normalizedSpeed > 0.2 ? 'text-yellow-500' : 'text-green-500'}`}>
          {speed.toFixed(1)} rad/s
        </div>
      </div>
    </div>
  )
}

export function IMUViewer({ data }: IMUViewerProps) {
  if (!data) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-gray-400 flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded" />
            </div>
            Robot Motion Sensor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Waiting for sensor data...</div>
        </CardContent>
      </Card>
    )
  }

  const { orientation, angular_velocity, linear_acceleration } = data
  const euler = quaternionToEuler(orientation)

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-gray-400 flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-500 rounded" />
          </div>
          Robot Motion Sensor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Device Orientation */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-center">Robot Orientation</div>
            <DeviceVisualization orientation={orientation} />
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Tilt Left/Right:</span>
                <span className={`font-mono ${Math.abs(euler.roll) > 30 ? 'text-red-500' : 'text-green-500'}`}>
                  {euler.roll.toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tilt Forward/Back:</span>
                <span className={`font-mono ${Math.abs(euler.pitch) > 30 ? 'text-red-500' : 'text-green-500'}`}>
                  {euler.pitch.toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span>Turn Left/Right:</span>
                <span className="font-mono">
                  {euler.yaw.toFixed(1)}°
                </span>
              </div>
            </div>
          </div>

          {/* Acceleration (Tilt Level) */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-center">Balance & Movement</div>
            <AccelerationBubble acceleration={linear_acceleration} />
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Left/Right:</span>
                <span className="font-mono">{linear_acceleration?.x?.toFixed(1) || "0.0"} m/s²</span>
              </div>
              <div className="flex justify-between">
                <span>Forward/Back:</span>
                <span className="font-mono">{linear_acceleration?.y?.toFixed(1) || "0.0"} m/s²</span>
              </div>
              <div className="flex justify-between">
                <span>Up/Down:</span>
                <span className="font-mono">{linear_acceleration?.z?.toFixed(1) || "0.0"} m/s²</span>
              </div>
            </div>
          </div>

          {/* Angular Velocity (Rotation) */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-center">Spinning Motion</div>
            <RotationIndicator angularVelocity={angular_velocity} />
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Roll Speed:</span>
                <span className="font-mono">{angular_velocity?.x?.toFixed(2) || "0.00"}</span>
              </div>
              <div className="flex justify-between">
                <span>Pitch Speed:</span>
                <span className="font-mono">{angular_velocity?.y?.toFixed(2) || "0.00"}</span>
              </div>
              <div className="flex justify-between">
                <span>Turn Speed:</span>
                <span className="font-mono">{angular_velocity?.z?.toFixed(2) || "0.00"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="pt-2 border-t flex justify-center space-x-6 text-xs">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${Math.abs(euler.roll) > 45 || Math.abs(euler.pitch) > 45 ? 'bg-red-500' : 'bg-green-500'}`} />
            <span>Stability</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${Math.abs(angular_velocity?.z || 0) > 2 ? 'bg-orange-500' : 'bg-green-500'}`} />
            <span>Rotation</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${Math.sqrt((linear_acceleration?.x || 0)**2 + (linear_acceleration?.y || 0)**2) > 5 ? 'bg-yellow-500' : 'bg-green-500'}`} />
            <span>Movement</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

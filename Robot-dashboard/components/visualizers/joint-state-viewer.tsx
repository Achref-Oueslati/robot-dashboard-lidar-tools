"use client"

import { useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface JointStateViewerProps {
  data: any
}

interface JointData {
  name: string
  position: number
  velocity: number
  effort: number
}

// Wheel visualization component
function WheelVisualization({ name, position, velocity, effort }: { 
  name: string; 
  position: number; 
  velocity: number; 
  effort: number 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 35
    
    // Draw wheel outline
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    ctx.stroke()
    
    // Fill based on effort (darker = more effort)
    const effortNormalized = Math.min(Math.abs(effort) / 10, 1) // Normalize to 0-1
    ctx.fillStyle = `rgba(59, 130, 246, ${effortNormalized * 0.3})`
    ctx.fill()
    
    // Draw wheel spokes based on position
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    const spokeCount = 6
    for (let i = 0; i < spokeCount; i++) {
      const angle = (position * 2) + (i * 2 * Math.PI / spokeCount) // Rotate based on position
      const startX = centerX + Math.cos(angle) * 10
      const startY = centerY + Math.sin(angle) * 10
      const endX = centerX + Math.cos(angle) * (radius - 5)
      const endY = centerY + Math.sin(angle) * (radius - 5)
      
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    }
    
    // Draw center hub
    ctx.fillStyle = '#374151'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI)
    ctx.fill()
    
    // Draw velocity arrow
    if (Math.abs(velocity) > 0.1) {
      const arrowLength = Math.min(Math.abs(velocity) * 20, 30)
      const arrowColor = velocity > 0 ? '#10b981' : '#ef4444'
      
      ctx.strokeStyle = arrowColor
      ctx.fillStyle = arrowColor
      ctx.lineWidth = 3
      
      // Arrow direction (forward/backward)
      const arrowY = velocity > 0 ? centerY - radius - 15 : centerY + radius + 15
      const arrowStartX = centerX - arrowLength / 2
      const arrowEndX = centerX + arrowLength / 2
      
      // Arrow line
      ctx.beginPath()
      ctx.moveTo(arrowStartX, arrowY)
      ctx.lineTo(arrowEndX, arrowY)
      ctx.stroke()
      
      // Arrow head
      const headX = velocity > 0 ? arrowEndX : arrowStartX
      const headDirection = velocity > 0 ? 1 : -1
      ctx.beginPath()
      ctx.moveTo(headX, arrowY)
      ctx.lineTo(headX - headDirection * 8, arrowY - 4)
      ctx.lineTo(headX - headDirection * 8, arrowY + 4)
      ctx.closePath()
      ctx.fill()
    }
    
  }, [position, velocity, effort])
  
  const speed = Math.abs(velocity)
  const maxEffort = 10
  
  return (
    <div className="flex flex-col items-center space-y-2 p-2 border rounded-lg bg-muted/20">
      <div className="text-sm font-medium">{name.replace('_joint', '').replace('_', ' ')}</div>
      <canvas ref={canvasRef} width={100} height={120} />
      
      <div className="text-xs space-y-1 text-center w-full">
        <div className="flex justify-between">
          <span>Speed:</span>
          <span className={`font-mono ${speed > 2 ? 'text-red-500' : speed > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
            {speed.toFixed(1)} r/s
          </span>
        </div>
        <div className="flex justify-between">
          <span>Effort:</span>
          <span className={`font-mono ${Math.abs(effort) > maxEffort * 0.8 ? 'text-red-500' : Math.abs(effort) > maxEffort * 0.5 ? 'text-yellow-500' : 'text-green-500'}`}>
            {effort.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Angle:</span>
          <span className="font-mono text-muted-foreground">
            {(position * 180 / Math.PI).toFixed(0)}°
          </span>
        </div>
      </div>
    </div>
  )
}

// Robot top-down view
function RobotTopView({ jointData }: { jointData: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    // Draw robot body (rectangle)
    const robotWidth = 100
    const robotHeight = 60
    
    ctx.fillStyle = '#e5e7eb'
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.fillRect(centerX - robotWidth/2, centerY - robotHeight/2, robotWidth, robotHeight)
    ctx.strokeRect(centerX - robotWidth/2, centerY - robotHeight/2, robotWidth, robotHeight)
    
    // Draw direction arrow
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.moveTo(centerX, centerY - robotHeight/2 - 10)
    ctx.lineTo(centerX - 8, centerY - robotHeight/2 + 5)
    ctx.lineTo(centerX + 8, centerY - robotHeight/2 + 5)
    ctx.closePath()
    ctx.fill()
    
    // Draw wheels on the robot
    const wheelRadius = 12
    const wheelPositions = [
  { x: centerX + robotWidth/2 + wheelRadius, y: centerY - robotHeight/3, name: 'left_front' },
  { x: centerX + robotWidth/2 + wheelRadius, y: centerY + robotHeight/3, name: 'left_rear' },
  { x: centerX - robotWidth/2 - wheelRadius, y: centerY - robotHeight/3, name: 'right_front' },
  { x: centerX - robotWidth/2 - wheelRadius, y: centerY + robotHeight/3, name: 'right_rear' },
    ]
    
    wheelPositions.forEach(({ x, y, name }) => {
      const joint = jointData.find(j => j.name.includes(name) || j.name.includes('wheel'))
      
      // Default wheel color
      ctx.fillStyle = '#6b7280'
      ctx.strokeStyle = '#374151'
      
      if (joint) {
        // Color based on velocity
        const speed = Math.abs(joint.velocity || 0)
        if (speed > 1) {
          ctx.fillStyle = '#ef4444' // Fast = red
        } else if (speed > 0.5) {
          ctx.fillStyle = '#f59e0b' // Medium = orange
        } else if (speed > 0.1) {
          ctx.fillStyle = '#10b981' // Slow = green
        }
      }
      
      ctx.beginPath()
      ctx.arc(x, y, wheelRadius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
      
      // Draw rotation indicator
      if (joint && Math.abs(joint.velocity || 0) > 0.1) {
        const angle = (joint.position || 0) * 2
        const indicatorLength = wheelRadius * 0.6
        
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(
          x + Math.cos(angle) * indicatorLength,
          y + Math.sin(angle) * indicatorLength
        )
        ctx.stroke()
      }
    })
    
    // Draw robot label
    ctx.fillStyle = '#374151'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ROBOT', centerX, centerY + 5)
    
  }, [jointData])
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="text-sm font-medium">Robot Overview</div>
      <canvas ref={canvasRef} width={200} height={150} className="border rounded" />
      <div className="flex space-x-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Slow</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-orange-500 rounded-full" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span>Fast</span>
        </div>
      </div>
    </div>
  )
}

export function JointStateViewer({ data }: JointStateViewerProps) {
  if (!data) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-400 rounded">
              <div className="w-1 h-1 bg-blue-500 rounded-full m-0.5" />
            </div>
            Robot Joints & Wheels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Waiting for joint data...</div>
        </CardContent>
      </Card>
    )
  }

  const { name = [], position = [], velocity = [], effort = [] } = data
  
  // Create joint data array
  const jointData: JointData[] = name.map((jointName: string, index: number) => ({
    name: jointName,
    position: position[index] || 0,
    velocity: velocity[index] || 0,
    effort: effort[index] || 0
  }))

  // Separate wheels from other joints
  const wheelJoints = jointData.filter((joint: JointData) => 
    joint.name.includes('wheel') || 
    joint.name.includes('drive') ||
    joint.name.includes('left') ||
    joint.name.includes('right')
  )
  
  const otherJoints = jointData.filter((joint: JointData) => 
    !joint.name.includes('wheel') && 
    !joint.name.includes('drive') &&
    !joint.name.includes('left') &&
    !joint.name.includes('right')
  )

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-400 rounded">
            <div className="w-1 h-1 bg-blue-500 rounded-full m-0.5" />
          </div>
          Robot Joints & Wheels ({name.length} total)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Robot Overview */}
        {wheelJoints.length > 0 && (
          <div className="flex justify-center">
            <RobotTopView jointData={jointData} />
          </div>
        )}

        {/* Wheels Section */}
        {wheelJoints.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium border-b pb-1">Drive Wheels</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {wheelJoints.map((joint: JointData, index: number) => (
                <WheelVisualization
                  key={index}
                  name={joint.name}
                  position={joint.position}
                  velocity={joint.velocity}
                  effort={joint.effort}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other Joints Section */}
        {otherJoints.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium border-b pb-1">Other Joints ({otherJoints.length})</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {otherJoints.map((joint: JointData, index: number) => (
                <div key={index} className="bg-muted/50 p-2 rounded text-xs">
                  <div className="font-medium mb-1">{joint.name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-muted-foreground">Pos:</span>
                      <span className="font-mono ml-1">{joint.position.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vel:</span>
                      <span className="font-mono ml-1">{joint.velocity.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Eff:</span>
                      <span className="font-mono ml-1">{joint.effort.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="pt-2 border-t grid grid-cols-3 gap-4 text-xs text-center">
          <div>
            <div className="text-muted-foreground">Active Joints</div>
            <div className="font-semibold text-lg">
              {jointData.filter((j: JointData) => Math.abs(j.velocity) > 0.1).length}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg Speed</div>
            <div className="font-semibold text-lg">
              {(jointData.reduce((sum: number, j: JointData) => sum + Math.abs(j.velocity), 0) / jointData.length).toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Max Effort</div>
            <div className="font-semibold text-lg">
              {Math.max(...jointData.map((j: JointData) => Math.abs(j.effort))).toFixed(1)}
            </div>
          </div>
        </div>

        {name.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No joint data available</div>
        )}
      </CardContent>
    </Card>
  )
}

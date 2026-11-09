"use client"

import { useRef, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TwistStampedViewerProps {
  data: any
}

// Velocity visualization with directional arrows
function VelocityVisualization({ linear, angular }: { linear: any; angular: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const robotSize = 40
    
    // Draw robot (rectangular body)
    ctx.fillStyle = '#3b82f6'
    ctx.strokeStyle = '#1e40af'
    ctx.lineWidth = 3
    ctx.fillRect(centerX - robotSize/2, centerY - robotSize/2, robotSize, robotSize)
    ctx.strokeRect(centerX - robotSize/2, centerY - robotSize/2, robotSize, robotSize)
    
    // Draw front indicator
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(centerX - 8, centerY - robotSize/2 - 5, 16, 5)
    
    // Draw linear velocity arrow (forward/backward)
    const linearSpeed = linear?.x || 0
    if (Math.abs(linearSpeed) > 0.01) {
      const arrowLength = Math.min(Math.abs(linearSpeed) * 60, 80)
      const arrowColor = linearSpeed > 0 ? '#10b981' : '#ef4444'
      
      ctx.strokeStyle = arrowColor
      ctx.fillStyle = arrowColor
      ctx.lineWidth = 4
      
      let arrowStartY, arrowEndY
      if (linearSpeed > 0) {
        // Forward arrow
        arrowStartY = centerY - robotSize/2 - 10
        arrowEndY = arrowStartY - arrowLength
      } else {
        // Backward arrow
        arrowStartY = centerY + robotSize/2 + 10
        arrowEndY = arrowStartY + arrowLength
      }
      
      // Arrow line
      ctx.beginPath()
      ctx.moveTo(centerX, arrowStartY)
      ctx.lineTo(centerX, arrowEndY)
      ctx.stroke()
      
      // Arrow head
      const headSize = 12
      ctx.beginPath()
      ctx.moveTo(centerX, arrowEndY)
      if (linearSpeed > 0) {
        ctx.lineTo(centerX - headSize/2, arrowEndY + headSize)
        ctx.lineTo(centerX + headSize/2, arrowEndY + headSize)
      } else {
        ctx.lineTo(centerX - headSize/2, arrowEndY - headSize)
        ctx.lineTo(centerX + headSize/2, arrowEndY - headSize)
      }
      ctx.closePath()
      ctx.fill()
      
      // Speed text
      ctx.fillStyle = arrowColor
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.abs(linearSpeed).toFixed(2)} m/s`, centerX, arrowEndY + (linearSpeed > 0 ? -20 : 35))
    }
    
    // Draw angular velocity indicator (rotation arrows)
  const angularSpeed = angular?.z ? -angular.z : 0
    if (Math.abs(angularSpeed) > 0.01) {
      const rotationRadius = robotSize/2 + 15
      const arrowColor = '#f59e0b'
      
      ctx.strokeStyle = arrowColor
      ctx.fillStyle = arrowColor
      ctx.lineWidth = 3
      
      // Draw rotation circle
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(centerX, centerY, rotationRadius, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.setLineDash([])
      
      // Draw rotation direction arrows
      const numArrows = 4
      for (let i = 0; i < numArrows; i++) {
        const angle = (i * 2 * Math.PI / numArrows) + (angularSpeed > 0 ? 0.3 : -0.3)
        const arrowX = centerX + Math.cos(angle) * rotationRadius
        const arrowY = centerY + Math.sin(angle) * rotationRadius
        
        // Arrow direction
        const nextAngle = angle + (angularSpeed > 0 ? 0.3 : -0.3)
        const nextX = centerX + Math.cos(nextAngle) * rotationRadius
        const nextY = centerY + Math.sin(nextAngle) * rotationRadius
        
        // Draw arrow
        ctx.beginPath()
        ctx.moveTo(arrowX, arrowY)
        ctx.lineTo(nextX, nextY)
        ctx.stroke()
        
        // Arrow head
        const headAngle = Math.atan2(nextY - arrowY, nextX - arrowX)
        const headSize = 8
        ctx.beginPath()
        ctx.moveTo(nextX, nextY)
        ctx.lineTo(
          nextX - headSize * Math.cos(headAngle - 0.5),
          nextY - headSize * Math.sin(headAngle - 0.5)
        )
        ctx.lineTo(
          nextX - headSize * Math.cos(headAngle + 0.5),
          nextY - headSize * Math.sin(headAngle + 0.5)
        )
        ctx.closePath()
        ctx.fill()
      }
      
      // Rotation speed text
      ctx.fillStyle = arrowColor
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(
        `${Math.abs(angularSpeed).toFixed(2)} rad/s`,
        centerX,
        centerY + robotSize + 40
      )
      ctx.fillText(
        angularSpeed > 0 ? '↻ Left' : '↺ Right',
        centerX,
        centerY + robotSize + 55
      )
    }
    
    // Draw coordinate system
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    
    // X axis (left-right)
    ctx.beginPath()
    ctx.moveTo(10, centerY)
    ctx.lineTo(canvas.width - 10, centerY)
    ctx.stroke()
    
    // Y axis (up-down)
    ctx.beginPath()
    ctx.moveTo(centerX, 10)
    ctx.lineTo(centerX, canvas.height - 10)
    ctx.stroke()
    
    ctx.setLineDash([])
    
  }, [linear, angular])
  
  return <canvas ref={canvasRef} width={250} height={250} className="border rounded" />
}

// Speed gauge component
function SpeedGauge({ speed, maxSpeed = 2, label }: { speed: number; maxSpeed?: number; label: string }) {
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
    
    // Draw gauge background
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, Math.PI, 0) // Half circle
    ctx.stroke()
    
    // Draw speed arc
    const normalizedSpeed = Math.min(Math.abs(speed) / maxSpeed, 1)
    const speedAngle = Math.PI * normalizedSpeed
    
    let speedColor = '#10b981' // Green
    if (normalizedSpeed > 0.7) speedColor = '#ef4444' // Red
    else if (normalizedSpeed > 0.4) speedColor = '#f59e0b' // Orange
    
    ctx.strokeStyle = speedColor
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + speedAngle)
    ctx.stroke()
    
    // Draw needle
    const needleAngle = Math.PI + speedAngle
    const needleLength = radius - 10
    
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(
      centerX + Math.cos(needleAngle) * needleLength,
      centerY + Math.sin(needleAngle) * needleLength
    )
    ctx.stroke()
    
    // Draw center dot
    ctx.fillStyle = '#374151'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI)
    ctx.fill()
    
  }, [speed, maxSpeed])
  
  return (
    <div className="flex flex-col items-center space-y-1">
      <canvas ref={canvasRef} width={100} height={60} />
      <div className="text-xs text-center">
        <div className="font-medium">{label}</div>
        <div className="font-mono text-lg">{Math.abs(speed).toFixed(2)}</div>
        <div className="text-muted-foreground">
          {speed > 0 ? '→' : speed < 0 ? '←' : '●'}
        </div>
      </div>
    </div>
  )
}

// Joystick-style control indicator
function ControlIndicator({ linear, angular }: { linear: any; angular: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 45
    
    // Draw joystick base
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
    
    // Calculate joystick position
    const maxLinear = 2 // m/s
    const maxAngular = 2 // rad/s
    
  const xOffset = (angular?.z ? -angular.z : 0) / maxAngular * radius * 0.8
    const yOffset = -(linear?.x || 0) / maxLinear * radius * 0.8 // Inverted Y
    
    // Clamp to circle
    const distance = Math.sqrt(xOffset * xOffset + yOffset * yOffset)
    let finalX = centerX + xOffset
    let finalY = centerY + yOffset
    
    if (distance > radius * 0.9) {
      const angle = Math.atan2(yOffset, xOffset)
      finalX = centerX + Math.cos(angle) * radius * 0.9
      finalY = centerY + Math.sin(angle) * radius * 0.9
    }
    
    // Draw joystick stick
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(finalX, finalY)
    ctx.stroke()
    
    // Draw joystick knob
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.arc(finalX, finalY, 8, 0, 2 * Math.PI)
    ctx.fill()
    
    // Add glow effect if moving
    if (distance > 5) {
      ctx.shadowColor = '#3b82f6'
      ctx.shadowBlur = 10
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.arc(finalX, finalY, 6, 0, 2 * Math.PI)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    
  }, [linear, angular])
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="text-sm font-medium">Control Input</div>
      <canvas ref={canvasRef} width={120} height={120} className="border rounded" />
      <div className="text-xs text-muted-foreground text-center">
        Forward/Back ↕ Turn ↔
      </div>
    </div>
  )
}

export function TwistStampedViewer({ data }: TwistStampedViewerProps) {
  if (!data) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-4 h-4 border border-gray-400 rounded-full flex items-center justify-center">
              <div className="w-2 h-1 bg-blue-500 rounded" />
            </div>
            Robot Movement Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Waiting for velocity commands...</div>
        </CardContent>
      </Card>
    )
  }

  const twist = data.twist || data
  const { linear, angular } = twist
  const header = data.header

  const forwardSpeed = linear?.x || 0
  const angularSpeed = angular?.z || 0
  const isMoving = Math.abs(forwardSpeed) > 0.01 || Math.abs(angularSpeed) > 0.01

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-gray-400 rounded-full flex items-center justify-center">
              <div className="w-2 h-1 bg-blue-500 rounded" />
            </div>
            Robot Movement Commands
          </div>
          <div className={`w-3 h-3 rounded-full ${isMoving ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Movement Visualization */}
          <div className="flex flex-col items-center space-y-2">
            <div className="text-sm font-medium">Movement Direction</div>
            <VelocityVisualization linear={linear} angular={angular} />
          </div>

          {/* Control Input Joystick */}
          <div className="flex flex-col items-center space-y-4">
            <ControlIndicator linear={linear} angular={angular} />
            
            {/* Speed Gauges */}
            <div className="grid grid-cols-2 gap-4">
              <SpeedGauge 
                speed={forwardSpeed} 
                maxSpeed={2} 
                label="Forward"
              />
              <SpeedGauge 
                speed={angularSpeed} 
                maxSpeed={2} 
                label="Turn"
              />
            </div>
          </div>
        </div>

        {/* Status and Values */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="text-sm font-medium">Movement Status</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Direction:</span>
                <span className={`font-mono ${forwardSpeed > 0.1 ? 'text-green-500' : forwardSpeed < -0.1 ? 'text-red-500' : 'text-gray-500'}`}>
                  {forwardSpeed > 0.1 ? 'Forward' : forwardSpeed < -0.1 ? 'Backward' : 'Stopped'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Turning:</span>
                <span className={`font-mono ${angularSpeed > 0.1 ? 'text-blue-500' : angularSpeed < -0.1 ? 'text-purple-500' : 'text-gray-500'}`}>
                  {angularSpeed > 0.1 ? 'Left' : angularSpeed < -0.1 ? 'Right' : 'Straight'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Combined Speed:</span>
                <span className="font-mono">
                  {Math.sqrt(forwardSpeed*forwardSpeed + angularSpeed*angularSpeed).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Precise Values</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Linear X:</span>
                <span className="font-mono">{forwardSpeed.toFixed(3)} m/s</span>
              </div>
              <div className="flex justify-between">
                <span>Angular Z:</span>
                <span className="font-mono">{angularSpeed.toFixed(3)} rad/s</span>
              </div>
              {header && (
                <div className="flex justify-between">
                  <span>Frame:</span>
                  <span className="font-mono text-muted-foreground">{header.frame_id || "N/A"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

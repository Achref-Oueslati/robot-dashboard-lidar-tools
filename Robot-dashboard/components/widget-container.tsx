"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, Minus, Maximize2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { WidgetConfig } from "@/lib/widget-types"
import { cn } from "@/lib/utils"

interface WidgetContainerProps {
  config: WidgetConfig
  onClose: () => void
  onMinimize: () => void
  onResize: (size: { width: number; height: number }) => void
  onMove: (position: { x: number; y: number }) => void
  children: React.ReactNode
}

export function WidgetContainer({ config, onClose, onMinimize, onResize, onMove, children }: WidgetContainerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y
        onMove({
          x: config.position.x + deltaX,
          y: config.position.y + deltaY,
        })
        setDragStart({ x: e.clientX, y: e.clientY })
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y
        onResize({
          width: Math.max(300, config.size.width + deltaX),
          height: Math.max(200, config.size.height + deltaY),
        })
        setDragStart({ x: e.clientX, y: e.clientY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, config, onMove, onResize])

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute bg-card border rounded-lg shadow-lg overflow-hidden flex flex-col",
        (isDragging || isResizing) && "cursor-move select-none",
      )}
      style={{
        left: config.position.x,
        top: config.position.y,
        width: config.size.width,
        height: config.minimized ? "auto" : config.size.height,
        zIndex: isDragging ? 50 : 10,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 cursor-move" onMouseDown={handleDragStart}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs truncate" title={config.topic.name}>
            {config.topic.name}
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {config.topic.type.split("/").pop()}
        </Badge>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMinimize}>
            {config.minimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!config.minimized && <div className="flex-1 overflow-auto p-4">{children}</div>}

      {/* Resize Handle */}
      {!config.minimized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
          style={{
            background: "linear-gradient(135deg, transparent 50%, currentColor 50%)",
            opacity: 0.3,
          }}
        />
      )}
    </div>
  )
}

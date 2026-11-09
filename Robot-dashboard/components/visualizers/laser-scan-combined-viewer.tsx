"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Eye, Orbit } from "lucide-react"
import { LaserScanViewer } from "./laser-scan-viewer"
import { LaserScanOrbitViewer } from "./laser-scan-orbit-viewer"

interface LaserScanCombinedViewerProps {
  data: any
}

export function LaserScanCombinedViewer({ data }: LaserScanCombinedViewerProps) {
  const [viewMode, setViewMode] = useState<'2d' | 'orbit'>('2d')

  return (
    <div className="w-full h-full flex flex-col">
      {/* View Toggle */}
      <div className="flex gap-1 p-2 border-b">
        <Button
          variant={viewMode === '2d' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('2d')}
          className="flex items-center gap-1"
        >
          <Eye className="h-4 w-4" />
          2D View
        </Button>
        <Button
          variant={viewMode === 'orbit' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('orbit')}
          className="flex items-center gap-1"
        >
          <Orbit className="h-4 w-4" />
          3D Orbit
        </Button>
      </div>

      {/* Viewer Content */}
      <div className="flex-1">
        {viewMode === '2d' ? (
          <LaserScanViewer data={data} />
        ) : (
          <LaserScanOrbitViewer data={data} />
        )}
      </div>
    </div>
  )
}
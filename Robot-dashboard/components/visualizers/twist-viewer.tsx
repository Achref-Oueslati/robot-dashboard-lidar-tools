"use client"

interface TwistViewerProps {
  data: any
}

export function TwistViewer({ data }: TwistViewerProps) {
  if (!data) {
    return <div className="text-sm text-muted-foreground">Waiting for velocity data...</div>
  }

  const { linear, angular } = data

  // Invert angular.z for correct left/right display
  const angularFixed = angular ? { ...angular, z: angular.z ? -angular.z : 0 } : undefined

  return (
    <div className="space-y-4">
      {/* Linear Velocity */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Linear Velocity (m/s)</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 p-3 rounded">
            <div className="text-xs text-muted-foreground mb-1">X</div>
            <div className="font-mono text-lg font-semibold">{linear?.x?.toFixed(3) || "0.000"}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded">
            <div className="text-xs text-muted-foreground mb-1">Y</div>
            <div className="font-mono text-lg font-semibold">{linear?.y?.toFixed(3) || "0.000"}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded">
            <div className="text-xs text-muted-foreground mb-1">Z</div>
            <div className="font-mono text-lg font-semibold">{angularFixed?.z?.toFixed(3) || "0.000"}</div>
          </div>
        </div>
      </div>

      {/* Angular Velocity */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Angular Velocity (rad/s)</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 p-3 rounded">
            <div className="text-xs text-muted-foreground mb-1">X</div>
            <div className="font-mono text-lg font-semibold">{angular?.x?.toFixed(3) || "0.000"}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded">
            <div className="text-xs text-muted-foreground mb-1">Y</div>
            <div className="font-mono text-lg font-semibold">{angular?.y?.toFixed(3) || "0.000"}</div>
          </div>
          <div className="bg-muted/50 p-3 rounded">
            <div className="text-xs text-muted-foreground mb-1">Z</div>
            <div className="font-mono text-lg font-semibold">{angularFixed?.z?.toFixed(3) || "0.000"}</div>
          </div>
        </div>
      </div>

      {/* Speed Indicator */}
      <div className="bg-primary/10 p-3 rounded border border-primary/20">
        <div className="text-xs text-muted-foreground mb-1">Forward Speed</div>
        <div className="font-mono text-2xl font-bold text-primary">{linear?.x?.toFixed(2) || "0.00"} m/s</div>
      </div>
    </div>
  )
}

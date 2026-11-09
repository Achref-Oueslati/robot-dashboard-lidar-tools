"use client"

interface CameraInfoViewerProps {
  data: any
}

export function CameraInfoViewer({ data }: CameraInfoViewerProps) {
  if (!data) {
    return <div className="text-sm text-muted-foreground">Waiting for camera info...</div>
  }

  const { header, height, width, distortion_model, d, k, r, p, binning_x, binning_y, roi } = data

  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      {header && (
        <div className="border-b pb-2">
          <div className="font-medium mb-1">Header</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Frame: {header.frame_id || "N/A"}</div>
            <div>Seq: {header.seq || "N/A"}</div>
          </div>
        </div>
      )}

      {/* Image Dimensions */}
      <div className="bg-muted/50 p-3 rounded">
        <div className="font-medium mb-2">Image Dimensions</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Width:</span> {width || "N/A"}
          </div>
          <div>
            <span className="text-muted-foreground">Height:</span> {height || "N/A"}
          </div>
          <div>
            <span className="text-muted-foreground">Binning X:</span> {binning_x || "N/A"}
          </div>
          <div>
            <span className="text-muted-foreground">Binning Y:</span> {binning_y || "N/A"}
          </div>
        </div>
      </div>

      {/* Distortion Model */}
      <div className="bg-muted/50 p-3 rounded">
        <div className="font-medium mb-2">Distortion</div>
        <div className="text-xs">
          <div className="text-muted-foreground mb-1">Model: {distortion_model || "N/A"}</div>
          {d && d.length > 0 && (
            <div className="font-mono text-xs">D: [{d.map((v: number) => v.toFixed(4)).join(", ")}]</div>
          )}
        </div>
      </div>

      {/* Camera Matrix */}
      {k && k.length === 9 && (
        <div className="bg-muted/50 p-3 rounded">
          <div className="font-medium mb-2">Camera Matrix (K)</div>
          <div className="font-mono text-xs space-y-1">
            <div>
              [
              {k
                .slice(0, 3)
                .map((v: number) => v.toFixed(2))
                .join(", ")}
              ]
            </div>
            <div>
              [
              {k
                .slice(3, 6)
                .map((v: number) => v.toFixed(2))
                .join(", ")}
              ]
            </div>
            <div>
              [
              {k
                .slice(6, 9)
                .map((v: number) => v.toFixed(2))
                .join(", ")}
              ]
            </div>
          </div>
        </div>
      )}

      {/* ROI */}
      {roi && (
        <div className="bg-muted/50 p-3 rounded">
          <div className="font-medium mb-2">Region of Interest</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">X Offset:</span> {roi.x_offset || 0}
            </div>
            <div>
              <span className="text-muted-foreground">Y Offset:</span> {roi.y_offset || 0}
            </div>
            <div>
              <span className="text-muted-foreground">Width:</span> {roi.width || 0}
            </div>
            <div>
              <span className="text-muted-foreground">Height:</span> {roi.height || 0}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

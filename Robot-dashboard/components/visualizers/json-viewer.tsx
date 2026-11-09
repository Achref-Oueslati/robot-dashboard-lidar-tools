"use client"

interface JSONViewerProps {
  data: any
}

export function JSONViewer({ data }: JSONViewerProps) {
  if (!data) {
    return <div className="text-sm text-muted-foreground">Waiting for data...</div>
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Raw Data</div>
      <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-96 font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

import React from "react"

// Minimal WidgetContainer for Vite app, based on dashboard
export interface WidgetContainerProps {
  title: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}

export function WidgetContainer({ title, children, style }: WidgetContainerProps) {
  // No drag/resize for minimal version
  return (
    <div
      className="mx-auto my-12 max-w-2xl w-full bg-white dark:bg-card rounded-2xl shadow-xl border border-border flex flex-col"
      style={{ minHeight: 500, ...style }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b bg-muted/50 rounded-t-2xl">
        <div className="font-mono text-lg font-bold text-primary tracking-tight">
          {title}
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  )
}

import type { Topic } from "./rosbridge"

export interface WidgetConfig {
  id: string
  topic: Topic
  position: { x: number; y: number }
  size: { width: number; height: number }
  minimized: boolean
}

export interface WidgetProps {
  config: WidgetConfig
  data: any
  onClose: () => void
  onMinimize: () => void
  onResize: (size: { width: number; height: number }) => void
  onMove: (position: { x: number; y: number }) => void
}

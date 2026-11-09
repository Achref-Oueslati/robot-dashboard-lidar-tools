"use client"

import type React from "react"

import { useEffect, useState, useCallback, useMemo } from "react"
import { WidgetContainer } from "./widget-container"
import type { WidgetConfig } from "@/lib/widget-types"

interface WidgetGridProps {
  widgets: WidgetConfig[]
  onUpdateWidget: (id: string, updates: Partial<WidgetConfig>) => void
  onRemoveWidget: (id: string) => void
  subscribe: (topic: string, callback: (message: any) => void, options?: any) => () => void
  children: (config: WidgetConfig, data: any) => React.ReactNode
  isDemoMode?: boolean
}

export function WidgetGrid({
  widgets,
  onUpdateWidget,
  onRemoveWidget,
  subscribe,
  children,
  isDemoMode,
}: WidgetGridProps) {
  const [widgetData, setWidgetData] = useState<Record<string, any>>({})

  const updateWidgetData = useCallback((widgetId: string, message: any) => {
    setWidgetData((prev) => ({
      ...prev,
      [widgetId]: message,
    }))
  }, [])

  const widgetIdsString = widgets.map(w => w.id).join(",");
  useEffect(() => {
    const currentWidgetIds = new Set(widgets.map((w) => w.id));
    setWidgetData((prev) => {
      const cleaned: Record<string, any> = {};
      Object.keys(prev).forEach((id) => {
        if (currentWidgetIds.has(id)) {
          cleaned[id] = prev[id];
        } else {
          console.log(`[v0] Cleaning up data for removed widget: ${id}`);
        }
      });
      return cleaned;
    });
  }, [widgetIdsString]);

  useEffect(() => {
    if (isDemoMode) return;

    const unsubscribers: (() => void)[] = [];

    console.log(`[v0] Setting up subscriptions for ${widgets.length} widgets`);

    widgets.forEach((w) => {
      const throttleRate = getThrottleRateForType(w.topic.type);
      const unsubscribe = subscribe(w.topic.name, (message) => updateWidgetData(w.id, message), {
        throttleRate,
        queueLength: 1,
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      console.log(`[v0] Cleaning up ${unsubscribers.length} subscriptions`);
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [widgets, subscribe, isDemoMode, updateWidgetData]);

  return (
    <div className="relative w-full h-full">
      {widgets.map((widget) => (
        <WidgetContainer
          key={widget.id}
          config={widget}
          onClose={() => onRemoveWidget(widget.id)}
          onMinimize={() => onUpdateWidget(widget.id, { minimized: !widget.minimized })}
          onResize={(size) => onUpdateWidget(widget.id, { size })}
          onMove={(position) => onUpdateWidget(widget.id, { position })}
        >
          {children(widget, widgetData[widget.id])}
        </WidgetContainer>
      ))}
    </div>
  )
}

function getThrottleRateForType(messageType: string): number {
  // High-frequency sensors (IMU, joint states) - throttle to 30 Hz
  if (messageType.includes("Imu") || messageType.includes("JointState")) {
    return 33 // ~30 FPS
  }

  // Color images - throttle to 16ms (60 FPS)
  if (
    (messageType.includes("Image") || messageType.includes("CompressedImage")) &&
    !messageType.toLowerCase().includes("depth")
  ) {
    return 33 // ~30 FPS
  }

  // Depth images - throttle to 3ms (300 FPS)
  if (
    (messageType.includes("Image") || messageType.includes("CompressedImage")) &&
    messageType.toLowerCase().includes("depth")
  ) {
    return 33 // ~30 FPS
  }

  // Point clouds - throttle to 5 Hz (heavy data)
  if (messageType.includes("PointCloud")) {
    return 33 // ~30 FPS
  }

  // Other topics - throttle to 20 Hz
  return 50 // ~20 FPS
}

"use client"

import { useEffect, useRef, useState } from "react"

export function useThrottledData<T>(data: T | undefined, maxFps = 30): T | undefined {
  const [throttledData, setThrottledData] = useState<T | undefined>(data)
  const lastUpdateRef = useRef<number>(0)
  const pendingDataRef = useRef<T | undefined>(data)
  const rafRef = useRef<number>()

  useEffect(() => {
    pendingDataRef.current = data

    const minInterval = 1000 / maxFps

    const updateData = (timestamp: number) => {
      const timeSinceLastUpdate = timestamp - lastUpdateRef.current

      if (timeSinceLastUpdate >= minInterval && pendingDataRef.current !== undefined) {
        setThrottledData(pendingDataRef.current)
        lastUpdateRef.current = timestamp
      }

      rafRef.current = requestAnimationFrame(updateData)
    }

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(updateData)
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = undefined
      }
    }
  }, [data, maxFps])

  return throttledData
}

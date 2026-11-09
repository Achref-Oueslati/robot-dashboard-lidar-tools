"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRosbridge } from "./use-rosbridge"

/**
 * Ultra-low latency topic subscription hook optimized for real-time video streams
 */
export function useRealtimeTopic<T>(
  rosbridgeUrl: string | undefined,
  topicName: string | undefined,
  onMessage: (data: T) => void,
  enabled: boolean = true
) {
  const { subscribe } = useRosbridge(rosbridgeUrl)
  const lastMessageTime = useRef<number>(0)
  const messageCount = useRef<number>(0)
  const skipCount = useRef<number>(0)

  const realtimeCallback = useCallback(
    (message: T) => {
      const now = performance.now()
      messageCount.current++

      // Drop frames if we're processing too slowly (prevent buffer buildup)
      if (now - lastMessageTime.current < 16) { // Less than 16ms = over 60 FPS
        skipCount.current++
        return
      }

      lastMessageTime.current = now
      
      // Process message immediately without any queueing
      try {
        onMessage(message)
      } catch (error) {
        console.error("[useRealtimeTopic] Error processing message:", error)
      }
    },
    [onMessage]
  )

  useEffect(() => {
    if (!enabled || !rosbridgeUrl || !topicName) return

    console.log(`[useRealtimeTopic] Subscribing to ${topicName} with ultra-low latency settings`)
    
    const unsubscribe = subscribe(
      topicName,
      realtimeCallback,
      {
        throttleRate: 0,      // No throttling at rosbridge level
        queueLength: 1,       // Minimum queue to prevent buffering
      }
    )

    // Log performance stats periodically
    const statsInterval = setInterval(() => {
      const fps = messageCount.current / 5 // Messages per second over 5 seconds
      const dropRate = (skipCount.current / messageCount.current) * 100
      
      console.log(`[useRealtimeTopic] ${topicName} - FPS: ${fps.toFixed(1)}, Drop Rate: ${dropRate.toFixed(1)}%`)
      
      // Reset counters
      messageCount.current = 0
      skipCount.current = 0
    }, 5000)

    return () => {
      clearInterval(statsInterval)
      unsubscribe()
    }
  }, [enabled, rosbridgeUrl, topicName, subscribe, realtimeCallback])
}
"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { RosbridgeConnection, type ConnectionStatus, type Topic, type SubscribeOptions } from "@/lib/rosbridge"

let globalConnection: RosbridgeConnection | null = null

export function useRosbridge(url?: string) {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
  })
  const [topics, setTopics] = useState<Topic[]>([])
  const connectionRef = useRef<RosbridgeConnection | null>(null)

  useEffect(() => {
    if (!url) return

    // Use global singleton connection
    if (!globalConnection) {
      globalConnection = new RosbridgeConnection({ url })
    }

    connectionRef.current = globalConnection

    const unsubscribeStatus = globalConnection.onStatusChange(setStatus)
    const unsubscribeTopics = globalConnection.onTopicList(setTopics)

    globalConnection.connect()

    return () => {
      unsubscribeStatus()
      unsubscribeTopics()
    }
  }, [url])

  const refreshTopics = useCallback(() => {
    connectionRef.current?.requestTopicList()
  }, [])

  const subscribe = useCallback(
    (topic: string, callback: (message: any) => void, options?: SubscribeOptions) => {
      const conn = connectionRef.current
      if (!conn) return () => {}
      const realtimeOptions: SubscribeOptions = {
        throttleRate: 0,
        queueLength: 1,
        ...options,
      }
      return conn.subscribe(topic, callback, realtimeOptions)
    },
    [] // ← stays stable forever
  )

  return {
    status,
    topics,
    refreshTopics,
    subscribe,
    connection: connectionRef.current,
  }
}

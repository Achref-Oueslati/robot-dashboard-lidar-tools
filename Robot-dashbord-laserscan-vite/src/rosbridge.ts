// ROS2 rosbridge WebSocket connection manager

export interface RosbridgeConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export interface Topic {
  name: string
  type: string
}

export interface ConnectionStatus {
  connected: boolean
  error?: string
  reconnecting: boolean
}

export type MessageCallback = (message: any) => void

export interface SubscribeOptions {
  throttleRate?: number // milliseconds between messages
  queueLength?: number // max queue size
}

export class RosbridgeConnection {
  private ws: WebSocket | null = null
  private config: RosbridgeConfig
  private reconnectAttempts = 0
  private reconnectTimeout: number | null = null
  private subscriptions = new Map<string, Set<MessageCallback>>()
  private statusCallbacks = new Set<(status: ConnectionStatus) => void>()
  private topicListCallbacks = new Set<(topics: Topic[]) => void>()

  constructor(config: RosbridgeConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      ...config,
    }
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      this.ws = new WebSocket(this.config.url)

      // Ultra-low latency WebSocket settings
      this.ws.binaryType = 'arraybuffer'  // Faster binary handling

      this.ws.onopen = () => {
        console.log("[v0] Rosbridge connected")
        this.reconnectAttempts = 0
        this.notifyStatus({ connected: true, reconnecting: false })
        this.requestTopicList()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Only log operation type and topic, not the full message data
          if (data.op === "publish") {
            // Don't log the actual message data for publish operations (can be huge)
            console.log(`[v0] Received ${data.op} on topic: ${data.topic}`)
          } else {
            console.log(`[v0] Received ${data.op}`)
          }

          if (data.op === "service_response" && data.service === "/rosapi/topics_and_raw_types") {
            if (data.values) {
              const topics: Topic[] = data.values.topics.map((name: string, index: number) => ({
                name,
                type: data.values.types[index],
              }))
              console.log("[v0] Received topics:", topics)
              this.notifyTopicList(topics)
            }
          }

          // Handle subscribed topic messages
          if (data.op === "publish" && data.topic) {
            const callbacks = this.subscriptions.get(data.topic)
            if (callbacks) {
              callbacks.forEach((callback) => {
                try {
                  callback(data.msg)
                } catch (callbackError) {
                  console.error(`[v0] Error in message callback for ${data.topic}:`, callbackError)
                }
              })
            }
          }
        } catch (parseError) {
          console.error("[v0] Failed to parse WebSocket message:", parseError, event.data)
        }
      }

      this.ws.onerror = (error) => {
        console.error("[v0] Rosbridge error:", error)
        this.notifyStatus({
          connected: false,
          error: "Connection error",
          reconnecting: false,
        })
      }

      this.ws.onclose = (event) => {
        console.log("[v0] Rosbridge disconnected", { code: event.code, reason: event.reason })
        this.ws = null
        this.notifyStatus({ connected: false, reconnecting: true })
        this.attemptReconnect()
      }
    } catch (error) {
      console.error("[v0] Failed to create WebSocket:", error)
      this.notifyStatus({
        connected: false,
        error: "Failed to connect",
        reconnecting: false,
      })
    }
  }

  private attemptReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    const maxAttempts = this.config.maxReconnectAttempts || 5
    if (this.reconnectAttempts >= maxAttempts) {
      console.log("[v0] Max reconnect attempts reached. Please check if rosbridge is running.")
      this.notifyStatus({
        connected: false,
        error: "Cannot connect to rosbridge. Please check if the server is running.",
        reconnecting: false,
      })
      return
    }

    this.reconnectAttempts++
    console.log(`[v0] Reconnecting to rosbridge... (attempt ${this.reconnectAttempts}/${maxAttempts})`)

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect()
    }, this.config.reconnectInterval)
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      // Remove event listeners to prevent async response errors
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      
      // Close connection gracefully
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Client disconnect")
      }
      this.ws = null
    }

    this.subscriptions.clear()
    this.notifyStatus({ connected: false, reconnecting: false })
  }

  subscribe(topic: string, callback: MessageCallback, options?: SubscribeOptions) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set())

      // Send subscribe message to rosbridge
      if (this.ws?.readyState === WebSocket.OPEN) {
        const subscribeMsg: any = {
          op: "subscribe",
          topic,
        }

        if (options?.throttleRate) {
          subscribeMsg.throttle_rate = options.throttleRate
        }

        if (options?.queueLength) {
          subscribeMsg.queue_length = options.queueLength
        }

        console.log(`[v0] Subscribing to ${topic} with throttle: ${options?.throttleRate}ms`)
        this.ws.send(JSON.stringify(subscribeMsg))
      }
    }

    this.subscriptions.get(topic)!.add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(topic)
      if (callbacks) {
        callbacks.delete(callback)

        // If no more callbacks, unsubscribe from topic
        if (callbacks.size === 0) {
          this.subscriptions.delete(topic)
          if (this.ws?.readyState === WebSocket.OPEN) {
            console.log(`[v0] Unsubscribing from ${topic}`)
            this.ws.send(
              JSON.stringify({
                op: "unsubscribe",
                topic,
              }),
            )
          }
        }
      }
    }
  }

  requestTopicList() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[v0] Requesting topic list...")
      this.ws.send(
        JSON.stringify({
          op: "call_service",
          service: "/rosapi/topics_and_raw_types",
          args: {},
        }),
      )
    }
  }

  onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusCallbacks.add(callback)
    return () => this.statusCallbacks.delete(callback)
  }

  onTopicList(callback: (topics: Topic[]) => void) {
    this.topicListCallbacks.add(callback)
    return () => this.topicListCallbacks.delete(callback)
  }

  private notifyStatus(status: ConnectionStatus) {
    this.statusCallbacks.forEach((callback) => callback(status))
  }

  private notifyTopicList(topics: Topic[]) {
    this.topicListCallbacks.forEach((callback) => callback(topics))
  }

  getConnectionStatus(): ConnectionStatus {
    if (!this.ws) {
      return { connected: false, reconnecting: false }
    }

    return {
      connected: this.ws.readyState === WebSocket.OPEN,
      reconnecting: this.reconnectAttempts > 0,
    }
  }
}
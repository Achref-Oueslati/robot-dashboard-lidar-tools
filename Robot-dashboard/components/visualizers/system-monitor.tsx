"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Simple Progress Bar Component
function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <div 
        className="h-full bg-primary transition-all duration-300 ease-in-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

// Simple Icons
const CpuIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v6M15 1v6M9 17v6M15 17v6M1 9h6M17 9h6M1 15h6M17 15h6" />
  </svg>
)

const MemoryIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M6 19V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14M6 19H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2M6 19h12M20 19h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2M10 7h4M10 11h4M10 15h4" />
  </svg>
)

const GaugeIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

const ThermometerIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
  </svg>
)

const WifiIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M2 12.88A10.95 10.95 0 0 1 12 7a10.95 10.95 0 0 1 10 5.88M5 19.5A6 6 0 0 1 12 15a6 6 0 0 1 7 4.5M12 20h.01" />
  </svg>
)

const HardDriveIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="22" y1="12" x2="2" y2="12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    <line x1="6" y1="16" x2="6.01" y2="16" />
    <line x1="10" y1="16" x2="10.01" y2="16" />
  </svg>
)

interface SystemStats {
  cpu: {
    usage: number
    temperature: number
    cores: number
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  gpu: {
    usage: number
    memory: {
      used: number
      total: number
      percentage: number
    }
    temperature: number
  }
  disk: {
    used: number
    total: number
    percentage: number
    io?: {
      readSpeed: number
      writeSpeed: number
      readOps: number
      writeOps: number
    }
  }
  network: {
    download: number
    upload: number
  }
  fps: number
  uptime: number
}

interface SystemMonitorProps {
  updateRate?: number
}

export function SystemMonitor({ updateRate = 500 }: SystemMonitorProps) {
  // Initialize with safe default values
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isSupported, setIsSupported] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  // Real system monitoring function
  const getRealSystemStats = async (): Promise<SystemStats | null> => {
    try {
      console.log("[SystemMonitor] Fetching real system stats...")
      
      // Ultra-low latency API timeout for real-time responsiveness
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn("[SystemMonitor] Request timeout after 1 second")
        controller.abort()
      }, 1000) // 1 second timeout for ultra-responsive updates
      
      const response = await fetch('/api/system-stats', {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        // Add cache control to prevent caching issues
        cache: 'no-cache'
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const serverStats = await response.json()
      console.log("[SystemMonitor] Server stats received:", serverStats)
      
      // Enhance with browser-specific data
      const memoryInfo = (performance as any)?.memory
      const connectionInfo = (navigator as any)?.connection
      
      // Calculate real FPS (simplified to avoid blocking)
      const fps = 60 // Use fixed 60 FPS for dashboard - real FPS calculation can be expensive
      
      // Combine server stats with browser stats
      const combinedStats: SystemStats = {
        cpu: {
          usage: serverStats.cpu?.usage || 0,
          temperature: serverStats.cpu?.temperature || 50,
          cores: serverStats.cpu?.cores || navigator.hardwareConcurrency || 4
        },
        memory: {
          used: serverStats.memory?.used || (memoryInfo ? memoryInfo.usedJSHeapSize / (1024 * 1024 * 1024) : 0),
          total: serverStats.memory?.total || (memoryInfo ? memoryInfo.totalJSHeapSize / (1024 * 1024 * 1024) : 8),
          percentage: serverStats.memory?.percentage || 0
        },
        gpu: {
          usage: serverStats.gpu?.usage || 0,
          memory: {
            used: serverStats.gpu?.memory?.used || 0,
            total: serverStats.gpu?.memory?.total || 8,
            percentage: serverStats.gpu?.memory?.percentage || 0
          },
          temperature: serverStats.gpu?.temperature || 50
        },
        disk: {
          used: serverStats.disk?.used || 0,
          total: serverStats.disk?.total || 0,
          percentage: serverStats.disk?.percentage || 0
        },
        network: {
          download: serverStats.network?.download || (connectionInfo?.downlink || 0),
          upload: serverStats.network?.upload || (connectionInfo?.uplink || 0)
        },
        fps: fps,
        uptime: serverStats.uptime || (performance.now() / 1000)
      }

      console.log("[SystemMonitor] Combined stats:", combinedStats)
      return combinedStats
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn("[SystemMonitor] Request was aborted (timeout or cancel):", err.message)
      } else {
        console.warn("[SystemMonitor] Failed to fetch real system stats:", err)
      }
      return null
    }
  }

  // Fallback mock data (only used if real stats fail)
  const generateFallbackStats = (): SystemStats => {
    console.log("[SystemMonitor] Using fallback mock data")
    const baseTime = Date.now()
    
    return {
      cpu: {
        usage: Math.max(10, Math.min(95, 30 + Math.sin(baseTime / 10000) * 20 + Math.random() * 10)),
        temperature: Math.max(35, Math.min(85, 45 + Math.sin(baseTime / 15000) * 15 + Math.random() * 5)),
        cores: navigator.hardwareConcurrency || 8
      },
      memory: {
        used: Math.max(2, Math.min(15, 4 + Math.sin(baseTime / 8000) * 2 + Math.random() * 1)),
        total: 16,
        percentage: 0
      },
      gpu: {
        usage: Math.max(5, Math.min(90, 25 + Math.sin(baseTime / 12000) * 30 + Math.random() * 15)),
        memory: {
          used: Math.max(1, Math.min(7, 2 + Math.sin(baseTime / 9000) * 2 + Math.random() * 0.5)),
          total: 8,
          percentage: 0
        },
        temperature: Math.max(40, Math.min(80, 50 + Math.sin(baseTime / 11000) * 15 + Math.random() * 5))
      },
      disk: {
        used: 450,
        total: 1000,
        percentage: 45,
        io: {
          readSpeed: Math.max(0, Math.sin(baseTime / 4000) * 50 + Math.random() * 10),
          writeSpeed: Math.max(0, Math.sin(baseTime / 5000) * 30 + Math.random() * 8),
          readOps: Math.floor(Math.max(0, Math.sin(baseTime / 3000) * 1000 + Math.random() * 500)),
          writeOps: Math.floor(Math.max(0, Math.sin(baseTime / 4500) * 800 + Math.random() * 300))
        }
      },
      network: {
        download: Math.max(0, Math.sin(baseTime / 5000) * 50 + Math.random() * 20),
        upload: Math.max(0, Math.sin(baseTime / 6000) * 10 + Math.random() * 5)
      },
      fps: Math.max(30, Math.min(120, 60 + Math.sin(baseTime / 3000) * 15 + Math.random() * 10)),
      uptime: Math.floor(baseTime / 1000) % 86400 // Seconds in a day
    }
  }

  // Simple system stats fetcher
  const getSystemStats = async (): Promise<SystemStats | null> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // Faster timeout
      
      const response = await fetch('/api/system-stats', {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) return null
      
      return await response.json()
    } catch (error) {
      // Silently fail for real-time updates
      return null
    }
  }

  useEffect(() => {
    let mounted = true
    let intervalId: NodeJS.Timeout | null = null
    
    const updateStats = async () => {
      if (!mounted) return
      
      const realStats = await getSystemStats()
      
      if (!mounted) return
      
      if (realStats) {
        setStats(realStats)
        setError(undefined)
      } else {
        // Use fallback data
        const fallbackStats = generateFallbackStats()
        fallbackStats.memory.percentage = (fallbackStats.memory.used / fallbackStats.memory.total) * 100
        fallbackStats.gpu.memory.percentage = (fallbackStats.gpu.memory.used / fallbackStats.gpu.memory.total) * 100
        setStats(fallbackStats)
        setError("Using simulated data")
      }
    }
    
    // Initial update
    updateStats()
    
    // Set up interval
    intervalId = setInterval(updateStats, updateRate)
    
    return () => {
      mounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [updateRate])

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage < 50) return "text-green-500"
    if (percentage < 75) return "text-yellow-500"
    return "text-red-500"
  }

  const getTemperatureColor = (temp: number): string => {
    if (temp < 60) return "text-blue-500"
    if (temp < 75) return "text-yellow-500"
    return "text-red-500"
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GaugeIcon />
            System Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    )
  }

  if (!stats || typeof stats !== 'object') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GaugeIcon />
            System Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading system statistics...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GaugeIcon />
          System Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CPU Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CpuIcon />
              <span className="text-sm font-medium">CPU ({stats.cpu?.cores || 0} cores)</span>
            </div>
            <span className={`text-sm font-mono ${getUsageColor(stats.cpu?.usage || 0)}`}>
              {(stats.cpu?.usage || 0).toFixed(1)}%
            </span>
          </div>
          <Progress value={stats.cpu?.usage || 0} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <ThermometerIcon />
              <span className={getTemperatureColor(stats.cpu?.temperature || 0)}>
                {(stats.cpu?.temperature || 0).toFixed(0)}°C
              </span>
            </div>
            <span>FPS: {(stats.fps || 0).toFixed(0)}</span>
          </div>
        </div>

        {/* Memory Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MemoryIcon />
              <span className="text-sm font-medium">Memory</span>
            </div>
            <span className={`text-sm font-mono ${getUsageColor(stats.memory?.percentage || 0)}`}>
              {(stats.memory?.used || 0).toFixed(1)} / {(stats.memory?.total || 0).toFixed(0)} GB
            </span>
          </div>
          <Progress value={stats.memory?.percentage || 0} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {(stats.memory?.percentage || 0).toFixed(1)}% used
          </div>
        </div>

        {/* GPU Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GaugeIcon />
              <span className="text-sm font-medium">GPU</span>
            </div>
            <span className={`text-sm font-mono ${getUsageColor(stats.gpu?.usage || 0)}`}>
              {(stats.gpu?.usage || 0).toFixed(1)}%
            </span>
          </div>
          <Progress value={stats.gpu?.usage || 0} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <ThermometerIcon />
              <span className={getTemperatureColor(stats.gpu?.temperature || 0)}>
                {(stats.gpu?.temperature || 0).toFixed(0)}°C
              </span>
            </div>
            <span>VRAM: {(stats.gpu?.memory?.used || 0).toFixed(1)}/{stats.gpu?.memory?.total || 0} GB</span>
          </div>
        </div>

        {/* Disk I/O Activity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HardDriveIcon />
            <span className="text-sm font-medium">Disk Activity</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">📖 Read:</span>
              <span className="font-mono text-blue-500">
                {stats.disk?.io ? `${stats.disk.io.readSpeed.toFixed(1)} MB/s` : '0.0 MB/s'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">✏️ Write:</span>
              <span className="font-mono text-red-500">
                {stats.disk?.io ? `${stats.disk.io.writeSpeed.toFixed(1)} MB/s` : '0.0 MB/s'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div className="text-center">
              {stats.disk?.io ? `${stats.disk.io.readOps} ops` : '0 ops'}
            </div>
            <div className="text-center">
              {stats.disk?.io ? `${stats.disk.io.writeOps} ops` : '0 ops'}
            </div>
          </div>
        </div>

        {/* Network Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <WifiIcon />
            <span className="text-sm font-medium">Network</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">↓ Download:</span>
              <span className="font-mono text-green-500">{(stats.network?.download || 0).toFixed(1)} Mbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">↑ Upload:</span>
              <span className="font-mono text-blue-500">{(stats.network?.upload || 0).toFixed(1)} Mbps</span>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Uptime:</span>
            <span className="font-mono">{formatUptime(stats.uptime || 0)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
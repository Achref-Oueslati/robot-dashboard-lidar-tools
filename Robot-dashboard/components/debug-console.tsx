"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface LogEntry {
  timestamp: string
  level: 'log' | 'warn' | 'error'
  message: string
}

export function DebugConsole() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [memoryInfo, setMemoryInfo] = useState<any>(null)

  useEffect(() => {
    // Capture console logs without causing render loops
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error

    console.log = (...args) => {
      originalLog(...args)
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        setLogs(prev => [...prev.slice(-49), {
          timestamp: new Date().toLocaleTimeString(),
          level: 'log',
          message: args.join(' ')
        }])
      }, 0)
    }

    console.warn = (...args) => {
      originalWarn(...args)
      setTimeout(() => {
        setLogs(prev => [...prev.slice(-49), {
          timestamp: new Date().toLocaleTimeString(),
          level: 'warn',
          message: args.join(' ')
        }])
      }, 0)
    }

    console.error = (...args) => {
      originalError(...args)
      setTimeout(() => {
        setLogs(prev => [...prev.slice(-49), {
          timestamp: new Date().toLocaleTimeString(),
          level: 'error',
          message: args.join(' ')
        }])
      }, 0)
    }

    // Monitor memory usage
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo((performance as any).memory)
      }
    }
    
    updateMemoryInfo()
    const memoryInterval = setInterval(updateMemoryInfo, 2000)

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      clearInterval(memoryInterval)
    }
  }, [])

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const clearLogs = () => {
    setLogs([])
  }

  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 hover:bg-gray-700"
        size="sm"
      >
        🐛 Debug
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-96 z-50 bg-black/90 text-white border-gray-600">
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-center text-sm">
          <span>🐛 Debug Console</span>
          <div className="flex gap-2">
            <Button onClick={clearLogs} size="sm" variant="outline">Clear</Button>
            <Button onClick={() => setIsOpen(false)} size="sm" variant="outline">×</Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 h-full overflow-hidden flex flex-col">
        
        {/* Memory Info */}
        {memoryInfo && (
          <div className="text-xs mb-2 p-2 bg-gray-800 rounded">
            <div>JS Heap: {formatBytes(memoryInfo.usedJSHeapSize)} / {formatBytes(memoryInfo.totalJSHeapSize)}</div>
            <div>Limit: {formatBytes(memoryInfo.jsHeapSizeLimit)}</div>
          </div>
        )}

        {/* Console Logs */}
        <div className="flex-1 overflow-y-auto text-xs font-mono space-y-1 bg-gray-900 p-2 rounded">
          {logs.map((log, idx) => (
            <div 
              key={idx} 
              className={`${
                log.level === 'error' ? 'text-red-400' : 
                log.level === 'warn' ? 'text-yellow-400' : 
                'text-green-400'
              }`}
            >
              <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-gray-500">No logs yet...</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
import { NextRequest } from 'next/server'
import { SystemMonitor } from '@/lib/system-monitor'

export async function GET(request: NextRequest) {
  console.log('[SSE] New client connected to system stats stream')
  
  // Set up Server-Sent Events
  const encoder = new TextEncoder()
  let interval: NodeJS.Timeout | null = null
  let isActive = true
  
  const stream = new ReadableStream({
    async start(controller) {
      const systemMonitor = SystemMonitor.getInstance()
      
      // Send initial data immediately
      try {
        const stats = await systemMonitor.getAllStats()
        const data = `data: ${JSON.stringify(stats)}\n\n`
        if (isActive) {
          controller.enqueue(encoder.encode(data))
        }
      } catch (error) {
        console.error('[SSE] Initial stats error:', error)
      }
      
      // Set up interval for updates (every 8 seconds - reduced frequency)
      interval = setInterval(async () => {
        if (!isActive) {
          return
        }
        
        try {
          const stats = await systemMonitor.getAllStats()
          const data = `data: ${JSON.stringify(stats)}\n\n`
          controller.enqueue(encoder.encode(data))
          console.log('[SSE] Stats sent to client')
        } catch (error) {
          console.error('[SSE] Stats update error:', error)
          if (isActive) {
            // Send error message
            const errorData = `data: ${JSON.stringify({ error: 'Failed to get stats' })}\n\n`
            controller.enqueue(encoder.encode(errorData))
          }
        }
      }, 8000) // 8 second intervals (reduced from 5)
      
      // Clean up on client disconnect
      const cleanup = () => {
        console.log('[SSE] Client disconnected, cleaning up')
        isActive = false
        if (interval) {
          clearInterval(interval)
          interval = null
        }
        try {
          controller.close()
        } catch (e) {
          // Controller might already be closed
        }
      }
      
      request.signal?.addEventListener('abort', cleanup)
      
      // Additional cleanup after 5 minutes (safety net)
      setTimeout(() => {
        if (isActive) {
          console.log('[SSE] Auto-cleanup after 5 minutes')
          cleanup()
        }
      }, 5 * 60 * 1000)
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
      // Add explicit timeout
      'Keep-Alive': 'timeout=300, max=100'
    },
  })
}
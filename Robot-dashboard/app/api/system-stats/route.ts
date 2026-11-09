import { NextRequest, NextResponse } from 'next/server'
import { SystemMonitor } from '@/lib/system-monitor'

interface SystemStats {
  cpu: {
    usage: number
    temperature: number
    cores: number
    model?: string
  }
  memory: {
    used: number
    total: number
    percentage: number
    available?: number
  }
  gpu: {
    usage: number
    memory: {
      used: number
      total: number
      percentage: number
    }
    temperature: number
    name?: string
  }
  disk: {
    used: number
    total: number
    percentage: number
    available?: number
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
    interfaces?: Array<{ name: string; rx: number; tx: number }>
  }
  uptime: number
  fps?: number
}

export async function GET(request: NextRequest) {
  try {
    console.log('[API] Getting system stats...')
    
    const systemMonitor = SystemMonitor.getInstance()
    const systemInfo = await systemMonitor.getAllStats()
    
    console.log('[API] System info received:', {
      cpu: systemInfo.cpu.usage,
      memory: systemInfo.memory.percentage,
      gpu: systemInfo.gpu.usage
    })
    
    // Convert to the expected format
    const stats: SystemStats = {
      cpu: {
        usage: systemInfo.cpu.usage,
        temperature: systemInfo.cpu.temperature,
        cores: systemInfo.cpu.cores,
        model: systemInfo.cpu.model
      },
      memory: {
        used: systemInfo.memory.used,
        total: systemInfo.memory.total,
        percentage: systemInfo.memory.percentage,
        available: systemInfo.memory.available
      },
      gpu: {
        usage: systemInfo.gpu.usage,
        memory: {
          used: systemInfo.gpu.memory.used,
          total: systemInfo.gpu.memory.total,
          percentage: systemInfo.gpu.memory.percentage
        },
        temperature: systemInfo.gpu.temperature,
        name: systemInfo.gpu.name
      },
      disk: {
        used: systemInfo.disk.used,
        total: systemInfo.disk.total,
        percentage: systemInfo.disk.percentage,
        available: systemInfo.disk.available,
        io: systemInfo.disk.io
      },
      network: {
        download: systemInfo.network.download,
        upload: systemInfo.network.upload,
        interfaces: systemInfo.network.interfaces
      },
      uptime: systemInfo.uptime
    }
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('System monitoring error:', error)
    return NextResponse.json(
      { error: 'Failed to get system stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
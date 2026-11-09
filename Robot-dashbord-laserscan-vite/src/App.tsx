
import { useState, useEffect } from 'react'
import { LaserScanViewer } from './LaserScanViewer'
import { WidgetContainer } from './WidgetContainer'
import { useRosbridge } from './useRosbridge'


function App() {
  // Rosbridge connection is always attempted; no auto-connect or URL input
  const [scanData, setScanData] = useState<any>(null)

  // Only connect if autoConnect is enabled
  const { status, topics, subscribe } = useRosbridge('ws://localhost:9090')

  // Find laser scan topics
  const laserTopics = topics.filter(topic => 
    topic.type === 'sensor_msgs/LaserScan' || 
    topic.type === 'sensor_msgs/msg/LaserScan'
  )

  // Auto-subscribe to the first available scan topic
  useEffect(() => {
    if (!status.connected || laserTopics.length === 0) {
      setScanData(null)
      return
    }

    const scanTopic = laserTopics.find(t => t.name === '/scan') || laserTopics[0]
    const unsubscribe = subscribe(scanTopic.name, (message) => {
      setScanData(message)
    })

    return unsubscribe
  }, [status.connected, laserTopics, subscribe])


  // Connection indicator: green if connected, red if not
  const getStatusColor = () => (status.connected ? '#22c55e' : '#ef4444')
  const getStatusText = () => (status.connected ? 'Connected' : 'Not Connected')


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-inter">
      <main className="flex-1 w-full flex flex-col items-center justify-center px-4 py-6">
        <WidgetContainer title={
          <div className="flex items-center gap-3">
            <span
              className="inline-block rounded-full border border-border"
              style={{
                width: '18px',
                height: '18px',
                backgroundColor: getStatusColor(),
                boxShadow: status.connected
                  ? '0 0 8px 2px #22c55e88'
                  : '0 0 8px 2px #ef444488',
              }}
            />
            <span className="font-bold text-xl text-primary">LaserScan Viewer</span>
            <span className="font-medium text-lg text-muted-foreground">{getStatusText()}</span>
          </div>
        }>
          <LaserScanViewer data={scanData} />
        </WidgetContainer>
      </main>
    </div>
  )
}

export default App
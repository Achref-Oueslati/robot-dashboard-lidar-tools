"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ConnectionConfigProps {
  onConnect: (url: string) => void
  isConnected: boolean
}

export function ConnectionConfig({ onConnect, isConnected }: ConnectionConfigProps) {
  const [url, setUrl] = useState("ws://localhost:9090")

  const handleConnect = () => {
    if (url.trim()) {
      onConnect(url.trim())
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>ROS2 Bridge Connection</CardTitle>
        <CardDescription>Connect to your rosbridge_suite WebSocket server</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ws-url">WebSocket URL</Label>
          <Input
            id="ws-url"
            type="text"
            placeholder="ws://localhost:9090"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isConnected}
          />
        </div>
        <Button onClick={handleConnect} disabled={isConnected || !url.trim()} className="w-full">
          {isConnected ? "Connected" : "Connect"}
        </Button>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Search, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TopicTree } from "@/components/topic-tree"
import type { Topic, ConnectionStatus } from "@/lib/rosbridge"
import { cn } from "@/lib/utils"

interface SidePanelProps {
  topics: Topic[]
  status: ConnectionStatus
  onAddWidget: (topic: Topic) => void
  onRefreshTopics: () => void
  isDemoMode?: boolean // Added isDemoMode prop
}

export function SidePanel({ topics, status, onAddWidget, onRefreshTopics, isDemoMode }: SidePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTopics = topics.filter(
    (topic) =>
      topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.type.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className={cn("relative h-full border-r bg-card transition-all duration-300", isCollapsed ? "w-12" : "w-80")}>
      {/* Collapse/Expand Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-md"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {!isCollapsed && (
        <div className="flex h-full flex-col">
          {/* Header with Connection Status */}
          <div className="border-b p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Topics</h2>
              {!isDemoMode && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefreshTopics}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  status.connected ? "bg-green-500 animate-pulse" : isDemoMode ? "bg-amber-500" : "bg-red-500",
                )}
              />
              <span className="text-xs text-muted-foreground">
                {isDemoMode
                  ? "Demo Mode"
                  : status.connected
                    ? "Connected"
                    : status.reconnecting
                      ? "Reconnecting..."
                      : "Disconnected"}
              </span>
            </div>

            {status.error && <div className="text-xs text-destructive">{status.error}</div>}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="topic-search"
                name="topicSearch"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Topic List */}
          <ScrollArea className="flex-1 overflow-x-auto">
            <div className="p-2 min-w-max">
              {filteredTopics.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {topics.length === 0 ? "No topics available" : "No topics match your search"}
                </div>
              ) : (
                <TopicTree topics={filteredTopics} onAddWidget={onAddWidget} />
              )}
            </div>
          </ScrollArea>

          {/* Footer with Topic Count */}
          <div className="border-t p-3">
            <div className="text-xs text-muted-foreground text-center">
              {filteredTopics.length} of {topics.length} topics
            </div>
          </div>
        </div>
      )}

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="flex h-full flex-col items-center py-4 gap-4">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              status.connected ? "bg-green-500 animate-pulse" : isDemoMode ? "bg-amber-500" : "bg-red-500",
            )}
          />
          <div className="text-xs text-muted-foreground writing-mode-vertical transform rotate-180">
            {topics.length}
          </div>
        </div>
      )}
    </div>
  )
}

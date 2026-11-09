"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Topic } from "@/lib/rosbridge"
import { cn } from "@/lib/utils"

interface TopicNode {
  name: string
  fullPath: string
  children: Map<string, TopicNode>
  topic?: Topic // Only leaf nodes have topic data
}

function buildTopicTree(topics: Topic[]): TopicNode {
  const root: TopicNode = {
    name: "",
    fullPath: "",
    children: new Map(),
  }

  for (const topic of topics) {
    const parts = topic.name.split("/").filter(Boolean) // Remove empty strings from leading /
    let currentNode = root

    parts.forEach((part, index) => {
      const fullPath = "/" + parts.slice(0, index + 1).join("/")

      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, {
          name: part,
          fullPath,
          children: new Map(),
        })
      }

      currentNode = currentNode.children.get(part)!

      // If this is the last part, attach the topic data
      if (index === parts.length - 1) {
        currentNode.topic = topic
      }
    })
  }

  return root
}

interface TopicTreeNodeProps {
  node: TopicNode
  level: number
  onAddWidget: (topic: Topic) => void
}

function TopicTreeNode({ node, level, onAddWidget }: TopicTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0) // Auto-expand root level
  const hasChildren = node.children.size > 0
  const isTopic = !!node.topic

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors",
          level > 0 && "cursor-pointer",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren && (
          <div className="flex-shrink-0">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        )}

        {/* Node Name */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-xs truncate",
              isTopic ? "text-foreground" : "text-muted-foreground font-medium",
            )}
            title={node.fullPath}
          >
            {node.name}
          </span>

          {/* Type Badge for leaf topics */}
          {isTopic && node.topic && (
            <Badge variant="secondary" className="text-[10px] font-normal flex-shrink-0">
              {node.topic.type.split("/").pop()}
            </Badge>
          )}
        </div>

        {/* Add Widget Button - only for leaf topics */}
        {isTopic && node.topic && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onAddWidget(node.topic!)
            }}
            title="Add widget"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {Array.from(node.children.values()).map((child) => (
            <TopicTreeNode key={child.fullPath} node={child} level={level + 1} onAddWidget={onAddWidget} />
          ))}
        </div>
      )}
    </div>
  )
}

interface TopicTreeProps {
  topics: Topic[]
  onAddWidget: (topic: Topic) => void
}

export function TopicTree({ topics, onAddWidget }: TopicTreeProps) {
  const tree = buildTopicTree(topics)

  if (tree.children.size === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No topics available</div>
  }

  return (
    <div className="space-y-0.5">
      {Array.from(tree.children.values()).map((child) => (
        <TopicTreeNode key={child.fullPath} node={child} level={0} onAddWidget={onAddWidget} />
      ))}
    </div>
  )
}

/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Individual message bubble component for displaying timeline entries in the ARC3 chat interface.
SRP/DRY check: Pass — isolates message rendering logic from timeline management and state.
*/

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Wrench, Brain, MessageSquare, Clock } from 'lucide-react';

interface Arc3MessageBubbleProps {
  entry: {
    index: number;
    type: 'assistant_message' | 'tool_call' | 'tool_result' | 'reasoning';
    label: string;
    content: string;
  };
  timestamp?: number;
}

export const Arc3MessageBubble: React.FC<Arc3MessageBubbleProps> = ({
  entry,
  timestamp,
}) => {
  const getIcon = () => {
    switch (entry.type) {
      case 'assistant_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'tool_call':
        return <Wrench className="h-4 w-4" />;
      case 'tool_result':
        return <Bot className="h-4 w-4" />;
      case 'reasoning':
        return <Brain className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeColor = () => {
    switch (entry.type) {
      case 'assistant_message':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'tool_call':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'tool_result':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'reasoning':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getTypeLabel = () => {
    switch (entry.type) {
      case 'assistant_message':
        return 'Message';
      case 'tool_call':
        return 'Tool Call';
      case 'tool_result':
        return 'Tool Result';
      case 'reasoning':
        return 'Reasoning';
      default:
        return 'Unknown';
    }
  };

  const formatContent = () => {
    try {
      // Try to parse as JSON for better formatting
      const parsed = JSON.parse(entry.content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Return as-is if not valid JSON
      return entry.content;
    }
  };

  const shouldTruncate = entry.content.length > 500;
  const [isExpanded, setIsExpanded] = React.useState(false);

  const displayContent = shouldTruncate && !isExpanded
    ? entry.content.substring(0, 500) + '...'
    : formatContent();

  return (
    <div className="mb-3 last:mb-0">
      <Card className={`border-l-4 ${getTypeColor()}`}>
        <CardContent className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getIcon()}
              <span className="font-medium text-sm">{entry.label}</span>
              <Badge variant="secondary" className="text-xs">
                {getTypeLabel()}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {timestamp && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(timestamp).toLocaleTimeString()}
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                #{entry.index}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="text-sm">
            {entry.type === 'reasoning' ? (
              <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded font-mono text-xs overflow-x-auto">
                <pre className="whitespace-pre-wrap">{displayContent}</pre>
              </div>
            ) : entry.type === 'tool_call' || entry.type === 'tool_result' ? (
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-xs overflow-x-auto">
                <pre className="whitespace-pre-wrap">{displayContent}</pre>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap">{displayContent}</p>
              </div>
            )}
          </div>

          {/* Expand/Collapse button for long content */}
          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Arc3MessageBubble;

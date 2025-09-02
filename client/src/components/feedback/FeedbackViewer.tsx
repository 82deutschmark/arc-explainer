/**
 * FeedbackViewer Component
 * @author Claude Code
 * 
 * Displays a list of feedback items with vote types, comments, and timestamps.
 * Shows user-friendly formatting with vote indicators and proper styling.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, Clock, User, Lightbulb } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Feedback, DetailedFeedback } from '@shared/types';

interface FeedbackViewerProps {
  feedback: Feedback[] | DetailedFeedback[];
  showExplanationContext?: boolean;
  className?: string;
  maxItems?: number;
}

export function FeedbackViewer({ 
  feedback, 
  showExplanationContext = false, 
  className = "",
  maxItems 
}: FeedbackViewerProps) {
  if (!feedback || feedback.length === 0) {
    return (
      <div className={`text-center text-muted-foreground py-4 ${className}`}>
        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No feedback available yet</p>
        <p className="text-xs mt-1">Be the first to provide feedback!</p>
      </div>
    );
  }

  const displayFeedback = maxItems ? feedback.slice(0, maxItems) : feedback;

  return (
    <div className={`space-y-3 ${className}`}>
      {displayFeedback.map((item) => (
        <FeedbackItem 
          key={item.id} 
          feedback={item} 
          showExplanationContext={showExplanationContext}
        />
      ))}
      
      {maxItems && feedback.length > maxItems && (
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {maxItems} of {feedback.length} feedback items
          </p>
        </div>
      )}
    </div>
  );
}

interface FeedbackItemProps {
  feedback: Feedback | DetailedFeedback;
  showExplanationContext: boolean;
}

function FeedbackItem({ feedback, showExplanationContext }: FeedbackItemProps) {
  const isDetailed = 'modelName' in feedback;

  const getFeedbackDisplay = () => {
    switch (feedback.feedbackType) {
      case 'helpful':
        return {
          icon: <ThumbsUp className="h-4 w-4 text-green-600" />,
          text: 'Helpful',
          variant: 'default' as const,
        };
      case 'not_helpful':
        return {
          icon: <ThumbsDown className="h-4 w-4 text-red-600" />,
          text: 'Not Helpful',
          variant: 'destructive' as const,
        };
      case 'solution_explanation':
        return {
          icon: <Lightbulb className="h-4 w-4 text-yellow-500" />,
          text: 'Solution Explanation',
          variant: 'secondary' as const,
        };
      default:
        return {
          icon: null,
          text: '',
          variant: 'outline' as const,
        };
    }
  };

  const { icon, text, variant } = getFeedbackDisplay();

  return (
    <Card className="border-l-4 border-l-transparent hover:border-l-blue-200 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            {icon}
            <Badge variant={variant} className="text-xs">
              {text}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
          </div>
        </div>
        
        {showExplanationContext && isDetailed && (
          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {feedback.modelName}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Puzzle: {feedback.puzzleId}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Confidence: {feedback.confidence}%
              </Badge>
            </div>
          </div>
        )}
        
        {feedback.comment && (
          <div className="mt-3">
            <p className="text-sm leading-relaxed">{feedback.comment}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
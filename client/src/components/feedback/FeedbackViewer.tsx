/**
 * FeedbackViewer.tsx
 *
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Display feedback items with optional dark theme variants for Puzzle Analyst cards.
 * SRP/DRY check: Pass - Feedback display only.
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
      <div className={`text-center text-muted-foreground py-4 dark:text-slate-300 ${className}`}>
        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No feedback available yet</p>
        <p className="text-xs mt-1 dark:text-slate-400">Be the first to provide feedback!</p>
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
          icon: <ThumbsUp className="h-4 w-4 text-green-600 dark:text-emerald-300" />,
          text: 'Helpful',
          variant: 'default' as const,
        };
      case 'not_helpful':
        return {
          icon: <ThumbsDown className="h-4 w-4 text-red-600 dark:text-rose-300" />,
          text: 'Not Helpful',
          variant: 'destructive' as const,
        };
      case 'solution_explanation':
        return {
          icon: <Lightbulb className="h-4 w-4 text-yellow-500 dark:text-amber-300" />,
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
    <Card className="border-l-4 border-l-transparent hover:border-l-blue-200 transition-colors dark:border-slate-800/70 dark:hover:border-l-sky-400 dark:bg-slate-950/40">
      <CardContent className="p-4 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            {icon}
            <Badge variant={variant} className="text-xs dark:border-slate-700/60 dark:text-slate-100">
              {text}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-slate-400 flex-shrink-0">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
          </div>
        </div>
        
        {showExplanationContext && isDetailed && (
          <div className="mt-2 p-2 bg-muted/50 rounded text-xs dark:bg-slate-900/60 dark:text-slate-200">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs dark:border-slate-700/60 dark:text-slate-100">
                {feedback.modelName}
              </Badge>
              <Badge variant="outline" className="text-xs dark:border-slate-700/60 dark:text-slate-100">
                Puzzle: {feedback.puzzleId}
              </Badge>
              <Badge variant="outline" className="text-xs dark:border-slate-700/60 dark:text-slate-100">
                Confidence: {feedback.confidence}%
              </Badge>
            </div>
          </div>
        )}
        
        {feedback.comment && (
          <div className="mt-3">
            <p className="text-sm leading-relaxed dark:text-slate-100">{feedback.comment}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

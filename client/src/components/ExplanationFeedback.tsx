/**
 * ExplanationFeedback.tsx
 *
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Collect feedback on explanations with optional dark theme variants for Puzzle Analyst.
 * SRP/DRY check: Pass - Feedback widget only.
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExplanationFeedbackProps {
  puzzleId: string;
  explanationId: number;
  onFeedbackSubmitted?: () => void;
}

export function ExplanationFeedback({ puzzleId, explanationId, onFeedbackSubmitted }: ExplanationFeedbackProps) {
  const [vote, setVote] = useState<'helpful' | 'not_helpful' | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  
  const MINIMUM_COMMENT_LENGTH = 20;
  
  // Calculate validation state
  const isCommentValid = useMemo(() => {
    // Comment must be at least 20 chars for helpful ratings
    // For not_helpful ratings, we still enforce this to get actionable feedback
    return comment.trim().length >= MINIMUM_COMMENT_LENGTH;
  }, [comment]);
  const { toast } = useToast();

  const { mutate: submitFeedback, isPending: isLoading } = useMutation({
    mutationFn: async () => {
      // Don't proceed if validation fails
      if (!isCommentValid) {
        throw new Error('Please provide detailed feedback (at least 20 characters)');
      }
      
      // Debug logging  
      console.log('Raw explanationId:', explanationId, 'Type:', typeof explanationId);
      
      // Ensure explanationId is explicitly sent as a number
      const numericExplanationId = parseInt(String(explanationId), 10);
      console.log('Parsed explanationId:', numericExplanationId);
      
      // Create payload with numeric explanationId
      const payload = {
        puzzleId: puzzleId,
        explanationId: numericExplanationId,
        feedbackType: vote,
        comment: comment.trim()
      };
      
      console.log('Sending payload:', JSON.stringify(payload));
      
      // Direct approach with simpler payload
      return apiRequest('POST', '/api/feedback', payload);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
      console.error('Error submitting feedback:', error);
    }
  });

  if (submitted) {
    return (
      <div className="border-t pt-4 mt-4 dark:border-slate-800/70">
        <p className="text-sm text-green-600 dark:text-emerald-300">
          Thank you for your feedback! Your input helps improve our explanations.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4 mt-4 dark:border-slate-800/70">
      <h3 className="text-sm font-medium mb-2 dark:text-slate-100">Was this explanation helpful? Or just a hallucination?</h3>
      <p className="text-xs text-muted-foreground mb-2 dark:text-slate-300">
        Your detailed feedback helps us improve our AI explanations. 
        <strong> Please include what was right or wrong about the explanation!!</strong>.
      </p>
      
      <div className="flex gap-2 mb-3">
        <Button 
          onClick={() => setVote('helpful')}
          variant={vote === 'helpful' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-1 dark:border-slate-700/60 dark:text-slate-100"
        >
          <ThumbsUp className="h-4 w-4" />
          Helpful
        </Button>
        <Button 
          onClick={() => setVote('not_helpful')}
          variant={vote === 'not_helpful' ? 'destructive' : 'outline'}
          size="sm"
          className="flex items-center gap-1 dark:border-slate-700/60 dark:text-slate-100"
        >
          <ThumbsDown className="h-4 w-4" />
          Not helpful
        </Button>
      </div>
      
      <div className="space-y-2">
        <Textarea 
          placeholder={vote === 'helpful' 
            ? "Why was this explanation helpful? What did it get right?" 
            : vote === 'not_helpful'
              ? "Why was this explanation not helpful? What was incorrect?"
              : "Please explain your rating (minimum 20 characters required)"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={cn(
            "w-full p-2 border rounded text-sm resize-none dark:bg-slate-950/70 dark:text-slate-100 dark:border-slate-700/60",
            attemptedSubmit && !isCommentValid && "border-red-500 focus:border-red-500 focus:ring-red-500"
          )}
          rows={3}
        />
        
        {/* Character count and validation message */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center">
            {isCommentValid ? (
              <CheckCircle className="h-3 w-3 text-green-500 dark:text-emerald-300 mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-500 dark:text-amber-300 mr-1" />
            )}
            <span className={isCommentValid ? "text-green-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}>
              {comment.trim().length}/{MINIMUM_COMMENT_LENGTH} characters
            </span>
          </div>
          
          {attemptedSubmit && !isCommentValid && (
            <span className="text-red-500 dark:text-rose-300">
              Please provide more detailed feedback
            </span>
          )}
        </div>
      </div>
      
      <Button 
        onClick={() => {
          setAttemptedSubmit(true);
          if (vote && isCommentValid) {
            submitFeedback();
          }
        }}
        disabled={!vote || isLoading}
        className="mt-2"
        size="sm"
        variant={isCommentValid ? "default" : "secondary"}
      >
        {isLoading ? 'Submitting...' : 'Submit Feedback'}
      </Button>
    </div>
  );
}

/**
 * ExplanationFeedback Component
 * @author Cascade - Claude 3.7 Sonnet Thinking
 * 
 * Enhanced feedback widget that allows users to rate if an explanation was helpful or not,
 * with required detailed feedback to improve explanation quality. Users must provide
 * substantial feedback (min 20 chars) to explain why they consider an explanation helpful or not.
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
  explanationId: number;
  onFeedbackSubmitted?: () => void;
}

export function ExplanationFeedback({ explanationId, onFeedbackSubmitted }: ExplanationFeedbackProps) {
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
      
      return apiRequest('/api/feedback', 'POST', {
        explanationId,
        voteType: vote,
        comment: comment.trim()
      });
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
      <div className="border-t pt-4 mt-4">
        <p className="text-sm text-green-600">
          Thank you for your feedback! Your input helps improve our explanations.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-sm font-medium mb-2">Was this explanation helpful? Or just a hallucination?</h3>
      <p className="text-xs text-muted-foreground mb-2">
        Your detailed feedback helps us improve our AI explanations. 
        <strong> Please include what was right or wrong about the explanation!!</strong>.
      </p>
      
      <div className="flex gap-2 mb-3">
        <Button 
          onClick={() => setVote('helpful')}
          variant={vote === 'helpful' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-1"
        >
          <ThumbsUp className="h-4 w-4" />
          Helpful
        </Button>
        <Button 
          onClick={() => setVote('not_helpful')}
          variant={vote === 'not_helpful' ? 'destructive' : 'outline'}
          size="sm"
          className="flex items-center gap-1"
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
            "w-full p-2 border rounded text-sm resize-none",
            attemptedSubmit && !isCommentValid && "border-red-500 focus:border-red-500 focus:ring-red-500"
          )}
          rows={3}
        />
        
        {/* Character count and validation message */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center">
            {isCommentValid ? (
              <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-500 mr-1" />
            )}
            <span className={isCommentValid ? "text-green-600" : "text-amber-600"}>
              {comment.trim().length}/{MINIMUM_COMMENT_LENGTH} characters
            </span>
          </div>
          
          {attemptedSubmit && !isCommentValid && (
            <span className="text-red-500">
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

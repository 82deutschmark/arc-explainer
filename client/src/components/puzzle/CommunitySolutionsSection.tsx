/**
 * CommunitySolutionsSection Component
 * 
 * Displays community solutions with voting functionality.
 * Single responsibility: Show user-submitted solutions with vote management.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useSolutions } from '@/hooks/useSolutions';
import { useVoting } from '@/hooks/useVoting';

interface CommunitySolutionsSectionProps {
  puzzleId: string;
}

export function CommunitySolutionsSection({ puzzleId }: CommunitySolutionsSectionProps) {
  const { solutions, isLoading, error } = useSolutions(puzzleId);
  const { vote, isVoting } = useVoting(puzzleId);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handleVote = (solutionId: string, voteType: 'helpful' | 'not_helpful') => {
    vote(solutionId, voteType);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Community Solutions
          {!isLoading && (
            <Badge variant="outline" className="ml-2">
              {solutions.length} solution{solutions.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-gray-600">
          Human-submitted explanations and approaches
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading solutions...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 border border-red-200 rounded-md bg-red-50">
            <MessageSquare className="h-12 w-12 text-red-400 mx-auto mb-2" />
            <h3 className="font-medium text-red-700">Failed to load solutions</h3>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
          </div>
        ) : solutions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-md">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <h3 className="font-medium text-gray-700">No solutions yet</h3>
            <p className="text-gray-500 text-sm mt-1">Be the first to submit a solution for this puzzle!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {solutions.map((solution) => (
              <div key={solution.id} className="border border-gray-200 rounded-md p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-gray-500">
                    Submitted on {formatDate(solution.createdAt)}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Vote counts display */}
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                      <span>{solution.helpful_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                      <span>{solution.not_helpful_count || 0}</span>
                    </div>
                    
                    {/* Voting buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant={solution.userVote === 'helpful' ? "default" : "outline"} 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => handleVote(solution.id, 'helpful')}
                        disabled={isVoting(solution.id)}
                      >
                        {isVoting(solution.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ThumbsUp className="h-4 w-4" />
                        )}
                        <span>Helpful</span>
                      </Button>
                      <Button 
                        variant={solution.userVote === 'not_helpful' ? "default" : "outline"} 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => handleVote(solution.id, 'not_helpful')}
                        disabled={isVoting(solution.id)}
                      >
                        {isVoting(solution.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ThumbsDown className="h-4 w-4" />
                        )}
                        <span>Not Helpful</span>
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Solution content */}
                <div className="text-gray-800 whitespace-pre-line">
                  {solution.comment}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
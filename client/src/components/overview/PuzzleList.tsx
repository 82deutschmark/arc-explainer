/**
 * PuzzleList Component
 * Displays a list of puzzles with pagination
 */

import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatProcessingTime } from '@/utils/timeFormatters';
import { 
  Loader2, 
  Database, 
  Eye,
  ChevronLeft,
  ChevronRight,
  Brain,
  CheckCircle2,
  Clock,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import type { PuzzleOverviewData } from '@shared/types';

interface PuzzleListProps {
  puzzles?: PuzzleOverviewData[];
  total: number;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onFeedbackClick: (puzzleId: string) => void;
  formatDate: (dateString: string) => string;
  getConfidenceColor: (confidence: number) => string;
}

const ITEMS_PER_PAGE = 20;

export function PuzzleList({
  puzzles,
  total,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onFeedbackClick,
  formatDate,
  getConfidenceColor
}: PuzzleListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading puzzle data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!puzzles?.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No puzzles match your current filters.</p>
            <p className="text-sm text-gray-500 mt-2">
              Try adjusting your filters or search terms.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-semibold">Results</span>
          <Badge variant="outline">
            {total} puzzles total
          </Badge>
        </div>

        <div className="space-y-4">
          {puzzles.map((puzzle: PuzzleOverviewData) => (
            <Card key={puzzle.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <code className="text-lg font-mono bg-gray-100 px-3 py-1 rounded">
                        {puzzle.id}
                      </code>
                      
                      {puzzle.source && (
                        <Badge variant="outline" className={`${
                          puzzle.source === 'ARC1' ? 'bg-blue-50 text-blue-700' : 
                          puzzle.source === 'ARC1-Eval' ? 'bg-cyan-50 text-cyan-700' : 
                          puzzle.source === 'ARC2' ? 'bg-purple-50 text-purple-700' : 
                          puzzle.source === 'ARC2-Eval' ? 'bg-green-50 text-green-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {puzzle.source.replace('-Eval', ' Eval')}
                        </Badge>
                      )}

                      <Badge variant="outline" className="bg-gray-50">
                        {puzzle.maxGridSize}×{puzzle.maxGridSize}
                      </Badge>

                      {puzzle.gridSizeConsistent ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Consistent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                          Variable
                        </Badge>
                      )}
                    </div>

                    {puzzle.hasExplanation ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-700">
                              {puzzle.totalExplanations} explanation{puzzle.totalExplanations !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {puzzle.feedbackCount !== undefined && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onFeedbackClick(puzzle.id)}
                              disabled={puzzle.feedbackCount === 0}
                              className={`h-auto p-1 flex items-center gap-1 hover:bg-blue-50 ${
                                puzzle.feedbackCount > 0 ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400'
                              }`}
                            >
                              <MessageSquare className={`h-4 w-4 ${puzzle.feedbackCount > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                              <span className={`text-sm font-medium ${puzzle.feedbackCount > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                                {puzzle.feedbackCount || 0} feedback
                              </span>
                            </Button>
                          )}
                        </div>
                        
                        {puzzle.latestExplanation && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Latest Model:</span>
                              <Badge variant="outline" className="ml-2">
                                <Brain className="h-3 w-3 mr-1" />
                                {puzzle.latestExplanation.modelName}
                              </Badge>
                            </div>
                            
                            <div>
                              <span className="text-gray-500">Confidence:</span>
                              <Badge className={`ml-2 ${getConfidenceColor(puzzle.latestExplanation.confidence)}`}>
                                <BarChart3 className="h-3 w-3 mr-1" />
                                {puzzle.latestExplanation.confidence}%
                              </Badge>
                            </div>
                            
                            <div>
                              <span className="text-gray-500">Analysis Date:</span>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className="text-xs">{formatDate(puzzle.latestExplanation.createdAt)}</span>
                              </div>
                            </div>

                            {puzzle.latestExplanation.apiProcessingTimeMs && (
                              <div>
                                <span className="text-gray-500">Processing:</span>
                                <span className="ml-2 text-xs">
                                  {formatProcessingTime(puzzle.latestExplanation.apiProcessingTimeMs)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {puzzle.explanations.length > 1 && (
                          <div className="mt-3">
                            <details className="text-sm">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                View all {puzzle.explanations.length} explanations
                              </summary>
                              <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200">
                                {puzzle.explanations.slice(1).map((explanation: any) => (
                                  <div key={explanation.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {explanation.modelName}
                                      </Badge>
                                      <Badge className={`${getConfidenceColor(explanation.confidence)} text-xs`}>
                                        {explanation.confidence}%
                                      </Badge>
                                    </div>
                                    <span className="text-gray-500">
                                      {formatDate(explanation.createdAt)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <span>No explanations yet</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href={`/task/${puzzle.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Analyze
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({total} total puzzles)
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
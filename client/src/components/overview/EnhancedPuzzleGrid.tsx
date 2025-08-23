/**
 * EnhancedPuzzleGrid Component
 * Modern grid layout for puzzle results with improved visual hierarchy
 */

import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Database, 
  Eye,
  Brain,
  CheckCircle2,
  Clock,
  BarChart3,
  MessageSquare,
  Grid3x3,
  Award,
  Zap
} from 'lucide-react';
import { MODELS } from '@/constants/models';

interface PuzzleOverviewData {
  id: string;
  source: string;
  maxGridSize: number;
  gridSizeConsistent: boolean;
  hasExplanation: boolean;
  explanations: Array<{
    id: number;
    patternDescription: string;
    solvingStrategy: string;
    alienMeaning: string;
    confidence: number;
    alienMeaningConfidence?: number;
    modelName: string;
    hasReasoningLog: boolean;
    apiProcessingTimeMs?: number;
    saturnSuccess?: boolean;
    createdAt: string;
  }>;
  totalExplanations: number;
  latestExplanation?: any;
  feedbackCount?: number;
}

interface EnhancedPuzzleGridProps {
  puzzles?: PuzzleOverviewData[];
  total: number;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLoadMore?: () => void;
  onFeedbackClick: (puzzleId: string) => void;
  formatDate: (dateString: string) => string;
  getConfidenceColor: (confidence: number) => string;
  hasMore?: boolean;
  loadMoreLoading?: boolean;
}

const ITEMS_PER_PAGE = 20;

export function EnhancedPuzzleGrid({
  puzzles,
  total,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onLoadMore,
  onFeedbackClick,
  formatDate,
  getConfidenceColor,
  hasMore = false,
  loadMoreLoading = false
}: EnhancedPuzzleGridProps) {
  const [expandedPuzzles, setExpandedPuzzles] = useState<Set<string>>(new Set());
  
  const toggleExpanded = (puzzleId: string) => {
    setExpandedPuzzles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(puzzleId)) {
        newSet.delete(puzzleId);
      } else {
        newSet.add(puzzleId);
      }
      return newSet;
    });
  };

  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case 'ARC1':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ARC1-Eval':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'ARC2':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ARC2-Eval':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getModelInfo = (modelName: string) => {
    return MODELS.find(m => m.key === modelName);
  };

  const renderPuzzleCard = (puzzle: PuzzleOverviewData) => {
    const isExpanded = expandedPuzzles.has(puzzle.id);
    const hasSaturnResult = puzzle.explanations.some(exp => exp.saturnSuccess !== undefined);
    const saturnSolved = puzzle.explanations.some(exp => exp.saturnSuccess === true);
    
    return (
      <Card key={puzzle.id} className="hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-gray-300">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-lg font-mono bg-gray-100 px-3 py-1 rounded-md font-semibold">
                  {puzzle.id}
                </code>
                
                <Badge variant="outline" className={`border ${getSourceBadgeStyle(puzzle.source)}`}>
                  {puzzle.source.replace('-Eval', ' Eval')}
                </Badge>

                <Badge variant="outline" className="bg-gray-50 border-gray-200">
                  <Grid3x3 className="h-3 w-3 mr-1" />
                  {puzzle.maxGridSize}×{puzzle.maxGridSize}
                </Badge>

                <Badge 
                  variant="outline" 
                  className={puzzle.gridSizeConsistent ? 
                    'bg-green-50 text-green-700 border-green-200' : 
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }
                >
                  {puzzle.gridSizeConsistent ? 'Consistent' : 'Variable'}
                </Badge>

                {hasSaturnResult && (
                  <Badge 
                    variant="outline"
                    className={saturnSolved ? 
                      'bg-purple-50 text-purple-700 border-purple-200' : 
                      'bg-orange-50 text-orange-700 border-orange-200'
                    }
                  >
                    🪐 {saturnSolved ? 'Solved' : 'Attempted'}
                  </Badge>
                )}
              </div>

              <Button asChild size="sm" className="shrink-0">
                <Link href={`/puzzle/${puzzle.id}`}>
                  <Eye className="h-4 w-4 mr-1" />
                  Examine
                </Link>
              </Button>
            </div>

            {/* Analysis status */}
            {puzzle.hasExplanation ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
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
                        className={`h-auto p-2 flex items-center gap-1 hover:bg-blue-50 ${
                          puzzle.feedbackCount > 0 ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400'
                        }`}
                      >
                        <MessageSquare className={`h-4 w-4 ${puzzle.feedbackCount > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`text-sm font-medium ${puzzle.feedbackCount > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                          {puzzle.feedbackCount || 0}
                        </span>
                      </Button>
                    )}
                  </div>
                  
                  {puzzle.explanations.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(puzzle.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {isExpanded ? 'Show Less' : `Show All ${puzzle.explanations.length}`}
                    </Button>
                  )}
                </div>
                
                {/* Latest explanation summary */}
                {puzzle.latestExplanation && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-gray-600" />
                        <div>
                          <div className="text-xs text-gray-500">Latest Model</div>
                          <div className="text-sm font-medium">
                            {(() => {
                              const modelInfo = getModelInfo(puzzle.latestExplanation.modelName);
                              return modelInfo ? (
                                <span>
                                  {modelInfo.name}
                                  <span className="text-xs text-gray-500 ml-1">({modelInfo.provider})</span>
                                </span>
                              ) : (
                                puzzle.latestExplanation.modelName
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                        <div>
                          <div className="text-xs text-gray-500">Confidence</div>
                          <Badge className={`text-xs ${getConfidenceColor(puzzle.latestExplanation.confidence)}`}>
                            {puzzle.latestExplanation.confidence}%
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-600" />
                        <div>
                          <div className="text-xs text-gray-500">Analyzed</div>
                          <div className="text-sm">
                            {new Date(puzzle.latestExplanation.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>

                      {puzzle.latestExplanation.apiProcessingTimeMs && (
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-gray-600" />
                          <div>
                            <div className="text-xs text-gray-500">Processing</div>
                            <div className="text-sm">
                              {puzzle.latestExplanation.apiProcessingTimeMs < 1000 
                                ? `${puzzle.latestExplanation.apiProcessingTimeMs}ms`
                                : `${(puzzle.latestExplanation.apiProcessingTimeMs / 1000).toFixed(1)}s`
                              }
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pattern description preview */}
                    {puzzle.latestExplanation.patternDescription && (
                      <div className="border-t border-gray-200 pt-3">
                        <div className="text-xs text-gray-500 mb-1">Pattern Description</div>
                        <div className="text-sm text-gray-700 line-clamp-2">
                          {puzzle.latestExplanation.patternDescription.slice(0, 150)}
                          {puzzle.latestExplanation.patternDescription.length > 150 && '...'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded explanations list */}
                {isExpanded && puzzle.explanations.length > 1 && (
                  <div className="space-y-2 border-t border-gray-200 pt-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">All Explanations:</div>
                    {puzzle.explanations.slice(1).map((explanation: any) => (
                      <div key={explanation.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              {(() => {
                                const modelInfo = getModelInfo(explanation.modelName);
                                return modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : explanation.modelName;
                              })()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(explanation.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${getConfidenceColor(explanation.confidence)}`}>
                            {explanation.confidence}%
                          </Badge>
                          {explanation.saturnSuccess !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              🪐 {explanation.saturnSuccess ? 'Solved' : 'Failed'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500 bg-gray-50 rounded-lg p-4">
                <Database className="h-5 w-5" />
                <span>No explanations yet</span>
                <Link href={`/puzzle/${puzzle.id}`}>
                  <Button variant="outline" size="sm" className="ml-auto">
                    Analyze Now
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading && !puzzles?.length) {
    return (
      <div className="flex-1 p-6">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading puzzle data...</p>
        </div>
      </div>
    );
  }

  if (!puzzles?.length) {
    return (
      <div className="flex-1 p-6">
        <div className="text-center py-12">
          <Database className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No puzzles found</h3>
          <p className="text-gray-600">No puzzles match your current filters.</p>
          <p className="text-sm text-gray-500 mt-2">
            Try adjusting your filters or search terms to find more results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      {/* Results header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {total.toLocaleString()} Puzzle{total !== 1 ? 's' : ''} Found
          </h2>
          <p className="text-sm text-gray-600">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} results
          </p>
        </div>
        
        {totalPages > 1 && (
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
        )}
      </div>

      {/* Puzzle grid */}
      <div className="space-y-4 mb-8">
        {puzzles.map(renderPuzzleCard)}
      </div>

      {/* Load more or pagination */}
      {(hasMore || totalPages > 1) && (
        <div className="flex justify-center">
          {onLoadMore ? (
            <Button
              onClick={onLoadMore}
              disabled={loadMoreLoading || !hasMore}
              variant="outline"
              size="lg"
              className="min-w-32"
            >
              {loadMoreLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                `Load More (${total - puzzles.length} remaining)`
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center px-4 py-2 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              
              <Button
                variant="outline"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
/**
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Expandable card showing detailed Grover iteration information.
 * Displays prompt sent, programs generated, execution results, and context amplification.
 * Makes quantum-inspired search visible and engaging.
 * SRP/DRY check: Pass - Single responsibility (iteration visualization)
 * shadcn/ui: Pass - Uses Card, Badge, Collapsible from shadcn
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Clock } from 'lucide-react';
import type { GroverIteration } from '@/hooks/useGroverProgress';

// Iteration strategies from Grover algorithm (credit: Zoe Carver)
const ITERATION_STRATEGIES: Record<number, { title: string; description: string; details: string }> = {
  1: {
    title: 'Initial Exploration',
    description: 'Generate 3-5 diverse program attempts to explore solution space',
    details: 'First iteration establishes baseline. Programs executed on training samples and graded 0-10. Best attempts positioned LAST in context for maximum attention weight.'
  },
  2: {
    title: 'Visual Analysis',
    description: 'Include visual analysis with images to guide pattern recognition',
    details: 'Adds image-based analysis to help model see visual patterns. Context now saturated with iteration 1 results. High-scoring programs from iteration 1 influence this generation.'
  },
  3: {
    title: 'Color Normalization',
    description: 'Use color-normalized problem representations',
    details: 'Provides alternative color mappings to break anchoring on specific colors. Context-free attempts with different seeds encourage exploration of new solution paths.'
  },
  4: {
    title: 'Full Visual Context',
    description: 'Include all training images and test input images directly',
    details: 'Maximum visual information provided. Model sees actual grids as images. Context saturated with best attempts from all previous iterations.'
  },
  5: {
    title: 'Context Refinement',
    description: 'Full context after removing low-scoring attempts',
    details: 'Final iteration with pruned context. Only highest-quality attempts remain. Model makes final refinement based on accumulated knowledge.'
  }
};

interface IterationCardProps {
  iteration: number;
  data?: GroverIteration;
  isActive?: boolean;
  phase?: string;
  message?: string;
  bestOverall?: number;
  promptPreview?: string;
  conversationChain?: string | null;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

export function IterationCard({ 
  iteration, 
  data, 
  isActive = false,
  phase,
  message,
  bestOverall,
  promptPreview,
  conversationChain,
  tokenUsage
}: IterationCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(isActive);

  // Status indicator
  const getStatusIcon = () => {
    if (isActive) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (data) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (isActive) return 'Running';
    if (data) return 'Complete';
    return 'Queued';
  };

  const bestScore = data?.best?.score ?? 0;
  const programCount = data?.programs?.length ?? 0;

  return (
    <Card className="mb-2">
      <CardHeader className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-sm font-semibold">
              Iteration {iteration}
            </CardTitle>
            <Badge variant={isActive ? "default" : data ? "outline" : "secondary"} className="text-xs">
              {getStatusText()}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <>
                <span className="text-xs text-gray-600">
                  {programCount} {programCount === 1 ? 'program' : 'programs'}
                </span>
                <Badge variant="default" className="bg-green-600 text-xs">
                  Best: {bestScore.toFixed(1)}/10
                </Badge>
              </>
            )}
            {data && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
        
        {/* Strategy explanation - ALWAYS show */}
        <div className="mt-2">
          {ITERATION_STRATEGIES[iteration] && (
            <div className="bg-blue-50 p-2 rounded">
              <div className="text-xs font-semibold text-blue-900">
                {ITERATION_STRATEGIES[iteration].title}
              </div>
              <div className="text-xs text-blue-800 mt-1">
                {ITERATION_STRATEGIES[iteration].description}
              </div>
              <div className="text-xs text-blue-700 mt-1 leading-relaxed">
                {ITERATION_STRATEGIES[iteration].details}
              </div>
            </div>
          )}
          {isActive && message && (
            <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
              <span className="font-medium">Current: </span>{message}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Expandable content for completed iterations */}
      {data && isExpanded && (
        <CardContent className="px-3 pb-3 pt-0">
          <div className="space-y-3">
            
            {/* Prompt & Response Info */}
            {(promptPreview || conversationChain || tokenUsage) && (
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold mb-2">📤 Prompt & Response</h4>
                <div className="space-y-2">
                  {promptPreview && (
                    <Collapsible>
                      <CollapsibleTrigger className="text-xs text-blue-600 hover:text-blue-800">
                        View Prompt Preview ({promptPreview.length} chars)
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto max-h-40 leading-tight">
                          {promptPreview}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  {conversationChain && (
                    <div className="text-xs bg-blue-50 p-2 rounded">
                      <span className="text-gray-600">🔗 Conversation Chain:</span>
                      <code className="ml-1 text-blue-700">{conversationChain.substring(0, 24)}...</code>
                    </div>
                  )}
                  {tokenUsage && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-gray-50 p-1.5 rounded">
                        <span className="text-gray-600">Input:</span>
                        <span className="ml-1 font-medium">{tokenUsage.input.toLocaleString()}</span>
                      </div>
                      <div className="bg-gray-50 p-1.5 rounded">
                        <span className="text-gray-600">Output:</span>
                        <span className="ml-1 font-medium">{tokenUsage.output.toLocaleString()}</span>
                      </div>
                      <div className="bg-gray-50 p-1.5 rounded">
                        <span className="text-gray-600">Total:</span>
                        <span className="ml-1 font-medium">{tokenUsage.total.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            
            {/* Programs Generated */}
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold mb-2">Programs Generated</h4>
              <div className="space-y-2">
                {data.programs.map((program, idx) => {
                  const result = data.executionResults.find(r => r.programIdx === idx);
                  const isBest = idx === data.best.programIdx;
                  
                  return (
                    <Collapsible key={idx}>
                      <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <CollapsibleTrigger className="text-xs font-medium text-blue-600 hover:text-blue-800">
                            Program {idx + 1}
                          </CollapsibleTrigger>
                          {isBest && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              BEST
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            {program.split('\n').length} lines
                          </span>
                          {result && (
                            <Badge 
                              variant={result.error ? "destructive" : "outline"}
                              className="text-xs"
                            >
                              {result.error ? 'Error' : `${result.score.toFixed(1)}/10`}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CollapsibleContent>
                        <pre className="mt-1 p-2 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto leading-tight max-h-60">
                          <code>{program}</code>
                        </pre>
                        {result?.error && (
                          <div className="mt-1 p-2 bg-red-50 text-red-700 rounded text-xs">
                            <strong>Error:</strong> {result.error}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>

            {/* Execution Summary */}
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold mb-2">Execution Summary</h4>
              <div className="bg-gray-50 p-2 rounded">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Total Programs:</span>
                    <span className="ml-2 font-medium">{programCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Best Score:</span>
                    <span className="ml-2 font-medium text-green-600">{bestScore.toFixed(1)}/10</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Successful:</span>
                    <span className="ml-2 font-medium">
                      {data.executionResults.filter(r => !r.error).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Failed:</span>
                    <span className="ml-2 font-medium text-red-600">
                      {data.executionResults.filter(r => r.error).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Context Amplification Info */}
            {bestOverall !== undefined && (
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold mb-2">🧠 Context Amplification</h4>
                <div className="bg-blue-50 p-2 rounded text-xs">
                  <p className="text-gray-700">
                    Overall best score: <strong>{bestOverall.toFixed(1)}/10</strong>
                  </p>
                  {bestScore > bestOverall && (
                    <p className="text-green-700 mt-1">
                      ✨ New best! Improved by <strong>+{(bestScore - bestOverall).toFixed(1)}</strong>
                    </p>
                  )}
                  <p className="text-gray-600 mt-2">
                    Best programs positioned last in context for maximum attention weight in next iteration.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

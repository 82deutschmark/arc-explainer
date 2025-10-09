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
// Based on quantum search: oracle (execution) + diffusion (context reordering) = amplitude amplification
const ITERATION_STRATEGIES: Record<number, { title: string; description: string; details: string; oracle: string }> = {
  1: {
    title: '🔍 Initial Exploration (Baseline)',
    description: 'Generate 3-5 diverse programs to establish superposition across solution space',
    details: 'Programs executed on training samples and graded 0-10 by LLM. Attempts sorted by score with BEST positioned LAST in context for maximum attention weight. Failed attempts kept to show dead ends.',
    oracle: 'Oracle: Python execution on training examples marks which attempts are closer to correct'
  },
  2: {
    title: '🖼️ Visual Analysis (Productive Entropy)',
    description: 'Add image-based analysis while keeping context-free attempts',
    details: 'Visual analysis helps some problems (e3721c99, 58f5dbd5, 8f215267) but can anchor model to wrong paths if incorrect. Context-free attempts with different seeds allow exploration without constraints. Context saturated with iteration 1 results.',
    oracle: 'Diffusion: Grading creates fitness landscape. Attention flows toward high-scoring patterns'
  },
  3: {
    title: '🎨 Color Normalization (Break Anchoring)',
    description: 'Alternative color mappings to prevent fixation on specific colors',
    details: 'Provides color-normalized representations. Context-free attempts continue to explore untainted solution paths. Accumulated context from iterations 1-2 guides generation while allowing divergence.',
    oracle: 'Amplitude Amplification: Probability mass concentrates on promising solution patterns'
  },
  4: {
    title: '📊 Full Visual Context (Maximum Information)',
    description: 'All training images + test input images provided directly to LLM',
    details: 'Maximum visual information. Model sees actual grids as images. Context saturated with best attempts from ALL previous iterations. Failed solutions help model avoid repeating mistakes.',
    oracle: 'Context Saturation: More relevant context = more productive attention connections'
  },
  5: {
    title: '✨ Context Refinement (Convergence)',
    description: 'Pruned context with only highest-quality attempts',
    details: 'Low-scoring attempts removed. Only best programs remain, positioned last for maximum influence. Model converges on solution through accumulated feedback. Early exit if 10/10 scores achieved.',
    oracle: 'Final Amplification: Probability mass concentrated on correct solution region'
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
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded border border-blue-200">
              <div className="text-xs font-bold text-blue-900 mb-1">
                {ITERATION_STRATEGIES[iteration].title}
              </div>
              <div className="text-xs text-blue-800 font-medium mb-1.5">
                {ITERATION_STRATEGIES[iteration].description}
              </div>
              <div className="text-xs text-blue-700 leading-relaxed mb-1.5">
                {ITERATION_STRATEGIES[iteration].details}
              </div>
              <div className="text-xs text-purple-700 italic bg-purple-50/50 p-1.5 rounded border-l-2 border-purple-400">
                {ITERATION_STRATEGIES[iteration].oracle}
              </div>
            </div>
          )}
          {isActive && message && (
            <div className="mt-2 text-xs text-gray-700 bg-yellow-50 p-2 rounded border border-yellow-200">
              <span className="font-semibold">⏳ Current: </span>{message}
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

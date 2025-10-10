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
  // ALWAYS start expanded so user can see the actual code generated
  const [isExpanded, setIsExpanded] = React.useState(true);
  // Track which programs are expanded (by index)
  const [expandedPrograms, setExpandedPrograms] = React.useState<Set<number>>(new Set());
  // Track prompt preview expanded state
  const [isPromptOpen, setIsPromptOpen] = React.useState(false);

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
    <Card className="mb-2 border-2 shadow-sm hover:shadow-md transition-shadow">
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
                <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                  {programCount} {programCount === 1 ? 'program' : 'programs'}
                </span>
                <Badge variant="default" className="bg-green-600 text-xs font-bold shadow-sm">
                  Best: {bestScore.toFixed(1)}/10
                </Badge>
              </>
            )}
            {data && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-all shadow-sm hover:shadow-md ${
                  isExpanded 
                    ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700' 
                    : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
                <h4 className="text-sm font-bold mb-3 text-gray-900 flex items-center gap-2">
                  <span>📤</span> Prompt & Response
                </h4>
                <div className="space-y-2">
                  {promptPreview && (
                    <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 hover:border-blue-400 rounded-lg transition-all shadow-sm hover:shadow-md cursor-pointer">
                          <div className={`flex items-center justify-center w-5 h-5 rounded ${
                            isPromptOpen ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-700'
                          } transition-all`}>
                            {isPromptOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </div>
                          <span className="text-xs font-bold text-blue-900">
                            View Prompt Preview ({promptPreview.length.toLocaleString()} chars)
                          </span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-2 p-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-xs overflow-x-auto max-h-60 leading-relaxed">
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
              <h4 className="text-sm font-bold mb-3 text-gray-900 flex items-center gap-2">
                <span className="text-purple-600">📝</span> Programs Generated
                <Badge variant="outline" className="text-xs">{data.programs.length}</Badge>
              </h4>
              <div className="space-y-2">
                {data.programs.map((program, idx) => {
                  const result = data.executionResults.find(r => r.programIdx === idx);
                  const isBest = idx === data.best.programIdx;
                  const isOpen = expandedPrograms.has(idx);
                  const toggleOpen = () => {
                    setExpandedPrograms(prev => {
                      const next = new Set(prev);
                      if (next.has(idx)) {
                        next.delete(idx);
                      } else {
                        next.add(idx);
                      }
                      return next;
                    });
                  };
                  
                  return (
                    <Collapsible key={idx} open={isOpen} onOpenChange={toggleOpen}>
                      <CollapsibleTrigger asChild>
                        <button className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all shadow-sm hover:shadow-md cursor-pointer ${
                          isBest 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 hover:border-green-500 hover:from-green-100 hover:to-emerald-100' 
                            : 'bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}>
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center justify-center w-6 h-6 rounded ${
                              isOpen ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                            } transition-all`}>
                              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                            <span className="text-sm font-bold text-gray-900">
                              Program {idx + 1}
                            </span>
                            {isBest && (
                              <Badge variant="default" className="text-xs bg-green-600 font-bold shadow-sm">
                                ⭐ BEST
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {program.split('\n').length} lines
                            </span>
                            {result && (
                              <Badge 
                                variant={result.error ? "destructive" : "outline"}
                                className={`text-sm font-bold shadow-sm ${
                                  result.error ? '' : 'bg-blue-50 border-blue-400'
                                }`}
                              >
                                {result.error ? '❌ Error' : `${result.score.toFixed(1)}/10`}
                              </Badge>
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 border-2 border-gray-200 rounded-lg overflow-hidden">
                          <pre className="p-3 bg-gray-900 text-gray-100 text-xs overflow-x-auto leading-relaxed max-h-96">
                            <code>{program}</code>
                          </pre>
                          {result?.error && (
                            <div className="p-3 bg-red-50 text-red-700 text-xs border-t-2 border-red-200">
                              <strong className="font-bold">❌ Error:</strong> {result.error}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>

            {/* Execution Summary */}
            <div className="border-t pt-3">
              <h4 className="text-sm font-bold mb-3 text-gray-900 flex items-center gap-2">
                <span className="text-orange-600">📊</span> Execution Summary
              </h4>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border-2 border-gray-200">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-600 font-medium">Total Programs:</span>
                    <span className="ml-2 font-bold text-gray-900">{programCount}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-600 font-medium">Best Score:</span>
                    <span className="ml-2 font-bold text-green-600">{bestScore.toFixed(1)}/10</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-600 font-medium">Successful:</span>
                    <span className="ml-2 font-bold text-blue-600">
                      {data.executionResults.filter(r => !r.error).length}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-600 font-medium">Failed:</span>
                    <span className="ml-2 font-bold text-red-600">
                      {data.executionResults.filter(r => r.error).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Context Amplification Info */}
            {bestOverall !== undefined && (
              <div className="border-t pt-3">
                <h4 className="text-sm font-bold mb-3 text-gray-900 flex items-center gap-2">
                  <span>🧠</span> Context Amplification
                </h4>
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-3 rounded-lg border-2 border-purple-200 text-xs">
                  <p className="text-gray-800 font-medium">
                    Overall best score: <strong className="text-purple-700">{bestOverall.toFixed(1)}/10</strong>
                  </p>
                  {bestScore > bestOverall && (
                    <p className="text-green-700 mt-2 font-bold">
                      ✨ New best! Improved by <strong className="text-lg">+{(bestScore - bestOverall).toFixed(1)}</strong>
                    </p>
                  )}
                  <p className="text-gray-700 mt-2 leading-relaxed">
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

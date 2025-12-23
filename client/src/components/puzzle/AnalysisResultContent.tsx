/**
 * AnalysisResultContent.tsx
 *
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Displays the main content of analysis results including pattern descriptions,
 * solving strategies, hints, alien meanings, and AI reasoning. Handles Saturn results and
 * optimistic update states (analyzing, saving, error). Shows trustworthiness badge for
 * non-ELO, non-debate, non-Saturn results only (predictionAccuracyScore).
 * SRP/DRY check: Pass - Single responsibility (content display)
 * shadcn/ui: Pass - Uses shadcn Badge/Button components
 * UPDATED (2025-12-24) by Codex (GPT-5): Adds dark theme variants for Puzzle Analyst cards.
 */

import React from 'react';
import { Brain, ChevronDown, ChevronUp, FileText, Copy, Check } from 'lucide-react';
import { ExplanationData } from '@/types/puzzle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export const formatConfidence = (confidence: string | number) => {
  if (typeof confidence === 'string') {
    return confidence.endsWith('%') ? confidence : `${confidence}%`;
  }
  return `${confidence}%`;
};

interface AnalysisResultContentProps {
  result: ExplanationData;
  isSaturnResult: boolean;
  isGroverResult?: boolean;
  showReasoning: boolean;
  setShowReasoning: (show: boolean) => void;
  showAlienMeaning: boolean;
  setShowAlienMeaning: (show: boolean) => void;
  eloMode?: boolean;
}

// Skeleton loader component
const SkeletonLoader = ({ className = "", height = "h-4" }: { className?: string; height?: string }) => (
  <div className={`bg-gray-200 dark:bg-slate-800 rounded animate-pulse ${height} ${className}`} />
);

export const AnalysisResultContent: React.FC<AnalysisResultContentProps> = ({
  result,
  isSaturnResult,
  isGroverResult = false,
  showReasoning,
  setShowReasoning,
  showAlienMeaning,
  setShowAlienMeaning,
  eloMode = false
}) => {
  const [showGroverProgram, setShowGroverProgram] = React.useState(false);
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);
  const isOptimistic = result.isOptimistic;
  const status = result.status;

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };
  
  // Show skeleton loaders for pending states
  if (isOptimistic && (status === 'analyzing' || status === 'saving')) {
    return (
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold">Pattern Description</h5>
            <SkeletonLoader className="w-20" height="h-5" />
          </div>
          <div className="space-y-2">
            <SkeletonLoader className="w-full" />
            <SkeletonLoader className="w-3/4" />
            <SkeletonLoader className="w-5/6" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold">Solving Strategy</h5>
          </div>
          <div className="space-y-2">
            <SkeletonLoader className="w-full" />
            <SkeletonLoader className="w-4/5" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold">Hints</h5>
          </div>
          <div className="space-y-2">
            <SkeletonLoader className="w-3/4" />
            <SkeletonLoader className="w-2/3" />
            <SkeletonLoader className="w-1/2" />
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state for failed analyses
  if (isOptimistic && status === 'error') {
    return (
      <div className="bg-red-50 p-3 rounded border border-red-200 dark:bg-rose-950/60 dark:border-rose-800/60">
        <p className="text-sm text-red-700 dark:text-rose-200">
          Analysis failed: {result.error || 'Unknown error occurred'}
        </p>
      </div>
    );
  }
  
  
  const isEmptyResult = !result || (
    (!result.patternDescription || result.patternDescription.trim() === '') &&
    (!result.solvingStrategy || result.solvingStrategy.trim() === '') &&
    (!result.alienMeaning || result.alienMeaning.trim() === '') &&
    (!result.hints || result.hints.length === 0) &&
    !result.predictedOutputGrid &&
    !(result as any).predictedOutput1 // Check for multi-prediction grids directly
  );

  if (isEmptyResult) {
    return (
      <div className="bg-yellow-50 p-3 rounded border border-yellow-200 dark:bg-amber-950/50 dark:border-amber-800/60">
        <p className="text-sm text-yellow-700 dark:text-amber-200">
          No analysis results available. The model may have encountered an error or returned an empty response.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result.patternDescription && (
        <div>
          <div className="flex items-center gap-2">
            <h5 className="font-semibold">
              {isSaturnResult ? '🪐 Saturn Visual Analysis' : isGroverResult ? '🔄 Grover Iterative Analysis' : 'Pattern Description'}
            </h5>
            {!isSaturnResult && result.confidence && (
              <Badge
                variant="outline"
                className="text-xs dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700/60"
              >
                Confidence: {formatConfidence(result.confidence)}
              </Badge>
            )}
            {!eloMode && !isSaturnResult && result.trustworthinessScore !== undefined && result.trustworthinessScore !== null && (
              <Badge
                variant="outline"
                className={`
                  text-xs
                  ${result.trustworthinessScore >= 0.8 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60' 
                    : result.trustworthinessScore >= 0.5 
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/60' 
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/60'}`}
              >
                Trustworthiness: {Math.round(result.trustworthinessScore * 100)}%
              </Badge>
            )}
            {isSaturnResult && typeof result.saturnSuccess === 'boolean' && (
              <Badge
                variant="outline"
                className={`
                  text-xs
                  ${result.saturnSuccess
                    ? 'bg-green-50 text-green-600 border-green-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60'
                    : 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800/60'}`}
              >
                {result.saturnSuccess ? 'Puzzle Solved Successfully' : 'Solution Attempt Failed'}
              </Badge>
            )}
          </div>
          <p className="text-gray-600 dark:text-slate-200">{result.patternDescription}</p>
        </div>
      )}
      {result.solvingStrategy && (
        <div>
          <h5 className="font-semibold">
            {isSaturnResult ? 'Visual Solving Process' : isGroverResult ? 'Search Strategy' : 'Solving Strategy'}
          </h5>
          <p className="text-gray-600 dark:text-slate-200">{result.solvingStrategy}</p>
        </div>
      )}
      {result.hints && result.hints.length > 0 && (
        <div>
          <h5 className="font-semibold">
            {isSaturnResult ? 'Key Observations' : isGroverResult ? 'Program Evolution' : 'Hints'}
          </h5>
          <ul className="list-disc list-inside text-gray-600 dark:text-slate-200">
            {result.hints.map((hint, i) => <li key={i}>{hint}</li>)}
          </ul>
        </div>
      )}
      {result.alienMeaning && (
        <div className="rounded border border-purple-200 bg-purple-50 dark:border-violet-800/60 dark:bg-violet-950/50">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowAlienMeaning(!showAlienMeaning)}
            className="flex w-full items-center justify-between rounded-none p-3 text-left hover:bg-purple-100 dark:hover:bg-violet-900/40"
          >
            <div className="flex items-center gap-2">
              <h5 className="font-semibold text-purple-800 dark:text-violet-200">🛸 What might the aliens mean?</h5>
              <Badge
                variant="outline"
                className="text-xs bg-purple-50 text-purple-700 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800/60"
              >
                Confidence: {formatConfidence(result.alienMeaningConfidence || result.confidence || '85%')}
              </Badge>
            </div>
            {showAlienMeaning ? (
              <ChevronUp className="h-4 w-4 text-purple-600 dark:text-violet-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-purple-600 dark:text-violet-300" />
            )}
          </Button>
          {showAlienMeaning && (
            <div className="px-3 pb-3">
              <div className="bg-white p-3 rounded border border-purple-100 dark:bg-slate-950/70 dark:border-violet-800/60">
                <p className="text-purple-700 dark:text-violet-200">{result.alienMeaning}</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {true && (
        <div
          className={`border rounded ${isSaturnResult ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-800/60' : 'bg-blue-50 border-blue-200 dark:bg-slate-900/60 dark:border-slate-800/60'}`}
        >
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isSaturnResult ? 'hover:bg-indigo-100 dark:hover:bg-indigo-900/40' : 'hover:bg-blue-100 dark:hover:bg-slate-800/60'}`}>
            <div className="flex items-center gap-2">
              {isSaturnResult ? (
                <>
                  <span className="text-sm">🪐</span>
                  <h5 className="font-semibold text-indigo-800 dark:text-indigo-200">Saturn Visual Reasoning</h5>
                  <Badge
                    variant="outline"
                    className="text-xs bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800/60 dark:text-indigo-200"
                  >
                    Multi-stage visual analysis
                  </Badge>
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 text-blue-600 dark:text-sky-300" />
                  <h5 className="font-semibold text-blue-800 dark:text-sky-200">AI Reasoning Process</h5>
                  <Badge
                    variant="outline"
                    className="text-xs bg-blue-50 text-blue-700 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700/60"
                  >
                    Step-by-step analysis
                  </Badge>
                </>
              )}
            </div>
            {showReasoning ? (
              <ChevronUp className={`h-4 w-4 ${isSaturnResult ? 'text-indigo-600 dark:text-indigo-300' : 'text-blue-600 dark:text-sky-300'}`} />
            ) : (
              <ChevronDown className={`h-4 w-4 ${isSaturnResult ? 'text-indigo-600 dark:text-indigo-300' : 'text-blue-600 dark:text-sky-300'}`} />
            )}
          </button>
          {showReasoning && (
            <div className="px-3 pb-3">
              <div className="bg-white p-3 rounded border border-indigo-100 dark:bg-slate-950/70 dark:border-slate-800/70">
                <pre className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                  {(() => {
                    let displayText = result.reasoningLog || '';
                    
                    // Try to parse OpenAI reasoning log format: [{"type":"summary_text","text":"..."}]
                    if (displayText && typeof displayText === 'string' && displayText.startsWith('[')) {
                      try {
                        const parsed = JSON.parse(displayText);
                        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
                          // Extract text from OpenAI format and clean up \n
                          displayText = parsed.map(item => item.text).join('\n').replace(/\\n/g, '\n');
                        }
                      } catch (e) {
                        // If parsing fails, keep original text
                      }
                    }
                    
                    return displayText || (result.reasoningItems && result.reasoningItems.length > 0 ? 'Structured reasoning steps shown below.' : '');
                  })()}
                </pre>
              </div>
              <p className={`text-xs mt-2 ${isSaturnResult ? 'text-indigo-600 dark:text-indigo-300' : 'text-blue-600 dark:text-sky-300'}`}>
                {isSaturnResult 
                  ? '🔍 This shows Saturn\'s iterative visual analysis process, including image generation and pattern recognition stages.'
                  : '💡 This shows how the AI model analyzed the puzzle step-by-step to reach its conclusion.'
                }
              </p>
              
              {/* Display structured reasoning items if available */}
              {result.reasoningItems && Array.isArray(result.reasoningItems) && result.reasoningItems.length > 0 && (
                <div className="mt-3 border-t border-blue-100 pt-3 dark:border-slate-800/70">
                  <h6 className={`font-semibold text-sm mb-2 ${isSaturnResult ? 'text-indigo-800 dark:text-indigo-200' : 'text-blue-800 dark:text-sky-200'}`}>
                    Step-by-Step Analysis:
                  </h6>
                  <div className="space-y-2">
                    {result.reasoningItems.map((item: any, index) => {
                      // Handle different reasoning item formats from different providers
                      let displayContent = '';
                      
                      if (typeof item === 'string') {
                        // OpenRouter, OpenAI Responses: simple strings
                        displayContent = item;
                      } else if (typeof item === 'object' && item !== null) {
                        // Gemini: objects with step, observation, insight
                        if (item.observation && item.insight) {
                          displayContent = `${item.observation} → ${item.insight}`;
                        } else if (item.text) {
                          displayContent = item.text;
                        } else if (item.content) {
                          displayContent = item.content; 
                        } else if (item.message) {
                          displayContent = item.message;
                        } else {
                          // Fallback: JSON stringify for structured objects
                          displayContent = JSON.stringify(item, null, 2);
                        }
                      } else {
                        // Fallback: try to stringify objects, or convert other types to string
                        if (typeof item === 'object' && item !== null) {
                          try {
                            displayContent = JSON.stringify(item, null, 2);
                          } catch (error) {
                            displayContent = `[Unable to parse reasoning item: ${typeof item}]`;
                          }
                        } else {
                          displayContent = String(item);
                        }
                      }
                      
                      return (
                        <div
                          key={index}
                          className="bg-gray-50 p-2 rounded text-sm border-l-3 border-l-blue-300 dark:bg-slate-900/60 dark:text-slate-100 dark:border-l-sky-400"
                        >
                          <span className="font-medium text-gray-600 dark:text-slate-300">Step {index + 1}:</span> {displayContent}
                        </div>
                      );
                    })}
                  </div>
                  <p className={`text-xs mt-2 ${isSaturnResult ? 'text-indigo-600 dark:text-indigo-300' : 'text-blue-600 dark:text-sky-300'}`}>
                    🧠 These are the structured reasoning steps captured from the AI model's internal thought process.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isGroverResult && result.groverBestProgram && (
        <div className="bg-green-50 border border-green-200 rounded dark:bg-emerald-950/60 dark:border-emerald-800/60">
          <button
            onClick={() => setShowGroverProgram(!showGroverProgram)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-green-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🔄</span>
              <h5 className="font-semibold text-green-800 dark:text-emerald-200">Discovered Python Program</h5>
              <Badge
                variant="outline"
                className="text-xs bg-green-50 border-green-200 text-green-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-200"
              >
                Best of {result.iterationCount || '?'} iterations
              </Badge>
            </div>
            {showGroverProgram ? (
              <ChevronUp className="h-4 w-4 text-green-600 dark:text-emerald-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-green-600 dark:text-emerald-300" />
            )}
          </button>
          {showGroverProgram && (
            <div className="px-3 pb-3">
              <div className="bg-white p-3 rounded border border-green-100 dark:bg-slate-950/70 dark:border-emerald-800/60">
                <pre className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                  {result.groverBestProgram}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prompt Sent to AI - Show what was actually sent */}
      {(result.systemPromptUsed || result.userPromptUsed) && (
        <div className="border rounded bg-gray-50 border-gray-200 dark:bg-slate-950/60 dark:border-slate-800/70">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 dark:hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-600 dark:text-slate-300" />
              <h5 className="font-semibold text-gray-800 dark:text-slate-100">Prompt Sent to AI</h5>
              <Badge
                variant="outline"
                className="text-xs bg-gray-50 text-gray-700 dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-700/60"
              >
                What was actually sent
              </Badge>
            </div>
            {showPrompt ? (
              <ChevronUp className="h-4 w-4 text-gray-600 dark:text-slate-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600 dark:text-slate-300" />
            )}
          </button>
          {showPrompt && (
            <div className="px-3 pb-3 space-y-3">
              {/* System Prompt */}
              {result.systemPromptUsed && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="font-semibold text-sm text-gray-700 dark:text-slate-200">System Prompt:</h6>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(result.systemPromptUsed!, 'system')}
                      title="Copy to clipboard"
                      className="h-7 w-7 text-gray-600 hover:text-gray-800 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                      {copiedSection === 'system' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <pre className="text-xs bg-white p-3 rounded border text-gray-700 dark:text-slate-200 dark:bg-slate-950/70 dark:border-slate-800/70 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                    {result.systemPromptUsed}
                  </pre>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {result.systemPromptUsed.length} characters
                  </div>
                </div>
              )}

              {/* User Prompt */}
              {result.userPromptUsed && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="font-semibold text-sm text-gray-700 dark:text-slate-200">User Prompt:</h6>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(result.userPromptUsed!, 'user')}
                      title="Copy to clipboard"
                      className="h-7 w-7 text-gray-600 hover:text-gray-800 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                      {copiedSection === 'user' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <pre className="text-xs bg-white p-3 rounded border text-gray-700 dark:text-slate-200 dark:bg-slate-950/70 dark:border-slate-800/70 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                    {result.userPromptUsed}
                  </pre>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {result.userPromptUsed.length} characters
                  </div>
                </div>
              )}

              {result.promptTemplateId && (
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                  Template: <span className="font-mono bg-gray-100 px-1 rounded dark:bg-slate-800/70 dark:text-slate-200">{result.promptTemplateId}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

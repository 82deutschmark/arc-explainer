/**
 * Author: Codex using GPT-5-high
 * Date: 2025-10-12 (Converted to DaisyUI)
 * PURPOSE: Shared panel to display live token streaming output (text + reasoning) across Saturn/Grover/Puzzle flows.
 * SRP/DRY check: Pass — reusable UI primitive.
 * DaisyUI: Pass — Uses DaisyUI card, badge, and button components.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { TinyGrid } from './TinyGrid';
import { GridDisplay } from './grids/GridDisplay';
import type { ARCTask } from '@shared/types';

interface TokenUsageSummary {
  input?: number;
  output?: number;
  reasoning?: number;
}

interface StreamingAnalysisPanelProps {
  title?: string;
  status: 'idle' | 'starting' | 'in_progress' | 'completed' | 'failed';
  phase?: string;
  message?: string;
  phaseHistory?: { phase?: string; message?: string; ts: number }[];
  text?: string;
  structuredJsonText?: string;
  structuredJson?: unknown;
  reasoning?: string;
  tokenUsage?: TokenUsageSummary;
  onCancel?: () => void;
  onClose?: () => void;
  task?: ARCTask;
  promptPreview?: string;
}

export function StreamingAnalysisPanel({
  title = 'Live Output',
  status,
  phase,
  message,
  phaseHistory,
  text,
  structuredJsonText,
  structuredJson,
  reasoning,
  tokenUsage,
  onCancel,
  onClose,
  task,
  promptPreview,
}: StreamingAnalysisPanelProps) {
  const renderStatusBadge = () => {
    switch (status) {
      case 'starting':
        return <div className="badge badge-outline badge-sm">Starting</div>;
      case 'in_progress':
        return (
          <div className="badge badge-primary badge-sm">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Streaming
          </div>
        );
      case 'completed':
        return <div className="badge badge-success badge-sm">Completed</div>;
      case 'failed':
        return <div className="badge badge-error badge-sm">Failed</div>;
      default:
        return <div className="badge badge-neutral badge-sm">Idle</div>;
    }
  };

  const hasStructuredJson = Boolean(structuredJsonText && structuredJsonText.trim().length > 0);
  let formattedStructuredJson: string | null = null;

  if (hasStructuredJson) {
    if (structuredJson && typeof structuredJson === 'object') {
      try {
        formattedStructuredJson = JSON.stringify(structuredJson, null, 2);
      } catch {
        formattedStructuredJson = structuredJsonText ?? null;
      }
    } else if (structuredJsonText) {
      try {
        formattedStructuredJson = JSON.stringify(JSON.parse(structuredJsonText), null, 2);
      } catch {
        formattedStructuredJson = structuredJsonText;
      }
    }
  }

  const visibleOutput = (formattedStructuredJson ?? text)?.trim();

  // Derive friendly solver progress steps from phase history
  const { steps, statusLine } = React.useMemo(() => {
    const baseSteps: { id: 'prepare' | 'llm' | 'code' | 'test' | 'select' | 'finalize'; label: string }[] = [
      { id: 'prepare', label: 'Preparing puzzle' },
      { id: 'llm', label: 'Asking the AI for a strategy' },
      { id: 'code', label: 'Generating code/solution' },
      { id: 'test', label: 'Testing on examples' },
      { id: 'select', label: 'Choosing the best attempt' },
      { id: 'finalize', label: 'Preparing final answer' },
    ];

    const latest = phaseHistory && phaseHistory.length > 0 ? phaseHistory[phaseHistory.length - 1] : undefined;
    const activePhase = (latest?.phase || phase || '').toString().toLowerCase();

    const mapToBucket = (p: string): 'prepare' | 'llm' | 'code' | 'test' | 'select' | 'finalize' => {
      const v = p.toLowerCase();
      if (!v) {
        return status === 'completed' || status === 'failed' ? 'finalize' : 'prepare';
      }
      if (v.includes('init') || v.includes('start') || v.includes('saturn_phase1')) return 'prepare';
      if (v.includes('prompt') || v.includes('waiting') || v.includes('phase2') || v.includes('llm')) return 'llm';
      if (v.includes('program') || v.includes('code')) return 'code';
      if (v.includes('execution') || v.includes('train') || v.includes('test')) return 'test';
      if (v.includes('best') || v.includes('select')) return 'select';
      if (v.includes('final') || v.includes('complete') || v.includes('error')) return 'finalize';
      return status === 'completed' ? 'finalize' : 'prepare';
    };

    const bucket = mapToBucket(activePhase);
    const activeIndex = baseSteps.findIndex(step => step.id === bucket);

    const derivedSteps = baseSteps.map((step, index) => {
      let stepStatus: 'done' | 'current' | 'pending' = 'pending';
      if (status === 'completed') {
        stepStatus = 'done';
      } else if (status === 'failed') {
        stepStatus = index <= activeIndex ? 'done' : 'pending';
      } else if (activeIndex >= 0) {
        if (index < activeIndex) stepStatus = 'done';
        else if (index === activeIndex) stepStatus = 'current';
        else stepStatus = 'pending';
      }
      return { ...step, status: stepStatus };
    });

    let friendlyLine: string | undefined;
    const latestMessage = latest?.message || message;
    if (status === 'failed') {
      friendlyLine = latestMessage || 'Streaming failed. Please try again.';
    } else if (status === 'completed') {
      friendlyLine = latestMessage || 'Analysis finished. Preparing final explanation.';
    } else if (latestMessage) {
      friendlyLine = latestMessage;
    } else {
      const defaultLines: Record<typeof baseSteps[number]['id'], string> = {
        prepare: 'Preparing the puzzle and examples…',
        llm: 'Asking the AI to analyze the pattern…',
        code: 'Turning the pattern into code…',
        test: 'Testing candidate answers on the examples…',
        select: 'Comparing attempts to pick the best one…',
        finalize: 'Wrapping up your final answer…',
      };
      friendlyLine = defaultLines[bucket];
    }

    return { steps: derivedSteps, statusLine: friendlyLine };
  }, [phaseHistory, phase, message, status]);

  // Extract multi-test prediction grids from structuredJson
  const predictedGrids: number[][][] = React.useMemo(() => {
    if (!structuredJson || typeof structuredJson !== 'object') {
      return [];
    }

    const obj = structuredJson as Record<string, any>;

    // Check for individual predictedOutputN fields (most defensive approach)
    if (obj.predictedOutput1 !== undefined) {
      const grids: number[][][] = [];
      let index = 1;

      while (obj[`predictedOutput${index}`] !== undefined) {
        const grid = obj[`predictedOutput${index}`];
        if (grid && Array.isArray(grid) && grid.length > 0) {
          grids.push(grid);
        }
        index++;
      }

      if (grids.length > 0) {
        return grids;
      }
    }

    // Fallback: Check multiTestPredictionGrids
    if (obj.multiTestPredictionGrids) {
      try {
        const gridData = obj.multiTestPredictionGrids;
        if (Array.isArray(gridData)) {
          return gridData.filter((g: any) => Array.isArray(g) && g.length > 0);
        } else if (typeof gridData === 'string') {
          return JSON.parse(gridData);
        }
      } catch (e) {
        // Failed to parse - continue
      }
    }

    // Fallback: Check multiplePredictedOutputs
    if (Array.isArray(obj.multiplePredictedOutputs)) {
      return obj.multiplePredictedOutputs.filter((g: any) => Array.isArray(g) && g.length > 0);
    }

    return [];
  }, [structuredJson]);

  // Get test grids
  const testExample = task?.test?.[0];

  return (
    <div className="card bg-blue-50 border border-blue-200 shadow-sm">
      <div className="card-body p-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 text-xs text-blue-600">
              {renderStatusBadge()}
              {phase && <span>Phase: {phase}</span>}
              {message && <span className="truncate max-w-sm">{message}</span>}
            </div>
          </div>
          {onCancel && status === 'in_progress' && (
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          {onClose && (status === 'completed' || status === 'failed') && (
            <button className="btn btn-primary btn-sm" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <div className="space-y-4 text-sm text-blue-900 pt-2">
          {/* Solver Progress Overview */}
          {steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Solver Progress</p>
              <div className="flex flex-wrap gap-1.5">
                {steps.map(step => (
                  <span
                    key={step.id}
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      step.status === 'done'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : step.status === 'current'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
              {statusLine && (
                <p className="text-xs text-blue-800 mt-1">{statusLine}</p>
              )}
            </div>
          )}
          {/* Test Grids Section - Compact */}
          {testExample && (
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Test Input</p>
                <GridDisplay
                  grid={testExample.input}
                  label=""
                  showDimensions={false}
                  className="border border-blue-200 bg-white rounded-md shadow-xs"
                  maxWidth={256}
                  maxHeight={256}
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Test Output</p>
                <GridDisplay
                  grid={testExample.output}
                  label=""
                  showDimensions={false}
                  className="border border-blue-200 bg-white rounded-md shadow-xs"
                  maxWidth={256}
                  maxHeight={256}
                />
              </div>
              {promptPreview && (
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Prompt Sent</p>
                  <pre className="whitespace-pre-wrap bg-blue-50 border border-blue-300 rounded p-3 max-h-[120px] overflow-y-auto text-[10px] text-blue-800 leading-tight">
                    {promptPreview}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Multi-Test Prediction Grids Section */}
          {predictedGrids && predictedGrids.length > 0 && status === 'completed' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Predicted Outputs ({predictedGrids.length} tests)
              </p>
              <div className="flex flex-wrap gap-3 p-2 bg-blue-50/50 rounded-md border border-blue-150/50">
                {predictedGrids.map((grid, index) => (
                  <div key={index} className="flex flex-col items-center gap-1">
                    <p className="text-[10px] text-blue-500 font-medium">Test {index + 1}</p>
                    <GridDisplay
                      grid={grid}
                      label=""
                      showDimensions={false}
                      className="border border-blue-200 bg-white rounded-md shadow-xs"
                      maxWidth={200}
                      maxHeight={200}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt only if no test grids */}
          {!testExample && promptPreview && (
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Prompt Sent</p>
              <pre className="whitespace-pre-wrap bg-blue-50 border border-blue-300 rounded-md p-3 max-h-[150px] overflow-y-auto text-xs text-blue-800">
                {promptPreview}
              </pre>
            </div>
          )}

          {reasoning && reasoning.trim().length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Reasoning</p>
              <pre className="whitespace-pre-wrap bg-white border border-blue-200 rounded-md p-3 max-h-[400px] overflow-y-auto text-xs text-blue-700 font-mono">
                {reasoning}
              </pre>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Final Reply</p>
            <pre className="whitespace-pre-wrap bg-white border border-blue-200 rounded-md p-3 max-h-[500px] overflow-y-auto font-mono text-xs">
              {visibleOutput && visibleOutput.length > 0 ? visibleOutput : 'Waiting for output\u2026'}
            </pre>
          </div>
          {hasStructuredJson && text && text.trim().length > 0 && formattedStructuredJson !== text.trim() && (
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Raw Text Stream</p>
              <pre className="whitespace-pre-wrap bg-white border border-blue-200 rounded-md p-3 max-h-[300px] overflow-y-auto font-mono text-xs">
                {text.trim()}
              </pre>
            </div>
          )}
          {tokenUsage && (tokenUsage.input || tokenUsage.output || tokenUsage.reasoning) && (
            <div className="text-xs text-blue-500 flex gap-3">
              {tokenUsage.input !== undefined && <span>Input: {tokenUsage.input}</span>}
              {tokenUsage.output !== undefined && <span>Output: {tokenUsage.output}</span>}
              {tokenUsage.reasoning !== undefined && <span>Reasoning: {tokenUsage.reasoning}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


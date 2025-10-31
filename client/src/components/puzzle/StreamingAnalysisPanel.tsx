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
          {/* Test Grids Section - Compact */}
          {testExample && (
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Test Input</p>
                <div className="bg-white border border-blue-200 rounded-md p-2 shadow-xs">
                  <TinyGrid grid={testExample.input} className="w-24 h-24 md:w-32 md:h-32" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Test Output</p>
                <div className="bg-white border border-blue-200 rounded-md p-2 shadow-xs">
                  <TinyGrid grid={testExample.output} className="w-24 h-24 md:w-32 md:h-32" />
                </div>
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

          {/* Prompt only if no test grids */}
          {!testExample && promptPreview && (
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Prompt Sent</p>
              <pre className="whitespace-pre-wrap bg-blue-50 border border-blue-300 rounded-md p-3 max-h-[150px] overflow-y-auto text-xs text-blue-800">
                {promptPreview}
              </pre>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Current Output</p>
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
          {reasoning && reasoning.trim().length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Reasoning</p>
              <pre className="whitespace-pre-wrap bg-white border border-blue-200 rounded-md p-3 max-h-[400px] overflow-y-auto text-xs text-blue-700 font-mono">
                {reasoning}
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


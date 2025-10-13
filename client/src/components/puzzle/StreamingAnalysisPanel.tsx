/**
 * Author: Codex using GPT-5-high
 * Date: 2025-10-12 (Converted to DaisyUI)
 * PURPOSE: Shared panel to display live token streaming output (text + reasoning) across Saturn/Grover/Puzzle flows.
 * SRP/DRY check: Pass — reusable UI primitive.
 * DaisyUI: Pass — Uses DaisyUI card, badge, and button components.
 */

import { Loader2 } from 'lucide-react';

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
  reasoning?: string;
  tokenUsage?: TokenUsageSummary;
  onCancel?: () => void;
  onClose?: () => void;
}

export function StreamingAnalysisPanel({
  title = 'Live Output',
  status,
  phase,
  message,
  text,
  reasoning,
  tokenUsage,
  onCancel,
  onClose,
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
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Current Output</p>
            <pre className="whitespace-pre-wrap bg-white border border-blue-200 rounded-md p-3 max-h-[500px] overflow-y-auto font-mono text-xs">
              {text?.trim() || 'Waiting for output\u2026'}
            </pre>
          </div>
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


/**
 * AdvancedControls.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Handles all advanced model parameter controls (temperature, topP, candidates, thinking budget, GPT-5 reasoning).
 * Extracted from PuzzleExaminer lines 673-857 to follow SRP.
 * 
 * SRP/DRY check: Pass - Single responsibility (advanced parameter controls)
 * DaisyUI: Pass - Uses DaisyUI range, select, and card components
 */

import React from 'react';
import { Brain } from 'lucide-react';

interface AdvancedControlsProps {
  temperature: number;
  onTemperatureChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
  candidateCount: number;
  onCandidateCountChange: (value: number) => void;
  thinkingBudget: number;
  onThinkingBudgetChange: (value: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  onReasoningEffortChange: (value: 'minimal' | 'low' | 'medium' | 'high') => void;
  reasoningVerbosity: 'low' | 'medium' | 'high';
  onReasoningVerbosityChange: (value: 'low' | 'medium' | 'high') => void;
  reasoningSummaryType: 'auto' | 'detailed';
  onReasoningSummaryTypeChange: (value: 'auto' | 'detailed') => void;
}

/**
 * Displays advanced model parameter controls in organized sections
 */
export function AdvancedControls({
  temperature,
  onTemperatureChange,
  topP,
  onTopPChange,
  candidateCount,
  onCandidateCountChange,
  thinkingBudget,
  onThinkingBudgetChange,
  reasoningEffort,
  onReasoningEffortChange,
  reasoningVerbosity,
  onReasoningVerbosityChange,
  reasoningSummaryType,
  onReasoningSummaryTypeChange
}: AdvancedControlsProps) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100">
      <div className="space-y-3 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor="temperature" className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
            Temperature
          </label>
          <input
            type="range"
            id="temperature"
            min="0.1"
            max="2.0"
            step="0.05"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="range range-xs flex-1 min-w-[160px]"
          />
          <span className="text-xs font-mono text-base-content/80">{temperature.toFixed(2)}</span>
          <span className="text-[0.7rem] text-base-content/60 sm:ml-auto">
            Determinism vs. creativity (Gemini · GPT-4.1)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor="topP" className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
            Top P
          </label>
          <input
            type="range"
            id="topP"
            min="0.0"
            max="1.0"
            step="0.05"
            value={topP}
            onChange={(e) => onTopPChange(parseFloat(e.target.value))}
            className="range range-xs flex-1 min-w-[160px]"
          />
          <span className="text-xs font-mono text-base-content/80">{topP.toFixed(2)}</span>
          <span className="text-[0.7rem] text-base-content/60 sm:ml-auto">Controls response diversity (Gemini)</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor="candidateCount" className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
            Candidates
          </label>
          <input
            type="range"
            id="candidateCount"
            min="1"
            max="8"
            step="1"
            value={candidateCount}
            onChange={(e) => onCandidateCountChange(parseInt(e.target.value))}
            className="range range-xs flex-1 min-w-[160px]"
          />
          <span className="text-xs font-mono text-base-content/80">{candidateCount}</span>
          <span className="text-[0.7rem] text-base-content/60 sm:ml-auto">Parallel candidates (Gemini)</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-base-200 pt-3">
          <label htmlFor="thinkingBudget" className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
            Thinking budget
          </label>
          <select
            id="thinkingBudget"
            className="select select-bordered select-sm flex-1 min-w-[160px]"
            value={thinkingBudget.toString()}
            onChange={(e) => onThinkingBudgetChange(parseInt(e.target.value))}
          >
            <option value="-1">Dynamic</option>
            <option value="0">Disabled</option>
            <option value="512">512 tokens</option>
            <option value="1024">1024 tokens</option>
            <option value="2048">2048 tokens</option>
            <option value="4096">4096 tokens</option>
            <option value="8192">8192 tokens</option>
            <option value="16384">16384 tokens</option>
            <option value="24576">24576 tokens (Flash max)</option>
            <option value="32768">32768 tokens (Pro max)</option>
          </select>
          <span className="text-[0.7rem] text-base-content/60 sm:ml-auto">Internal reasoning tokens (Gemini 2.5+)</span>
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-800">
            <Brain className="h-3.5 w-3.5" />
            GPT-5 reasoning parameters
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="reasoning-effort" className="text-xs font-medium text-blue-800">
                Effort
              </label>
              <select
                id="reasoning-effort"
                className="select select-bordered select-sm w-full"
                value={reasoningEffort}
                onChange={(e) => onReasoningEffortChange(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
              >
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="text-[0.7rem] text-blue-700">
                {reasoningEffort === 'minimal' && 'Fast heuristic checks'}
                {reasoningEffort === 'low' && 'Light planning'}
                {reasoningEffort === 'medium' && 'Structured reasoning'}
                {reasoningEffort === 'high' && 'Max depth reasoning'}
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="reasoning-verbosity" className="text-xs font-medium text-blue-800">
                Verbosity
              </label>
              <select
                id="reasoning-verbosity"
                className="select select-bordered select-sm w-full"
                value={reasoningVerbosity}
                onChange={(e) => onReasoningVerbosityChange(e.target.value as 'low' | 'medium' | 'high')}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="text-[0.7rem] text-blue-700">
                {reasoningVerbosity === 'low' && 'Concise logs'}
                {reasoningVerbosity === 'medium' && 'Balanced detail'}
                {reasoningVerbosity === 'high' && 'Full reasoning trace'}
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="reasoning-summary" className="text-xs font-medium text-blue-800">
                Summary
              </label>
              <select
                id="reasoning-summary"
                className="select select-bordered select-sm w-full"
                value={reasoningSummaryType}
                onChange={(e) => onReasoningSummaryTypeChange(e.target.value as 'auto' | 'detailed')}
              >
                <option value="auto">Auto</option>
                <option value="detailed">Detailed</option>
              </select>
              <p className="text-[0.7rem] text-blue-700">
                {reasoningSummaryType === 'auto' && 'Model decides summary length'}
                {reasoningSummaryType === 'detailed' && 'Always include full recap'}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[0.7rem] text-blue-700">
            Available on GPT-5 class models. Pair with temperature ≤ 0.3 for best reproducibility.
          </p>
        </div>
      </div>
    </div>
  );
}

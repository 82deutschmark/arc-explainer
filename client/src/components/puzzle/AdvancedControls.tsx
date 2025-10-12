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
    <div className="space-y-2">
      {/* Temperature Control */}
      <div className="p-2 bg-base-200 border border-base-300 rounded">
        <div className="flex items-center gap-3">
          <label htmlFor="temperature" className="label text-sm font-medium whitespace-nowrap">
            Temperature: {temperature}
          </label>
          <div className="flex-1 max-w-xs">
            <input
              type="range"
              id="temperature"
              min="0.1"
              max="2.0"
              step="0.05"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              className="range range-xs w-full"
            />
          </div>
          <div className="text-xs opacity-60 flex-shrink-0">
            <div>Controls creativity • Gemini & GPT-4.1 & older only!!!</div>
            <div className="text-blue-600">💡 Temperature and reasoning are mutually exclusive</div>
          </div>
        </div>
      </div>

      {/* Top P Control */}
      <div className="p-2 bg-base-200 border border-base-300 rounded">
        <div className="flex items-center gap-3">
          <label htmlFor="topP" className="label text-sm font-medium whitespace-nowrap">
            Top P: {topP.toFixed(2)}
          </label>
          <div className="flex-1 max-w-xs">
            <input
              type="range"
              id="topP"
              min="0.0"
              max="1.0"
              step="0.05"
              value={topP}
              onChange={(e) => onTopPChange(parseFloat(e.target.value))}
              className="range range-xs w-full"
            />
          </div>
          <div className="text-xs opacity-60 flex-shrink-0">
            <div>Controls diversity • Gemini only</div>
          </div>
        </div>
      </div>

      {/* Candidate Count Control */}
      <div className="p-2 bg-base-200 border border-base-300 rounded">
        <div className="flex items-center gap-3">
          <label htmlFor="candidateCount" className="label text-sm font-medium whitespace-nowrap">
            Candidates: {candidateCount}
          </label>
          <div className="flex-1 max-w-xs">
            <input
              type="range"
              id="candidateCount"
              min="1"
              max="8"
              step="1"
              value={candidateCount}
              onChange={(e) => onCandidateCountChange(parseInt(e.target.value))}
              className="range range-xs w-full"
            />
          </div>
          <div className="text-xs opacity-60 flex-shrink-0">
            <div>Number of responses • Gemini only</div>
          </div>
        </div>
      </div>

      {/* Thinking Budget Control */}
      <div className="p-2 bg-purple-50 border border-purple-200 rounded">
        <div className="flex items-center gap-3">
          <label htmlFor="thinkingBudget" className="label text-sm font-medium whitespace-nowrap">
            Thinking Budget: {thinkingBudget === -1 ? 'Dynamic' : thinkingBudget === 0 ? 'Disabled' : thinkingBudget}
          </label>
          <div className="flex-1 max-w-xs">
            <select
              className="select select-bordered w-full"
              value={thinkingBudget.toString()}
              onChange={(e) => onThinkingBudgetChange(parseInt(e.target.value))}
            >
              <option value="-1">Dynamic (Model Chooses)</option>
              <option value="0">Disabled</option>
              <option value="512">512 tokens</option>
              <option value="1024">1024 tokens</option>
              <option value="2048">2048 tokens</option>
              <option value="4096">4096 tokens</option>
              <option value="8192">8192 tokens</option>
              <option value="16384">16384 tokens</option>
              <option value="24576">24576 tokens (Max Flash)</option>
              <option value="32768">32768 tokens (Max Pro)</option>
            </select>
          </div>
          <div className="text-xs opacity-60 flex-shrink-0">
            <div>Internal reasoning tokens • Gemini 2.5+ only</div>
          </div>
        </div>
      </div>

      {/* GPT-5 Reasoning Parameters */}
      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Brain className="h-4 w-4" />
          GPT-5 Reasoning Parameters
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Effort Control */}
          <div>
            <label htmlFor="reasoning-effort" className="label text-sm font-medium text-blue-700">
              Effort Level
            </label>
            <select
              className="select select-bordered w-full mt-1"
              value={reasoningEffort}
              onChange={(e) => onReasoningEffortChange(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
            >
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="text-xs text-blue-600 mt-0.5">
              {reasoningEffort === 'minimal' && 'Basic reasoning'}
              {reasoningEffort === 'low' && 'Light reasoning'}
              {reasoningEffort === 'medium' && 'Moderate reasoning'}
              {reasoningEffort === 'high' && 'Intensive reasoning'}
            </p>
          </div>

          {/* Verbosity Control */}
          <div>
            <label htmlFor="reasoning-verbosity" className="label text-sm font-medium text-blue-700">
              Verbosity
            </label>
            <select
              className="select select-bordered w-full mt-1"
              value={reasoningVerbosity}
              onChange={(e) => onReasoningVerbosityChange(e.target.value as 'low' | 'medium' | 'high')}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="text-xs text-blue-600 mt-0.5">
              {reasoningVerbosity === 'low' && 'Concise reasoning logs'}
              {reasoningVerbosity === 'medium' && 'Balanced detail'}
              {reasoningVerbosity === 'high' && 'Detailed reasoning logs'}
            </p>
          </div>

          {/* Summary Control */}
          <div>
            <label htmlFor="reasoning-summary" className="label text-sm font-medium text-blue-700">
              Summary
            </label>
            <select
              className="select select-bordered w-full mt-1"
              value={reasoningSummaryType}
              onChange={(e) => onReasoningSummaryTypeChange(e.target.value as 'auto' | 'detailed')}
            >
              <option value="auto">Auto</option>
              <option value="detailed">Detailed</option>
            </select>
            <p className="text-xs text-blue-600 mt-0.5">
              {reasoningSummaryType === 'auto' && 'Automatic summary generation'}
              {reasoningSummaryType === 'detailed' && 'Comprehensive summary'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

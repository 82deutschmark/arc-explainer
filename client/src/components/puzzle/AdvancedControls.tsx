/**
 * Author: gpt-5-codex
 * Date: 2025-10-31
 * PURPOSE: Provides a high-density advanced model parameter editor with compact DaisyUI controls and inline tooltips.
 * SRP/DRY check: Pass - confirmed the component only manages control rendering while state comes from the parent container.
 */

import React from 'react';
import { Brain, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

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
  includeGridImages: boolean;
  onIncludeGridImagesChange: (value: boolean) => void;
}

type NumberCommitHandler = (
  target: HTMLInputElement,
  min: number,
  max: number,
  decimals: number,
  onChange: (value: number) => void
) => void;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatDecimal = (value: number, decimals: number) =>
  decimals === 0 ? `${value}` : value.toFixed(decimals);

const commitNumber: NumberCommitHandler = (target, min, max, decimals, onChange) => {
  const parsed = parseFloat(target.value);
  const fallback = decimals === 0 ? Math.round(min) : parseFloat(min.toFixed(decimals));

  if (Number.isNaN(parsed)) {
    onChange(fallback);
    target.value = formatDecimal(fallback, decimals);
    return;
  }

  const clamped = clamp(parsed, min, max);
  const normalized = decimals === 0 ? Math.round(clamped) : parseFloat(clamped.toFixed(decimals));
  onChange(normalized);
  target.value = formatDecimal(normalized, decimals);
};

const THINKING_BUDGET_OPTIONS: Array<{ value: number; label: string }> = [
  { value: -1, label: 'Dynamic (auto)' },
  { value: 0, label: 'Disabled' },
  { value: 512, label: '512 tokens' },
  { value: 1024, label: '1024 tokens' },
  { value: 2048, label: '2048 tokens' },
  { value: 4096, label: '4096 tokens' },
  { value: 8192, label: '8192 tokens' },
  { value: 16384, label: '16384 tokens' },
  { value: 24576, label: '24576 tokens (Flash max)' },
  { value: 32768, label: '32768 tokens (Pro max)' }
];

const EFFORT_DESCRIPTIONS = {
  minimal: 'Fast heuristic checks',
  low: 'Light planning',
  medium: 'Structured reasoning',
  high: 'Max depth reasoning'
} as const;

const VERBOSITY_DESCRIPTIONS = {
  low: 'Concise logs',
  medium: 'Balanced detail',
  high: 'Full reasoning trace'
} as const;

const SUMMARY_DESCRIPTIONS = {
  auto: 'Model decides summary length',
  detailed: 'Always include full recap'
} as const;

/**
 * Displays advanced model parameters in a compact grid.
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
  onReasoningSummaryTypeChange,
  includeGridImages,
  onIncludeGridImagesChange
}: AdvancedControlsProps) {
  const sliderControls = [
    {
      id: 'temperature',
      label: 'Temperature',
      tooltip: 'Determinism versus creativity.',
      min: 0.1,
      max: 2.0,
      step: 0.05,
      decimals: 2,
      value: temperature,
      onChange: onTemperatureChange
    },
    {
      id: 'topP',
      label: 'Top P',
      tooltip: 'Controls response diversity.',
      min: 0,
      max: 1,
      step: 0.01,
      decimals: 2,
      value: topP,
      onChange: onTopPChange
    },
    {
      id: 'candidateCount',
      label: 'Candidates',
      tooltip: 'Parallel completions per request.',
      min: 1,
      max: 8,
      step: 1,
      decimals: 0,
      value: candidateCount,
      onChange: onCandidateCountChange
    }
  ] as const;

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-box border border-base-200 bg-base-100/80 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="uppercase tracking-wide text-[10px] text-base-content/60">Sampling</span>
          <span className="text-[10px] font-medium text-base-content/60">Model: GPT-4x only, Gemini</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
          {sliderControls.map((control) => (
            <div key={control.id} className="form-control gap-2">
              <label htmlFor={control.id} className="label py-0">
                <span className="label-text flex items-center gap-1 text-xs font-semibold">
                  {control.label}
                  <div className="tooltip tooltip-top" data-tip={control.tooltip}>
                    <Info className="h-3 w-3 text-base-content/50" aria-hidden="true" />
                  </div>
                </span>
                <span className="text-xs font-mono tabular-nums text-base-content">
                  {formatDecimal(control.value, control.decimals)}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={control.id}
                  type="range"
                  className="range range-primary range-xs flex-1"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={control.value}
                  onChange={(event) => {
                    const parsed = parseFloat(event.currentTarget.value);
                    if (!Number.isNaN(parsed)) {
                      const clamped = clamp(parsed, control.min, control.max);
                      const normalized =
                        control.decimals === 0
                          ? Math.round(clamped)
                          : parseFloat(clamped.toFixed(control.decimals));
                      control.onChange(normalized);
                    }
                  }}
                />
                <input
                  key={`${control.id}-${formatDecimal(control.value, control.decimals)}`}
                  type="number"
                  className="input input-bordered input-xs w-16 text-right"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  defaultValue={formatDecimal(control.value, control.decimals)}
                  aria-label={`${control.label} numeric value`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitNumber(
                        event.currentTarget,
                        control.min,
                        control.max,
                        control.decimals,
                        control.onChange
                      );
                    }
                  }}
                  onBlur={(event) =>
                    commitNumber(
                      event.currentTarget,
                      control.min,
                      control.max,
                      control.decimals,
                      control.onChange
                    )
                  }
                />
              </div>
            </div>
          ))}

          <div className="form-control gap-2 sm:col-span-2 lg:col-span-3">
            <label htmlFor="thinkingBudget" className="label py-0">
              <span className="label-text flex items-center gap-1 text-xs font-semibold">
                Thinking Budget
                <div
                  className="tooltip tooltip-top"
                  data-tip="Internal reasoning tokens for Gemini 2.5+ models."
                >
                  <Info className="h-3 w-3 text-base-content/50" aria-hidden="true" />
                </div>
              </span>
              <span className="text-xs font-mono uppercase tracking-wide text-base-content/60">
                {thinkingBudget < 0 ? 'Dynamic' : `${thinkingBudget} tokens`}
              </span>
            </label>
            <select
              id="thinkingBudget"
              className="select select-bordered select-xs w-full"
              value={thinkingBudget.toString()}
              onChange={(event) => onThinkingBudgetChange(parseInt(event.currentTarget.value, 10))}
            >
              {THINKING_BUDGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value.toString()}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-box border border-base-200 bg-base-100/80 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="uppercase tracking-wide text-[10px] text-base-content/60">GPT-5 Reasoning Parameters</span>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="form-control gap-1">
              <label htmlFor="reasoning-effort" className="label py-0">
                <span className="label-text text-xs font-semibold">Effort</span>
              </label>
              <select
                id="reasoning-effort"
                className="select select-bordered select-xs w-full"
                value={reasoningEffort}
                onChange={(event) =>
                  onReasoningEffortChange(event.currentTarget.value as typeof reasoningEffort)
                }
              >
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="text-[11px] text-base-content/60">{EFFORT_DESCRIPTIONS[reasoningEffort]}</p>
            </div>

            <div className="form-control gap-1">
              <label htmlFor="reasoning-verbosity" className="label py-0">
                <span className="label-text text-xs font-semibold">Verbosity</span>
              </label>
              <select
                id="reasoning-verbosity"
                className="select select-bordered select-xs w-full"
                value={reasoningVerbosity}
                onChange={(event) =>
                  onReasoningVerbosityChange(event.currentTarget.value as typeof reasoningVerbosity)
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="text-[11px] text-base-content/60">
                {VERBOSITY_DESCRIPTIONS[reasoningVerbosity]}
              </p>
            </div>

            <div className="form-control gap-1">
              <label htmlFor="reasoning-summary" className="label py-0">
                <span className="label-text text-xs font-semibold">Summary</span>
              </label>
              <select
                id="reasoning-summary"
                className="select select-bordered select-xs w-full"
                value={reasoningSummaryType}
                onChange={(event) =>
                  onReasoningSummaryTypeChange(
                    event.currentTarget.value as typeof reasoningSummaryType
                  )
                }
              >
                <option value="auto">Auto</option>
                <option value="detailed">Detailed</option>
              </select>
              <p className="text-[11px] text-base-content/60">
                {SUMMARY_DESCRIPTIONS[reasoningSummaryType]}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-base-content/60">
            GPT-5 is NOT compatible with temperature settings. These controls are ignored.
          </p>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Switch
                id="include-grid-images-advanced"
                checked={includeGridImages}
                onCheckedChange={(checked) => onIncludeGridImagesChange(Boolean(checked))}
              />
              <span className="text-[11px] text-base-content/80">
                Include puzzle screenshots in request
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

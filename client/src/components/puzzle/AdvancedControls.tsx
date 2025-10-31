/**
 * AdvancedControls.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-31
 * PURPOSE: Handles all advanced model parameter controls (temperature, topP, candidates, thinking budget, GPT-5 reasoning).
 * Refactored to use shadcn/ui for compact, professional design with clear visual hierarchy.
 *
 * SRP/DRY check: Pass - Single responsibility (advanced parameter controls)
 * shadcn/ui: Pass - Uses shadcn/ui Slider, Select, and Label components for consistent, compact design
 */

import React from 'react';
import { Brain } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const effortDescriptions = {
  minimal: 'Fast heuristic checks',
  low: 'Light planning',
  medium: 'Structured reasoning',
  high: 'Max depth reasoning'
} as const;

const verbosityDescriptions = {
  low: 'Concise logs',
  medium: 'Balanced detail',
  high: 'Full reasoning trace'
} as const;

const summaryDescriptions = {
  auto: 'Model decides summary length',
  detailed: 'Always include full recap'
} as const;

/**
 * Displays advanced model parameter controls in a compact, professional layout
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
    <div className="space-y-3">
      {/* Temperature Control */}
      <div className="bg-muted/30 rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature" className="text-sm font-semibold">
            Temperature
          </Label>
          <span className="text-sm font-mono tabular-nums font-semibold">{temperature.toFixed(2)}</span>
        </div>
        <Slider
          id="temperature"
          min={0.1}
          max={2.0}
          step={0.05}
          value={[temperature]}
          onValueChange={([value]) => onTemperatureChange(value)}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Determinism vs. creativity (Gemini · GPT-4.1)
        </p>
      </div>

      {/* Top P Control */}
      <div className="bg-muted/30 rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="topP" className="text-sm font-semibold">
            Top P
          </Label>
          <span className="text-sm font-mono tabular-nums font-semibold">{topP.toFixed(2)}</span>
        </div>
        <Slider
          id="topP"
          min={0.0}
          max={1.0}
          step={0.05}
          value={[topP]}
          onValueChange={([value]) => onTopPChange(value)}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Controls response diversity (Gemini)
        </p>
      </div>

      {/* Candidates Control */}
      <div className="bg-muted/30 rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="candidateCount" className="text-sm font-semibold">
            Candidates
          </Label>
          <span className="text-sm font-mono tabular-nums font-semibold">{candidateCount}</span>
        </div>
        <Slider
          id="candidateCount"
          min={1}
          max={8}
          step={1}
          value={[candidateCount]}
          onValueChange={([value]) => onCandidateCountChange(value)}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Parallel candidates (Gemini)
        </p>
      </div>

      {/* Thinking Budget Control */}
      <div className="bg-muted/30 rounded-md p-2.5 space-y-1.5">
        <Label htmlFor="thinkingBudget" className="text-sm font-semibold">
          Thinking Budget
        </Label>
        <Select value={thinkingBudget.toString()} onValueChange={(value) => onThinkingBudgetChange(parseInt(value))}>
          <SelectTrigger id="thinkingBudget" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-1">Dynamic</SelectItem>
            <SelectItem value="0">Disabled</SelectItem>
            <SelectItem value="512">512 tokens</SelectItem>
            <SelectItem value="1024">1024 tokens</SelectItem>
            <SelectItem value="2048">2048 tokens</SelectItem>
            <SelectItem value="4096">4096 tokens</SelectItem>
            <SelectItem value="8192">8192 tokens</SelectItem>
            <SelectItem value="16384">16384 tokens</SelectItem>
            <SelectItem value="24576">24576 tokens (Flash max)</SelectItem>
            <SelectItem value="32768">32768 tokens (Pro max)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Internal reasoning tokens (Gemini 2.5+)
        </p>
      </div>

      {/* GPT-5 Reasoning Parameters */}
      <div className="rounded-md border border-blue-300 bg-blue-50 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-700" />
          <span className="text-sm font-semibold text-blue-900">
            GPT-5 Reasoning Parameters
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Effort */}
          <div className="bg-white/60 rounded p-2 space-y-1.5">
            <Label htmlFor="reasoning-effort" className="text-xs font-semibold text-blue-900">
              Effort
            </Label>
            <Select value={reasoningEffort} onValueChange={(value) => onReasoningEffortChange(value as typeof reasoningEffort)}>
              <SelectTrigger id="reasoning-effort" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-800">
              {effortDescriptions[reasoningEffort]}
            </p>
          </div>

          {/* Verbosity */}
          <div className="bg-white/60 rounded p-2 space-y-1.5">
            <Label htmlFor="reasoning-verbosity" className="text-xs font-semibold text-blue-900">
              Verbosity
            </Label>
            <Select value={reasoningVerbosity} onValueChange={(value) => onReasoningVerbosityChange(value as typeof reasoningVerbosity)}>
              <SelectTrigger id="reasoning-verbosity" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-800">
              {verbosityDescriptions[reasoningVerbosity]}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-white/60 rounded p-2 space-y-1.5">
            <Label htmlFor="reasoning-summary" className="text-xs font-semibold text-blue-900">
              Summary
            </Label>
            <Select value={reasoningSummaryType} onValueChange={(value) => onReasoningSummaryTypeChange(value as typeof reasoningSummaryType)}>
              <SelectTrigger id="reasoning-summary" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-800">
              {summaryDescriptions[reasoningSummaryType]}
            </p>
          </div>
        </div>

        <p className="text-xs text-blue-800/90">
          Available on GPT-5 class models. Pair with temperature ≤ 0.3 for best reproducibility.
        </p>
      </div>
    </div>
  );
}

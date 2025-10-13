/**
 * client/src/components/saturn/SaturnControlPanel.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Compact control panel for Saturn Visual Solver settings. Features model selection,
 * temperature control, and reasoning parameters in a clean, minimal design.
 *
 * SRP/DRY check: Pass - Single responsibility for control settings
 * DaisyUI: Pass - Uses DaisyUI form components exclusively
 */

import React from 'react';
import { Settings, Brain, Zap, Thermometer } from 'lucide-react';

interface SaturnControlPanelProps {
  model: string;
  setModel: (model: string) => void;
  temperature: number;
  setTemperature: (temperature: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (effort: 'minimal' | 'low' | 'medium' | 'high') => void;
  isRunning: boolean;
}

export default function SaturnControlPanel({
  model,
  setModel,
  temperature,
  setTemperature,
  reasoningEffort,
  setReasoningEffort,
  isRunning,
}: SaturnControlPanelProps) {
  const models = [
    { value: 'gpt-5', label: 'GPT-5', description: 'Latest OpenAI model' },
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Anthropic\'s best model' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Google\'s flagship model' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Fast multimodal model' },
  ];

  return (
    <div className="card bg-white/90 backdrop-blur-sm border-0 shadow-xl">
      <div className="card-body p-4">

        {/* Minimal Header */}
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-gray-600" />
          <h3 className="font-medium text-gray-800">Controls</h3>
        </div>

        {/* Ultra Minimal Controls */}
        <div className="space-y-3">
          <div>
            <select
              className="select select-bordered select-sm w-full bg-white"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
            >
              <option value="gpt-5">GPT-5</option>
              <option value="claude-3.5-sonnet">Claude 3.5</option>
              <option value="gemini-1.5-pro">Gemini 1.5</option>
            </select>
          </div>

          <div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="range range-xs range-primary w-full"
              disabled={isRunning}
            />
            <div className="text-xs text-gray-500 text-center mt-1">{temperature}</div>
          </div>

          <div>
            <select
              className="select select-bordered select-sm w-full bg-white"
              value={reasoningEffort}
              onChange={(e) => setReasoningEffort(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
              disabled={isRunning}
            >
              <option value="minimal">Min</option>
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

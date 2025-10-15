/**
 * Author: code-supernova using DeepSeek V3.2 Exp
 * Date: 2025-10-15
 * PURPOSE: Control panel for Saturn Visual Solver - model selection and execution controls.
 * Clean component focused on solver configuration and control, not image display.
 * SRP: Single responsibility - solver control interface
 * DRY: Pass - reusable component
 */

import React from 'react';
import { Rocket, Square } from 'lucide-react';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';
import { getSaturnCompatibleModels, getDefaultSaturnModel, getModelDisplayName, modelSupportsTemperature, modelSupportsReasoningEffort } from '@/lib/saturnModels';

interface SaturnControlPanelProps {
  state: SaturnProgressState;
  isRunning: boolean;
  compact?: boolean;
  model: string;
  setModel: (model: string) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (effort: 'minimal' | 'low' | 'medium' | 'high') => void;
  onStart: () => void;
  onCancel: () => void;
}

export default function SaturnControlPanel({
  state,
  isRunning,
  compact,
  model,
  setModel,
  temperature,
  setTemperature,
  reasoningEffort,
  setReasoningEffort,
  onStart,
  onCancel
}: SaturnControlPanelProps) {

  const saturnModels = getSaturnCompatibleModels();
  const currentModel = saturnModels.find(m => m.key === model);
  const supportsTemperature = currentModel ? modelSupportsTemperature(model) : false;
  const supportsReasoningEffort = currentModel ? modelSupportsReasoningEffort(model) : false;

  // Update model if current selection is not compatible
  React.useEffect(() => {
    if (saturnModels.length > 0 && !saturnModels.find(m => m.key === model)) {
      const defaultModel = getDefaultSaturnModel();
      if (defaultModel) {
        setModel(defaultModel.key);
      }
    }
  }, [model, saturnModels, setModel]);

  if (compact) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm font-bold text-white">
              {isRunning ? 'SOLVER RUNNING' : 'SOLVER READY'}
            </span>
          </div>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isRunning}
            className="select select-bordered select-sm bg-white/90 text-gray-900"
          >
            {saturnModels.map(saturnModel => (
              <option key={saturnModel.key} value={saturnModel.key}>
                {getModelDisplayName(saturnModel.key)}
              </option>
            ))}
          </select>

          {supportsTemperature && (
            <div>
              <label className="text-xs text-white/80 block mb-1">Temperature</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={isRunning}
                className="range range-xs range-primary"
              />
              <div className="text-xs text-white/60 text-center">{temperature}</div>
            </div>
          )}

          {supportsReasoningEffort && (
            <div>
              <label className="text-xs text-white/80 block mb-1">Reasoning</label>
              <select
                value={reasoningEffort}
                onChange={(e) => setReasoningEffort(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
                disabled={isRunning}
                className="select select-bordered select-sm bg-white/90 text-gray-900"
              >
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}

          <button
            onClick={isRunning ? onCancel : onStart}
            className={`btn ${isRunning ? 'btn-error' : 'btn-success'} btn-sm`}
          >
            {isRunning ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Start
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-lg font-bold text-white">
            {isRunning ? 'SOLVER RUNNING' : 'SOLVER READY'}
          </span>
        </div>

        <div>
          <label className="text-sm font-medium text-white/90 block mb-2">AI Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isRunning}
            className="select select-bordered select-md w-full bg-white/90 text-gray-900"
          >
            {saturnModels.map(saturnModel => (
              <option key={saturnModel.key} value={saturnModel.key}>
                {getModelDisplayName(saturnModel.key)}
              </option>
            ))}
          </select>
        </div>

        {supportsTemperature && (
          <div>
            <label className="text-sm font-medium text-white/90 block mb-2">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              disabled={isRunning}
              className="range range-primary w-full"
            />
          </div>
        )}

        {supportsReasoningEffort && (
          <div>
            <label className="text-sm font-medium text-white/90 block mb-2">Reasoning Effort</label>
            <select
              value={reasoningEffort}
              onChange={(e) => setReasoningEffort(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
              disabled={isRunning}
              className="select select-bordered select-md w-full bg-white/90 text-gray-900"
            >
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        )}

        <button
          onClick={isRunning ? onCancel : onStart}
          className={`btn w-full ${isRunning ? 'btn-error' : 'btn-success'} btn-lg`}
        >
          {isRunning ? (
            <>
              <Square className="h-5 w-5" />
              Stop Solver
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              Start Visual Solver
            </>
          )}
        </button>
      </div>
    </div>
  );
}

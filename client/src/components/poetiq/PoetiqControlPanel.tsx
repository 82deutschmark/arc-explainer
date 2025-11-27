/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * Updated: 2025-11-26 - Dynamic model loading from API (no hardcoded lists)
 * PURPOSE: Control panel for Poetiq solver page (/puzzle/poetiq/:taskId).
 *          Fetches Poetiq-specific models from /api/poetiq/models and groups by provider.
 *          Expert configs: 1, 2, 8 only (from config.py).
 *
 * SRP/DRY check: Pass - Single responsibility for solver control interface
 * DaisyUI: Pass - Uses DaisyUI components
 */

import React, { useMemo, useEffect } from 'react';
import { Rocket, Square, Key, Users, AlertTriangle, Settings, Loader2 } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';
import { usePoetiqModels } from '@/hooks/usePoetiqModels';

// Provider options with key placeholders
const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter', icon: '', keyPlaceholder: 'sk-or-...', apiProvider: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI Direct', icon: '', keyPlaceholder: 'sk-...', apiProvider: 'OpenAI' },
  { value: 'gemini', label: 'Gemini Direct', icon: '', keyPlaceholder: 'AIza...', apiProvider: 'Google' },
] as const;

// Expert configs - 1, 2, 8 ONLY (from config.py)
const EXPERT_OPTIONS = [
  { value: 1, label: 'Gemini-3-a (1 Expert)', description: 'Fastest, ~5-15 min' },
  { value: 2, label: 'Gemini-3-b (2 Experts)', description: 'Default, ~10-20 min' },
  { value: 8, label: 'Gemini-3-c (8 Experts)', description: 'Best accuracy, ~25-45+ min' },
] as const;

interface PoetiqControlPanelProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  
  // API Key (optional - falls back to server env vars)
  apiKey: string;
  setApiKey: (key: string) => void;
  
  // Provider and model selection
  provider: 'gemini' | 'openrouter' | 'openai';
  setProvider: (provider: 'gemini' | 'openrouter' | 'openai') => void;
  model: string;
  setModel: (model: string) => void;
  
  // Expert configuration (1, 2, or 8)
  numExperts: number;
  setNumExperts: (num: number) => void;
  
  // Max iterations per expert
  maxIterations: number;
  setMaxIterations: (iterations: number) => void;
  
  // Temperature
  temperature: number;
  setTemperature: (temp: number) => void;
  
  // Actions
  onStart: () => void;
  onCancel: () => void;
}

export default function PoetiqControlPanel({
  state,
  isRunning,
  apiKey,
  setApiKey,
  provider,
  setProvider,
  model,
  setModel,
  numExperts,
  setNumExperts,
  maxIterations,
  setMaxIterations,
  temperature,
  setTemperature,
  onStart,
  onCancel,
}: PoetiqControlPanelProps) {
  // Fetch all models from API
  const { data: poetiqModels, isLoading: modelsLoading } = usePoetiqModels();
  
  // Can always start (API key is optional - falls back to server env vars)
  const canStart = !isRunning && !modelsLoading;
  
  // Get selected provider info
  const selectedProvider = PROVIDERS.find(p => p.value === provider);
  
  // Filter models by provider
  const models = useMemo(() => {
    if (!poetiqModels) return [];
    const providerMapping = selectedProvider?.apiProvider;
    return poetiqModels.filter(m => !providerMapping || m.provider === providerMapping);
  }, [poetiqModels, selectedProvider]);

  // Sync model state when models load - ensure selected model is valid for provider
  useEffect(() => {
    if (models.length > 0 && !isRunning) {
      // Check if current model is in the filtered list
      const currentModelExists = models.some(m => m.id === model);
      if (!currentModelExists) {
        // Set to first model for this provider
        setModel(models[0].id);
      }
    }
  }, [models, model, setModel, isRunning]);

  return (
    <div className="space-y-2">
      {/* Start Button - TOP */}
      <div className="bg-white border border-gray-300 rounded p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm font-bold text-gray-800">
            {isRunning ? 'POETIQ RUNNING' : 'READY TO START'}
          </span>
        </div>
        <button
          onClick={isRunning ? onCancel : onStart}
          disabled={!canStart && !isRunning}
          className={`btn w-full ${isRunning ? 'btn-error' : 'btn-success'}`}
        >
          {isRunning ? (
            <>
              <Square className="h-5 w-5" />
              Stop Solver
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              Start Poetiq Solver
            </>
          )}
        </button>
      </div>

      {/* Provider & Model Selection */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Provider & Model
          </h3>
          <div className="space-y-3">
            {/* Provider */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Provider</span>
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value as 'gemini' | 'openrouter' | 'openai';
                  setProvider(newProvider);
                  // Set default model for new provider from filtered list
                  const providerInfo = PROVIDERS.find(p => p.value === newProvider);
                  if (poetiqModels && providerInfo) {
                    const providerModels = poetiqModels.filter(m => m.provider === providerInfo.apiProvider);
                    if (providerModels.length > 0) {
                      setModel(providerModels[0].id);
                    }
                  }
                }}
                disabled={isRunning}
                className="select select-bordered select-sm w-full"
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.icon} {p.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Model */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Model</span>
              </label>
              {modelsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading models...</span>
                </div>
              ) : (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isRunning}
                  className="select select-bordered select-sm w-full"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.recommended ? ' (recommended)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {/* Temperature */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Temperature: {temperature.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={isRunning}
                className="range range-primary range-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* API Key Card (Optional) */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Key (Optional)
          </h3>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-[10px] text-blue-700">
                <strong>Optional:</strong> Leave blank to use server API key.
                Provide your own key for unlimited access.
              </p>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isRunning}
              placeholder={selectedProvider?.keyPlaceholder || 'API key (optional)'}
              className="input input-bordered input-sm w-full font-mono"
              autoComplete="new-password"
            />
            <p className="text-[10px] text-gray-500">
              Never stored. Used only for this run.
            </p>
          </div>
        </div>
      </div>

      {/* Expert Configuration Card */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Expert Configuration
          </h3>
          <div className="space-y-3">
            {/* Experts - 1, 2, or 8 ONLY */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Configuration</span>
              </label>
              <select
                value={numExperts}
                onChange={(e) => setNumExperts(parseInt(e.target.value))}
                disabled={isRunning}
                className="select select-bordered select-sm w-full"
              >
                {EXPERT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </option>
                ))}
              </select>
            </div>
            {/* Max Iterations */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Max Iterations per Expert</span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value) || 10)}
                disabled={isRunning}
                className="input input-bordered input-sm w-full"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Default: 10. Higher = more attempts but longer runtime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning for 8 experts */}
      {numExperts === 8 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              <strong>Gemini-3-c (8 experts)</strong> makes 8x parallel API calls. 
              This provides best accuracy but may take 25-45+ minutes and consume significant API quota.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

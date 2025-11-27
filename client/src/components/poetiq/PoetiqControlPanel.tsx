/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * Updated: 2025-11-26 - Full provider/model selection for solver page (unlike locked community page)
 * PURPOSE: Control panel for Poetiq solver page (/puzzle/poetiq/:taskId).
 *          Allows any provider/model (unlike community page which is locked to Gemini 3 Pro).
 *          Expert configs: 1, 2, 8 only (from config.py).
 *
 * SRP/DRY check: Pass - Single responsibility for solver control interface
 * DaisyUI: Pass - Uses DaisyUI components
 */

import React from 'react';
import { Rocket, Square, Key, Users, AlertTriangle, Settings } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';

// Provider options
const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter', icon: '🔀', keyPlaceholder: 'sk-or-...' },
  { value: 'openai', label: 'OpenAI Direct', icon: '🟢', keyPlaceholder: 'sk-...' },
  { value: 'gemini', label: 'Gemini Direct', icon: '🔷', keyPlaceholder: 'AIza...' },
] as const;

// OpenRouter models - from server/config/models.ts (OpenRouter entries)
const OPENROUTER_MODELS = [
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', recommended: true },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' },
];

// OpenAI Direct models - from server/config/models.ts
const OPENAI_MODELS = [
  { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano', recommended: true },
  { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini' },
  { id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini' },
  { id: 'o4-mini-2025-04-16', name: 'o4-mini' },
];

// Gemini Direct models - from server/config/models.ts
const GEMINI_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', recommended: true },
  { id: 'gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

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
  // Can always start (API key is optional - falls back to server env vars)
  const canStart = !isRunning;
  
  // Get models based on provider
  const models = provider === 'openrouter' 
    ? OPENROUTER_MODELS 
    : provider === 'openai' 
    ? OPENAI_MODELS 
    : GEMINI_MODELS;
  
  // Get selected provider info
  const selectedProvider = PROVIDERS.find(p => p.value === provider);

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
                  // Set default model for new provider
                  const defaultModels = newProvider === 'openrouter' ? OPENROUTER_MODELS 
                    : newProvider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;
                  setModel(defaultModels[0].id);
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
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isRunning}
                className="select select-bordered select-sm w-full"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.recommended ? '⭐' : ''}
                  </option>
                ))}
              </select>
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
              <strong>Gemini-3-c (8 experts)</strong> makes 8× parallel API calls. 
              This provides best accuracy but may take 25-45+ minutes and consume significant API quota.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

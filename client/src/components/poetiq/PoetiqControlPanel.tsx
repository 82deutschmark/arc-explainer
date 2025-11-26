/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * Updated: 2025-11-26 - Saturn-style visible controls, GPT-5 models
 * PURPOSE: Control panel for Poetiq solver - Saturn-style layout with all controls visible.
 *          Model selection (incl. GPT-5), provider choice, expert count, reasoning config.
 *          Matches Saturn's information density - NO collapsing, everything visible.
 *
 * SRP/DRY check: Pass - Single responsibility for solver control interface
 * DaisyUI: Pass - Uses DaisyUI components with Saturn-style cards
 */

import React from 'react';
import { Rocket, Square, Key, Users, AlertTriangle } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';

// Provider options
const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter', icon: '🔀' },
  { value: 'openai', label: 'OpenAI Direct', icon: '🟢' },
  { value: 'gemini', label: 'Gemini Direct', icon: '🔷' },
] as const;

// OpenRouter models - includes GPT-5 and other top models
const OPENROUTER_MODELS = [
  { id: 'openrouter/openai/gpt-5-nano', name: 'GPT-5 Nano (Recommended)', reasoning: true },
  { id: 'openrouter/openai/gpt-5-mini', name: 'GPT-5 Mini', reasoning: true },
  { id: 'openrouter/google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', reasoning: false },
  { id: 'openrouter/google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', reasoning: false },
  { id: 'openrouter/anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', reasoning: false },
];

// OpenAI Direct models (GPT-5 family)
const OPENAI_MODELS = [
  { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano (Recommended)', reasoning: true },
  { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', reasoning: true },
  { id: 'o4-mini-2025-04-16', name: 'O4 Mini', reasoning: true },
];

// Gemini Direct models
const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', reasoning: false },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', reasoning: false },
];

interface PoetiqControlPanelProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  
  // Configuration values
  apiKey: string;
  setApiKey: (key: string) => void;
  provider: 'gemini' | 'openrouter' | 'openai';
  setProvider: (provider: 'gemini' | 'openrouter' | 'openai') => void;
  model: string;
  setModel: (model: string) => void;
  numExperts: number;
  setNumExperts: (num: number) => void;
  maxIterations: number;
  setMaxIterations: (iterations: number) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (effort: 'minimal' | 'low' | 'medium' | 'high') => void;
  
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
  reasoningEffort,
  setReasoningEffort,
  onStart,
  onCancel,
}: PoetiqControlPanelProps) {
  // API key is now optional - can start without it (falls back to server env vars)
  const canStart = !isRunning;
  
  // Get models based on provider
  const models = provider === 'openrouter' 
    ? OPENROUTER_MODELS 
    : provider === 'openai' 
    ? OPENAI_MODELS 
    : GEMINI_MODELS;
  
  // Check if selected model supports reasoning
  const selectedModel = models.find(m => m.id === model);
  const showReasoningControls = selectedModel?.reasoning ?? false;

  return (
    <div className="space-y-2">
      {/* Start Button - TOP (Saturn style) */}
      <div className="bg-white border border-gray-300 rounded p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm font-bold text-gray-800">
            {isRunning ? 'SOLVER RUNNING' : 'READY TO START'}
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
              Start Code Generation
            </>
          )}
        </button>
      </div>

      {/* API Key Card */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Key (Optional)
          </h3>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-[10px] text-blue-700">
                <strong>Optional:</strong> Leave blank to use server API key (limited usage).
                Provide your own key for unlimited access.
              </p>
            </div>
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Provider</span>
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
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
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">
                  {provider === 'openai' ? 'OpenAI Key' : provider === 'gemini' ? 'Gemini Key' : 'OpenRouter Key'}
                </span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isRunning}
                placeholder={provider === 'openai' ? 'sk-... (optional)' : provider === 'gemini' ? 'AIza... (optional)' : 'sk-or-... (optional)'}
                className="input input-bordered input-sm w-full font-mono"
                autoComplete="new-password"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Never stored. Used only for this run.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Model Configuration Card (Saturn style) */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm">Model Configuration</h3>
          <div className="space-y-3">
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
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            {/* Temperature - always visible */}
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

      {/* Reasoning Configuration (Saturn style) - shown for GPT-5/reasoning models */}
      {showReasoningControls && (
        <div className="card bg-white border border-gray-300 shadow-sm">
          <div className="card-body p-4">
            <h3 className="card-title text-sm">Reasoning Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold">Effort Level</span>
                </label>
                <select
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value as any)}
                  disabled={isRunning}
                  className="select select-bordered select-sm w-full"
                >
                  <option value="minimal">Minimal</option>
                  <option value="low">Low (Recommended)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Poetiq Configuration Card */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Poetiq Settings
          </h3>
          <div className="space-y-3">
            {/* Experts */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Number of Experts</span>
              </label>
              <select
                value={numExperts}
                onChange={(e) => setNumExperts(parseInt(e.target.value))}
                disabled={isRunning}
                className="select select-bordered select-sm w-full"
              >
                <option value={1}>1 Expert (Fast, ~5-15 min)</option>
                <option value={2}>2 Experts (Default, ~10-20 min)</option>
                <option value={4}>4 Experts (~15-30 min)</option>
                <option value={8}>8 Experts (Best accuracy, ~25-45+ min)</option>
              </select>
            </div>
            {/* Max Iterations */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Max Iterations</span>
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
            </div>
          </div>
        </div>
      </div>

      {/* Warning for high expert count */}
      {numExperts >= 8 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              8 experts will make many parallel API calls. This may take 25-45+ minutes and consume significant API quota.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * PURPOSE: Control panel for Poetiq solver - Saturn/Grover hybrid pattern.
 *          Model selection, provider choice, expert count, and execution controls.
 *          Includes cost/time warnings and validation before start.
 *
 * SRP/DRY check: Pass - Single responsibility for solver control interface
 * DaisyUI: Pass - Uses DaisyUI components with Saturn-style glass-morphism
 */

import React from 'react';
import { 
  Play, Square, Key, Users, AlertTriangle, Clock, 
  DollarSign, Zap, ChevronDown, ChevronUp, Settings 
} from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';

// Provider options with descriptions
const PROVIDERS = [
  { value: 'gemini', label: 'Gemini Direct', description: 'Google AI Studio key', icon: '🔷' },
  { value: 'openrouter', label: 'OpenRouter', description: 'OpenRouter key', icon: '🔀' },
] as const;

// OpenRouter models (recommended for avoiding rate limits)
const OPENROUTER_MODELS = [
  { id: 'openrouter/google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', speed: 'fast', cost: 'low' },
  { id: 'openrouter/google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', speed: 'medium', cost: 'medium' },
  { id: 'openrouter/anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', speed: 'medium', cost: 'medium' },
  { id: 'openrouter/openai/gpt-4o', name: 'GPT-4o', speed: 'medium', cost: 'high' },
];

// Direct API models
const DIRECT_MODELS = [
  { id: 'gemini/gemini-2.5-flash', name: 'Gemini 2.5 Flash', speed: 'fast', cost: 'low' },
  { id: 'gemini/gemini-2.5-pro', name: 'Gemini 2.5 Pro', speed: 'medium', cost: 'medium' },
];

// Expert presets (from Poetiq docs)
const EXPERT_PRESETS = [
  { value: 1, label: '1 Expert', config: 'Gemini-3-a', time: '~5-15 min', cost: 'Lowest' },
  { value: 2, label: '2 Experts', config: 'Gemini-3-b (Default)', time: '~10-20 min', cost: 'Low' },
  { value: 4, label: '4 Experts', config: 'Custom', time: '~15-30 min', cost: 'Medium' },
  { value: 8, label: '8 Experts', config: 'Gemini-3-c', time: '~25-45+ min', cost: 'High' },
];

interface PoetiqControlPanelProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  compact?: boolean;
  
  // Configuration values
  apiKey: string;
  setApiKey: (key: string) => void;
  provider: 'gemini' | 'openrouter';
  setProvider: (provider: 'gemini' | 'openrouter') => void;
  model: string;
  setModel: (model: string) => void;
  numExperts: number;
  setNumExperts: (num: number) => void;
  maxIterations: number;
  setMaxIterations: (iterations: number) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  
  // Actions
  onStart: () => void;
  onCancel: () => void;
}

export default function PoetiqControlPanel({
  state,
  isRunning,
  compact = false,
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
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  
  const canStart = apiKey.trim().length > 10 && !isRunning;
  const models = provider === 'openrouter' ? OPENROUTER_MODELS : DIRECT_MODELS;
  const selectedPreset = EXPERT_PRESETS.find(p => p.value === numExperts);
  
  // Estimated time and cost warnings
  const getTimeEstimate = () => {
    const baseTime = numExperts === 1 ? 10 : numExperts === 2 ? 15 : numExperts === 4 ? 22 : 35;
    return `${Math.round(baseTime * 0.7)}-${Math.round(baseTime * 1.5)} min`;
  };

  // Compact version for sidebar
  if (compact) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 space-y-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm font-bold text-white">
            {isRunning ? 'SOLVER RUNNING' : 'SOLVER READY'}
          </span>
        </div>

        {/* API Key input */}
        <div className="space-y-1">
          <label className="text-xs text-white/80 flex items-center gap-1">
            <Key className="w-3 h-3" />
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isRunning}
            placeholder={provider === 'gemini' ? 'AIza...' : 'sk-or-...'}
            className="input input-bordered input-sm w-full bg-white/90 text-gray-900 font-mono text-xs"
            autoComplete="new-password"
          />
        </div>

        {/* Provider selection */}
        <div className="space-y-1">
          <label className="text-xs text-white/80">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'gemini' | 'openrouter')}
            disabled={isRunning}
            className="select select-bordered select-sm w-full bg-white/90 text-gray-900"
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>
                {p.icon} {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Expert count */}
        <div className="space-y-1">
          <label className="text-xs text-white/80 flex items-center gap-1">
            <Users className="w-3 h-3" />
            Experts
          </label>
          <select
            value={numExperts}
            onChange={(e) => setNumExperts(parseInt(e.target.value))}
            disabled={isRunning}
            className="select select-bordered select-sm w-full bg-white/90 text-gray-900"
          >
            {EXPERT_PRESETS.map(p => (
              <option key={p.value} value={p.value}>
                {p.label} ({p.time})
              </option>
            ))}
          </select>
        </div>

        {/* Time/cost estimate */}
        <div className="text-xs text-white/70 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Est. {getTimeEstimate()}
        </div>

        {/* Warning for high expert count */}
        {numExperts >= 8 && (
          <div className="flex items-center gap-1 text-amber-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            High API usage
          </div>
        )}

        {/* Start/Cancel button */}
        <button
          onClick={isRunning ? onCancel : onStart}
          disabled={!canStart && !isRunning}
          className={`btn w-full ${isRunning ? 'btn-error' : 'btn-success'} btn-sm`}
        >
          {isRunning ? (
            <>
              <Square className="h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start Solver
            </>
          )}
        </button>
      </div>
    );
  }

  // Full panel version
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 space-y-4">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-lg font-bold text-white">
            {isRunning ? 'SOLVER RUNNING' : 'POETIQ SOLVER'}
          </span>
        </div>
        {state.phase && isRunning && (
          <span className="text-sm text-white/70 bg-white/10 px-2 py-1 rounded">
            {state.phase}
          </span>
        )}
      </div>

      {/* API Key Section */}
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-purple-400" />
          Bring Your Own API Key
        </h3>
        <p className="text-xs text-white/70">
          Your key is used only for this run and is <strong>never stored</strong>.
        </p>
        
        {/* Provider tabs */}
        <div className="flex gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.value}
              onClick={() => setProvider(p.value)}
              disabled={isRunning}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                provider === p.value
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="mr-1">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>

        {/* API Key input */}
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={isRunning}
          placeholder={provider === 'gemini' 
            ? 'AIza... (from Google AI Studio)' 
            : 'sk-or-... (from OpenRouter)'}
          className="input input-bordered w-full bg-white/90 text-gray-900 font-mono text-sm"
          autoComplete="new-password"
        />
        <p className="text-xs text-white/50">
          {provider === 'gemini' 
            ? 'Get your key from aistudio.google.com' 
            : 'Get your key from openrouter.ai/keys'}
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={isRunning}
          className="select select-bordered w-full bg-white/90 text-gray-900"
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} • {m.speed} • ${m.cost}
            </option>
          ))}
        </select>
      </div>

      {/* Expert Configuration */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Number of Experts
        </label>
        <div className="grid grid-cols-4 gap-2">
          {EXPERT_PRESETS.map(preset => (
            <button
              key={preset.value}
              onClick={() => setNumExperts(preset.value)}
              disabled={isRunning}
              className={`p-2 rounded-lg text-center transition-all border ${
                numExperts === preset.value
                  ? 'bg-white/20 border-cyan-400/50 text-white'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              <div className="text-lg font-bold">{preset.value}</div>
              <div className="text-[10px] opacity-70">{preset.time}</div>
            </button>
          ))}
        </div>
        {selectedPreset && (
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Config: {selectedPreset.config}</span>
            <span>Cost: {selectedPreset.cost}</span>
          </div>
        )}
      </div>

      {/* Warning for high expert count */}
      {numExperts >= 8 && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/20 border border-amber-400/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-200">
            8 experts will make many parallel API calls. This may take 25-45+ minutes 
            and consume significant API quota.
          </p>
        </div>
      )}

      {/* Advanced Settings (Collapsible) */}
      <div className="border-t border-white/20 pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          Advanced Settings
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {showAdvanced && (
          <div className="mt-3 space-y-3 p-3 bg-white/5 rounded-lg">
            {/* Max Iterations */}
            <div className="space-y-1">
              <label className="text-xs text-white/80">Max Iterations</label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value) || 10)}
                disabled={isRunning}
                className="input input-bordered input-sm w-full bg-white/90 text-gray-900"
              />
            </div>

            {/* Temperature */}
            <div className="space-y-1">
              <label className="text-xs text-white/80">Temperature: {temperature.toFixed(1)}</label>
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
              <div className="flex justify-between text-[10px] text-white/50">
                <span>Focused</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Time Estimate */}
      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-white/70">
          <Clock className="w-4 h-4" />
          Estimated Time
        </div>
        <span className="text-white font-medium">{getTimeEstimate()}</span>
      </div>

      {/* Start/Cancel Button */}
      <button
        onClick={isRunning ? onCancel : onStart}
        disabled={!canStart && !isRunning}
        className={`btn w-full ${isRunning ? 'btn-error' : 'btn-success'} btn-lg font-bold`}
      >
        {isRunning ? (
          <>
            <Square className="h-5 w-5" />
            Stop Solver
          </>
        ) : (
          <>
            <Play className="h-5 w-5" />
            Start Poetiq Solver
          </>
        )}
      </button>

      {!canStart && !isRunning && (
        <p className="text-center text-xs text-white/50">
          Enter your API key to start the solver
        </p>
      )}
    </div>
  );
}

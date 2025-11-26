/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * Updated: 2025-11-26 - Fixed to match actual Poetiq config (Gemini 3 Pro only, experts 1/2/8)
 * PURPOSE: Control panel for Poetiq solver.
 *          Poetiq ONLY uses Gemini 3 Pro Preview via OpenRouter. Expert configs: 1, 2, 8.
 *          Based on poetiq-solver/arc_agi/config.py
 *
 * SRP/DRY check: Pass - Single responsibility for solver control interface
 * DaisyUI: Pass - Uses DaisyUI components
 */

import React from 'react';
import { Rocket, Square, Key, Users, AlertTriangle, Info } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';

// Poetiq ONLY supports these expert configurations (from config.py):
// - Gemini-3-a: 1 expert (fastest, lowest cost)
// - Gemini-3-b: 2 experts (default, good balance)
// - Gemini-3-c: 8 experts (best accuracy, slowest)
const EXPERT_OPTIONS = [
  { value: 1, label: 'Gemini-3-a (1 Expert)', description: 'Fastest, ~5-15 min' },
  { value: 2, label: 'Gemini-3-b (2 Experts)', description: 'Default, ~10-20 min' },
  { value: 8, label: 'Gemini-3-c (8 Experts)', description: 'Best accuracy, ~25-45+ min' },
] as const;

// Poetiq model - ONLY Gemini 3 Pro Preview via OpenRouter
// This is hardcoded in poetiq-solver/arc_agi/config.py
const POETIQ_MODEL = {
  id: 'google/gemini-3-pro-preview',
  name: 'Gemini 3 Pro Preview',
  provider: 'OpenRouter',
};

interface PoetiqControlPanelProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  
  // API Key (optional - falls back to server env vars)
  apiKey: string;
  setApiKey: (key: string) => void;
  
  // Expert configuration (1, 2, or 8)
  numExperts: number;
  setNumExperts: (num: number) => void;
  
  // Max iterations per expert
  maxIterations: number;
  setMaxIterations: (iterations: number) => void;
  
  // Actions
  onStart: () => void;
  onCancel: () => void;
}

export default function PoetiqControlPanel({
  state,
  isRunning,
  apiKey,
  setApiKey,
  numExperts,
  setNumExperts,
  maxIterations,
  setMaxIterations,
  onStart,
  onCancel,
}: PoetiqControlPanelProps) {
  // Can always start (API key is optional - falls back to server env vars)
  const canStart = !isRunning;

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

      {/* Model Info Card - Fixed to Gemini 3 Pro Preview */}
      <div className="card bg-teal-50 border border-teal-300 shadow-sm">
        <div className="card-body p-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-teal-800">Model: {POETIQ_MODEL.name}</span>
          </div>
          <p className="text-[10px] text-teal-700 mt-1">
            via {POETIQ_MODEL.provider} ({POETIQ_MODEL.id})
          </p>
        </div>
      </div>

      {/* API Key Card (Optional) */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Key className="w-4 h-4" />
            OpenRouter API Key (Optional)
          </h3>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-[10px] text-blue-700">
                <strong>Optional:</strong> Leave blank to use server API key.
                Provide your own OpenRouter key for unlimited access.
              </p>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isRunning}
              placeholder="sk-or-... (optional)"
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

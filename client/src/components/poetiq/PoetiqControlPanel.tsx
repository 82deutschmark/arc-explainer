/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * Updated: 2025-11-28 - BYO Key requirement (no server fallback), dynamic model loading
 * PURPOSE: Control panel for Poetiq solver page (/puzzle/poetiq/:taskId).
 *          Fetches Poetiq-specific models from /api/poetiq/models and groups by provider.
 *          Expert configs: 1, 2, 8 only (from config.py).
 *
 * SRP/DRY check: Pass - Single responsibility for solver control interface
 * DaisyUI: Pass - Uses DaisyUI components
 */

import React, { useMemo, useEffect } from 'react';
import { Key, Users, AlertTriangle, Loader2, Cpu, Cloud, Server } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';
import { usePoetiqModels } from '@/hooks/usePoetiqModels';

// Expert configs - 1, 2, 8 ONLY (from config.py)
const EXPERT_OPTIONS = [
  { value: 1, label: '1 Expert (Config A)', description: 'Fastest, ~5-15 min' },
  { value: 2, label: '2 Experts (Config B)', description: 'Default, ~10-20 min' },
  { value: 8, label: '8 Experts (Config C)', description: 'Best accuracy, ~25-45+ min' },
] as const;

// API Key placeholders by provider
const KEY_PLACEHOLDERS: Record<string, string> = {
  'OpenAI': 'sk-...',
  'Google': 'AIza...',
  'Anthropic': 'sk-ant-...',
  'xAI': 'xai-...',
  'OpenRouter': 'sk-or-...',
};

interface PoetiqControlPanelProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  
  apiKey: string;
  setApiKey: (key: string) => void;
  
  // Provider is now derived from model
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
  
  reasoningEffort: 'low' | 'medium' | 'high';
  setReasoningEffort: (effort: 'low' | 'medium' | 'high') => void;

  onStart: () => void;
  onCancel: () => void;
}

export default function PoetiqControlPanel({
  state,
  isRunning,
  apiKey,
  setApiKey,
  provider, // Still needed for parent state, but auto-managed
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
  // Fetch all models from API
  const { data: poetiqModels, isLoading: modelsLoading } = usePoetiqModels();
  
  // Bring Your Own Key is REQUIRED - no fallback to server keys
  const hasApiKey = apiKey.trim().length > 0;
  const canStart = !isRunning && !modelsLoading && hasApiKey;

  // Group models by family for the dropdown
  const groupedModels = useMemo(() => {
    if (!poetiqModels) return {};
    
    const groups: Record<string, typeof poetiqModels> = {
      'Recommended (SOTA)': [],
      'Gemini Family': [],
      'GPT Family': [],
      'Grok Family': [],
      'Claude Family': [],
      'Open Source & Other': []
    };

    poetiqModels.forEach(m => {
      if (m.recommended) {
        groups['Recommended (SOTA)'].push(m);
      }
      
      // Also add to specific families
      const name = m.name.toLowerCase();
      if (name.includes('gemini')) groups['Gemini Family'].push(m);
      else if (name.includes('gpt')) groups['GPT Family'].push(m);
      else if (name.includes('grok')) groups['Grok Family'].push(m);
      else if (name.includes('claude')) groups['Claude Family'].push(m);
      else groups['Open Source & Other'].push(m);
    });

    // Remove empty groups and recommended duplicates from families if desired (optional)
    // For now keeping duplicates in families is fine for discoverability
    
    return groups;
  }, [poetiqModels]);

  // Find current model object to determine provider/placeholder
  const selectedModelObj = useMemo(() => 
    poetiqModels?.find(m => m.id === model), 
  [poetiqModels, model]);

  // Auto-update provider when model changes
  useEffect(() => {
    if (selectedModelObj) {
      // Map API provider to internal provider state
      let newProvider: 'gemini' | 'openrouter' | 'openai' = 'openrouter';
      if (selectedModelObj.provider === 'Google') newProvider = 'gemini';
      if (selectedModelObj.provider === 'OpenAI') newProvider = 'openai';
      // Note: xAI and others go through OpenRouter or specialized handlers in backend, 
      // but for this simple state we default to openrouter if not explicit direct Google/OpenAI
      
      if (provider !== newProvider) {
        setProvider(newProvider);
      }
    }
  }, [selectedModelObj, provider, setProvider]);

  // Placeholder based on selected model's provider
  const keyPlaceholder = selectedModelObj 
    ? KEY_PLACEHOLDERS[selectedModelObj.provider] || 'API Key...'
    : 'API Key...';

  return (
    <div className="space-y-3">
      {/* LLM Selection - Start button is now in header */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2 text-indigo-900">
            <Cpu className="w-4 h-4" />
            Select Large Language Model
          </h3>
          <div className="space-y-3">
            
            {/* Model Dropdown - Flattened & Grouped */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold text-gray-600">
                  Choose the AI model that will generate code
                </span>
              </label>
              {modelsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded bg-gray-50">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="text-xs text-gray-500">Loading compatible models...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={isRunning}
                    className="select select-bordered select-sm w-full font-medium text-gray-800"
                  >
                    {Object.entries(groupedModels).map(([group, models]) => (
                      models.length > 0 && (
                        <optgroup key={group} label={group}>
                          {models.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} {(m as any).requiresBYO ? '(BYO Key)' : ''}
                            </option>
                          ))}
                        </optgroup>
                      )
                    ))}
                  </select>
                  {/* Routing indicator - clear visual distinction */}
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium ${(selectedModelObj as any)?.routing === 'direct' 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                    {(selectedModelObj as any)?.routing === 'direct' ? (
                      <>
                        <Server className="h-3.5 w-3.5" />
                        <span>Direct API to <strong>{selectedModelObj?.provider}</strong></span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-3.5 w-3.5" />
                        <span>Via <strong>OpenRouter</strong></span>
                      </>
                    )}
                  </div>
                </div>
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

            {/* Reasoning Effort */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Reasoning Effort</span>
              </label>
              <select
                value={reasoningEffort}
                onChange={(e) => setReasoningEffort(e.target.value as 'low' | 'medium' | 'high')}
                disabled={isRunning}
                className="select select-bordered select-sm w-full"
              >
                <option value="low">Low (Faster)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Deep Thinking)</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">
                Controls model thinking budget (where supported).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bring Your Own Key Card - REQUIRED */}
      <div className={`card bg-white border shadow-sm ${hasApiKey ? 'border-green-300' : 'border-amber-400'}`}>
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Key className={`w-4 h-4 ${hasApiKey ? 'text-green-600' : 'text-amber-600'}`} />
            Bring Your Own Key
            <span className="badge badge-sm badge-warning">Required</span>
          </h3>
          <div className="space-y-2">
            <div className={`rounded p-2 ${hasApiKey ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-[10px] leading-tight ${hasApiKey ? 'text-green-700' : 'text-amber-700'}`}>
                {hasApiKey 
                  ? <>✓ Your <strong>{selectedModelObj?.provider}</strong> key is set. It's used for this session only and never stored.</>
                  : <>Provide your <strong>{selectedModelObj?.provider}</strong> API key to run Poetiq. Your key is used for this session only and never stored.</>}
              </p>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isRunning}
              placeholder={keyPlaceholder}
              className={`input input-bordered input-sm w-full font-mono text-xs ${!hasApiKey && 'input-warning'}`}
            />
            {!hasApiKey && (
              <p className="text-[10px] text-amber-600">
                Get your API key from: 
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="link link-primary ml-1">Google AI Studio</a> | 
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="link link-primary ml-1">OpenAI</a> | 
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="link link-primary ml-1">OpenRouter</a>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Expert Configuration Card */}
      <div className="card bg-white border border-gray-300 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Solver Settings
          </h3>
          <div className="space-y-3">
            {/* Experts */}
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Parallel Experts</span>
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
                <span className="label-text text-xs font-semibold">Self-Audit Limit (Iterations)</span>
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
                Max refinement cycles before giving up.
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
              <strong>Config C (8 experts)</strong> makes 8x parallel API calls. 
              This provides best accuracy but may take 25-45+ minutes and consume significant API quota.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CompactControls.tsx
 *
 * Author: Cascade (DeepSeek R1)
 * Date: 2025-10-12
 * PURPOSE: Compact, always-visible control panel for prompt and advanced settings
 * Replaces separate CollapsibleCard sections with data-dense horizontal layout
 * Preserves ALL functionality from PromptConfiguration and AdvancedControls
 * Uses disclosure triangles for optional advanced parameters (not CollapsibleCard)
 * 
 * SRP/DRY check: Pass - Single responsibility (compact control display)
 * DaisyUI: Pass - Uses DaisyUI form controls, collapse component
 */

import React, { useState, useEffect } from 'react';
import { Eye, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
}

interface CompactControlsProps {
  // Prompt Configuration
  promptId: string;
  onPromptChange: (id: string) => void;
  customPrompt: string;
  onCustomPromptChange: (text: string) => void;
  sendAsEmojis: boolean;
  onSendAsEmojisChange: (value: boolean) => void;
  omitAnswer: boolean;
  onOmitAnswerChange: (value: boolean) => void;
  onPreviewClick: () => void;
  disabled: boolean;
  
  // Advanced Controls
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

/**
 * Compact control panel with disclosure triangles for advanced parameters
 */
export function CompactControls({
  promptId,
  onPromptChange,
  customPrompt,
  onCustomPromptChange,
  sendAsEmojis,
  onSendAsEmojisChange,
  omitAnswer,
  onOmitAnswerChange,
  onPreviewClick,
  disabled,
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
}: CompactControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch prompts
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await apiRequest('GET', '/api/prompts');
        if (response.ok) {
          const data = await response.json();
          setPrompts(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching prompts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrompts();
  }, []);

  const currentPrompt = prompts.find(p => p.id === promptId);

  return (
    <div className="space-y-2">
      {/* Compact Prompt Controls - Single Row */}
      <div className="border border-base-300 rounded-lg bg-base-100 p-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Prompt Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium opacity-70">Prompt:</label>
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <select
                className="select select-bordered select-xs"
                value={promptId}
                onChange={(e) => onPromptChange(e.target.value)}
                disabled={disabled}
              >
                {prompts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Emoji Toggle */}
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              className="toggle toggle-xs toggle-success"
              checked={sendAsEmojis}
              onChange={(e) => onSendAsEmojisChange(e.target.checked)}
              disabled={disabled}
              id="emoji-toggle"
            />
            <label htmlFor="emoji-toggle" className="text-xs opacity-70 cursor-pointer">
              🌟 Emojis
            </label>
          </div>

          {/* Omit Answer Toggle */}
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              className="toggle toggle-xs toggle-warning"
              checked={omitAnswer}
              onChange={(e) => onOmitAnswerChange(e.target.checked)}
              disabled={disabled}
              id="omit-toggle"
            />
            <label htmlFor="omit-toggle" className="text-xs opacity-70 cursor-pointer">
              🎭 Hide solution
            </label>
          </div>

          {/* Preview Button */}
          <button
            className="btn btn-outline btn-xs ml-auto"
            onClick={onPreviewClick}
            disabled={disabled}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>

          {/* Details Toggle */}
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setShowPromptDetails(!showPromptDetails)}
          >
            {showPromptDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>

        {/* Custom Prompt Textarea (if custom selected) */}
        {promptId === 'custom' && (
          <textarea
            className="textarea textarea-bordered w-full mt-2 text-xs"
            rows={3}
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="Enter custom prompt..."
            disabled={disabled}
          />
        )}

        {/* Prompt Details (collapsible) */}
        {showPromptDetails && currentPrompt && (
          <div className="mt-2 p-2 bg-base-200 rounded text-xs">
            <p className="opacity-70">{currentPrompt.description}</p>
          </div>
        )}
      </div>

      {/* Advanced Parameters - Collapsible but inline */}
      <div className="border border-base-300 rounded-lg bg-base-100">
        <button
          className="w-full p-3 flex items-center justify-between hover:bg-base-200 transition-colors rounded-t-lg"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex items-center gap-2">
            {showAdvanced ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-medium text-sm">Advanced Parameters</span>
            <span className="text-xs opacity-60">
              (Model-specific settings)
            </span>
          </div>
        </button>

        {showAdvanced && (
          <div className="p-3 border-t border-base-300 space-y-2">
            {/* Temperature Control - Compact */}
            <div className="flex items-center gap-3 p-2 bg-base-200 rounded">
              <label className="text-xs font-medium w-24 flex-shrink-0">
                Temperature:
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={temperature}
                onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                className="range range-xs range-accent flex-1"
              />
              <span className="text-xs font-mono w-12 text-right">{temperature.toFixed(2)}</span>
              <span className="text-xs opacity-60 flex-shrink-0">
                Gemini, GPT-4.1, Grok
              </span>
            </div>

            {/* Top P Control - Compact */}
            <div className="flex items-center gap-3 p-2 bg-base-200 rounded">
              <label className="text-xs font-medium w-24 flex-shrink-0">
                Top P:
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={topP}
                onChange={(e) => onTopPChange(parseFloat(e.target.value))}
                className="range range-xs range-accent flex-1"
              />
              <span className="text-xs font-mono w-12 text-right">{topP.toFixed(2)}</span>
              <span className="text-xs opacity-60 flex-shrink-0">
                Gemini only
              </span>
            </div>

            {/* Candidate Count - Compact */}
            <div className="flex items-center gap-3 p-2 bg-base-200 rounded">
              <label className="text-xs font-medium w-24 flex-shrink-0">
                Candidates:
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={candidateCount}
                onChange={(e) => onCandidateCountChange(parseInt(e.target.value))}
                className="range range-xs range-accent flex-1"
              />
              <span className="text-xs font-mono w-12 text-right">{candidateCount}</span>
              <span className="text-xs opacity-60 flex-shrink-0">
                Gemini only
              </span>
            </div>

            {/* Thinking Budget - Compact dropdown */}
            <div className="flex items-center gap-3 p-2 bg-purple-50 border border-purple-200 rounded">
              <label className="text-xs font-medium w-24 flex-shrink-0">
                Thinking:
              </label>
              <select
                className="select select-bordered select-xs flex-1"
                value={thinkingBudget.toString()}
                onChange={(e) => onThinkingBudgetChange(parseInt(e.target.value))}
              >
                <option value="-1">Dynamic</option>
                <option value="0">Disabled</option>
                <option value="512">512 tokens</option>
                <option value="1024">1024 tokens</option>
                <option value="2048">2048 tokens</option>
                <option value="4096">4096 tokens</option>
                <option value="8192">8192 tokens</option>
                <option value="16384">16384 tokens</option>
                <option value="24576">24576 tokens (Max Flash)</option>
                <option value="32768">32768 tokens (Max Pro)</option>
              </select>
              <span className="text-xs opacity-60 flex-shrink-0">
                Gemini 2.5+ only
              </span>
            </div>

            {/* GPT-5 Reasoning Parameters - Compact grid */}
            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <div className="text-xs font-medium text-blue-800 mb-2">
                GPT-5 Reasoning Parameters
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Effort</label>
                  <select
                    className="select select-bordered select-xs w-full"
                    value={reasoningEffort}
                    onChange={(e) => onReasoningEffortChange(e.target.value as any)}
                  >
                    <option value="minimal">Minimal</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Verbosity</label>
                  <select
                    className="select select-bordered select-xs w-full"
                    value={reasoningVerbosity}
                    onChange={(e) => onReasoningVerbosityChange(e.target.value as any)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Summary</label>
                  <select
                    className="select select-bordered select-xs w-full"
                    value={reasoningSummaryType}
                    onChange={(e) => onReasoningSummaryTypeChange(e.target.value as any)}
                  >
                    <option value="auto">Auto</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

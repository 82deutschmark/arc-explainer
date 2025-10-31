/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-31
 * PURPOSE: Compact PromptPicker that renders prompt template selection as a dropdown
 *          with inline toggles for emojis and hide solutions options. Simplified from
 *          two-column layout to single-column for better space efficiency.
 * SRP/DRY check: Pass — only responsible for listing prompt templates and
 *                related prompt-level options. Reuses shared API client.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  emojiMapIncluded: boolean;
}

interface PromptPickerProps {
  selectedPromptId: string;
  onPromptChange: (promptId: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (customPrompt: string) => void;
  disabled?: boolean;
  // Advanced options props
  sendAsEmojis?: boolean;
  onSendAsEmojisChange?: (sendAsEmojis: boolean) => void;
  omitAnswer?: boolean;
  onOmitAnswerChange?: (omitAnswer: boolean) => void;
  // systemPromptMode removed - now using modular architecture
}

export function PromptPicker({
  selectedPromptId,
  onPromptChange,
  customPrompt,
  onCustomPromptChange,
  disabled = false,
  sendAsEmojis,
  onSendAsEmojisChange,
  omitAnswer,
  onOmitAnswerChange
}: PromptPickerProps) {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activePrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId),
    [prompts, selectedPromptId]
  );
  const promptDescription = activePrompt?.description ?? '';

  const handlePromptChange = (promptId: string) => {
    onPromptChange(promptId);
    if (promptId !== 'custom' && onCustomPromptChange) {
      onCustomPromptChange('');
    }
  };

  // Fetch available prompts on component mount
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        setLoading(true);
        const response = await apiRequest('GET', '/api/prompts');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch prompts: ${response.statusText}`);
        }
        
        const data = await response.json();
        setPrompts(data.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching prompts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load prompts');
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/70 px-3 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading prompt templates…
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error text-sm" role="alert">
        <span className="font-medium">Unable to load prompts.</span>
        <span className="text-xs opacity-80">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Compact prompt selector dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-base-content/80 min-w-fit">Template:</label>
        <select
          className="select select-bordered select-sm flex-1"
          value={selectedPromptId}
          onChange={(e) => handlePromptChange(e.target.value)}
          disabled={disabled}
        >
          {prompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.name}
            </option>
          ))}
        </select>
      </div>

      {/* Active prompt description - compact */}
      {activePrompt && (
        <div className="text-xs text-base-content/70 px-1">
          {activePrompt.description}
        </div>
      )}

      {/* Custom prompt textarea (only shown when custom is selected) */}
      {selectedPromptId === 'custom' && onCustomPromptChange && (
        <div className="space-y-1">
          <textarea
            className="textarea textarea-bordered textarea-sm w-full text-xs"
            value={customPrompt || ''}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="Enter custom prompt instructions…"
            disabled={disabled}
            rows={3}
          />
          <div className="flex items-center justify-between text-[0.7rem] text-base-content/60 px-1">
            <span>Custom text is appended after core puzzle context.</span>
            <span className="font-mono">{(customPrompt ?? '').length} chars</span>
          </div>
        </div>
      )}

      {/* Compact toggle controls in a single row */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="toggle toggle-xs toggle-success"
            checked={sendAsEmojis}
            onChange={(e) => onSendAsEmojisChange?.(e.target.checked)}
            disabled={disabled}
            id="emoji-toggle-picker"
          />
          <label htmlFor="emoji-toggle-picker" className="text-xs text-base-content/70 cursor-pointer">
            🌟 Send as emojis
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="toggle toggle-xs toggle-warning"
            checked={omitAnswer}
            onChange={(e) => onOmitAnswerChange?.(e.target.checked)}
            disabled={disabled}
            id="omit-toggle-picker"
          />
          <label htmlFor="omit-toggle-picker" className="text-xs text-base-content/70 cursor-pointer">
            🎭 Hide solutions
          </label>
        </div>
      </div>

      {selectedPromptId === 'custom' && !customPrompt && (
        <div className="alert alert-warning alert-sm py-2 text-xs">
          Custom prompt selected — add instructions above before running an analysis.
        </div>
      )}
    </div>
  );
}

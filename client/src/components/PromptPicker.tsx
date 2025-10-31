/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: PromptPicker fetches and renders available prompt templates with
 *          inline advanced toggles so PuzzleExaminer can offer a compact,
 *          information-dense configuration surface.
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
    <div className="rounded-lg border border-base-300 bg-base-100">
      <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-base-content/60">
            <span>Prompt templates</span>
            {activePrompt ? (
              <span className="font-semibold text-base-content/80">{activePrompt.name}</span>
            ) : (
              <span className="font-semibold text-base-content/80">Select a template</span>
            )}
          </div>

          <div className="rounded-md border border-base-200 divide-y divide-base-200">
            {prompts.map((prompt) => {
              const isActive = selectedPromptId === prompt.id;
              return (
                <label
                  key={prompt.id}
                  className={`flex cursor-pointer gap-3 p-2 transition-colors hover:bg-base-200/60 ${
                    isActive ? 'bg-base-200/70' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="prompt-picker"
                    className="radio radio-xs mt-1"
                    value={prompt.id}
                    checked={isActive}
                    onChange={() => handlePromptChange(prompt.id)}
                    disabled={disabled}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">{prompt.name}</span>
                      {prompt.emojiMapIncluded && (
                        <span className="badge badge-outline badge-xs whitespace-nowrap">Emoji ready</span>
                      )}
                    </div>
                    <p className="text-xs leading-snug text-base-content/70">
                      {prompt.description}
                    </p>
                    {prompt.id === 'custom' && selectedPromptId === 'custom' && onCustomPromptChange && (
                      <div className="mt-2">
                        <textarea
                          className="textarea textarea-bordered textarea-sm w-full text-xs"
                          value={customPrompt || ''}
                          onChange={(e) => onCustomPromptChange(e.target.value)}
                          placeholder="Enter custom prompt instructions…"
                          disabled={disabled}
                          rows={4}
                        />
                        <div className="mt-1 flex items-center justify-between text-[0.7rem] text-base-content/60">
                          <span>Custom text is appended after core puzzle context.</span>
                          <span className="font-mono">{(customPrompt ?? '').length} chars</span>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-dashed border-base-200 p-2">
            <div className="text-xs uppercase tracking-wide text-base-content/60">Active instructions</div>
            <div className="mt-1 text-sm font-semibold text-base-content">
              {activePrompt ? activePrompt.name : 'Choose a template'}
            </div>
            {promptDescription && (
              <p className="mt-1 text-xs leading-snug text-base-content/70">{promptDescription}</p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-base-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">Send as emojis</span>
                <button
                  type="button"
                  className={`btn btn-xs ${sendAsEmojis ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => onSendAsEmojisChange?.(!sendAsEmojis)}
                  disabled={disabled}
                  aria-pressed={sendAsEmojis}
                >
                  {sendAsEmojis ? 'Enabled' : 'Enable'}
                </button>
              </div>
              <p className="mt-1 text-[0.7rem] leading-snug text-base-content/60">
                Converts grids to the active emoji palette (configure palette in the header) before sending to the model.
              </p>
            </div>

            <div className="rounded-md border border-base-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">Hide solutions</span>
                <button
                  type="button"
                  className={`btn btn-xs ${omitAnswer ? 'btn-warning' : 'btn-outline'}`}
                  onClick={() => onOmitAnswerChange?.(!omitAnswer)}
                  disabled={disabled}
                  aria-pressed={omitAnswer}
                >
                  {omitAnswer ? 'On' : 'Off'}
                </button>
              </div>
              <p className="mt-1 text-[0.7rem] leading-snug text-base-content/60">
                When enabled, the assistant must infer answers without being shown the provided solutions.
              </p>
            </div>
          </div>

          {selectedPromptId === 'custom' && !customPrompt && (
            <p className="text-[0.7rem] text-warning">
              Custom prompt selected — add instructions above before running an analysis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

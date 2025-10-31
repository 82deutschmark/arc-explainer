/**
 * Author: gpt-5-codex
 * Date: 2025-10-31
 * PURPOSE: Renders prompt selection, emoji flags, and preview affordances in a compact DaisyUI-friendly layout.
 * SRP/DRY check: Pass - verified only prompt-related controls live here while orchestration stays on the page container.
 */

import React from 'react';
import { Eye, Info } from 'lucide-react';
import { PromptPicker } from '../PromptPicker';

interface PromptConfigurationProps {
  promptId: string;
  onPromptChange: (id: string) => void;
  customPrompt: string;
  onCustomPromptChange: (text: string) => void;
  disabled: boolean;
  sendAsEmojis: boolean;
  onSendAsEmojisChange: (value: boolean) => void;
  omitAnswer: boolean;
  onOmitAnswerChange: (value: boolean) => void;
  onPreviewClick: () => void;
}

/**
 * Compact prompt configuration card content.
 */
export function PromptConfiguration({
  promptId,
  onPromptChange,
  customPrompt,
  onCustomPromptChange,
  disabled,
  sendAsEmojis,
  onSendAsEmojisChange,
  omitAnswer,
  onOmitAnswerChange,
  onPreviewClick
}: PromptConfigurationProps) {
  return (
    <div className="space-y-3">
      <PromptPicker
        selectedPromptId={promptId}
        onPromptChange={onPromptChange}
        customPrompt={customPrompt}
        onCustomPromptChange={onCustomPromptChange}
        disabled={disabled}
        sendAsEmojis={sendAsEmojis}
        onSendAsEmojisChange={onSendAsEmojisChange}
        omitAnswer={omitAnswer}
        onOmitAnswerChange={onOmitAnswerChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200/60 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] leading-tight text-base-content/70">
          <div
            className="tooltip tooltip-top"
            data-tip="Check the compiled instructions before launching an analysis."
          >
            <Info className="h-3 w-3 text-base-content/50" aria-hidden="true" />
          </div>
          <span>Preview the exact prompt the solver will receive.</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-xs gap-1"
          onClick={onPreviewClick}
          disabled={disabled}
        >
          <Eye className="h-3 w-3" aria-hidden="true" />
          Preview
        </button>
      </div>
    </div>
  );
}

/**
 * PromptConfiguration.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Handles prompt selection and preview controls.
 * Extracted from PuzzleExaminer lines 614-646 to follow SRP.
 * 
 * SRP/DRY check: Pass - Single responsibility (prompt configuration)
 * DaisyUI: Pass - Uses DaisyUI btn component
 */

import React from 'react';
import { Eye } from 'lucide-react';
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
 * Renders prompt configuration controls with preview button
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
    <div>
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

      {/* Prompt Preview Button */}
      <div className="mb-3 flex justify-center">
        <button
          className="btn btn-outline btn-sm flex items-center gap-2"
          onClick={onPreviewClick}
          disabled={disabled}
        >
          <Eye className="h-4 w-4" />
          Preview Prompt
        </button>
      </div>
    </div>
  );
}

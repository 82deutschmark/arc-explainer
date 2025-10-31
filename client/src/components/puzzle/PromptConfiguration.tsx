/**
 * PromptConfiguration.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-31
 * PURPOSE: Handles prompt selection and preview controls.
 * Extracted from PuzzleExaminer lines 614-646 to follow SRP.
 * Updated to use shadcn/ui components for consistent design system.
 *
 * SRP/DRY check: Pass - Single responsibility (prompt configuration)
 */

import React from 'react';
import { Eye } from 'lucide-react';
import { PromptPicker } from '../PromptPicker';
import { Button } from '@/components/ui/button';

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
    <div className="space-y-2">
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

      <div className="flex items-center justify-end gap-3 px-1 text-xs text-muted-foreground">
        <span>Preview the final prompt before running an analysis.</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onPreviewClick}
          disabled={disabled}
          className="h-8"
        >
          <Eye className="h-3 w-3" />
          Preview prompt
        </Button>
      </div>
    </div>
  );
}

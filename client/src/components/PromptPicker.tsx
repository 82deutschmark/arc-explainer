/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-31
 * PURPOSE: Compact PromptPicker that renders prompt template selection as a dropdown
 *          with inline toggles for emojis and hide solutions options. Uses shadcn/ui
 *          components for consistent design system integration.
 * SRP/DRY check: Pass — only responsible for listing prompt templates and
 *                related prompt-level options. Reuses shared API client.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  sendAsEmojis = false,
  onSendAsEmojisChange,
  omitAnswer = false,
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
      <Alert variant="destructive" className="text-sm">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <span className="font-medium">Unable to load prompts.</span>
          <span className="text-xs opacity-80 ml-2">{error}</span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact prompt selector dropdown */}
      <div className="flex items-center gap-3">
        <Label htmlFor="prompt-select" className="text-sm min-w-fit">Template:</Label>
        <Select
          value={selectedPromptId}
          onValueChange={handlePromptChange}
          disabled={disabled}
        >
          <SelectTrigger id="prompt-select" className="h-9">
            <SelectValue placeholder="Select a prompt template" />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((prompt) => (
              <SelectItem key={prompt.id} value={prompt.id}>
                {prompt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active prompt description - compact */}
      {activePrompt && (
        <div className="text-xs text-muted-foreground px-1">
          {activePrompt.description}
        </div>
      )}

      {/* Custom prompt textarea (only shown when custom is selected) */}
      {selectedPromptId === 'custom' && onCustomPromptChange && (
        <div className="space-y-2">
          <Textarea
            value={customPrompt || ''}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="Enter custom prompt instructions…"
            disabled={disabled}
            rows={3}
            className="text-xs min-h-[60px]"
          />
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground px-1">
            <span>Custom text is appended after core puzzle context.</span>
            <span className="font-mono">{(customPrompt ?? '').length} chars</span>
          </div>
        </div>
      )}

      {/* Compact toggle controls in a single row */}
      <div className="flex items-center gap-6 px-1">
        <div className="flex items-center gap-2">
          <Switch
            id="emoji-toggle-picker"
            checked={sendAsEmojis}
            onCheckedChange={onSendAsEmojisChange}
            disabled={disabled}
          />
          <Label htmlFor="emoji-toggle-picker" className="text-xs font-normal cursor-pointer">
            🌟 Send as emojis
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="omit-toggle-picker"
            checked={omitAnswer}
            onCheckedChange={onOmitAnswerChange}
            disabled={disabled}
          />
          <Label htmlFor="omit-toggle-picker" className="text-xs font-normal cursor-pointer">
            🎭 Hide solutions
          </Label>
        </div>
      </div>

      {selectedPromptId === 'custom' && !customPrompt && (
        <Alert className="py-2 border-yellow-200 bg-yellow-50 text-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-xs">
            Custom prompt selected — add instructions above before running an analysis.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

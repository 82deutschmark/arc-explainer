/**
 * PromptPreviewModal.tsx
 * Modal component for previewing prompts that will be sent to AI models.
 * Uses the server-side /api/prompt-preview endpoint to get actual system and user prompts.
 * 
 * @author Claude Code with Sonnet 4
 * @date August 31, 2025
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Loader2 } from 'lucide-react';
import { ARCTask } from '@shared/types';

interface PromptOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;
  sendAsEmojis?: boolean;
  topP?: number;
  candidateCount?: number;
}

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ARCTask;
  taskId: string;
  promptId: string;
  customPrompt?: string;
  options?: PromptOptions;
}

interface PromptPreviewData {
  systemPrompt: string;
  userPrompt: string;
  selectedTemplate: any;
  isAlienMode: boolean;
  isSolver: boolean;
}

export function PromptPreviewModal({
  isOpen,
  onClose,
  task,
  taskId,
  promptId,
  customPrompt,
  options = {}
}: PromptPreviewModalProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState<PromptPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch prompt preview from server when modal opens or parameters change
  useEffect(() => {
    if (!isOpen || !taskId || !promptId) return;

    const fetchPromptPreview = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/prompt-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: 'openai', // Default provider for preview
            taskId,
            promptId,
            customPrompt,
            emojiSetKey: options.emojiSetKey,
            omitAnswer: options.omitAnswer ?? true,
            topP: options.topP,
            candidateCount: options.candidateCount
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch prompt preview: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          setPromptPreview(result.data);
        } else {
          throw new Error(result.message || 'Failed to generate prompt preview');
        }
      } catch (err) {
        console.error('Error fetching prompt preview:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPromptPreview();
  }, [isOpen, taskId, promptId, customPrompt, options.emojiSetKey, options.omitAnswer, options.topP, options.candidateCount]);

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPromptPreview(null);
      setError(null);
      setCopiedSection(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Prompt Preview - {promptId}
            {promptPreview?.selectedTemplate?.emoji && (
              <span className="ml-2">{promptPreview.selectedTemplate.emoji}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Generating prompt preview...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <h4 className="text-sm font-semibold text-red-800 mb-2">Error loading prompt preview</h4>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {promptPreview && !isLoading && (
            <>
              {/* Template Info */}
              {promptPreview.selectedTemplate && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-blue-800">
                        {promptPreview.selectedTemplate.name}
                      </h4>
                      <p className="text-xs text-blue-600 mt-1">
                        {promptPreview.selectedTemplate.description}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {promptPreview.isAlienMode && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          Alien Mode
                        </span>
                      )}
                      {promptPreview.isSolver && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                          Solver Mode
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* System Prompt Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">System Prompt</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(promptPreview.systemPrompt, 'system')}
                    className="h-8 px-2"
                    disabled={!promptPreview.systemPrompt}
                  >
                    {copiedSection === 'system' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap min-h-[100px]">
                  {promptPreview.systemPrompt || '(No system prompt)'}
                </pre>
                <div className="text-xs text-gray-500">
                  {promptPreview.systemPrompt?.length || 0} characters
                </div>
              </div>

              {/* User Prompt Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">User Prompt</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(promptPreview.userPrompt, 'user')}
                    className="h-8 px-2"
                    disabled={!promptPreview.userPrompt}
                  >
                    {copiedSection === 'user' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap min-h-[200px]">
                  {promptPreview.userPrompt || '(No user prompt)'}
                </pre>
                <div className="text-xs text-gray-500">
                  {promptPreview.userPrompt?.length || 0} characters
                </div>
              </div>

              {/* Summary Stats */}
              <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Total Characters:</strong>{' '}
                    {(promptPreview.systemPrompt?.length || 0) + (promptPreview.userPrompt?.length || 0)}
                  </div>
                  <div>
                    <strong>Estimated Tokens:</strong>{' '}
                    {Math.ceil(((promptPreview.systemPrompt?.length || 0) + (promptPreview.userPrompt?.length || 0)) / 4)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


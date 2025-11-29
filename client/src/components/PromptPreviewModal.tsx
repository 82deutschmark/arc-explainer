/**
 * PromptPreviewModal.tsx
 * Modal component for previewing prompts that will be sent to AI models.
 * Uses the server-side /api/prompt-preview endpoint to get actual system and user prompts.
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-11-19
 * PURPOSE: Preview system and user prompts before sending to AI models.
 *          Supports continuation mode to show minimal prompts when chaining conversations.
 * SRP/DRY check: Pass - Single responsibility: prompt preview display
 */

import React, { useState, useEffect } from 'react';
import { Copy, Check, Loader2, Link2 } from 'lucide-react';
import { ARCTask } from '@shared/types';

interface PromptOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;
  sendAsEmojis?: boolean;
  topP?: number;
  candidateCount?: number;
  originalExplanation?: any; // For debate mode
  customChallenge?: string; // For debate/discussion mode
  previousResponseId?: string; // For conversation chaining (Responses API)
}

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ARCTask;
  taskId: string;
  promptId: string;
  customPrompt?: string;
  options?: PromptOptions;
  // Confirmation mode - shows "Confirm & Run" button to execute action after preview
  confirmMode?: boolean;
  onConfirm?: () => void | Promise<void>;
  confirmButtonText?: string;
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
  options = {},
  confirmMode = false,
  onConfirm,
  confirmButtonText = 'Confirm & Run'
}: PromptPreviewModalProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState<PromptPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

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
            emojiSetKey: options.sendAsEmojis ? options.emojiSetKey : undefined,
            sendAsEmojis: options.sendAsEmojis ?? false,
            omitAnswer: options.omitAnswer ?? true,
            topP: options.topP,
            candidateCount: options.candidateCount,
            originalExplanation: options.originalExplanation, // For debate mode
            customChallenge: options.customChallenge, // For debate/discussion mode
            previousResponseId: options.previousResponseId // For conversation chaining
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
  }, [isOpen, taskId, promptId, customPrompt, options.emojiSetKey, options.omitAnswer, options.topP, options.candidateCount, options.originalExplanation, options.customChallenge, options.previousResponseId]);

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Handle confirmation
  const handleConfirm = async () => {
    if (!onConfirm) return;

    setIsConfirming(true);
    try {
      await onConfirm();
      onClose(); // Close modal after successful confirmation
    } catch (error) {
      console.error('Confirmation failed:', error);
      // Don't close modal if confirmation fails - let user retry or cancel
    } finally {
      setIsConfirming(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPromptPreview(null);
      setError(null);
      setCopiedSection(null);
      setIsConfirming(false);
    }
  }, [isOpen]);

  return (
    <dialog className={`modal ${isOpen ? 'modal-open' : ''}`} style={{ zIndex: 9999 }} open={isOpen}>
      <div className="modal-box max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <h3 className="font-bold text-lg mb-4">
          Prompt Preview - {promptId}
          {promptPreview?.selectedTemplate?.emoji && (
            <span className="ml-2">{promptPreview.selectedTemplate.emoji}</span>
          )}
        </h3>
        
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
              {/* Continuation Mode Indicator */}
              {options.previousResponseId && (
                <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Link2 className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-purple-900 mb-1">
                        🔗 Continuation Mode - Server-Side Memory Active
                      </h4>
                      <p className="text-xs text-purple-700 mb-2">
                        This is a <strong>continuation prompt</strong> that leverages OpenAI's Responses API server-side state.
                        The model already has full context from previous iterations - this prompt only sends new instructions.
                      </p>
                      <div className="bg-purple-100 rounded px-2 py-1 inline-block">
                        <span className="text-xs font-mono text-purple-800">
                          Response ID: {options.previousResponseId.substring(0, 24)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  <button
                    className="btn btn-outline btn-sm h-8 px-2"
                    onClick={() => copyToClipboard(promptPreview.systemPrompt, 'system')}
                    disabled={!promptPreview.systemPrompt}
                  >
                    {copiedSection === 'system' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
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
                  <button
                    className="btn btn-outline btn-sm h-8 px-2"
                    onClick={() => copyToClipboard(promptPreview.userPrompt, 'user')}
                    disabled={!promptPreview.userPrompt}
                  >
                    {copiedSection === 'user' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
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

        <div className="modal-action">
          {confirmMode ? (
            <>
              <button
                className="btn btn-ghost"
                onClick={onClose}
                disabled={isConfirming}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={isConfirming || !promptPreview || isLoading}
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  confirmButtonText
                )}
              </button>
            </>
          ) : (
            <button className="btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}


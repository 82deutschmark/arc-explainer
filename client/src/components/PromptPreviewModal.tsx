/**
 * PromptPreviewModal.tsx
 * Simple modal component for previewing prompts that will be sent to AI models.
 * Uses buildAnalysisPrompt() to generate the actual system and user prompts.
 * 
 * @author Claude Code with Sonnet 4
 * @date August 30, 2025
 */

import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { ARCTask } from '@shared/types';

// We need to import the prompt builder - but it's on the server side
// For now, let's create a simple interface and handle the building client-side
interface PromptOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;
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

export function PromptPreviewModal({
  isOpen,
  onClose,
  task,
  taskId,
  promptId,
  customPrompt,
  options = {}
}: PromptPreviewModalProps) {
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);

  // For now, create a simple preview since we can't directly call server-side buildAnalysisPrompt
  // This is a minimal implementation that shows the structure
  const promptPreview = useMemo(() => {
    const systemPrompt = customPrompt && customPrompt.trim() 
      ? "You are an expert at analyzing ARC-AGI puzzles." 
      : getSimpleSystemPrompt(promptId);
    
    const userPrompt = buildSimpleUserPrompt(task, options);
    
    return { systemPrompt, userPrompt };
  }, [task, promptId, customPrompt, options]);

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Prompt Preview - {promptId}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* System Prompt Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">System Prompt</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(promptPreview.systemPrompt, 'system')}
                className="h-8 px-2"
              >
                {copiedSection === 'system' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap">
              {promptPreview.systemPrompt}
            </pre>
            <div className="text-xs text-gray-500">
              {promptPreview.systemPrompt.length} characters
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
              >
                {copiedSection === 'user' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap">
              {promptPreview.userPrompt}
            </pre>
            <div className="text-xs text-gray-500">
              {promptPreview.userPrompt.length} characters
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple system prompt generator (placeholder until we can properly integrate with server)
function getSimpleSystemPrompt(promptId: string): string {
  switch (promptId) {
    case 'solver':
      return `You are an expert at analyzing ARC-AGI puzzles. 

Your job is to understand transformation patterns and provide clear, structured analysis.

TASK: Analyze training examples, identify the transformation patterns, 
and predict the correct output for the test case.

CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.`;

    case 'standardExplanation':
      return `You are an expert at analyzing ARC-AGI puzzles. 

Your job is to understand transformation patterns and provide clear, structured analysis.

TASK: Analyze training examples, identify the transformation patterns, 
and explain the correct output for the test case.

CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.`;

    case 'alienCommunication':
      return `You are an expert at analyzing ARC-AGI puzzles. 

SPECIAL CONTEXT: This puzzle comes from alien visitors who communicate through spatial patterns.

TASK: Explain the transformation pattern AND interpret what the aliens might be trying to communicate.

CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.`;

    default:
      return `You are an expert at analyzing ARC-AGI puzzles. 

Your job is to understand transformation patterns and provide clear, structured analysis.

CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.`;
  }
}

// Simple user prompt builder (placeholder)
function buildSimpleUserPrompt(task: ARCTask, options: PromptOptions): string {
  const { omitAnswer = false } = options;
  
  let prompt = "TRAINING EXAMPLES:\n";
  
  task.train.forEach((example, i) => {
    prompt += `\nExample ${i + 1}:\nInput:\n`;
    prompt += formatGrid(example.input);
    prompt += `\nOutput:\n`;
    prompt += formatGrid(example.output);
    prompt += "\n";
  });
  
  prompt += "\nTEST CASE:\n";
  task.test.forEach((testCase, i) => {
    prompt += `\nTest ${i + 1}:\nInput:\n`;
    prompt += formatGrid(testCase.input);
    if (!omitAnswer) {
      prompt += `\nOutput:\n`;
      prompt += formatGrid(testCase.output);
    }
    prompt += "\n";
  });
  
  return prompt;
}

// Simple grid formatter
function formatGrid(grid: number[][]): string {
  return grid.map(row => row.join(' ')).join('\n');
}
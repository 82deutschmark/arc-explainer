/**
 * PromptPicker.tsx
 * 
 * Component for selecting AI analysis prompt templates.
 * Fetches available prompt templates from the backend and allows users to choose
 * different explanation approaches for puzzle analysis.
 * Integrates with the prompt picker system to provide dynamic prompt selection.
 * 
 * @author Cascade
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, HelpCircle, Edit3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiRequest } from '@/lib/queryClient';
import { EMOJI_SET_INFO } from '@/lib/spaceEmojis';

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
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Prompt Templates...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-4 border-red-200">
        <CardHeader>
          <CardTitle className="text-red-800">Error Loading Prompts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Explanation Style
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Choose how you want the AI to explain the puzzle solution. Different styles provide different perspectives and detail levels.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedPromptId}
          onValueChange={onPromptChange}
          disabled={disabled}
          className="space-y-3"
        >
          {prompts.map((prompt) => (
            <div key={prompt.id} className="flex items-start space-x-2">
              <RadioGroupItem 
                value={prompt.id} 
                id={prompt.id}
                className="mt-1"
                disabled={disabled}
              />
              <div className="flex-1">
                <Label
                  htmlFor={prompt.id}
                  className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50' : ''}`}
                >
                  <span className="font-medium">{prompt.name}</span>
                  {prompt.emojiMapIncluded && (
                    <Badge variant="secondary" className="text-xs">
                      🛸 Alien Theme
                    </Badge>
                  )}
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  {prompt.description}
                </p>
                
                {/* Custom Prompt Textarea */}
                {prompt.id === "custom" && selectedPromptId === "custom" && onCustomPromptChange && (
                  <div className="mt-3">
                    <Textarea
                      value={customPrompt || ""}
                      onChange={(e) => onCustomPromptChange(e.target.value)}
                      placeholder="Enter your custom prompt here... (e.g., You are an expert in pattern recognition. Analyze this ARC-AGI puzzle and explain the transformations involved.)"
                      className="min-h-[120px] resize-none"
                      disabled={disabled}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Custom prompts allow for specialized analysis approaches. The system will automatically append training examples and test case data.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
        
        {/* Advanced Options integrated into Explanation Style */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h6 className="text-sm font-semibold mb-3 text-gray-700">Advanced Options</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Send as Emojis Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Prompt Format</label>
              <div className="flex items-center gap-2 p-2 border rounded">
                <Switch
                  checked={sendAsEmojis || false}
                  onCheckedChange={onSendAsEmojisChange}
                  disabled={disabled}
                  id="send-as-emojis-toggle"
                />
                <label htmlFor="send-as-emojis-toggle" className="text-sm select-none">
                  Send as emojis
                </label>
              </div>
              <p className="text-xs text-gray-500">Send emoji symbols instead of numbers to AI models</p>
            </div>

            {/* Omit Answer Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Research Option</label>
              <div className="flex items-center gap-2 p-2 border rounded">
                <Switch
                  checked={omitAnswer || false}
                  onCheckedChange={onOmitAnswerChange}
                  disabled={disabled}
                  id="omit-answer-toggle"
                />
                <label htmlFor="omit-answer-toggle" className="text-sm select-none">
                  Omit correct answer in prompt
                </label>
              </div>
              <p className="text-xs text-gray-500">Hides the solution from AI models for testing</p>
            </div>
          </div>
        </div>
        
        {selectedPromptId && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Selected:</strong> {
                selectedPromptId === "custom" 
                  ? "Custom Prompt" 
                  : prompts.find(p => p.id === selectedPromptId)?.name
              }
            </p>
            {selectedPromptId === "custom" && customPrompt && (
              <p className="text-xs text-blue-600 mt-1">
                Custom prompt: {customPrompt.length} characters
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

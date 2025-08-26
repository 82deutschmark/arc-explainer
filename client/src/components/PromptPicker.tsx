/**
 * PromptPicker.tsx
 * 
 * Component for selecting AI analysis prompt templates.
 * Fetches available prompt templates from the backend and allows users to choose
 * different prompt styles for puzzle analysis.
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
  // systemPromptMode removed - now using modular architecture
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
          🎯 Prompt Style
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Choose how you want to prompt the AI to analyze the puzzle. Each style uses different instructions to guide the AI's reasoning approach and output format.</p>
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
        
        {/* Advanced Options integrated into Prompt Style */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h6 className="text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
            ⚡ Advanced Options
          </h6>
          
          {/* Active System Prompt Template */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1">
                🎛️ Active System Prompt
              </label>
              <Badge variant="default" className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-blue-200">
                {selectedPromptId === 'solver' ? '🎯 Solver' : 
                 selectedPromptId === 'alienCommunication' ? '🛸 Alien' :
                 selectedPromptId === 'educationalApproach' ? '🧠 Educational' :
                 selectedPromptId === 'custom' ? '⚙️ Custom' : '📝 Standard'}
              </Badge>
            </div>
            <div className="p-3 border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-blue-700">
                  {selectedPromptId === 'solver' ? '🎯 Answer Prediction Mode' : 
                   selectedPromptId === 'alienCommunication' ? '🛸 Alien Communication Mode' :
                   selectedPromptId === 'educationalApproach' ? '🧠 Educational Guide Mode' :
                   selectedPromptId === 'custom' ? '⚙️ Custom Instructions Mode' : '📝 Pattern Analysis Mode'}
                </span>
              </div>
              <p className="text-xs text-blue-700">
                {selectedPromptId === 'solver' ? 'AI becomes a puzzle solver, predicting answers without seeing solutions' : 
                 selectedPromptId === 'alienCommunication' ? 'AI interprets puzzles as creative alien messages using emoji symbols' :
                 selectedPromptId === 'educationalApproach' ? 'AI teaches algorithmic thinking and step-by-step problem-solving' :
                 selectedPromptId === 'custom' ? 'AI follows your custom instructions with full control over analysis style' :
                 'AI provides clear, structured analysis of transformation patterns'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Send as Emojis Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1">
                🎨 Prompt Format
              </label>
              <div className="flex items-center gap-2 p-3 border border-green-200 bg-green-50 rounded-lg">
                <Switch
                  checked={sendAsEmojis || false}
                  onCheckedChange={onSendAsEmojisChange}
                  disabled={disabled}
                  id="send-as-emojis-toggle"
                />
                <label htmlFor="send-as-emojis-toggle" className="text-sm select-none font-medium">
                  🌟 Send as emojis
                </label>
              </div>
              <p className="text-xs text-gray-500">Transform numbers into colorful emoji symbols for AI analysis</p>
            </div>

            {/* Omit Answer Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1">
                🔬 Research Mode
              </label>
              <div className="flex items-center gap-2 p-3 border border-orange-200 bg-orange-50 rounded-lg">
                <Switch
                  checked={omitAnswer || false}
                  onCheckedChange={onOmitAnswerChange}
                  disabled={disabled}
                  id="omit-answer-toggle"
                />
                <label htmlFor="omit-answer-toggle" className="text-sm select-none font-medium">
                  🎭 Hide solution
                </label>
              </div>
              <p className="text-xs text-gray-500">Challenge the AI to solve puzzles without seeing answers</p>
            </div>
          </div>
        </div>
        
        {selectedPromptId && (
          <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">✅</span>
              <p className="text-sm text-emerald-800 font-medium">
                <strong>Active Prompt:</strong> {
                  selectedPromptId === "custom" 
                    ? "⚙️ Custom Prompt" 
                    : prompts.find(p => p.id === selectedPromptId)?.name
                }
              </p>
            </div>
            {selectedPromptId === "custom" && customPrompt && (
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                <span>📝</span>
                Custom instructions: {customPrompt.length} characters
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

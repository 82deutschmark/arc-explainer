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
import { Loader2, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  disabled?: boolean;
}

export function PromptPicker({ selectedPromptId, onPromptChange, disabled = false }: PromptPickerProps) {
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
              </div>
            </div>
          ))}
        </RadioGroup>
        
        {selectedPromptId && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Selected:</strong> {prompts.find(p => p.id === selectedPromptId)?.name}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PromptPreviewModal.tsx
 * 
 * Modal component for displaying provider-specific prompt previews.
 * Shows the exact prompt text and message format that will be sent to AI providers.
 * Allows users to see exactly what will be sent before running analysis.
 * 
 * @author Claude 4 Sonnet
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, Copy, Loader2, Send, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';

interface PromptPreviewData {
  provider: string;
  modelName: string;
  promptText: string;
  messageFormat: any;
  templateInfo: {
    id: string;
    name: string;
    usesEmojis: boolean;
  };
  promptStats: {
    characterCount: number;
    wordCount: number;
    lineCount: number;
  };
  providerSpecificNotes: string[];
  captureReasoning: boolean;
  temperature: number | string;
  pricingTier?: string;
  isReasoningModel?: boolean;
}

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  puzzleId: string;
  selectedPromptId: string;
  customPrompt?: string;
  disabled?: boolean;
  onAnalyze?: (provider: string, model: string, editedPrompt?: string) => void;
}

// Import the actual models from constants
import { MODELS } from '@/constants/models';

// Group models by provider using the actual model data
const PROVIDERS = [
  { 
    key: 'openai', 
    name: 'OpenAI', 
    models: MODELS.filter(m => m.provider === 'OpenAI').map(m => m.key)
  },
  { 
    key: 'anthropic', 
    name: 'Anthropic', 
    models: MODELS.filter(m => m.provider === 'Anthropic').map(m => m.key)
  },
  { 
    key: 'gemini', 
    name: 'Google Gemini', 
    models: MODELS.filter(m => m.provider === 'Gemini').map(m => m.key)
  },
  { 
    key: 'grok', 
    name: 'xAI Grok', 
    models: MODELS.filter(m => m.provider === 'xAI').map(m => m.key)
  },
  { 
    key: 'deepseek', 
    name: 'DeepSeek', 
    models: MODELS.filter(m => m.provider === 'DeepSeek').map(m => m.key)
  }
];

export function PromptPreviewModal({
  isOpen,
  onClose,
  puzzleId,
  selectedPromptId,
  customPrompt,
  disabled = false,
  onAnalyze
}: PromptPreviewModalProps) {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [previewData, setPreviewData] = useState<PromptPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Initialize edited prompt when modal opens or custom prompt changes
  React.useEffect(() => {
    if (isOpen) {
      setEditedPrompt(customPrompt || '');
      setIsEditing(false);
    }
  }, [isOpen, customPrompt]);

  const handlePreview = async () => {
    if (!puzzleId || !selectedProvider || !selectedModel) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('POST', `/api/prompt/preview/${selectedProvider}/${puzzleId}`, {
        promptId: selectedPromptId,
        customPrompt: isEditing ? editedPrompt : customPrompt,
        temperature: 0.75,
        captureReasoning: true,
        modelKey: selectedModel
      });

      if (!response.ok) {
        throw new Error(`Failed to generate preview: ${response.statusText}`);
      }

      const data = await response.json();
      setPreviewData(data.data);
    } catch (err) {
      console.error('Error generating prompt preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!previewData) return;
    
    try {
      await navigator.clipboard.writeText(previewData.promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const providerData = PROVIDERS.find(p => p.key === provider);
    if (providerData && providerData.models.length > 0) {
      setSelectedModel(providerData.models[0]);
    }
    setPreviewData(null); // Clear previous preview when provider changes
  };

  const handleAnalyze = () => {
    if (onAnalyze && selectedProvider && selectedModel) {
      onAnalyze(selectedProvider, selectedModel, isEditing ? editedPrompt : undefined);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Preview Prompt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provider-Specific Prompt Preview</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Provider and Model Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(provider => (
                    <SelectItem key={provider.key} value={provider.key}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.find(p => p.key === selectedProvider)?.models.map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prompt Editor (for custom prompts) */}
          {selectedPromptId === 'custom' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Custom Prompt Text</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs"
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Prompt'}
                </Button>
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    placeholder="Enter your custom prompt here..."
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAnalyze}
                      disabled={!editedPrompt.trim() || !onAnalyze}
                      className="flex-1"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send to {PROVIDERS.find(p => p.key === selectedProvider)?.name}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePreview}
                      disabled={loading}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600 font-mono">
                    {(customPrompt || editedPrompt) || 'No custom prompt text entered'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Generate Preview Button */}
          <Button 
            onClick={handlePreview} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Preview...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Generate Preview for {PROVIDERS.find(p => p.key === selectedProvider)?.name} {selectedModel}
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Preview Results */}
          {previewData && (
            <div className="space-y-4">
              {/* Preview Header with Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Preview for {previewData.provider} - {previewData.modelName}</span>
                    <div className="flex items-center gap-2">
                      {previewData.templateInfo.usesEmojis && (
                        <Badge variant="secondary">🛸 Emoji Mode</Badge>
                      )}
                      {previewData.isReasoningModel && (
                        <Badge variant="outline">🧠 Reasoning Model</Badge>
                      )}
                      {previewData.pricingTier && (
                        <Badge variant="outline">{previewData.pricingTier}</Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Characters:</span> {previewData.promptStats.characterCount.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Words:</span> {previewData.promptStats.wordCount.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Lines:</span> {previewData.promptStats.lineCount.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabbed Content */}
              <Tabs defaultValue="prompt" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="prompt">Prompt Text</TabsTrigger>
                  <TabsTrigger value="format">Message Format</TabsTrigger>
                  <TabsTrigger value="notes">Provider Notes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="prompt" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Final Prompt Text</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {previewData.promptText}
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="format" className="space-y-2">
                  <h3 className="text-sm font-medium">Provider-Specific Message Format</h3>
                  <div className="bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(previewData.messageFormat, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="notes" className="space-y-2">
                  <h3 className="text-sm font-medium">Provider-Specific Implementation Notes</h3>
                  <div className="space-y-2">
                    {previewData.providerSpecificNotes.map((note, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div><span className="font-medium">Template:</span> {previewData.templateInfo.name}</div>
                      <div><span className="font-medium">Temperature:</span> {previewData.temperature}</div>
                      <div><span className="font-medium">Reasoning Capture:</span> {previewData.captureReasoning ? 'Enabled' : 'Disabled'}</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

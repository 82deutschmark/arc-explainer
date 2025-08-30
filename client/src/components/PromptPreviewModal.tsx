/**
 * PromptPreviewModal.tsx
 * NEEDS TO BE REWRITTEN!!!
 * Modal component for previewing the complete prompt that will be sent to AI models.
 * Works with the new modular prompt architecture (system + user prompts).
 * 
 * @author Claude Code with Sonnet 4
 * @date August 23, 2025
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Eye } from 'lucide-react';
import { ARCTask } from '@shared/types';

interface PromptPreviewData {
  systemPrompt: string;
  userPrompt: string;
  selectedTemplate: any;
  jsonSchema?: any;
  useStructuredOutput: boolean;
  isAlienMode: boolean;
  isSolver: boolean;
}

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ARCTask | null;
  taskId: string; // Add taskId as a separate prop
  promptId: string;
  customPrompt?: string;
  options?: {
    emojiSetKey?: string;
    omitAnswer?: boolean;
    sendAsEmojis?: boolean;
  };
}
/// NEEDS TO BE REWRITTEN!!!
export function PromptPreviewModal({ 
  isOpen, 
  onClose, 
  task, 
  taskId,
  promptId, 
  customPrompt,
  options = {}
}: PromptPreviewModalProps) {
  const [promptData, setPromptData] = useState<PromptPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Fetch prompt preview from backend
  useEffect(() => {
    if (isOpen && task) {
      fetchPromptPreview();
    }
  }, [isOpen, task, promptId, customPrompt, options]);

  const fetchPromptPreview = async () => {
    if (!task) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/prompt-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          promptId,
          customPrompt,
          emojiSetKey: options.sendAsEmojis ? options.emojiSetKey : undefined,
          omitAnswer: options.omitAnswer,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch prompt preview: ${response.statusText}`);
      }

      const data = await response.json();
      setPromptData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching prompt preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatJsonSchema = (schema: any) => {
    if (!schema) return 'None';
    return JSON.stringify(schema, null, 2);
  };

  const getCharacterCount = (text: string) => {
    return text.length.toLocaleString();
  };

  const getWordCount = (text: string) => {
    return text.split(/\s+/).filter(word => word.length > 0).length.toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Prompt Preview
            {promptData?.selectedTemplate && (
              <Badge variant="outline">
                {promptData.selectedTemplate.name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-gray-600">Loading prompt preview...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-sm text-red-700">Error: {error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchPromptPreview}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {promptData && !loading && !error && (
            <Tabs defaultValue="combined" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="combined">Combined View</TabsTrigger>
                <TabsTrigger value="system">System Prompt</TabsTrigger>
                <TabsTrigger value="user">User Prompt</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
                <TabsTrigger value="raw">Raw API JSON</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="combined" className="h-full mt-2">
                  <div className="h-full border rounded p-4 overflow-y-auto bg-gray-50">
                    <div className="space-y-6">
                      {/* System Prompt Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-blue-800">System Prompt</h4>
                            <Badge variant="outline" className="text-xs">
                              {getCharacterCount(promptData.systemPrompt)} chars
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(promptData.systemPrompt, 'system')}
                            className="h-auto p-1"
                          >
                            {copiedSection === 'system' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <pre className="text-sm whitespace-pre-wrap font-mono text-blue-800 leading-relaxed">
                            {promptData.systemPrompt}
                          </pre>
                        </div>
                      </div>

                      {/* User Prompt Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-green-800">User Prompt</h4>
                            <Badge variant="outline" className="text-xs">
                              {getCharacterCount(promptData.userPrompt)} chars, {getWordCount(promptData.userPrompt)} words
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(promptData.userPrompt, 'user')}
                            className="h-auto p-1"
                          >
                            {copiedSection === 'user' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <pre className="text-sm whitespace-pre-wrap font-mono text-green-800 leading-relaxed">
                            {promptData.userPrompt}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="system" className="h-full mt-2">
                  <div className="h-full border rounded p-4 overflow-y-auto bg-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-blue-800">System Prompt</h4>
                        <Badge variant="outline" className="text-xs">
                          {getCharacterCount(promptData.systemPrompt)} characters
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(promptData.systemPrompt, 'system')}
                      >
                        {copiedSection === 'system' ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="text-sm whitespace-pre-wrap font-mono text-blue-800 leading-relaxed">
                      {promptData.systemPrompt}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="user" className="h-full mt-2">
                  <div className="h-full border rounded p-4 overflow-y-auto bg-green-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-green-800">User Prompt</h4>
                        <Badge variant="outline" className="text-xs">
                          {getCharacterCount(promptData.userPrompt)} chars, {getWordCount(promptData.userPrompt)} words
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(promptData.userPrompt, 'user')}
                      >
                        {copiedSection === 'user' ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="text-sm whitespace-pre-wrap font-mono text-green-800 leading-relaxed">
                      {promptData.userPrompt}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="schema" className="h-full mt-2">
                  <div className="h-full border rounded p-4 overflow-y-auto bg-purple-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-purple-800">JSON Schema</h4>
                        <Badge variant="outline" className="text-xs">
                          {promptData.useStructuredOutput ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {promptData.isAlienMode && (
                          <Badge variant="outline" className="text-xs bg-purple-100">
                            Alien Mode
                          </Badge>
                        )}
                        {promptData.isSolver && (
                          <Badge variant="outline" className="text-xs bg-orange-100">
                            Solver Mode
                          </Badge>
                        )}
                      </div>
                      {promptData.jsonSchema && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(formatJsonSchema(promptData.jsonSchema), 'schema')}
                        >
                          {copiedSection === 'schema' ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <pre className="text-sm whitespace-pre-wrap font-mono text-purple-800 leading-relaxed">
                      {formatJsonSchema(promptData.jsonSchema)}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="raw" className="h-full mt-2">
                  <div className="h-full border rounded p-4 overflow-y-auto bg-red-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-red-800">Message Structure (Debugging)</h4>
                        <Badge variant="outline" className="text-xs bg-red-100">
                          Researcher Debug Data
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const messageStructure = {
                            messages: [
                              { role: "system", content: promptData.systemPrompt },
                              { role: "user", content: promptData.userPrompt }
                            ],
                            response_format: promptData.useStructuredOutput ? { type: "json_object" } : undefined,
                            temperature: 0.2,
                            model: "example-model"
                          };
                          copyToClipboard(JSON.stringify(messageStructure, null, 2), 'raw');
                        }}
                      >
                        {copiedSection === 'raw' ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Structure
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-white border border-red-200 rounded p-3">
                      <h5 className="font-medium text-red-700 mb-2">OpenAI-style Message Structure</h5>
                      <pre className="text-xs whitespace-pre-wrap font-mono text-red-800 leading-relaxed">
                        {JSON.stringify({
                          messages: [
                            { role: "system", content: promptData.systemPrompt.substring(0, 100) + "..." },
                            { role: "user", content: promptData.userPrompt.substring(0, 100) + "..." }
                          ],
                          response_format: promptData.useStructuredOutput ? { type: "json_object" } : undefined,
                          temperature: 0.2,
                          model: "example-model"
                        }, null, 2)}
                      </pre>
                      <p className="text-xs text-red-500 mt-2">
                        This shows the basic message structure that would be sent to AI providers. Content truncated for display.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-gray-600">
            {promptData && (
              <>
                Total: {getCharacterCount(promptData.systemPrompt + promptData.userPrompt)} characters
                {promptData.useStructuredOutput && ' • Structured Output Enabled'}
              </>
            )}
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Configuration panel for ARC3 agent settings - fetches real models from /api/models.
SRP/DRY check: Pass — isolates agent configuration logic from game execution and UI rendering.
*/

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot, Play, Square, AlertCircle, RefreshCw, Brain } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ModelConfig {
  key: string;
  name: string;
  provider: string;
  premium?: boolean;
  isReasoning?: boolean;
  cost?: {
    input: string;
    output: string;
  };
  responseTime?: {
    speed: string;
    estimate: string;
  };
}

interface Arc3AgentConfigPanelProps {
  agentName: string;
  setAgentName: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  maxTurns: number;
  setMaxTurns: (value: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (value: 'minimal' | 'low' | 'medium' | 'high') => void;
  instructions: string;
  setInstructions: (value: string) => void;
  isRunning: boolean;
  onStart: () => void;
  onCancel: () => void;
  className?: string;
}

export const Arc3AgentConfigPanel: React.FC<Arc3AgentConfigPanelProps> = ({
  agentName,
  setAgentName,
  model,
  setModel,
  maxTurns,
  setMaxTurns,
  reasoningEffort,
  setReasoningEffort,
  instructions,
  setInstructions,
  isRunning,
  onStart,
  onCancel,
  className = '',
}) => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const fetchModels = async () => {
    setLoadingModels(true);
    setModelsError(null);
    
    try {
      const response = await apiRequest('GET', '/api/models');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setModels(data);
        // Auto-select first model if none selected
        if (!model && data.length > 0) {
          setModel(data[0].key);
        }
      } else {
        throw new Error('Invalid response format from /api/models');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch models';
      setModelsError(message);
      console.error('[Arc3AgentConfigPanel] Error fetching models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const selectedModel = models.find(m => m.key === model);

  const canStart = !isRunning && instructions.trim().length > 0 && model && agentName.trim().length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Agent Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent Name */}
        <div className="space-y-2">
          <Label htmlFor="agent-name" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agent Name
          </Label>
          <Input
            id="agent-name"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="ARC3 Game Agent"
            disabled={isRunning}
          />
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="model-select" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Model
            {loadingModels && (
              <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </Label>
          
          {modelsError ? (
            <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-900 dark:text-red-100 font-medium">Failed to load models</p>
                <p className="text-red-700 dark:text-red-300">{modelsError}</p>
              </div>
              <Button onClick={fetchModels} variant="ghost" size="sm">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <Select 
                value={model} 
                onValueChange={setModel} 
                disabled={isRunning || loadingModels}
              >
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="Select a model">
                    {selectedModel && (
                      <div className="flex items-center gap-2">
                        <span>{selectedModel.name}</span>
                        <Badge variant="outline" className="text-xs">{selectedModel.provider}</Badge>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {models.map((modelOption) => (
                    <SelectItem key={modelOption.key} value={modelOption.key}>
                      <div className="flex flex-col items-start py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{modelOption.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {modelOption.provider}
                          </Badge>
                          {modelOption.premium && (
                            <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              Premium
                            </Badge>
                          )}
                          {modelOption.isReasoning && (
                            <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              Reasoning
                            </Badge>
                          )}
                        </div>
                        {modelOption.responseTime && (
                          <span className="text-xs text-muted-foreground">
                            {modelOption.responseTime.estimate}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedModel && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Provider: {selectedModel.provider}</p>
                  {selectedModel.cost && (
                    <p>Cost: {selectedModel.cost.input}/M input, {selectedModel.cost.output}/M output</p>
                  )}
                  {selectedModel.responseTime && (
                    <p>Speed: {selectedModel.responseTime.speed} ({selectedModel.responseTime.estimate})</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Max Turns */}
        <div className="space-y-2">
          <Label htmlFor="max-turns">Max Turns: {maxTurns}</Label>
          <input
            id="max-turns"
            type="range"
            min="10"
            max="100"
            step="5"
            value={maxTurns}
            onChange={(e) => setMaxTurns(Number(e.target.value))}
            disabled={isRunning}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10 (quick exploration)</span>
            <span>100 (thorough gameplay)</span>
          </div>
        </div>

        {/* Reasoning Effort */}
        <div className="space-y-2">
          <Label htmlFor="reasoning-effort" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Reasoning Effort
          </Label>
          <Select
            value={reasoningEffort}
            onValueChange={setReasoningEffort}
            disabled={isRunning}
          >
            <SelectTrigger id="reasoning-effort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minimal">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Minimal</span>
                  <span className="text-xs text-muted-foreground">Quick responses, basic reasoning</span>
                </div>
              </SelectItem>
              <SelectItem value="low">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Low</span>
                  <span className="text-xs text-muted-foreground">Balanced speed and reasoning</span>
                </div>
              </SelectItem>
              <SelectItem value="medium">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Medium</span>
                  <span className="text-xs text-muted-foreground">Moderate reasoning depth</span>
                </div>
              </SelectItem>
              <SelectItem value="high">
                <div className="flex flex-col items-start">
                  <span className="font-medium">High</span>
                  <span className="text-xs text-muted-foreground">Deep analysis, thorough reasoning</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls how much computational effort the agent spends on reasoning. Higher effort = better analysis but slower responses.
          </p>
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          <Label htmlFor="instructions">Agent Instructions</Label>
          <Textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Provide custom instructions for how the agent should approach the game..."
            className="min-h-[140px] resize-none"
            disabled={isRunning}
          />
          <p className="text-xs text-muted-foreground">
            Tell the agent how to approach the game. These instructions will be combined with
            the agent's base game-playing knowledge.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {!isRunning ? (
            <Button 
              onClick={onStart} 
              disabled={!canStart}
              className="w-full"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Agent Run
            </Button>
          ) : (
            <Button 
              onClick={onCancel} 
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <Square className="h-4 w-4 mr-2" />
              Cancel Run
            </Button>
          )}

          {!canStart && !isRunning && (
            <p className="text-xs text-muted-foreground text-center">
              {!agentName.trim() && 'Please enter an agent name. '}
              {!model && 'Please select a model. '}
              {!instructions.trim() && 'Please provide instructions.'}
            </p>
          )}
        </div>

        {/* Running Status */}
        {isRunning && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
            <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              <span className="font-medium">Agent is running...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Arc3AgentConfigPanel;

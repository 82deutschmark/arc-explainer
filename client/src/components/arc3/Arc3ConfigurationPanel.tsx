/*
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-07
 * PURPOSE: Ultra-compact configuration panel for ARC3 Agent Playground.
 *          Extracted from ARC3AgentPlayground.tsx to follow SRP.
 *          Handles system prompt, user prompt, model selection (OpenAI only),
 *          reasoning effort, max turns, and start/stop controls.
 * SRP/DRY check: Pass — isolates agent configuration UI from page orchestration.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Play, Square, RefreshCw } from 'lucide-react';

interface ModelInfo {
  key: string;
  name: string;
  color: string;
  premium: boolean;
  cost: { input: string; output: string };
  supportsTemperature?: boolean;
  supportsStreaming?: boolean;
  provider: string;
  responseTime: { speed: string; estimate: string };
  isReasoning?: boolean;
  releaseDate?: string;
}

interface Arc3ConfigurationPanelProps {
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  instructions: string;
  setInstructions: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (value: 'minimal' | 'low' | 'medium' | 'high') => void;
  maxTurns: number;
  setMaxTurns: (value: number) => void;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  isPlaying: boolean;
  onStart: () => void;
  onCancel: () => void;
}

export const Arc3ConfigurationPanel: React.FC<Arc3ConfigurationPanelProps> = ({
  systemPrompt,
  setSystemPrompt,
  instructions,
  setInstructions,
  model,
  setModel,
  reasoningEffort,
  setReasoningEffort,
  maxTurns,
  setMaxTurns,
  availableModels,
  modelsLoading,
  isPlaying,
  onStart,
  onCancel,
}) => {
  const [showSystemPrompt, setShowSystemPrompt] = React.useState(true);

  return (
    <Card className="text-xs">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Configuration</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className="h-6 px-2 text-[10px]"
          >
            {showSystemPrompt ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            {showSystemPrompt ? 'Hide' : 'Show'} System
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px] px-3 pb-3">
        {/* System Prompt - EDITABLE, at top */}
        {showSystemPrompt && (
          <div className="space-y-0.5">
            <label className="font-medium text-[10px]">System Prompt</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={isPlaying}
              className="text-[10px] min-h-[8rem] max-h-[60vh] resize-y font-mono"
              placeholder="Base system instructions..."
            />
          </div>
        )}

        {/* User Prompt (formerly "Instructions") */}
        <div className="space-y-0.5">
          <label className="font-medium text-[10px]">User Prompt</label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isPlaying}
            className="text-[11px] min-h-[6rem] max-h-[50vh] resize-y"
            placeholder="Additional operator guidance..."
          />
        </div>

        {/* Model & Reasoning - Compact horizontal layout */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="space-y-0.5">
            <label className="font-medium text-[10px]">Model</label>
            {modelsLoading ? (
              <div className="flex items-center gap-1 h-7 px-2 text-[10px] text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : (
              <Select value={model} onValueChange={setModel} disabled={isPlaying}>
                <SelectTrigger className="h-7 text-[10px] px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m: ModelInfo) => (
                    <SelectItem key={m.key} value={m.key} className="text-[10px]">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-0.5">
            <label className="font-medium text-[10px]">Reasoning</label>
            <Select
              value={reasoningEffort}
              onValueChange={(v) => setReasoningEffort(v as any)}
              disabled={isPlaying}
            >
              <SelectTrigger className="h-7 text-[10px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal" className="text-[10px]">Minimal</SelectItem>
                <SelectItem value="low" className="text-[10px]">Low</SelectItem>
                <SelectItem value="medium" className="text-[10px]">Medium</SelectItem>
                <SelectItem value="high" className="text-[10px]">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Max Turns - High default (effectively unlimited) */}
        <div className="space-y-0.5">
          <label className="font-medium text-[10px]">Max Turns</label>
          <Input
            type="number"
            min="1"
            value={maxTurns}
            onChange={(e) => setMaxTurns(Number(e.target.value))}
            disabled={isPlaying}
            className="h-7 text-[11px]"
            placeholder="100000 (default)"
          />
          <p className="text-[9px] text-muted-foreground">Set high to avoid auto-pauses; agent stops only on user cancel or game end.</p>
        </div>

        {/* Start/Stop */}
        <div className="flex gap-1.5 pt-1">
          {!isPlaying ? (
            <Button onClick={onStart} size="sm" className="flex-1 h-7 text-[11px]">
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          ) : (
            <Button onClick={onCancel} size="sm" variant="destructive" className="flex-1 h-7 text-[11px]">
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Arc3ConfigurationPanel;

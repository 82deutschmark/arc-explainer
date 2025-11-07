/*
Author: Claude (Windsurf Cascade)  
Date: 2025-11-06
PURPOSE: ARC-AGI-3 Agent Playground matching real site layout.
Left: Tiny "How it Works" + Actions summary | Middle: Game controls ABOVE grid | Right: Streaming reasoning
*/

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Gamepad2, Play, Square, Brain, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { useArc3AgentStream } from '@/hooks/useArc3AgentStream';
import { Arc3GridVisualization } from '@/components/arc3/Arc3GridVisualization';

// Import models from config
import { MODELS } from '../../../server/config/models';

export default function ARC3AgentPlayground() {
  const [gameId, setGameId] = useState('ls20');
  const [model, setModel] = useState('gpt-5-nano-2025-08-07');
  const [maxTurns, setMaxTurns] = useState(10);
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [instructions, setInstructions] = useState(
    'Systematically explore the game. Use RESET, inspect state, try actions, learn rules.'
  );
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const { state, start, cancel, setCurrentFrame, currentFrame, isPlaying } = useArc3AgentStream();

  // Get available OpenAI Agents SDK models
  const availableModels = MODELS.filter(m => 
    m.provider === 'OpenAI' && 
    (m.modelType === 'gpt5' || m.modelType === 'gpt5_chat' || m.modelType === 'o3_o4')
  );

  const handleStart = () => {
    start({
      game_id: gameId,
      agentName: 'ARC3 Agent',
      instructions,
      model,
      maxTurns,
      reasoningEffort,
    });
  };

  const reasoningEntries = state.timeline.filter(entry => entry.type === 'reasoning');
  const toolEntries = state.timeline.filter(entry => 
    entry.type === 'tool_call' || entry.type === 'tool_result'
  );

  // System prompt that agents use
  const systemPrompt = `You are an AI agent playing ARC-AGI-3 games. You have tools to:
- RESET: Initialize game
- inspect_game_state: Observe the grid
- ACTION1-6: Perform game actions

Your goal: Understand the puzzle rules through systematic exploration and solve it efficiently.`;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-3 py-1.5 bg-gray-900">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-2 text-sm">
            <Gamepad2 className="h-4 w-4" />
            <span className="font-semibold">ARC-AGI-3 Agent Playground</span>
          </div>
          <Badge 
            variant={state.status === 'running' ? 'default' : 'outline'}
            className="text-[10px] h-5"
          >
            {state.status}
          </Badge>
        </div>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-12 gap-3 p-3 max-w-[1800px] mx-auto">
        
        {/* LEFT: Tiny info + actions */}
        <div className="col-span-3 space-y-2">
          
          {/* How it Works - TINY */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="p-2">
              <CardTitle className="text-[11px] font-medium">How it Works</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-[9px] text-gray-400 space-y-1">
                <p>• Configure agent + game</p>
                <p>• Start run + watch stream</p>
                <p>• After {maxTurns} actions without win, inject message</p>
              </div>
            </CardContent>
          </Card>

          {/* System Prompt Toggle */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="p-2 cursor-pointer" onClick={() => setShowSystemPrompt(!showSystemPrompt)}>
              <CardTitle className="text-[11px] font-medium flex items-center justify-between">
                System Prompt
                {showSystemPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </CardTitle>
            </CardHeader>
            {showSystemPrompt && (
              <CardContent className="p-2 pt-0">
                <pre className="text-[8px] text-gray-400 whitespace-pre-wrap">{systemPrompt}</pre>
              </CardContent>
            )}
          </Card>

          {/* Stats */}
          {currentFrame && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="p-2">
                <CardTitle className="text-[11px] font-medium">Stats</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 space-y-1">
                <div className="grid grid-cols-2 gap-1 text-[9px]">
                  <div>
                    <p className="text-gray-500">Score</p>
                    <p className="text-sm font-bold">{currentFrame.score}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Actions</p>
                    <p className="text-sm font-bold">{currentFrame.action_counter}/{currentFrame.max_actions}</p>
                  </div>
                </div>
                <Badge className="text-[9px] h-4" variant={currentFrame.state === 'WIN' ? 'default' : 'outline'}>
                  {currentFrame.state}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Actions/Tools - TINY */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="p-2">
              <CardTitle className="text-[11px] font-medium flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                Actions & Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {toolEntries.length === 0 ? (
                  <p className="text-[9px] text-gray-500">No actions yet</p>
                ) : (
                  toolEntries.slice(-5).map((entry, idx) => (
                    <div key={idx} className="p-1 rounded bg-gray-800 border border-gray-700">
                      <p className="text-[9px] font-medium truncate">{entry.label}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MIDDLE: Game controls ABOVE grid */}
        <div className="col-span-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="p-2">
              <CardTitle className="text-[11px] font-medium">Game: {gameId}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
              
              {/* COMPACT CONTROLS */}
              <div className="grid grid-cols-3 gap-2 p-2 bg-gray-800 rounded">
                {/* Game selector */}
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400">Game</label>
                  <Select value={gameId} onValueChange={setGameId} disabled={isPlaying}>
                    <SelectTrigger className="h-6 text-[10px] bg-gray-900 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ls20">ls20</SelectItem>
                      <SelectItem value="zz34">zz34</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Model selector */}
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400">Model</label>
                  <Select value={model} onValueChange={setModel} disabled={isPlaying}>
                    <SelectTrigger className="h-6 text-[10px] bg-gray-900 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((m) => (
                        <SelectItem key={m.key} value={m.apiModelName}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reasoning */}
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400">Reasoning</label>
                  <Select 
                    value={reasoningEffort} 
                    onValueChange={(v) => setReasoningEffort(v as any)}
                    disabled={isPlaying}
                  >
                    <SelectTrigger className="h-6 text-[10px] bg-gray-900 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Max Actions + Start/Stop */}
              <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                <div className="flex-1">
                  <label className="text-[9px] text-gray-400 block mb-1">Max Actions: {maxTurns}</label>
                  <input
                    type="range"
                    min="5"
                    max="24"
                    value={maxTurns}
                    onChange={(e) => setMaxTurns(Number(e.target.value))}
                    disabled={isPlaying}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                {!isPlaying ? (
                  <Button onClick={handleStart} size="sm" className="h-6 text-[10px]">
                    <Play className="h-3 w-3 mr-1" />
                    Start
                  </Button>
                ) : (
                  <Button onClick={cancel} size="sm" variant="destructive" className="h-6 text-[10px]">
                    <Square className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                )}
              </div>

              {/* Instructions - Collapsible */}
              <div className="p-2 bg-gray-800 rounded">
                <div 
                  className="flex items-center justify-between cursor-pointer mb-1"
                  onClick={() => setShowInstructions(!showInstructions)}
                >
                  <label className="text-[9px] text-gray-400">Instructions</label>
                  {showInstructions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </div>
                {showInstructions && (
                  <Textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    disabled={isPlaying}
                    className="text-[9px] h-16 resize-none bg-gray-900 border-gray-700"
                  />
                )}
              </div>

              {/* GAME GRID */}
              <div className="border border-gray-700 rounded p-2 bg-black">
                {currentFrame ? (
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      <Arc3GridVisualization
                        grid={[currentFrame.frame]}
                        frameIndex={0}
                        cellSize={16}
                        showGrid={true}
                      />
                    </div>

                    {/* Frame slider */}
                    {state.frames.length > 1 && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-400">
                          Frame: {state.currentFrameIndex + 1} / {state.frames.length}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={state.frames.length - 1}
                          value={state.currentFrameIndex}
                          onChange={(e) => setCurrentFrame(Number(e.target.value))}
                          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Gamepad2 className="h-10 w-10 text-gray-700 mb-2" />
                    <p className="text-[10px] text-gray-500">
                      {state.status === 'running' ? 'Waiting...' : 'Start agent to see grid'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Streaming Reasoning */}
        <div className="col-span-3">
          <Card className="bg-gray-900 border-gray-800 h-full">
            <CardHeader className="p-2">
              <CardTitle className="text-[11px] font-medium flex items-center gap-1">
                <Brain className="h-3 w-3" />
                STREAMING REASONING
                {isPlaying && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto">
                {reasoningEntries.length === 0 && !isPlaying ? (
                  <div className="text-center text-gray-500 py-8">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-[9px]">No reasoning yet</p>
                  </div>
                ) : (
                  <>
                    {reasoningEntries.map((entry, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-gray-800 border border-gray-700">
                        <p className="text-[9px] text-blue-400 font-medium mb-0.5">
                          Step {idx + 1}
                        </p>
                        <pre className="text-[8px] text-gray-300 whitespace-pre-wrap">
                          {entry.content}
                        </pre>
                      </div>
                    ))}
                    
                    {isPlaying && (
                      <div className="flex items-center gap-1 p-1.5 border-l-2 border-blue-500 bg-blue-950/20">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-[9px] text-blue-400">
                          {state.streamingMessage || 'Thinking...'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

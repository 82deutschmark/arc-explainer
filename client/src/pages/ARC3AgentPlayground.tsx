/*
Author: Claude (Windsurf Cascade)  
Date: 2025-11-06
PURPOSE: Ultra-compact ARC3 Agent Playground matching real ARC-AGI-3 site layout.
Game selector above grid in center. Models from config. Minimal controls.
SRP/DRY check: Pass
*/

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Gamepad2, Play, Square, Brain, Wrench, ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Link } from 'wouter';
import { useArc3AgentStream } from '@/hooks/useArc3AgentStream';
import { Arc3GridVisualization } from '@/components/arc3/Arc3GridVisualization';
import { apiRequest } from '@/lib/queryClient';

interface GameInfo {
  game_id: string;
  title: string;
}

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

export default function ARC3AgentPlayground() {
  // Fetch games
  const [games, setGames] = useState<GameInfo[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [initialGrid, setInitialGrid] = useState<number[][][] | null>(null);

  // Fetch models
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  const fetchGames = async () => {
    setGamesLoading(true);
    try {
      const response = await apiRequest('GET', '/api/arc3/games');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setGames(data.data);
        // Auto-load first game's grid
        if (data.data.length > 0) {
          const firstGame = data.data.find((g: GameInfo) => g.game_id === 'ls20') || data.data[0];
          setGameId(firstGame.game_id);
          await fetchGameGrid(firstGame.game_id);
        }
      }
    } catch (error) {
      console.error('[ARC3] Failed to fetch games:', error);
    } finally {
      setGamesLoading(false);
    }
  };

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const response = await apiRequest('GET', '/api/models');
      const data = await response.json();
      if (Array.isArray(data)) {
        setModels(data);
        // Set default model if available
        const defaultModel = data.find((m: ModelInfo) => m.key === 'gpt-5-nano-2025-08-07');
        if (defaultModel) {
          setModel(defaultModel.key);
        }
      }
    } catch (error) {
      console.error('[ARC3] Failed to fetch models:', error);
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchGameGrid = async (gameId: string) => {
    try {
      const response = await apiRequest('POST', '/api/arc3/start-game', { game_id: gameId });
      const data = await response.json();
      if (data.success && data.data?.frame) {
        setInitialGrid(data.data.frame);
      }
    } catch (error) {
      console.error('[ARC3] Failed to fetch game grid:', error);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchModels();
  }, []);

  // Agent config
  const [gameId, setGameId] = useState('ls20');
  const [agentName, setAgentName] = useState('ARC3 Explorer');
  const [model, setModel] = useState<string>('');
  const [maxTurns, setMaxTurns] = useState(10);
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [systemPrompt, setSystemPrompt] = useState(
    `You are playing a real ARC-AGI-3 game from the competition at https://three.arcprize.org/
Game rules:
- The game uses a grid-based interface with colors represented by integers 0-15
- Each action you take affects the game state and may change the grid
- Use inspect_game_state first to understand the current situation
- ACTION1-ACTION5 perform various game-specific actions
- ACTION6 requires coordinates [x, y] for targeted actions
- Your goal is to understand the game mechanics and achieve the objective
Strategy:
- Use inspect_game_state to observe the grid and understand patterns
- Experiment with different actions to learn the rules
- Track how the grid changes with each action
- Stop when you achieve WIN or when no useful actions remain
Return a concise summary of what you learned about the game mechanics and your final outcome.`
  );
  const [showSystemPrompt, setShowSystemPrompt] = useState(true);
  const [instructions, setInstructions] = useState(
    'Explore the game systematically. Inspect the game state and try different actions to learn the rules.'
  );
  const [userMessage, setUserMessage] = useState('');
  const [showUserInput, setShowUserInput] = useState(false);

  // Streaming
  const { state, start, cancel, setCurrentFrame, currentFrame, isPlaying } = useArc3AgentStream();

  const handleStart = () => {
    start({
      game_id: gameId,
      agentName,
      systemPrompt,
      instructions,
      model,
      maxTurns,
      reasoningEffort,
    });
  };

  // Show user input after max actions without win
  React.useEffect(() => {
    if (currentFrame && currentFrame.action_counter >= maxTurns && currentFrame.state !== 'WIN') {
      setShowUserInput(true);
    }
  }, [currentFrame, maxTurns]);

  const handleUserMessageSubmit = () => {
    console.log('User message:', userMessage);
    setUserMessage('');
    setShowUserInput(false);
  };

  // Filter reasoning entries
  const reasoningEntries = state.timeline.filter(entry => entry.type === 'reasoning');
  const toolEntries = state.timeline.filter(entry => entry.type === 'tool_call' || entry.type === 'tool_result');

  // Get available models (OpenAI only for ARC3 Agents SDK)
  const availableModels = models.filter((m: ModelInfo) => 
    m.provider === 'OpenAI' && 
    !m.key.startsWith('grover-') &&
    !m.color.includes('slate')
  );

  const resolveFrameLayers = (frameData: { frame: number[][][] } | null) => {
    if (!frameData) return null;
    return frameData.frame as number[][][];
  };

  const resolvedCurrentFrame = resolveFrameLayers(currentFrame);

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <div className="border-b px-3 py-1.5">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href="/arc3">
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Link>
            </Button>
            <Gamepad2 className="h-4 w-4" />
            <span className="text-sm font-semibold">ARC-AGI-3 Playground</span>
          </div>
          <Badge variant={state.status === 'running' ? 'default' : 'outline'} className="text-xs">
            {state.status}
          </Badge>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 max-w-[1800px] mx-auto">
        
        {/* LEFT: Ultra-compact controls */}
        <div className="lg:col-span-3 space-y-3">
          
          {/* Config */}
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

              {/* Max Actions - Smaller */}
              <div className="space-y-0.5">
                <label className="font-medium text-[10px]">Max Actions</label>
                <Input
                  type="number"
                  min="5"
                  max="24"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  disabled={isPlaying}
                  className="h-7 text-[11px]"
                />
              </div>

              {/* Start/Stop */}
              <div className="flex gap-1.5 pt-1">
                {!isPlaying ? (
                  <Button onClick={handleStart} size="sm" className="flex-1 h-7 text-[11px]">
                    <Play className="h-3 w-3 mr-1" />
                    Start
                  </Button>
                ) : (
                  <Button onClick={cancel} size="sm" variant="destructive" className="flex-1 h-7 text-[11px]">
                    <Square className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          {currentFrame && (
            <Card className="text-xs">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground text-[10px]">Score</p>
                    <p className="text-base font-bold">{currentFrame.score}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">Actions</p>
                    <p className="text-base font-bold">
                      {currentFrame.action_counter} / {currentFrame.max_actions}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-[10px]">State</p>
                    <Badge className="mt-0.5 text-[10px]" variant={currentFrame.state === 'WIN' ? 'default' : 'outline'}>
                      {currentFrame.state}
                    </Badge>
                  </div>
                </div>

                {state.usage && (
                  <div className="pt-1.5 border-t text-[10px]">
                    <p className="text-muted-foreground mb-1">Tokens</p>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <p className="text-muted-foreground text-[9px]">In</p>
                        <p className="font-mono text-[10px]">{(state.usage.inputTokens / 1000).toFixed(1)}k</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[9px]">Out</p>
                        <p className="font-mono text-[10px]">{(state.usage.outputTokens / 1000).toFixed(1)}k</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[9px]">Total</p>
                        <p className="font-mono text-[10px]">{(state.usage.totalTokens / 1000).toFixed(1)}k</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card className="text-xs">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-[10px]">
                {toolEntries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-3">No actions yet</p>
                ) : (
                  toolEntries.map((entry, idx) => (
                    <div key={idx} className="p-1.5 rounded border bg-muted/30">
                      <p className="font-medium text-[10px]">{entry.label}</p>
                      <pre className="text-[9px] text-muted-foreground mt-0.5 overflow-x-auto">
                        {entry.content.substring(0, 80)}...
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Message Injection */}
          {showUserInput && (
            <Card className="border-orange-500">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm text-orange-600">Inject Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                <p className="text-[10px] text-muted-foreground">
                  {maxTurns} actions without win. Add guidance:
                </p>
                <Textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  className="text-[11px] h-16 resize-none"
                  placeholder="Hint or instruction..."
                />
                <Button onClick={handleUserMessageSubmit} size="sm" className="w-full h-7 text-[10px]">
                  Send
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* CENTER: Game selector ABOVE grid */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Game Selector */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium whitespace-nowrap">Game:</label>
                {gamesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <Select 
                    value={gameId} 
                    onValueChange={(newGameId) => {
                      setGameId(newGameId);
                      fetchGameGrid(newGameId);
                    }} 
                    disabled={isPlaying}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue>
                        {games.find(g => g.game_id === gameId)?.title || gameId}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {games.map((game) => (
                        <SelectItem key={game.game_id} value={game.game_id} className="text-xs">
                          {game.title} ({game.game_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchGames}
                  className="h-7 w-7 p-0"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Grid */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  Game Grid
                </CardTitle>
                {currentFrame && (
                  <Badge variant={currentFrame.state === 'WIN' ? 'default' : 'outline'} className="text-[10px]">
                    {currentFrame.state}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {/* Show error if present */}
              {state.error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <p className="font-semibold">Error:</p>
                  <pre className="text-[10px] whitespace-pre-wrap mt-1">{state.error}</pre>
                </div>
              )}
              
              {resolvedCurrentFrame ? (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <Arc3GridVisualization
                      grid={resolvedCurrentFrame}
                      frameIndex={0}
                      cellSize={20}
                      showGrid={true}
                    />
                  </div>

                  {/* Frame Navigation */}
                  {state.frames.length > 1 && (
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium">
                        Frame: {state.currentFrameIndex + 1} / {state.frames.length}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={state.frames.length - 1}
                        value={state.currentFrameIndex}
                        onChange={(e) => setCurrentFrame(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Color Legend */}
                  <div className="grid grid-cols-5 gap-1 text-[9px]">
                    {[
                      { color: '#000000', name: '0' },
                      { color: '#0074D9', name: '1' },
                      { color: '#FF4136', name: '2' },
                      { color: '#2ECC40', name: '3' },
                      { color: '#FFDC00', name: '4' },
                      { color: '#AAAAAA', name: '5' },
                      { color: '#F012BE', name: '6' },
                      { color: '#FF851B', name: '7' },
                      { color: '#7FDBFF', name: '8' },
                      { color: '#870C25', name: '9' },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center gap-0.5">
                        <div 
                          className="w-2.5 h-2.5 border border-gray-300 rounded"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : initialGrid ? (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <Arc3GridVisualization
                      grid={initialGrid as number[][][]}
                      frameIndex={0}
                      cellSize={20}
                      showGrid={true}
                    />
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground">Initial state - press Start to begin</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Gamepad2 className="h-10 w-10 text-muted-foreground opacity-50 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {state.status === 'running' ? 'Waiting for game...' : gamesLoading ? 'Loading games...' : 'Select a game to see grid'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Streaming Reasoning */}
        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                Streaming Reasoning
                {isPlaying && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1.5 max-h-[calc(100vh-10rem)] overflow-y-auto text-[10px]">
                {reasoningEntries.length === 0 && !isPlaying ? (
                  <div className="text-center text-muted-foreground py-10">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No reasoning yet</p>
                    <p className="text-[10px]">Start agent to see reasoning</p>
                  </div>
                ) : (
                  <>
                    {reasoningEntries.map((entry, idx) => (
                      <div key={idx} className="p-2 rounded border bg-blue-50 dark:bg-blue-950">
                        <p className="font-medium text-[10px] text-blue-600 mb-0.5">
                          Step {idx + 1}
                        </p>
                        <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap">
                          {entry.content}
                        </pre>
                      </div>
                    ))}
                    
                    {isPlaying && (
                      <div className="p-2 border-l-2 border-blue-200 bg-blue-50 dark:bg-blue-950">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-[10px]">{state.streamingMessage || 'Thinking...'}</span>
                        </div>
                        {state.streamingReasoning && (
                          <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap mt-1">
                            {state.streamingReasoning}
                          </pre>
                        )}
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

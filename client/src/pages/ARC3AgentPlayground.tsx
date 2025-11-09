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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Gamepad2, Play, Square, Brain, Wrench, ArrowLeft, RefreshCw, Eye, EyeOff, HelpCircle } from 'lucide-react';
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

const normalizeAvailableActionName = (token: string | number | null | undefined): string | null => {
  if (token === null || token === undefined) {
    return null;
  }

  if (typeof token === 'number' && Number.isFinite(token)) {
    if (token === 0) {
      return 'RESET';
    }
    return `ACTION${token}`;
  }

  if (typeof token === 'string') {
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }

    const upper = trimmed.toUpperCase();
    const canonical = upper.replace(/[\s_-]+/g, '');

    if (canonical === 'RESET') {
      return 'RESET';
    }

    if (canonical.startsWith('ACTION')) {
      const suffix = canonical.slice(6);
      if (!suffix) {
        return null;
      }
      const parsed = parseInt(suffix, 10);
      if (Number.isNaN(parsed)) {
        return null;
      }
      if (parsed === 0) {
        return 'RESET';
      }
      return `ACTION${parsed}`;
    }

    if (/^\d+$/.test(canonical)) {
      const parsed = parseInt(canonical, 10);
      if (parsed === 0) {
        return 'RESET';
      }
      return `ACTION${parsed}`;
    }
  }

  return null;
};

export default function ARC3AgentPlayground() {
  // Auto-scroll ref for streaming panel
  const reasoningContainerRef = React.useRef<HTMLDivElement>(null);

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

  const fetchDefaultPrompt = async () => {
    try {
      const response = await apiRequest('GET', '/api/arc3/default-prompt');
      const data = await response.json();
      if (data.success && data.data?.prompt) {
        setSystemPrompt(data.data.prompt);
      }
    } catch (error) {
      console.error('[ARC3] Failed to fetch default prompt:', error);
      // Fall back to what we have
    }
  };

  const fetchGameGrid = async (gameId: string) => {
    try {
      const response = await apiRequest('POST', '/api/arc3/start-game', { game_id: gameId });
      const data = await response.json();
      if (data.success && data.data?.frame) {
        const frameData = data.data;
        console.log('[ARC3] Initial frame data from API:', frameData);
        console.log('[ARC3] Available actions from API:', frameData.available_actions);
        setInitialGrid(frameData.frame);

        // Initialize the hook state with the game session so manual actions work immediately
        initializeGameSession(frameData);
      }
    } catch (error) {
      console.error('[ARC3] Failed to fetch game grid:', error);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchModels();
    fetchDefaultPrompt();
  }, []);

  // Agent config
  const [gameId, setGameId] = useState('ls20');
  const [agentName, setAgentName] = useState('ARC3 Explorer');
  const [model, setModel] = useState<string>('');
  const [maxTurns, setMaxTurns] = useState(100);
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [systemPrompt, setSystemPrompt] = useState('Loading default prompt...');
  const [showSystemPrompt, setShowSystemPrompt] = useState(true);
  const [instructions, setInstructions] = useState(
    'Explore the game systematically. Inspect the game state and try different actions to learn the rules.'
  );
  const [userMessage, setUserMessage] = useState('');
  const [showUserInput, setShowUserInput] = useState(false);

  // Streaming
  const { state, start, cancel, continueWithMessage, executeManualAction, initializeGameSession, setCurrentFrame, isPlaying } = useArc3AgentStream();

  // Manual action state
  const [showCoordinatePicker, setShowCoordinatePicker] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

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

  // Show user input after agent pauses (at maxTurns) or completes
  React.useEffect(() => {
    if (state.status === 'paused' || (state.status === 'completed' && state.streamingStatus === 'completed')) {
      setShowUserInput(true);
    }
  }, [state.status, state.streamingStatus]);

  const handleUserMessageSubmit = async () => {
    if (!userMessage.trim()) return;

    try {
      await continueWithMessage(userMessage);
      setUserMessage('');
      setShowUserInput(false);
    } catch (error) {
      console.error('[ARC3] Failed to continue:', error);
    }
  };

  // Auto-scroll streaming panel to bottom when new content arrives
  React.useEffect(() => {
    if (reasoningContainerRef.current) {
      setTimeout(() => {
        if (reasoningContainerRef.current) {
          reasoningContainerRef.current.scrollTop = reasoningContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [state.timeline, state.streamingReasoning]);

  // Filter timeline entries by type
  const reasoningEntries = state.timeline.filter(entry => entry.type === 'reasoning');
  const assistantMessages = state.timeline.filter(entry => entry.type === 'assistant_message');
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

  // Compute currentFrame directly from state to ensure re-renders trigger updates
  const currentFrame = state.frames[state.currentFrameIndex] || null;
  const resolvedCurrentFrame = resolveFrameLayers(currentFrame);
  const normalizedAvailableActions = React.useMemo(() => {
    const tokens = currentFrame?.available_actions;
    if (!tokens || tokens.length === 0) {
      return null;
    }

    const normalized = new Set<string>();
    let fallbackAllowAll = false;

    for (const token of tokens) {
      const normalizedToken = normalizeAvailableActionName(token);
      if (normalizedToken) {
        normalized.add(normalizedToken);
      } else if (token !== null && token !== undefined) {
        fallbackAllowAll = true;
        break;
      }
    }

    return fallbackAllowAll ? null : normalized;
  }, [currentFrame]);

  return (
    <div className="min-h-screen bg-background">
      {/* Ultra-compact single-line header */}
      <div className="border-b px-3 py-1">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" asChild>
              <Link href="/arc3">
                <ArrowLeft className="h-2.5 w-2.5 mr-0.5" />
                Back
              </Link>
            </Button>
            <Gamepad2 className="h-3 w-3" />
            <span className="text-xs font-semibold">ARC3 Playground</span>
          </div>

          {/* Inline game selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Game:</span>
            {gamesLoading ? (
              <RefreshCw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
            ) : (
              <Select
                value={gameId}
                onValueChange={(newGameId) => {
                  setGameId(newGameId);
                  fetchGameGrid(newGameId);
                }}
                disabled={isPlaying}
              >
                <SelectTrigger className="h-6 text-[10px] min-w-[120px] py-0">
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
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-2.5 w-2.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelpModal(true)}
              className="h-6 w-6 p-0"
              title="Help & Guide"
            >
              <HelpCircle className="h-3 w-3" />
            </Button>
            <Badge variant={state.status === 'running' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
              {state.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 max-w-[1800px] mx-auto">

        {/* LEFT: Ultra-compact controls */}
        <div className="lg:col-span-3 space-y-3">

          {/* Config - Hidden when playing */}
          {!isPlaying && (
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

              {/* Max Turns - Unlimited */}
              <div className="space-y-0.5">
                <label className="font-medium text-[10px]">Max Turns</label>
                <Input
                  type="number"
                  min="1"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  disabled={isPlaying}
                  className="h-7 text-[11px]"
                  placeholder="100 (default)"
                />
                <p className="text-[9px] text-muted-foreground">Agent loop iterations (not tool calls)</p>
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
          )}

          {/* User Message Injection - shown when agent completes */}
          {showUserInput && (
            <Card className="border-orange-500">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm text-orange-600">Send Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                <p className="text-[10px] text-muted-foreground">
                  Chain your message to the agent for continued exploration:
                </p>
                <Textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  className="text-[11px] h-20 resize-none"
                  placeholder="Send new guidance or observation..."
                />
                <Button onClick={handleUserMessageSubmit} size="sm" className="w-full h-7 text-[10px]">
                  Send
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card className="text-xs">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Actions
                {isPlaying && state.streamingMessage?.includes('called') && (
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                    <span className="text-[9px] text-blue-600">Calling ARC3 API...</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-[10px]">
                {toolEntries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-3">No actions yet</p>
                ) : (
                  toolEntries.map((entry, idx) => (
                    <div key={idx} className={`p-1.5 rounded border ${
                      idx === toolEntries.length - 1 && isPlaying && state.streamingMessage?.includes('called')
                        ? 'bg-blue-50 border-blue-300 animate-pulse'
                        : 'bg-muted/30'
                    }`}>
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
        </div>

        {/* CENTER: Action pills now occupy former game selector spot */}
        <div className="lg:col-span-5 space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6', 'ACTION7'].map((actionName) => {
                  const usedCount = toolEntries.filter(e => e.label.includes(actionName)).length;
                  const isActive = isPlaying && state.streamingMessage?.includes(actionName);
                  const displayName = actionName.replace('ACTION', 'Action ');

                  // Check if action is available according to the API
                  const isAvailable = !normalizedAvailableActions || normalizedAvailableActions.has(actionName);

                  const handleActionClick = async () => {
                    if (actionName === 'ACTION6') {
                      setShowCoordinatePicker(true);
                    } else {
                      try {
                        await executeManualAction(actionName);
                      } catch (error) {
                        console.error(`Failed to execute ${actionName}:`, error);
                      }
                    }
                  };

                  const isDisabled = !state.gameGuid || !state.gameId || !isAvailable;

                  return (
                    <button
                      key={actionName}
                      onClick={handleActionClick}
                      disabled={isDisabled}
                      title={!isAvailable ? `${actionName} is not available in this game state` : `Execute ${actionName}`}
                      className={`px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all shadow-sm ${
                        isActive
                          ? 'bg-green-500 text-white animate-pulse shadow-lg'
                          : !isAvailable
                          ? 'bg-red-50 text-red-400 border border-red-200 opacity-60 cursor-not-allowed'
                          : usedCount > 0
                          ? 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 cursor-pointer'
                          : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 cursor-pointer'
                      } ${isDisabled && isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {displayName}
                      {usedCount > 0 && <span className="ml-1 text-[10px] sm:text-[11px]">×{usedCount}</span>}
                    </button>
                  );
                })}
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
                      lastAction={currentFrame?.action}
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

        {/* RIGHT: Streaming Reasoning - Auto-advance, larger text */}
        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-base font-bold flex items-center gap-1.5">
                <Brain className="h-4 w-4" />
                Agent Reasoning
                {isPlaying && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div ref={reasoningContainerRef} className="space-y-2 max-h-[calc(100vh-10rem)] overflow-y-auto text-sm">
                {reasoningEntries.length === 0 && assistantMessages.length === 0 && !isPlaying ? (
                  <div className="text-center text-muted-foreground py-10">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No reasoning yet</p>
                    <p className="text-[10px]">Start agent to see reasoning</p>
                  </div>
                ) : (
                  <>
                    {/* Display all entries in chronological order */}
                    {state.timeline
                      .filter(entry => entry.type === 'reasoning' || entry.type === 'assistant_message')
                      .map((entry, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border-l-4 ${
                            entry.type === 'reasoning'
                              ? 'bg-blue-50 dark:bg-blue-950 border-l-blue-500 border-r border-t border-b border-blue-200'
                              : 'bg-green-50 dark:bg-green-950 border-l-green-500 border-r border-t border-b border-green-200'
                          }`}
                        >
                          <p className={`font-bold text-sm mb-1 ${
                            entry.type === 'reasoning' ? 'text-blue-700' : 'text-green-700'
                          }`}>
                            {entry.label}
                          </p>
                          <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {entry.content}
                          </pre>
                        </div>
                      ))}

                    {isPlaying && (
                      <div className="p-3 rounded-lg border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950 border-r border-t border-b border-blue-200 animate-pulse">
                        <div className="flex items-center gap-2 text-blue-700 mb-2 font-bold text-sm">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span>{state.streamingMessage || 'Agent thinking...'}</span>
                        </div>
                        {state.streamingReasoning && (
                          <pre className="text-sm text-foreground whitespace-pre-wrap font-mono mt-2 leading-relaxed">
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

      {/* ACTION6 Coordinate Picker Dialog */}
      <Dialog open={showCoordinatePicker} onOpenChange={setShowCoordinatePicker}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Action 6: Select Coordinates</DialogTitle>
            <DialogDescription>
              Click on any cell in the grid to execute ACTION6 at that position
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-4">
            {resolvedCurrentFrame && (
              <div className="relative inline-block">
                <Arc3GridVisualization
                  grid={resolvedCurrentFrame}
                  frameIndex={0}
                  cellSize={20}
                  showGrid={true}
                  lastAction={currentFrame?.action}
                />
                {/* Clickable overlay */}
                <div
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${resolvedCurrentFrame[0]?.length || 64}, 1fr)`,
                    gridTemplateRows: `repeat(${resolvedCurrentFrame.length || 64}, 1fr)`,
                  }}
                >
                  {Array.from({ length: resolvedCurrentFrame.length || 64 }).map((_, row) =>
                    Array.from({ length: resolvedCurrentFrame[0]?.length || 64 }).map((_, col) => (
                      <button
                        key={`${col}-${row}`}
                        onClick={async () => {
                          try {
                            await executeManualAction('ACTION6', [col, row]);
                            setShowCoordinatePicker(false);
                          } catch (error) {
                            console.error('Failed to execute ACTION6:', error);
                          }
                        }}
                        className="hover:bg-white/30 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                        title={`Execute ACTION6 at (${col}, ${row}) [x=${col}, y=${row}]`}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCoordinatePicker(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help/Guide Modal */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              ARC3 Playground Guide
            </DialogTitle>
            <DialogDescription>
              Learn how to use the playground to train and optimize AI agents for ARC-AGI-3 challenges
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* What is this? */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">🎮 What is the ARC3 Playground?</h3>
              <p className="text-sm text-muted-foreground">
                The ARC3 Playground is an interactive environment where you can train AI agents to solve
                ARC-AGI-3 puzzles. ARC-AGI-3 is a benchmark test for artificial general intelligence that
                challenges AI systems to learn and apply abstract reasoning skills.
              </p>
            </div>

            {/* The Goal */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">🎯 Your Goal</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Craft the best possible prompts to help your agent succeed!</strong> Your task is to:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li><strong>System Prompt</strong>: Define the agent's core behavior, reasoning approach, and capabilities</li>
                <li><strong>Instructions (User Prompt)</strong>: Provide specific guidance for solving the current puzzle</li>
                <li><strong>Model Selection</strong>: Choose the AI model that best fits the task complexity and your needs</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                The better your prompts, the more effective your agent will be at understanding patterns,
                making logical deductions, and solving puzzles!
              </p>
            </div>

            {/* How to Use */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">🚀 How to Use</h3>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 ml-2">
                <li>
                  <strong>Select a Game</strong>: Choose an ARC-AGI-3 puzzle from the dropdown
                </li>
                <li>
                  <strong>Configure Your Agent</strong>:
                  <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                    <li>Write a system prompt that defines how the agent thinks and reasons</li>
                    <li>Provide specific instructions for the current puzzle</li>
                    <li>Select an AI model (reasoning models work best for complex puzzles)</li>
                    <li>Set max turns to limit agent actions (default: 100)</li>
                  </ul>
                </li>
                <li>
                  <strong>Run the Agent</strong>: Click "Start Agent" and watch it attempt the puzzle
                </li>
                <li>
                  <strong>Manual Control</strong>: Click action pills (ACTION1-7) to manually execute actions
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>Click ACTION6 to open a grid picker for coordinate-based actions</li>
                  </ul>
                </li>
                <li>
                  <strong>Iterate & Improve</strong>: Analyze the agent's reasoning and adjust your prompts to improve performance
                </li>
              </ol>
            </div>

            {/* Understanding Actions */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">🎬 Action Pills</h3>
              <p className="text-sm text-muted-foreground">
                Action pills show the agent's available actions and their usage:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li><span className="text-green-600 font-semibold">Green (pulsing)</span>: Currently executing</li>
                <li><span className="text-blue-600 font-semibold">Blue</span>: Already used (shows count)</li>
                <li><span className="text-gray-600 font-semibold">Gray</span>: Available but not yet used</li>
                <li><span className="text-red-600 font-semibold">Red (strikethrough)</span>: Not available in current game state</li>
              </ul>
            </div>

            {/* Pro Tips */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">💡 Pro Tips</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Use <strong>reasoning models</strong> (like GPT-4.5 or o1) for better abstract thinking</li>
                <li>Write clear, specific instructions that explain what patterns to look for</li>
                <li>Encourage the agent to <strong>reason step-by-step</strong> before taking actions</li>
                <li>Use the <strong>system prompt</strong> to define problem-solving strategies</li>
                <li>Watch the reasoning panel to understand how the agent thinks</li>
                <li>Try <strong>hybrid mode</strong>: let the agent explore, then manually guide it when stuck</li>
              </ul>
            </div>

            {/* Example Prompts */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">📝 Example Prompt Strategy</h3>
              <div className="bg-muted p-3 rounded-md text-xs font-mono space-y-2">
                <div>
                  <div className="text-foreground font-semibold mb-1">System Prompt:</div>
                  <div className="text-muted-foreground">
                    "You are an expert pattern recognition system. Always analyze the game state carefully,
                    identify repeating patterns, and reason through cause-and-effect relationships before
                    taking actions. Think step-by-step and explain your reasoning."
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-foreground font-semibold mb-1">Instructions:</div>
                  <div className="text-muted-foreground">
                    "Explore the puzzle systematically. Try each action type to understand what they do.
                    Look for patterns in how the grid changes. Once you understand the rules, use that
                    knowledge to reach the win condition."
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={() => setShowHelpModal(false)}>
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

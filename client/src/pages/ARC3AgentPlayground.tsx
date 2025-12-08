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
import { Gamepad2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { useArc3AgentStream } from '@/hooks/useArc3AgentStream';
import { Arc3ReasoningViewer } from '@/components/arc3/Arc3ReasoningViewer';
import { Arc3ToolTimeline } from '@/components/arc3/Arc3ToolTimeline';
import { Arc3GamePanel } from '@/components/arc3/Arc3GamePanel';
import { Arc3ConfigurationPanel } from '@/components/arc3/Arc3ConfigurationPanel';
import { apiRequest } from '@/lib/queryClient';
import { usePageMeta } from '@/hooks/usePageMeta';

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

// Normalize available_actions tokens from the API
// API can send: integers (0=RESET, 1-7=ACTION1-7) or strings ('RESET', 'ACTION1', etc)
const normalizeAvailableActionName = (token: string | number | null | undefined): string | null => {
  if (token === null || token === undefined) {
    return null;
  }

  // Handle numeric tokens: 0 = RESET, 1-7 = ACTION1-ACTION7
  if (typeof token === 'number' && Number.isFinite(token)) {
    if (token === 0) {
      return 'RESET';
    }
    if (token >= 1 && token <= 7) {
      return `ACTION${token}`;
    }
    console.warn('[ARC3] Unexpected numeric action token:', token);
    return null;
  }

  // Handle string tokens
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
      if (parsed >= 1 && parsed <= 7) {
        return `ACTION${parsed}`;
      }
      console.warn('[ARC3] Unexpected ACTION number in string:', parsed);
      return null;
    }

    if (/^\d+$/.test(canonical)) {
      const parsed = parseInt(canonical, 10);
      if (parsed === 0) {
        return 'RESET';
      }
      if (parsed >= 1 && parsed <= 7) {
        return `ACTION${parsed}`;
      }
      console.warn('[ARC3] Unexpected numeric string token:', parsed);
      return null;
    }
  }

  return null;
};

export default function ARC3AgentPlayground() {
  usePageMeta({
    title: 'ARC Explainer – ARC3 Agent Playground',
    description:
      'Watch real ARC-AGI-3 agents explore interactive games, stream reasoning traces, and inspect grid state transitions.',
    canonicalPath: '/arc3/playground',
  });

  // URL state management for game selection
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const urlGameId = React.useMemo(() => {
    const params = new URLSearchParams(searchParams);
    return params.get('game') || 'ls20';  // Default to ls20 if no game param
  }, [searchParams]);

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
        // Auto-load game from URL or default to ls20
        if (data.data.length > 0) {
          const targetGame = data.data.find((g: GameInfo) => g.game_id === urlGameId) || data.data[0];
          setGameId(targetGame.game_id);
          await fetchGameGrid(targetGame.game_id);
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
  const [gameId, setGameId] = useState(urlGameId);  // Initialize from URL param
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
  const { state, start, cancel, continueWithMessage, executeManualAction, initializeGameSession, setCurrentFrame, isPlaying, isPendingManualAction } = useArc3AgentStream();

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

  // Filter timeline entries by type
  const toolEntries = state.timeline.filter(entry => entry.type === 'tool_call' || entry.type === 'tool_result');

  // Get available models (OpenAI only for ARC3 Agents SDK)
  const availableModels = models.filter((m: ModelInfo) => 
    m.provider === 'OpenAI' && 
    !m.key.startsWith('grover-') &&
    !m.color.includes('slate')
  );

  // Compute currentFrame directly from state to ensure re-renders trigger updates
  const currentFrame = state.frames[state.currentFrameIndex] || null;

  // Normalize available_actions from the API
  // API returns integers [1, 2, 3, 4, 5, 6] but we use strings like 'ACTION1', 'ACTION2'
  const normalizedAvailableActions = React.useMemo(() => {
    const tokens = currentFrame?.available_actions;

    // If no available_actions field or empty array, allow all actions (no restrictions)
    if (!tokens || tokens.length === 0) {
      console.log('[ARC3] No action restrictions (available_actions is empty or missing)');
      return null;
    }

    const normalized = new Set<string>();
    let fallbackAllowAll = false;

    for (const token of tokens) {
      const normalizedToken = normalizeAvailableActionName(token);
      if (normalizedToken) {
        normalized.add(normalizedToken);
      } else if (token !== null && token !== undefined) {
        // If we encounter an unexpected token format, log it and allow all actions
        console.warn('[ARC3] Unexpected action token format:', token);
        fallbackAllowAll = true;
        break;
      }
    }

    const result = fallbackAllowAll ? null : normalized;
    console.log('[ARC3] Available actions:', {
      raw: tokens,
      normalized: result ? Array.from(result) : 'ALL',
    });

    return result;
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
                  // Update URL to reflect game selection
                  setLocation(`/arc3/playground?game=${newGameId}`);
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

          <Badge variant={state.status === 'running' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
            {state.status}
          </Badge>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 max-w-[1800px] mx-auto">

        {/* LEFT: Ultra-compact controls */}
        <div className="lg:col-span-3 space-y-3">

          {/* Config - Hidden when playing */}
          {!isPlaying && (
            <Arc3ConfigurationPanel
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              instructions={instructions}
              setInstructions={setInstructions}
              model={model}
              setModel={setModel}
              reasoningEffort={reasoningEffort}
              setReasoningEffort={setReasoningEffort}
              maxTurns={maxTurns}
              setMaxTurns={setMaxTurns}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              isPlaying={isPlaying}
              onStart={handleStart}
              onCancel={cancel}
            />
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
          <Arc3ToolTimeline
            entries={toolEntries}
            isPlaying={isPlaying}
            streamingMessage={state.streamingMessage}
          />
        </div>

        {/* CENTER: Game Panel (grid + actions + navigation) */}
        <div className="lg:col-span-5">
          <Arc3GamePanel
            currentFrame={currentFrame}
            frames={state.frames}
            currentFrameIndex={state.currentFrameIndex}
            executeManualAction={executeManualAction}
            isPendingManualAction={isPendingManualAction}
            isPlaying={isPlaying}
            streamingMessage={state.streamingMessage}
            toolEntries={toolEntries}
            gameGuid={state.gameGuid}
            gameId={state.gameId}
            error={state.error}
            setCurrentFrame={setCurrentFrame}
            normalizedAvailableActions={normalizedAvailableActions}
          />
        </div>

        {/* RIGHT: Streaming Reasoning - Auto-advance, larger text */}
        <div className="lg:col-span-4">
          <Arc3ReasoningViewer
            timeline={state.timeline}
            isPlaying={isPlaying}
            streamingMessage={state.streamingMessage}
            streamingReasoning={state.streamingReasoning}
          />
        </div>
      </div>
    </div>
  );
}

/*
Author: Cascade
Date: 2026-01-03
Updated: 2026-01-03 - Locked config/system prompt when run starts (align with main playground), dynamic models, BYOK handling
PURPOSE: OpenRouter-specific ARC3 Agent Playground using LangGraph Python runner.
         Routes to /api/arc3-openrouter backend (Python subprocess).
         Uses dynamic model list from project's OpenRouter catalog (not hardcoded).
         BYOK: OpenRouter API key required in production.
SRP/DRY check: Pass — mirrors Arc3AgentPlayground, only changes provider filtering to OpenRouter.
*/

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Gamepad2, ArrowLeft, RefreshCw, Key, Zap, Coins, AlertCircle, Loader2 } from 'lucide-react';
import { requiresUserApiKey } from '@/lib/environmentPolicy';
import { Link, useLocation, useSearch } from 'wouter';
import { useArc3AgentStream } from '@/hooks/useArc3AgentStream';
import { useOpenRouterCredits, formatCredits } from '@/hooks/useOpenRouterCredits';
import { Arc3ReasoningViewer } from '@/components/arc3/Arc3ReasoningViewer';
import { Arc3ToolTimeline } from '@/components/arc3/Arc3ToolTimeline';
import { Arc3GamePanel } from '@/components/arc3/Arc3GamePanel';
import { Arc3ConfigurationPanel } from '@/components/arc3/Arc3ConfigurationPanel';
import { Arc3AgentControls } from '@/components/arc3/Arc3AgentControls';
import { Arc3AgentVisionPreview } from '@/components/arc3/Arc3AgentVisionPreview';
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

interface Arc3SystemPromptPresetMeta {
  id: 'twitch' | 'playbook' | 'none';
  label: string;
  description: string;
  isDefault: boolean;
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
    console.warn('[OpenRouter] Unexpected numeric action token:', token);
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
      console.warn('[OpenRouter] Unexpected ACTION number in string:', parsed);
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
      console.warn('[OpenRouter] Unexpected numeric string token:', parsed);
      return null;
    }
  }

  return null;
};

export default function Arc3OpenRouterPlayground() {
  usePageMeta({
    title: 'ARC Explainer – OpenRouter Playground',
    description:
      'Watch ARC-AGI-3 agents explore interactive games using OpenRouter models, stream reasoning traces, and inspect grid state transitions.',
    canonicalPath: '/arc3/openrouter-playground',
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
      console.error('[OpenRouter] Failed to fetch games:', error);
    } finally {
      setGamesLoading(false);
    }
  };

  const [systemPromptPresets, setSystemPromptPresets] = useState<Arc3SystemPromptPresetMeta[]>([]);
  const [systemPromptPresetId, setSystemPromptPresetId] = useState<'twitch' | 'playbook' | 'none'>('playbook');

  const fetchSystemPromptPresets = async () => {
    try {
      const response = await apiRequest('GET', '/api/arc3/system-prompts');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const presets = result.data as Arc3SystemPromptPresetMeta[];
        setSystemPromptPresets(presets);

        const defaultPreset = presets.find((p) => p.isDefault) || presets.find((p) => p.id === 'playbook');
        if (defaultPreset) {
          setSystemPromptPresetId(defaultPreset.id);
        }
      }
    } catch (error) {
      console.error('[OpenRouter] Failed to fetch system prompt presets:', error);
    }
  };

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const response = await apiRequest('GET', '/api/models');
      const data = await response.json();
      if (Array.isArray(data)) {
        setModels(data);
        // Set default model: explicitly prefer xiaomi/mimo-v2-flash:free
        const openRouterModels = data.filter((m: ModelInfo) => m.provider === 'OpenRouter');
        const defaultModel = openRouterModels.find((m: ModelInfo) => m.key === 'xiaomi/mimo-v2-flash:free') ||
                            openRouterModels.find((m: ModelInfo) => m.key.includes(':free')) ||
                            openRouterModels[0];
        if (defaultModel) {
          setModel(defaultModel.key);
        }
      }
    } catch (error) {
      console.error('[OpenRouter] Failed to fetch models:', error);
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
      console.error('[OpenRouter] Failed to fetch default prompt:', error);
      // Fall back to what we have
    }
  };

  const fetchGameGrid = async (gameId: string) => {
    try {
      const response = await apiRequest('POST', '/api/arc3/start-game', { game_id: gameId });
      const data = await response.json();
      if (data.success && data.data?.frame) {
        const frameData = data.data;
        console.log('[OpenRouter] Initial frame data from API:', frameData);
        console.log('[OpenRouter] Available actions from API:', frameData.available_actions);
        setInitialGrid(frameData.frame);

        // Initialize the hook state with the game session so manual actions work immediately
        initializeGameSession(frameData);
      }
    } catch (error) {
      console.error('[OpenRouter] Failed to fetch game grid:', error);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchModels();
    fetchDefaultPrompt();
    fetchSystemPromptPresets();
  }, []);

  // When the preset changes, update the System Prompt textarea from backend templates.
  useEffect(() => {
    if (systemPromptPresetId === 'none') {
      setSystemPrompt('');
      return;
    }

    const loadPresetBody = async () => {
      try {
        const response = await apiRequest('GET', `/api/arc3/system-prompts/${systemPromptPresetId}`);
        const result = await response.json();
        if (result.success && result.data?.body && typeof result.data.body === 'string') {
          setSystemPrompt(result.data.body);
        }
      } catch (error) {
        console.error('[OpenRouter] Failed to load system prompt preset body:', error);
      }
    };

    loadPresetBody();
  }, [systemPromptPresetId]);

  // Agent config
  const [gameId, setGameId] = useState(urlGameId);  // Initialize from URL param
  const [agentName, setAgentName] = useState('OpenRouter Explorer');
  const [model, setModel] = useState<string>('');
  const [maxTurns, setMaxTurns] = useState(80);  // Max 500 per OpenRouter route validation
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [systemPrompt, setSystemPrompt] = useState('Loading default prompt...');
  const [instructions, setInstructions] = useState(
    'Explore the game systematically. Inspect the game state and try different actions to learn the rules.'
  );
  const [userMessage, setUserMessage] = useState('');
  const [showUserInput, setShowUserInput] = useState(false);
  // BYOK: API key state for production environment
  const [userApiKey, setUserApiKey] = useState('');
  const byokRequired = requiresUserApiKey();

  // Credits monitor - tries server env key first, falls back to user-provided key
  const [serverCreditsLoading, setServerCreditsLoading] = useState(true);
  const [serverCredits, setServerCredits] = useState<typeof credits | null>(null);
  const [creditsSource, setCreditsSource] = useState<'server' | 'user' | 'none'>('none');

  // Fetch credits from server env key on mount
  useEffect(() => {
    const fetchServerCredits = async () => {
      try {
        setServerCreditsLoading(true);
        const response = await apiRequest('GET', '/api/arc3-openrouter/credits-env');
        const data = await response.json();
        if (data.success && data.data) {
          setServerCredits(data.data);
          setCreditsSource('server');
        }
      } catch (error) {
        // No server key configured - that's OK, user can provide their own
        setServerCredits(null);
      } finally {
        setServerCreditsLoading(false);
      }
    };
    fetchServerCredits();
  }, []);

  // Credits monitor - polls OpenRouter for user-provided key (fallback)
  const { credits: userCredits, isLoading: userCreditsLoading, error: userCreditsError, refetch: refetchCredits } = useOpenRouterCredits({
    apiKey: userApiKey,
    pollInterval: 15000, // Poll every 15s during active use
    enabled: Boolean(userApiKey.trim() && !serverCredits), // Only if no server credits
  });

  // Use server credits if available, otherwise user credits
  const credits = serverCredits || userCredits;
  const creditsLoading = serverCreditsLoading || userCreditsLoading;
  const creditsError = userCreditsError;

  // Streaming
  const { state, start, cancel, continueWithMessage, executeManualAction, initializeGameSession, setCurrentFrame, isPlaying, isPendingManualAction } = useArc3AgentStream();

  // Treat starting/running/streaming as "active" to hide config/system prompt consistently.
  const isActiveSession =
    state.streamingStatus === 'starting' ||
    state.streamingStatus === 'in_progress' ||
    state.status === 'running';

  const handleStart = () => {
    // BYOK: Block start if key required but not provided
    if (byokRequired && !userApiKey.trim()) {
      alert('OpenRouter API key is required in production. Please enter your OpenRouter API key.');
      return;
    }

    const skipDefaultSystemPrompt = systemPromptPresetId === 'none';

    // Reset user input visibility (prevent showing "send message" during run)
    setShowUserInput(false);
    setUserMessage('');

    start({
      game_id: gameId,
      agentName,
      systemPrompt,
      instructions,
      model,
      maxTurns,
      reasoningEffort,
      systemPromptPresetId,
      skipDefaultSystemPrompt,
      provider: 'openrouter',  // Routes to /api/arc3-openrouter backend
      // BYOK: Pass user API key if provided (required in production)
      ...(userApiKey.trim() ? { apiKey: userApiKey.trim() } : {}),
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
      console.error('[OpenRouter] Failed to continue:', error);
    }
  };

  // Filter timeline entries by type
  const toolEntries = state.timeline.filter(entry => entry.type === 'tool_call' || entry.type === 'tool_result');

  // Extract latest frameImage from inspect_game_state tool results
  const latestFrameImage = React.useMemo(() => {
    const inspectResults = state.timeline
      .filter(entry => entry.type === 'tool_result' && entry.label.includes('inspect_game_state'))
      .reverse(); // Get most recent first

    for (const result of inspectResults) {
      try {
        const parsed = JSON.parse(result.content);
        if (parsed.frameImage && typeof parsed.frameImage === 'string') {
          return parsed.frameImage;
        }
      } catch {
        // Ignore parsing errors
      }
    }
    return null;
  }, [state.timeline]);

  // Get available models (OpenRouter only for this playground)
  const availableModels = models.filter((m: ModelInfo) => 
    m.provider === 'OpenRouter'
  );

  // Compute currentFrame directly from state to ensure re-renders trigger updates
  const currentFrame = state.frames[state.currentFrameIndex] || null;

  // Normalize available_actions from the API
  // API returns integers [1, 2, 3, 4, 5, 6] but we use strings like 'ACTION1', 'ACTION2'
  const normalizedAvailableActions = React.useMemo(() => {
    const tokens = currentFrame?.available_actions;

    // If no available_actions field or empty array, allow all actions (no restrictions)
    if (!tokens || tokens.length === 0) {
      console.log('[OpenRouter] No action restrictions (available_actions is empty or missing)');
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
        console.warn('[OpenRouter] Unexpected action token format:', token);
        fallbackAllowAll = true;
        break;
      }
    }

    const result = fallbackAllowAll ? null : normalized;
    console.log('[OpenRouter] Available actions:', {
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
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-semibold">OpenRouter Playground</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-600">
              LangGraph
            </Badge>
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
                  setLocation(`/arc3/openrouter-playground?game=${newGameId}`);
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
            {/* Credits Monitor - shows when available (server env key or user-provided key) */}
            {(credits || creditsLoading) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                      {creditsLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                      ) : creditsError ? (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      ) : (
                        <Coins className="h-3 w-3 text-amber-600" />
                      )}
                      <span className="text-[10px] font-medium text-amber-800">
                        {creditsError ? (
                          'Error'
                        ) : credits ? (
                          credits.remaining !== null ? (
                            `${formatCredits(credits.remaining)} remaining`
                          ) : (
                            `${formatCredits(credits.usage)} used`
                          )
                        ) : (
                          'Loading...'
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); refetchCredits(); }}
                        className="h-4 w-4 p-0 ml-0.5 hover:bg-amber-100"
                        disabled={creditsLoading}
                      >
                        <RefreshCw className={`h-2.5 w-2.5 text-amber-600 ${creditsLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {creditsError ? (
                      <span className="text-red-600">{creditsError}</span>
                    ) : credits ? (
                      <div className="space-y-1">
                        <div><strong>Label:</strong> {credits.label}</div>
                        <div><strong>Used:</strong> {formatCredits(credits.usage)}</div>
                        <div><strong>Limit:</strong> {credits.limit !== null ? formatCredits(credits.limit) : 'Unlimited'}</div>
                        {credits.remaining !== null && (
                          <div><strong>Remaining:</strong> {formatCredits(credits.remaining)}</div>
                        )}
                        <div><strong>Free Tier:</strong> {credits.isFreeTier ? 'Yes' : 'No'}</div>
                        <div className="text-[9px] pt-2 border-t text-muted-foreground">
                          {creditsSource === 'server' ? 'Server API Key' : 'User-provided Key'}
                        </div>
                      </div>
                    ) : null}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

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

          {/* BYOK: API Key Input - Only shown in production */}
          {byokRequired && !isActiveSession && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-sm text-amber-900 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5" />
                      OpenRouter API Key
                    </CardTitle>
                    <CardDescription className="text-xs mt-1 text-amber-700">
                      Your key is used for this session only and is never stored.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide border-amber-300 text-amber-700">
                    BYOK
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor="openrouter-api-key" className="sr-only">OpenRouter API Key</Label>
                    <Input
                      id="openrouter-api-key"
                      type="password"
                      placeholder="sk-or-v1-..."
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      className="font-mono text-xs h-8"
                    />
                  </div>
                  {userApiKey.trim() && (
                    <span className="text-[10px] text-green-600 font-medium whitespace-nowrap">Key provided</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Config - Hidden when playing */}
          {!isActiveSession && (
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
              systemPromptPresetId={systemPromptPresetId}
              setSystemPromptPresetId={setSystemPromptPresetId}
              systemPromptPresets={systemPromptPresets}
              onStart={handleStart}
              onCancel={cancel}
            />
          )}

          {/* User Message Injection - shown when agent completes */}
          {showUserInput && (
            <Arc3AgentControls
              userMessage={userMessage}
              setUserMessage={setUserMessage}
              onSubmit={handleUserMessageSubmit}
            />
          )}

          {/* Actions */}
          <Arc3ToolTimeline
            entries={toolEntries}
            isPlaying={isPlaying}
            streamingMessage={state.streamingMessage}
          />
        </div>

        {/* CENTER: Game Panel (grid + actions + navigation) */}
        <div className="lg:col-span-5 space-y-3">
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

          {/* Agent Vision Preview - shows base64 image the agent sees */}
          <Arc3AgentVisionPreview frameImage={latestFrameImage} />
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

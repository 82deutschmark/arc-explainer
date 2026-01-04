/*
Author: Claude Sonnet 4
Date: 2026-01-03
PURPOSE: Haiku 4.5 ARC3 Agent Playground - Vision-first, child-like learning.
         Routes to /api/arc3-haiku backend (Python subprocess).
         BYOK: Anthropic API key required in production.
         
         Philosophy: Haiku SEES, THINKS, ACTS, OBSERVES, LEARNS.
         UI shows: Game state, Haiku's descriptions, hypotheses, and learned observations.
SRP/DRY check: Pass — mirrors Arc3OpenRouterPlayground, adapted for Haiku vision-first approach.
*/

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, ArrowLeft, RefreshCw, Key, Eye, Brain, Lightbulb, BookOpen } from 'lucide-react';
import { requiresUserApiKey } from '@/lib/environmentPolicy';
import { Link, useLocation, useSearch } from 'wouter';
import { Arc3ReasoningViewer } from '@/components/arc3/Arc3ReasoningViewer';
import { Arc3ToolTimeline } from '@/components/arc3/Arc3ToolTimeline';
import { Arc3GamePanel } from '@/components/arc3/Arc3GamePanel';
import { Arc3ObservationsList } from '@/components/arc3/Arc3ObservationsList';
import { Arc3ScorecardLink } from '@/components/arc3/Arc3ScorecardLink';
import { apiRequest } from '@/lib/queryClient';
import { usePageMeta } from '@/hooks/usePageMeta';

interface GameInfo {
  game_id: string;
  title: string;
}

interface HaikuStreamState {
  status: 'idle' | 'starting' | 'running' | 'paused' | 'completed' | 'error';
  streamingStatus: 'idle' | 'starting' | 'in_progress' | 'completed' | 'error';
  streamingMessage: string;
  streamingReasoning: string;
  error: string | null;
  gameId: string;
  gameGuid: string;
  frames: any[];
  currentFrameIndex: number;
  timeline: any[];
  observations: string[];
  descriptions: string[];
  hypotheses: string[];
  turn: number;
  score: number;
  scorecard?: {
    card_id: string;
    url: string;
  };
}

const initialState: HaikuStreamState = {
  status: 'idle',
  streamingStatus: 'idle',
  streamingMessage: '',
  streamingReasoning: '',
  error: null,
  gameId: '',
  gameGuid: '',
  frames: [],
  currentFrameIndex: 0,
  timeline: [],
  observations: [],
  descriptions: [],
  hypotheses: [],
  turn: 0,
  score: 0,
};

export default function Arc3HaikuPlayground() {
  usePageMeta({
    title: 'ARC Explainer – Haiku 4.5 Playground',
    description:
      'Watch Haiku 4.5 learn ARC-AGI-3 games through vision-first observation, forming hypotheses and learning from experience like a curious child.',
    canonicalPath: '/arc3/haiku-playground',
  });

  // URL state management
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const urlGameId = React.useMemo(() => {
    const params = new URLSearchParams(searchParams);
    return params.get('game') || 'ls20';
  }, [searchParams]);

  // Fetch games
  const [games, setGames] = useState<GameInfo[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [initialGrid, setInitialGrid] = useState<number[][][] | null>(null);

  const fetchGames = async () => {
    setGamesLoading(true);
    try {
      const response = await apiRequest('GET', '/api/arc3/games');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setGames(data.data);
        if (data.data.length > 0) {
          const targetGame = data.data.find((g: GameInfo) => g.game_id === urlGameId) || data.data[0];
          setGameId(targetGame.game_id);
          await fetchGameGrid(targetGame.game_id);
        }
      }
    } catch (error) {
      console.error('[Haiku] Failed to fetch games:', error);
    } finally {
      setGamesLoading(false);
    }
  };

  const fetchGameGrid = async (gameId: string) => {
    try {
      const response = await apiRequest('POST', '/api/arc3/start-game', { game_id: gameId });
      const data = await response.json();
      if (data.success && data.data?.frame) {
        setInitialGrid(data.data.frame);
        setState(prev => ({
          ...prev,
          frames: [data.data],
          currentFrameIndex: 0,
          gameGuid: data.data.guid || '',
          gameId: gameId,
        }));
      }
    } catch (error) {
      console.error('[Haiku] Failed to fetch game grid:', error);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  // Agent config
  const [gameId, setGameId] = useState(urlGameId);
  const [agentName, setAgentName] = useState('Haiku Explorer');
  const [maxTurns, setMaxTurns] = useState(80);

  // BYOK: API key state for production environment
  const [userApiKey, setUserApiKey] = useState('');
  const byokRequired = requiresUserApiKey();

  // Streaming state
  const [state, setState] = useState<HaikuStreamState>(initialState);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const isActiveSession =
    state.streamingStatus === 'starting' ||
    state.streamingStatus === 'in_progress' ||
    state.status === 'running';

  const handleStart = async () => {
    if (byokRequired && !userApiKey.trim()) {
      alert('Anthropic API key is required in production. Please enter your Anthropic API key.');
      return;
    }

    setIsPlaying(true);
    setState(prev => ({
      ...prev,
      status: 'starting',
      streamingStatus: 'starting',
      streamingMessage: 'Preparing Haiku agent...',
      error: null,
      observations: [],
      descriptions: [],
      hypotheses: [],
      timeline: [],
      turn: 0,
      score: 0,
    }));

    try {
      // Step 1: Prepare session
      const prepareResponse = await apiRequest('POST', '/api/arc3-haiku/stream/prepare', {
        game_id: gameId,
        max_turns: maxTurns,
        agent_name: agentName,
        ...(userApiKey.trim() ? { anthropic_api_key: userApiKey.trim() } : {}),
      });

      const prepareData = await prepareResponse.json();
      if (!prepareData.success || !prepareData.data?.sessionId) {
        throw new Error('Failed to prepare streaming session');
      }

      const sessionId = prepareData.data.sessionId;

      // Step 2: Connect to SSE stream
      const streamUrl = `/api/arc3-haiku/stream/${sessionId}`;
      const es = new EventSource(streamUrl);
      setEventSource(es);

      // Event handlers
      es.addEventListener('stream.init', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          status: 'running',
          streamingStatus: 'in_progress',
          streamingMessage: 'Haiku agent starting...',
          gameId: data.game_id || prev.gameId,
        }));
      });

      es.addEventListener('stream.status', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          streamingMessage: data.message || prev.streamingMessage,
        }));
      });

      es.addEventListener('scorecard.opened', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          scorecard: {
            card_id: data.card_id,
            url: data.url,
          },
        }));
      });

      es.addEventListener('agent.turn_start', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          turn: data.turn || prev.turn,
          streamingMessage: `Turn ${data.turn}: Haiku is looking at the game...`,
        }));
      });

      es.addEventListener('agent.description', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          descriptions: [...prev.descriptions, data.content],
          streamingReasoning: data.content,
          timeline: [...prev.timeline, {
            type: 'description',
            label: 'Haiku sees',
            content: data.content,
            timestamp: Date.now(),
          }],
        }));
      });

      es.addEventListener('agent.hypothesis', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          hypotheses: [...prev.hypotheses, data.content],
          timeline: [...prev.timeline, {
            type: 'hypothesis',
            label: 'Haiku thinks',
            content: data.content,
            timestamp: Date.now(),
          }],
        }));
      });

      es.addEventListener('agent.tool_call', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          streamingMessage: `Haiku tries ${data.action}...`,
          timeline: [...prev.timeline, {
            type: 'tool_call',
            label: data.action,
            content: data.coordinates ? `Coordinates: ${data.coordinates}` : '',
            timestamp: Date.now(),
          }],
        }));
      });

      es.addEventListener('agent.tool_result', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          timeline: [...prev.timeline, {
            type: 'tool_result',
            label: `${data.action} result`,
            content: data.result,
            timestamp: Date.now(),
          }],
        }));
      });

      es.addEventListener('game.frame_update', (evt) => {
        const data = JSON.parse(evt.data);
        if (data.frame) {
          setState(prev => {
            const newFrames = [...prev.frames, data.frame];
            return {
              ...prev,
              frames: newFrames,
              currentFrameIndex: newFrames.length - 1,
              gameGuid: data.frame.guid || prev.gameGuid,
              score: data.frame.score ?? prev.score,
            };
          });
        }
      });

      es.addEventListener('agent.observation', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          observations: [...prev.observations, data.content],
          timeline: [...prev.timeline, {
            type: 'observation',
            label: 'Haiku learned',
            content: data.content,
            timestamp: Date.now(),
          }],
        }));
      });

      es.addEventListener('agent.completed', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          status: 'completed',
          streamingStatus: 'completed',
          streamingMessage: `Completed! Final score: ${data.final_score}, Turns: ${data.turns}`,
          observations: data.observations || prev.observations,
        }));
        setIsPlaying(false);
        es.close();
      });

      es.addEventListener('game.won', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          status: 'completed',
          streamingStatus: 'completed',
          streamingMessage: `Haiku won! Score: ${data.score}, Turn: ${data.turn}`,
        }));
        setIsPlaying(false);
        es.close();
      });

      es.addEventListener('game.over', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          status: 'completed',
          streamingStatus: 'completed',
          streamingMessage: `Game over. Score: ${data.score}, Turn: ${data.turn}`,
        }));
        setIsPlaying(false);
        es.close();
      });

      es.addEventListener('stream.error', (evt) => {
        const data = JSON.parse(evt.data);
        setState(prev => ({
          ...prev,
          status: 'error',
          streamingStatus: 'error',
          error: data.message || 'Unknown error',
          streamingMessage: `Error: ${data.message}`,
        }));
        setIsPlaying(false);
        es.close();
      });

      es.onerror = () => {
        setState(prev => ({
          ...prev,
          status: 'error',
          streamingStatus: 'error',
          error: 'Connection lost',
          streamingMessage: 'Connection to agent lost',
        }));
        setIsPlaying(false);
        es.close();
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start agent';
      setState(prev => ({
        ...prev,
        status: 'error',
        streamingStatus: 'error',
        error: message,
        streamingMessage: message,
      }));
      setIsPlaying(false);
    }
  };

  const handleCancel = async () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setIsPlaying(false);
    setState(prev => ({
      ...prev,
      status: 'idle',
      streamingStatus: 'idle',
      streamingMessage: 'Cancelled',
    }));
  };

  const setCurrentFrame = (index: number) => {
    setState(prev => ({
      ...prev,
      currentFrameIndex: Math.max(0, Math.min(index, prev.frames.length - 1)),
    }));
  };

  // Get current frame
  const currentFrame = state.frames[state.currentFrameIndex] || null;

  // Filter timeline entries
  const toolEntries = state.timeline.filter(entry => 
    entry.type === 'tool_call' || entry.type === 'tool_result'
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b px-3 py-1">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" asChild>
              <Link href="/arc3">
                <ArrowLeft className="h-2.5 w-2.5 mr-0.5" />
                Back
              </Link>
            </Button>
            <Eye className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-semibold">Haiku 4.5 Playground</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-400 text-purple-600">
              Vision-First
            </Badge>
          </div>

          {/* Game selector */}
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
                  setLocation(`/arc3/haiku-playground?game=${newGameId}`);
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
            <Button variant="ghost" size="sm" onClick={fetchGames} className="h-6 w-6 p-0">
              <RefreshCw className="h-2.5 w-2.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Turn {state.turn} | Score {state.score}
            </Badge>
            {/* Scorecard Link - shows when scorecard is opened during streaming */}
            <Arc3ScorecardLink card_id={state.scorecard?.card_id} url={state.scorecard?.url} />

            <Badge variant={state.status === 'running' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
              {state.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 max-w-[1800px] mx-auto">

        {/* LEFT: Config and controls */}
        <div className="lg:col-span-3 space-y-3">

          {/* BYOK: API Key Input */}
          {byokRequired && !isActiveSession && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-sm text-purple-900 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5" />
                      Anthropic API Key
                    </CardTitle>
                    <CardDescription className="text-xs mt-1 text-purple-700">
                      Your key is used for this session only and is never stored.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide border-purple-300 text-purple-700">
                    BYOK
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor="anthropic-api-key" className="sr-only">Anthropic API Key</Label>
                    <Input
                      id="anthropic-api-key"
                      type="password"
                      placeholder="sk-ant-..."
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

          {/* Config panel */}
          {!isActiveSession && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-purple-500" />
                  Agent Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Agent Name</Label>
                  <Input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Haiku Explorer"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Turns</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={maxTurns}
                    onChange={(e) => setMaxTurns(parseInt(e.target.value) || 80)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="text-[10px] text-muted-foreground bg-purple-50 p-2 rounded">
                  <p className="font-medium text-purple-700 mb-1">Haiku's Approach:</p>
                  <p>Haiku learns like a curious child - observing, hypothesizing, acting, and remembering patterns.</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleStart} disabled={isPlaying} className="flex-1 h-8 text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Start Haiku
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancel button when playing */}
          {isActiveSession && (
            <Card>
              <CardContent className="pt-4">
                <Button onClick={handleCancel} variant="destructive" className="w-full h-8 text-xs">
                  Cancel Agent
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Observations List - Haiku's learned patterns */}
          <Arc3ObservationsList
            observations={state.observations}
            descriptions={state.descriptions}
            hypotheses={state.hypotheses}
          />

          {/* Tool Timeline */}
          <Arc3ToolTimeline
            entries={toolEntries}
            isPlaying={isPlaying}
            streamingMessage={state.streamingMessage}
          />
        </div>

        {/* CENTER: Game Panel */}
        <div className="lg:col-span-5 space-y-3">
          <Arc3GamePanel
            currentFrame={currentFrame}
            frames={state.frames}
            currentFrameIndex={state.currentFrameIndex}
            executeManualAction={async () => {}}
            isPendingManualAction={false}
            isPlaying={isPlaying}
            streamingMessage={state.streamingMessage}
            toolEntries={toolEntries}
            gameGuid={state.gameGuid}
            gameId={state.gameId}
            error={state.error || undefined}
            setCurrentFrame={setCurrentFrame}
            normalizedAvailableActions={null}
          />
        </div>

        {/* RIGHT: Reasoning Viewer */}
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

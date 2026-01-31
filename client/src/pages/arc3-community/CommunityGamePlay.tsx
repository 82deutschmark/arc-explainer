/*
Author: Cascade (Claude Sonnet 4)
Date: 2026-01-31
PURPOSE: Game play page for community games. Handles game session management,
         rendering the game grid, and player input controls. Uses ARC3 pixel UI theme.
SRP/DRY check: Pass — uses shared pixel UI primitives and ARC3 grid visualization.
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  RotateCcw,
  Play,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trophy,
  XCircle,
  Gamepad2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Arc3GridVisualization } from '@/components/arc3/Arc3GridVisualization';
import { Arc3PixelPage, PixelButton, PixelPanel } from '@/components/arc3-community/Arc3PixelUI';

interface FrameData {
  frame: number[][][];  // 3D array: list of animation frames, each is a 2D grid
  score: number;
  state: string;
  action_counter: number;
  max_actions: number;
  win_score: number;
  available_actions: string[];
  last_action: string;
  levels_completed?: number;
}

interface StartGameResponse {
  success: boolean;
  data: {
    sessionGuid: string;
    frame: FrameData;
    game: {
      gameId: string;
      displayName: string;
      winScore: number;
      maxActions: number | null;
    };
  };
}

interface ActionResponse {
  success: boolean;
  data: {
    frame: FrameData;
    isGameOver: boolean;
    isWin: boolean;
  };
}

interface GameDetails {
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
}

type GameState = 'idle' | 'playing' | 'won' | 'lost';

export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [sessionGuid, setSessionGuid] = useState<string | null>(null);
  const [frame, setFrame] = useState<FrameData | null>(null);
  const [gameInfo, setGameInfo] = useState<{ displayName: string; winScore: number; maxActions: number | null } | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle');

  // Fetch game details
  const { data: gameDetails } = useQuery<{ success: boolean; data: GameDetails }>({
    queryKey: [`/api/arc3-community/games/${gameId}`],
    enabled: !!gameId,
  });

  // Start game mutation
  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/arc3-community/session/start", { gameId });
      return response.json() as Promise<StartGameResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setSessionGuid(data.data.sessionGuid);
        setFrame(data.data.frame);
        setGameInfo(data.data.game);
      }
    },
  });

  // Execute action mutation
  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (!sessionGuid) throw new Error('No active session');
      const response = await apiRequest('POST', `/api/arc3-community/session/${sessionGuid}/action`, { action });
      return response.json() as Promise<ActionResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setFrame(data.data.frame);
        if (data.data.isGameOver) {
          setGameState(data.data.isWin ? 'won' : 'lost');
        }
      }
    },
  });

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (actionMutation.isPending || !sessionGuid) return;

    const keyMap: Record<string, string> = {
      'ArrowUp': 'ACTION1',
      'ArrowDown': 'ACTION2',
      'ArrowLeft': 'ACTION3',
      'ArrowRight': 'ACTION4',
      'w': 'ACTION1',
      's': 'ACTION2',
      'a': 'ACTION3',
      'd': 'ACTION4',
      ' ': 'ACTION5',
      'Enter': 'ACTION5',
      'r': 'RESET',
    };

    const action = keyMap[e.key];
    if (action) {
      e.preventDefault();
      actionMutation.mutate(action);
    }
  }, [actionMutation, sessionGuid]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Start game
  const handleStart = () => {
    setGameState('playing');
    startGameMutation.mutate();
  };

  // Reset game
  const handleReset = () => {
    if (sessionGuid) {
      setGameState('playing');
      actionMutation.mutate('RESET');
    }
  };

  // Play again (full restart)
  const handlePlayAgain = () => {
    setSessionGuid(null);
    setFrame(null);
    setGameInfo(null);
    setGameState('idle');
  };


  return (
    <Arc3PixelPage>
      {/* Header */}
      <header className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/arc3/gallery">
              <PixelButton tone="neutral">
                <ArrowLeft className="w-4 h-4" />
                Gallery
              </PixelButton>
            </Link>
            <span className="text-[var(--arc3-dim)]">|</span>
            <Gamepad2 className="w-5 h-5 text-[var(--arc3-c14)]" />
            <div className="min-w-0">
              <span className="text-sm font-semibold truncate">
                {gameInfo?.displayName || gameDetails?.data?.displayName || 'Loading...'}
              </span>
              {gameDetails?.data && (
                <span className="text-[11px] text-[var(--arc3-dim)] ml-2">
                  by {gameDetails.data.authorName}
                </span>
              )}
            </div>
          </div>

          {frame && gameState === 'playing' && (
            <div className="flex items-center gap-3 text-xs shrink-0">
              <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-c14)] text-[var(--arc3-c0)] px-2 py-1 font-semibold">
                Score: {frame.score}/{gameInfo?.winScore || frame.win_score}
              </div>
              <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] px-2 py-1">
                Actions: {frame.action_counter}{gameInfo?.maxActions ? `/${gameInfo.maxActions}` : ''}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Game Grid */}
          <div className="lg:col-span-3">
            {/* Win/Loss overlay */}
            {gameState === 'won' && (
              <PixelPanel tone="green" title="Victory!" className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-[var(--arc3-c11)]" />
                    <div>
                      <p className="text-sm font-semibold">Congratulations!</p>
                      <p className="text-[11px] text-[var(--arc3-muted)]">
                        Final score: {frame?.score} | Actions: {frame?.action_counter}
                      </p>
                    </div>
                  </div>
                  <PixelButton tone="green" onClick={handlePlayAgain}>
                    <Play className="w-4 h-4" />
                    Play Again
                  </PixelButton>
                </div>
              </PixelPanel>
            )}

            {gameState === 'lost' && (
              <PixelPanel tone="danger" title="Game Over" className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-[var(--arc3-c8)]" />
                    <div>
                      <p className="text-sm font-semibold">Better luck next time!</p>
                      <p className="text-[11px] text-[var(--arc3-muted)]">
                        Final score: {frame?.score} | Actions: {frame?.action_counter}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PixelButton tone="yellow" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4" />
                      Retry Level
                    </PixelButton>
                    <PixelButton tone="green" onClick={handlePlayAgain}>
                      <Play className="w-4 h-4" />
                      New Game
                    </PixelButton>
                  </div>
                </div>
              </PixelPanel>
            )}

            <PixelPanel tone="blue">
              {gameState === 'idle' ? (
                <div className="text-center py-12">
                  <Gamepad2 className="w-12 h-12 text-[var(--arc3-dim)] mx-auto mb-4" />
                  <p className="text-sm font-semibold mb-2">
                    {gameInfo?.displayName || gameDetails?.data?.displayName || 'Community Game'}
                  </p>
                  <p className="text-[11px] text-[var(--arc3-muted)] mb-6 max-w-md mx-auto">
                    {gameDetails?.data?.description || 'Initialize game session to begin playing'}
                  </p>
                  <PixelButton
                    tone="green"
                    onClick={handleStart}
                    disabled={startGameMutation.isPending}
                  >
                    {startGameMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Start Game
                      </>
                    )}
                  </PixelButton>
                </div>
              ) : frame?.frame ? (
                <div className="mx-auto" style={{ maxWidth: '512px' }}>
                  <Arc3GridVisualization
                    grid={frame.frame}
                    frameIndex={0}
                    cellSize={8}
                    showGrid={true}
                    showCoordinates={false}
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--arc3-c14)] animate-spin mx-auto" />
                  <p className="text-[11px] text-[var(--arc3-dim)] mt-3">Loading game...</p>
                </div>
              )}
            </PixelPanel>
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* D-Pad Controls */}
            <PixelPanel tone="purple" title="Controls">
              <div className="flex flex-col items-center gap-1">
                <PixelButton
                  tone="neutral"
                  onClick={() => actionMutation.mutate('ACTION1')}
                  disabled={!sessionGuid || actionMutation.isPending || gameState !== 'playing'}
                  className="w-12 h-12"
                >
                  <ChevronUp className="w-6 h-6" />
                </PixelButton>
                <div className="flex gap-1">
                  <PixelButton
                    tone="neutral"
                    onClick={() => actionMutation.mutate('ACTION3')}
                    disabled={!sessionGuid || actionMutation.isPending || gameState !== 'playing'}
                    className="w-12 h-12"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </PixelButton>
                  <PixelButton
                    tone="green"
                    onClick={() => actionMutation.mutate('ACTION5')}
                    disabled={!sessionGuid || actionMutation.isPending || gameState !== 'playing'}
                    className="w-12 h-12"
                  >
                    <Play className="w-5 h-5" />
                  </PixelButton>
                  <PixelButton
                    tone="neutral"
                    onClick={() => actionMutation.mutate('ACTION4')}
                    disabled={!sessionGuid || actionMutation.isPending || gameState !== 'playing'}
                    className="w-12 h-12"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </PixelButton>
                </div>
                <PixelButton
                  tone="neutral"
                  onClick={() => actionMutation.mutate('ACTION2')}
                  disabled={!sessionGuid || actionMutation.isPending || gameState !== 'playing'}
                  className="w-12 h-12"
                >
                  <ChevronDown className="w-6 h-6" />
                </PixelButton>
              </div>

              <PixelButton
                tone="yellow"
                onClick={handleReset}
                disabled={!sessionGuid || actionMutation.isPending}
                className="w-full mt-4"
              >
                <RotateCcw className="w-4 h-4" />
                Reset (R)
              </PixelButton>
            </PixelPanel>

            {/* Keyboard Shortcuts */}
            <PixelPanel tone="blue" title="Keyboard">
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--arc3-muted)]">Move</span>
                  <span className="font-mono">WASD / Arrows</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--arc3-muted)]">Action</span>
                  <span className="font-mono">Space / Enter</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--arc3-muted)]">Reset</span>
                  <span className="font-mono">R</span>
                </div>
              </div>
            </PixelPanel>

            {/* Game Info */}
            {gameInfo && (
              <PixelPanel tone="green" title="Goal">
                <p className="text-[11px] text-[var(--arc3-muted)]">
                  Reach a score of <span className="font-semibold text-[var(--arc3-c14)]">{gameInfo.winScore}</span> to win!
                  {gameInfo.maxActions && (
                    <> You have <span className="font-semibold">{gameInfo.maxActions}</span> actions maximum.</>                  )}
                </p>
              </PixelPanel>
            )}
          </div>
        </div>
      </main>
    </Arc3PixelPage>
  );
}

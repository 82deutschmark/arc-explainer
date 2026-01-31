<<<<<<< C:/Projects/arc-explainer/client/src/pages/arc3-community/CommunityGamePlay.tsx
/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Game play page for community games. Handles game session management,
 *          rendering the game grid, and player input controls.
 * SRP/DRY check: Pass — single-purpose game play interface.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  RotateCcw, 
  Play,
  Trophy,
  XCircle,
  Gamepad2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ARC color palette (0-9)
const ARC_COLORS = [
  '#000000', // 0 - black
  '#0074D9', // 1 - blue  
  '#FF4136', // 2 - red
  '#2ECC40', // 3 - green
  '#FFDC00', // 4 - yellow
  '#AAAAAA', // 5 - gray
  '#F012BE', // 6 - magenta
  '#FF851B', // 7 - orange
  '#7FDBFF', // 8 - cyan
  '#B10DC9', // 9 - purple
];

interface FrameData {
  frame: number[][];
  score: number;
  state: string;
  action_counter: number;
  max_actions: number;
  win_score: number;
  available_actions: string[];
  last_action: string;
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
  difficulty: string;
}

export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [sessionGuid, setSessionGuid] = useState<string | null>(null);
  const [frame, setFrame] = useState<FrameData | null>(null);
  const [gameInfo, setGameInfo] = useState<{ displayName: string; winScore: number; maxActions: number | null } | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

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
        setIsGameOver(false);
        setIsWin(false);
      }
    },
  });

  // Execute action mutation
  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (!sessionGuid) throw new Error("No active session");
      const response = await apiRequest("POST", `/api/arc3-community/session/${sessionGuid}/action`, { action });
      return response.json() as Promise<ActionResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setFrame(data.data.frame);
        if (data.data.isGameOver) {
          setIsGameOver(true);
          setIsWin(data.data.isWin);
        }
      }
    },
  });

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isGameOver || actionMutation.isPending || !sessionGuid) return;

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
  }, [isGameOver, actionMutation, sessionGuid]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Start game on mount
  const handleStart = () => {
    setIsStarting(true);
    startGameMutation.mutate();
  };

  // Reset game
  const handleReset = () => {
    if (sessionGuid) {
      actionMutation.mutate('RESET');
      setIsGameOver(false);
      setIsWin(false);
    }
  };

  // Render grid cell
  const renderCell = (value: number, rowIdx: number, colIdx: number) => {
    const color = ARC_COLORS[value] || ARC_COLORS[0];
    return (
      <div
        key={`${rowIdx}-${colIdx}`}
        className="aspect-square border border-slate-600"
        style={{ backgroundColor: color }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/arc3/gallery">
            <Button variant="ghost" size="icon" className="text-slate-400">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">
              {gameInfo?.displayName || gameDetails?.data?.displayName || 'Loading...'}
            </h1>
            {gameDetails?.data && (
              <p className="text-slate-400">
                by {gameDetails.data.authorName} · {gameDetails.data.difficulty}
              </p>
            )}
          </div>
          {frame && (
            <div className="flex gap-4 text-sm">
              <Badge variant="outline" className="text-cyan-400 border-cyan-500">
                Score: {frame.score} / {gameInfo?.winScore || frame.win_score}
              </Badge>
              <Badge variant="outline" className="text-slate-400">
                Actions: {frame.action_counter} {gameInfo?.maxActions ? `/ ${gameInfo.maxActions}` : ''}
              </Badge>
            </div>
          )}
        </div>

        {/* Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Game Grid */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                {!sessionGuid ? (
                  <div className="text-center py-16">
                    <Gamepad2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-4">
                      Ready to Play?
                    </h3>
                    <p className="text-slate-400 mb-6 max-w-md mx-auto">
                      {gameDetails?.data?.description || 'Start the game to begin playing!'}
                    </p>
                    <Button 
                      onClick={handleStart} 
                      disabled={startGameMutation.isPending}
                      className="bg-cyan-600 hover:bg-cyan-700"
                      size="lg"
                    >
                      {startGameMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Start Game
                        </>
                      )}
                    </Button>
                  </div>
                ) : frame ? (
                  <div className="relative">
                    {/* Game Over Overlay */}
                    {isGameOver && (
                      <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 rounded-lg">
                        <div className="text-center">
                          {isWin ? (
                            <>
                              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                              <h3 className="text-2xl font-bold text-white mb-2">You Win!</h3>
                              <p className="text-slate-300 mb-4">Final Score: {frame.score}</p>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                              <h3 className="text-2xl font-bold text-white mb-2">Game Over</h3>
                              <p className="text-slate-300 mb-4">Score: {frame.score}</p>
                            </>
                          )}
                          <Button onClick={handleReset} className="bg-cyan-600 hover:bg-cyan-700">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Play Again
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Grid */}
                    <div 
                      className="grid gap-0 mx-auto max-w-lg"
                      style={{ 
                        gridTemplateColumns: `repeat(${frame.frame[0]?.length || 10}, 1fr)`,
                      }}
                    >
                      {frame.frame.map((row, rowIdx) =>
                        row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Controls Sidebar */}
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* D-Pad */}
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12"
                    onClick={() => actionMutation.mutate('ACTION1')}
                    disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                  >
                    <ChevronUp className="w-6 h-6" />
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-12 h-12"
                      onClick={() => actionMutation.mutate('ACTION3')}
                      disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-12 h-12"
                      onClick={() => actionMutation.mutate('ACTION5')}
                      disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-12 h-12"
                      onClick={() => actionMutation.mutate('ACTION4')}
                      disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12"
                    onClick={() => actionMutation.mutate('ACTION2')}
                    disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                  >
                    <ChevronDown className="w-6 h-6" />
                  </Button>
                </div>

                {/* Reset Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleReset}
                  disabled={!sessionGuid || actionMutation.isPending}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset (R)
                </Button>
              </CardContent>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Keyboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Move</span>
                    <span className="text-slate-300">Arrow Keys / WASD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Action</span>
                    <span className="text-slate-300">Space / Enter</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reset</span>
                    <span className="text-slate-300">R</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
=======
/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Game play page for community games. Terminal-style design for researchers.
 *          Handles game session management, rendering the game grid, and player input.
 * SRP/DRY check: Pass — single-purpose game play interface.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  RotateCcw, 
  Play,
  Trophy,
  XCircle,
  Terminal,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ARC color palette (0-9)
const ARC_COLORS = [
  '#000000', // 0 - black
  '#0074D9', // 1 - blue  
  '#FF4136', // 2 - red
  '#2ECC40', // 3 - green
  '#FFDC00', // 4 - yellow
  '#AAAAAA', // 5 - gray
  '#F012BE', // 6 - magenta
  '#FF851B', // 7 - orange
  '#7FDBFF', // 8 - cyan
  '#B10DC9', // 9 - purple
];

interface FrameData {
  frame: number[][];
  levels_completed: number;  // How many levels player has completed
  win_levels: number;        // How many levels needed to win
  state: string;             // GameState: 'PLAYING', 'WIN', 'LOSE', etc.
  available_actions: number[];
  last_action: string;
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
  difficulty: string;
}

export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [sessionGuid, setSessionGuid] = useState<string | null>(null);
  const [frame, setFrame] = useState<FrameData | null>(null);
  const [gameInfo, setGameInfo] = useState<{ displayName: string; winScore: number; maxActions: number | null } | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

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
        setIsGameOver(false);
        setIsWin(false);
      }
    },
  });

  // Execute action mutation
  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (!sessionGuid) throw new Error("No active session");
      const response = await apiRequest("POST", `/api/arc3-community/session/${sessionGuid}/action`, { action });
      return response.json() as Promise<ActionResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setFrame(data.data.frame);
        if (data.data.isGameOver) {
          setIsGameOver(true);
          setIsWin(data.data.isWin);
        }
      }
    },
  });

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isGameOver || actionMutation.isPending || !sessionGuid) return;

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
  }, [isGameOver, actionMutation, sessionGuid]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Start game on mount
  const handleStart = () => {
    setIsStarting(true);
    startGameMutation.mutate();
  };

  // Reset game
  const handleReset = () => {
    if (sessionGuid) {
      actionMutation.mutate('RESET');
      setIsGameOver(false);
      setIsWin(false);
    }
  };

  // Render grid cell
  const renderCell = (value: number, rowIdx: number, colIdx: number) => {
    const color = ARC_COLORS[value] || ARC_COLORS[0];
    return (
      <div
        key={`${rowIdx}-${colIdx}`}
        className="aspect-square border border-slate-600"
        style={{ backgroundColor: color }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Compact header bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/80">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/arc3">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-zinc-400 hover:text-zinc-100">
                <ArrowLeft className="w-3 h-3 mr-1" />
                Back
              </Button>
            </Link>
            <span className="text-zinc-700">|</span>
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold">
              {gameInfo?.displayName || gameDetails?.data?.displayName || 'Loading...'}
            </span>
            {gameDetails?.data && (
              <span className="text-xs text-zinc-500">
                by {gameDetails.data.authorName}
              </span>
            )}
          </div>
          {frame && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-400">
                Level {frame.levels_completed}/{frame.win_levels}
              </span>
              <span className="text-zinc-500">|</span>
              <span className={frame.state === 'WIN' ? 'text-emerald-400' : frame.state === 'LOSE' ? 'text-red-400' : 'text-zinc-400'}>
                {frame.state}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Game Grid */}
          <div className="lg:col-span-3">
            <div className="border border-zinc-800 rounded bg-zinc-900/50 p-4">
              {!sessionGuid ? (
                <div className="text-center py-12">
                  <Terminal className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-xs text-zinc-500 mb-4 max-w-md mx-auto">
                    {gameDetails?.data?.description || 'Initialize game session to begin'}
                  </p>
                  <Button 
                    onClick={handleStart} 
                    disabled={startGameMutation.isPending}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
                  >
                    {startGameMutation.isPending ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Start Game
                      </>
                    )}
                  </Button>
                </div>
              ) : frame ? (
                <div className="relative">
                  {/* Game Over Overlay */}
                  {isGameOver && (
                    <div className="absolute inset-0 bg-zinc-950/90 flex items-center justify-center z-10 rounded">
                      <div className="text-center">
                        {isWin ? (
                          <>
                            <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-zinc-100 mb-1">WIN</h3>
                            <p className="text-xs text-zinc-400 mb-3">Levels: {frame.levels_completed}/{frame.win_levels}</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-zinc-100 mb-1">GAME OVER</h3>
                            <p className="text-xs text-zinc-400 mb-3">Levels: {frame.levels_completed}/{frame.win_levels}</p>
                          </>
                        )}
                        <Button onClick={handleReset} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7">
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Restart
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Grid */}
                  <div 
                    className="grid gap-px mx-auto bg-zinc-800"
                    style={{ 
                      gridTemplateColumns: `repeat(${frame.frame[0]?.length || 10}, 1fr)`,
                      maxWidth: '400px',
                    }}
                  >
                    {frame.frame.map((row, rowIdx) =>
                      row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
                </div>
              )}
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* D-Pad Controls */}
            <div className="border border-zinc-800 rounded bg-zinc-900/50 p-3">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Controls</h3>
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 border-zinc-700 hover:bg-zinc-800"
                  onClick={() => actionMutation.mutate('ACTION1')}
                  disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                >
                  <ChevronUp className="w-5 h-5" />
                </Button>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-10 h-10 border-zinc-700 hover:bg-zinc-800"
                    onClick={() => actionMutation.mutate('ACTION3')}
                    disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-10 h-10 border-zinc-700 hover:bg-zinc-800 text-emerald-500"
                    onClick={() => actionMutation.mutate('ACTION5')}
                    disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-10 h-10 border-zinc-700 hover:bg-zinc-800"
                    onClick={() => actionMutation.mutate('ACTION4')}
                    disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 border-zinc-700 hover:bg-zinc-800"
                  onClick={() => actionMutation.mutate('ACTION2')}
                  disabled={!sessionGuid || isGameOver || actionMutation.isPending}
                >
                  <ChevronDown className="w-5 h-5" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3 h-7 text-xs border-zinc-700 hover:bg-zinc-800"
                onClick={handleReset}
                disabled={!sessionGuid || actionMutation.isPending}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset (R)
              </Button>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="border border-zinc-800 rounded bg-zinc-900/50 p-3">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Keyboard</h3>
              <div className="text-xs text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>Move</span>
                  <span className="text-zinc-300 font-mono">WASD / Arrows</span>
                </div>
                <div className="flex justify-between">
                  <span>Action</span>
                  <span className="text-zinc-300 font-mono">Space / Enter</span>
                </div>
                <div className="flex justify-between">
                  <span>Reset</span>
                  <span className="text-zinc-300 font-mono">R</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
>>>>>>> C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-55ac97c0/client/src/pages/arc3-community/CommunityGamePlay.tsx

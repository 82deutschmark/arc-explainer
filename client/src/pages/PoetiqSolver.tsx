/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-26 - Major refactor with Saturn/Grover patterns
 * PURPOSE: Poetiq Iterative Code-Generation Solver page with BYO API key support.
 *          Uses Saturn-style visual workbench layout with streaming visualizer,
 *          Grover-style iteration tracking, and live activity stream.
 * 
 * SRP/DRY check: Pass - UI orchestration, delegates to specialized components
 * Components: PoetiqControlPanel, PoetiqStreamingVisualizer, PoetiqStreamingModal, PoetiqLiveActivityStream
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { 
  Loader2, ArrowLeft, Eye, ExternalLink, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { usePoetiqCommunityProgress } from '@/hooks/usePoetiqCommunityProgress';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import { Badge } from '@/components/ui/badge';

// Import new Poetiq components (Saturn/Grover hybrid patterns)
import PoetiqControlPanel from '@/components/poetiq/PoetiqControlPanel';
import PoetiqStreamingVisualizer from '@/components/poetiq/PoetiqStreamingVisualizer';
import PoetiqStreamingModal from '@/components/poetiq/PoetiqStreamingModal';
import { PoetiqLiveActivityStream } from '@/components/poetiq/PoetiqLiveActivityStream';

export default function PoetiqSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, cancel } = usePoetiqProgress(taskId);
  const communityProgress = usePoetiqCommunityProgress();
  
  // Configuration state
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('openrouter');
  const [model, setModel] = useState('openrouter/google/gemini-2.5-flash-preview');
  const [numExperts, setNumExperts] = useState(2);
  const [maxIterations, setMaxIterations] = useState(10);
  const [temperature, setTemperature] = useState(1.0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showStreamingModal, setShowStreamingModal] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Set page title
  useEffect(() => {
    document.title = taskId ? `Poetiq Solver - ${taskId}` : 'Poetiq Code-Generation Solver';
  }, [taskId]);

  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';

  // Track elapsed time
  useEffect(() => {
    if (isRunning && !startTime) {
      setStartTime(new Date());
      setLogs([]); // Clear logs on new run
    } else if (!isRunning && startTime) {
      setStartTime(null);
    }
  }, [isRunning, startTime]);

  useEffect(() => {
    if (isRunning && startTime) {
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, startTime]);

  // Simulate log updates from state changes
  useEffect(() => {
    if (state.message && isRunning) {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${state.message}`]);
    }
  }, [state.message, isRunning]);

  useEffect(() => {
    if (state.phase && isRunning) {
      setLogs(prev => [...prev, `🔁 Phase: ${state.phase}`]);
    }
  }, [state.phase, isRunning]);

  const handleStart = () => {
    start({
      apiKey,
      provider,
      model,
      numExperts,
      maxIterations,
      temperature,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current puzzle status from community progress
  const currentPuzzleStatus = communityProgress.puzzles?.find(p => p.puzzleId === taskId);

  // Loading states
  if (!taskId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white/70 p-8 bg-white/10 backdrop-blur-md rounded-xl">
          <p className="text-red-400">Invalid puzzle ID</p>
          <Link href="/poetiq">
            <a className="text-cyan-400 hover:text-cyan-300 text-sm mt-2 block">← Back to Community</a>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading puzzle {taskId}...</span>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white/70 p-8 bg-white/10 backdrop-blur-md rounded-xl">
          <p className="text-red-400">Failed to load puzzle: {taskError?.message || 'Not found'}</p>
          <Link href="/poetiq">
            <a className="text-cyan-400 hover:text-cyan-300 text-sm mt-2 block">← Back to Community</a>
          </Link>
        </div>
      </div>
    );
  }

  // Get training/test grids from task
  const trainingPairs = task.train || [];
  const testPair = task.test?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900">
      {/* Background effects */}
      <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-slate-800/50 to-slate-900/50" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 h-screen overflow-hidden">
        {/* Header Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-4">
            <Link href="/poetiq">
              <a className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Community</span>
              </a>
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                Poetiq Solver
                {isRunning && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/20 rounded-full text-xs text-cyan-300 font-mono">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </h1>
              <p className="text-xs text-white/50 font-mono">{taskId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Timer */}
            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full">
                <Clock className="w-4 h-4 text-white/70" />
                <span className="text-white/90 font-mono">{formatTime(elapsed)}</span>
              </div>
            )}
            
            {/* Status Badge */}
            {isDone && (
              <Badge className={state.result?.isPredictionCorrect 
                ? 'bg-green-500/20 text-green-300 border-green-400/30' 
                : 'bg-red-500/20 text-red-300 border-red-400/30'
              }>
                {state.result?.isPredictionCorrect ? (
                  <><CheckCircle className="w-3 h-3 mr-1" /> SOLVED</>
                ) : (
                  <><XCircle className="w-3 h-3 mr-1" /> UNSOLVED</>
                )}
              </Badge>
            )}
            
            {/* Streaming Modal Toggle */}
            {(isRunning || isDone) && (
              <button
                onClick={() => setShowStreamingModal(true)}
                className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-purple-300 text-sm transition-colors"
              >
                <Eye className="w-4 h-4" />
                Expand View
              </button>
            )}

            {/* Puzzle Link */}
            <Link href={`/puzzle/${taskId}`}>
              <a className="flex items-center gap-1 text-white/60 hover:text-white text-sm">
                <ExternalLink className="w-4 h-4" />
                View Puzzle
              </a>
            </Link>
          </div>
        </header>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-12 gap-4 p-4 h-[calc(100vh-57px)] overflow-hidden">
          
          {/* LEFT SIDEBAR - Control Panel & Puzzle Preview */}
          <aside className="col-span-3 space-y-4 overflow-y-auto">
            {/* Control Panel */}
            <PoetiqControlPanel
              state={state}
              isRunning={isRunning}
              apiKey={apiKey}
              setApiKey={setApiKey}
              provider={provider}
              setProvider={setProvider}
              model={model}
              setModel={setModel}
              numExperts={numExperts}
              setNumExperts={setNumExperts}
              maxIterations={maxIterations}
              setMaxIterations={setMaxIterations}
              temperature={temperature}
              setTemperature={setTemperature}
              onStart={handleStart}
              onCancel={cancel}
            />

            {/* Puzzle Preview - Training Examples */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/90">Training Examples</h3>
              <div className="space-y-2">
                {trainingPairs.slice(0, 2).map((pair, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] text-white/50 mb-1">Input</div>
                      <PuzzleGrid
                        grid={pair.input}
                        title="Input"
                        showEmojis={true}
                        emojiSet={DEFAULT_EMOJI_SET}
                        compact={true}
                      />
                    </div>
                    <div className="flex items-center text-white/30">→</div>
                    <div className="flex-1">
                      <div className="text-[10px] text-white/50 mb-1">Output</div>
                      <PuzzleGrid
                        grid={pair.output}
                        title="Output"
                        showEmojis={true}
                        emojiSet={DEFAULT_EMOJI_SET}
                        compact={true}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {trainingPairs.length > 2 && (
                <p className="text-xs text-white/50 text-center">
                  +{trainingPairs.length - 2} more examples
                </p>
              )}
            </div>

            {/* Test Input */}
            {testPair && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white/90 mb-3">Test Input</h3>
                <PuzzleGrid
                  grid={testPair.input}
                  title="Test Input"
                  showEmojis={true}
                  emojiSet={DEFAULT_EMOJI_SET}
                  compact={true}
                />
              </div>
            )}

            {/* Current Puzzle Status */}
            {currentPuzzleStatus && (
              <div className={`p-3 rounded-lg border ${
                currentPuzzleStatus.status === 'solved' 
                  ? 'bg-green-500/20 border-green-400/30' 
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  {currentPuzzleStatus.status === 'solved' 
                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-white/40" />
                  }
                  <span>
                    {currentPuzzleStatus.status === 'solved' 
                      ? 'Previously solved' 
                      : currentPuzzleStatus.status === 'attempted' 
                      ? 'Previously attempted' 
                      : 'Not yet attempted'
                    }
                  </span>
                </div>
              </div>
            )}
          </aside>

          {/* CENTER - Streaming Visualizer */}
          <main className="col-span-6 flex flex-col min-h-0">
            <PoetiqStreamingVisualizer
              state={state}
              isRunning={isRunning}
              logs={logs}
              generatedCode={state.result?.generatedCode}
              onExpand={() => setShowStreamingModal(true)}
            />
          </main>

          {/* RIGHT SIDEBAR - Activity Stream & Stats */}
          <aside className="col-span-3 space-y-4 overflow-y-auto">
            {/* Activity Log */}
            <PoetiqLiveActivityStream 
              logs={logs} 
              maxHeight="300px"
              onClear={() => setLogs([])}
            />

            {/* Community Progress Summary */}
            {communityProgress.total > 0 && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white/90">Community Progress</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 rounded p-2">
                    <div className="text-lg font-bold text-white">{communityProgress.total}</div>
                    <div className="text-[10px] text-white/50">Total</div>
                  </div>
                  <div className="bg-white/5 rounded p-2">
                    <div className="text-lg font-bold text-blue-400">{communityProgress.attempted}</div>
                    <div className="text-[10px] text-white/50">Attempted</div>
                  </div>
                  <div className="bg-white/5 rounded p-2">
                    <div className="text-lg font-bold text-green-400">{communityProgress.solved}</div>
                    <div className="text-[10px] text-white/50">Solved</div>
                  </div>
                </div>
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                    style={{ width: `${(communityProgress.solved / communityProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-white/50 text-center">
                  {Math.round((communityProgress.solved / communityProgress.total) * 100)}% solved
                </p>
              </div>
            )}

            {/* Quick Info */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white/70 mb-2">How Poetiq Works</h3>
              <ul className="text-xs text-white/50 space-y-1">
                <li>1. AI generates Python transform() code</li>
                <li>2. Code runs on training examples</li>
                <li>3. Iterates until tests pass</li>
                <li>4. Multiple experts vote on best solution</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* Streaming Modal */}
      <PoetiqStreamingModal
        isOpen={showStreamingModal}
        onClose={() => setShowStreamingModal(false)}
        state={state}
        logs={logs}
        elapsedSeconds={elapsed}
      />
    </div>
  );
}

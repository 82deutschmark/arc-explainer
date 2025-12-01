/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Beetree Ensemble Solver - Multi-model consensus ARC solver interface.
 * Uses 3-8 frontier AI models (GPT-5.1, Claude Opus, Gemini) for ensemble consensus.
 * Testing mode: ~$0.50-$2, 2-6 min. Production mode: ~$15-$50, 20-45 min.
 *
 * SRP/DRY check: Pass - Follows Saturn page patterns
 */

import React from 'react';
import { useParams } from 'wouter';
import { ArrowLeft, Square, Trees } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useBeetreeRun } from '@/hooks/useBeetreeRun';
import { PuzzleGridDisplay } from '@/components/puzzle/PuzzleGridDisplay';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';

export default function BeetreeSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { status, progress, results, cost, error, startAnalysis, cancelAnalysis, clearResults } = useBeetreeRun();

  // Settings
  const [mode, setMode] = React.useState<'testing' | 'production'>('testing');
  const [showConfirm, setShowConfirm] = React.useState(false);

  const isRunning = status === 'running';
  const isDone = status === 'completed';
  const hasError = status === 'error';

  // Error states
  if (!taskId) {
    return (
      <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
        <div className="p-4">
          <div className="text-red-600 text-sm font-bold">Invalid puzzle ID</div>
        </div>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
        <div className="p-4">
          <div className="text-amber-600 text-sm font-bold">Loading puzzle...</div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
        <div className="p-4">
          <div className="text-red-600 text-sm font-bold">Puzzle not found</div>
          <div className="text-gray-600 text-xs mt-1">{taskError?.message || 'Puzzle could not be loaded'}</div>
        </div>
      </div>
    );
  }

  const onStart = () => {
    if (mode === 'production') {
      setShowConfirm(true);
      return;
    }
    doStart();
  };

  const doStart = () => {
    setShowConfirm(false);
    startAnalysis({
      taskId: taskId!,
      testIndex: 0,
      mode,
      runTimestamp: `beetree_${Date.now()}`
    });
  };

  const formatCost = (val: number) => `$${val.toFixed(2)}`;

  return (
    <div className="h-screen overflow-hidden bg-gray-50 text-gray-900 flex flex-col">
      {/* Compact Header */}
      <header className="bg-white border-b border-gray-300 px-2 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <a href="/" className="btn btn-ghost btn-xs gap-1">
            <ArrowLeft className="h-3 w-3" />
            Back
          </a>
          <div className="border-l border-gray-300 pl-2">
            <h1 className="text-xs font-bold text-gray-900">Beetree - {taskId}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="text-xs">
              <span className="font-semibold text-gray-600">Mode:</span>{' '}
              <span className="text-gray-900">{mode === 'testing' ? 'Testing (3 models)' : 'Production (8 models)'}</span>
            </div>
          )}
          {isRunning && (
            <button onClick={cancelAnalysis} className="btn btn-error btn-sm gap-1">
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
          )}
        </div>
      </header>

      {/* IDLE STATE: Configuration */}
      {!isRunning && !isDone && !hasError && (
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Hero */}
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-bold text-gray-900">Beetree Ensemble Solver</h2>
              <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                Multi-model consensus solver using GPT-5.1, Claude Opus, and Gemini Pro.
                Runs multiple frontier models in parallel and picks the most agreed-upon solution.
              </p>
              <button
                onClick={onStart}
                className="btn btn-primary btn-lg gap-3 text-lg font-bold uppercase tracking-wide shadow-2xl shadow-primary/40 px-12 py-6"
              >
                <Trees className="h-6 w-6" />
                Start Ensemble Analysis
              </button>
            </div>

            {/* Mode Selection */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card bg-white border border-gray-300 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="card-title text-sm">Analysis Mode</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label py-1">
                        <span className="label-text text-xs font-semibold">Mode</span>
                      </label>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as 'testing' | 'production')}
                        className="select select-bordered select-sm w-full"
                      >
                        <option value="testing">Testing - 3 models, $0.50-$2, 2-6 min</option>
                        <option value="production">Production - 8 models, $15-$50, 20-45 min</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card bg-white border border-gray-300 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="card-title text-sm">Cost Estimate</h3>
                  <div className="space-y-2 text-sm">
                    {mode === 'testing' ? (
                      <>
                        <div className="flex justify-between"><span>Models:</span><span className="font-bold">3</span></div>
                        <div className="flex justify-between"><span>Duration:</span><span className="font-bold">2-6 min</span></div>
                        <div className="flex justify-between"><span>Cost:</span><span className="font-bold text-green-600">$0.50 - $2.00</span></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between"><span>Models:</span><span className="font-bold">8</span></div>
                        <div className="flex justify-between"><span>Duration:</span><span className="font-bold">20-45 min</span></div>
                        <div className="flex justify-between"><span>Cost:</span><span className="font-bold text-amber-600">$15 - $50</span></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Puzzle Preview */}
            <div>
              <PuzzleGridDisplay
                task={task}
                showEmojis={false}
                showColorOnly={false}
                emojiSet={DEFAULT_EMOJI_SET}
              />
            </div>
          </div>
        </main>
      )}

      {/* RUNNING/DONE STATE */}
      {(isRunning || isDone || hasError) && (
        <main className="flex-1 overflow-hidden p-2">
          <div className="h-full grid grid-cols-12 gap-2">
            {/* LEFT: Status + Puzzle (4 cols) */}
            <div className="col-span-4 flex flex-col gap-2 overflow-y-auto">
              {/* Status Card */}
              <div className="bg-white border border-gray-300 rounded">
                <div className="border-b border-gray-300 bg-gray-50 px-2 py-1">
                  <h2 className="text-xs font-bold text-gray-700">STATUS</h2>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Mode:</span>
                    <span className="font-bold">{mode === 'testing' ? 'Testing' : 'Production'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Status:</span>
                    <span className={`font-bold ${isRunning ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-red-600'}`}>
                      {isRunning ? 'Running...' : isDone ? 'Complete' : 'Error'}
                    </span>
                  </div>
                  {cost && (
                    <div className="flex justify-between text-sm">
                      <span>Cost:</span>
                      <span className="font-bold text-green-600">{formatCost(cost.total_cost)}</span>
                    </div>
                  )}
                  {error && (
                    <div className="text-xs text-red-600 mt-2">{error}</div>
                  )}
                </div>
              </div>

              {/* Progress Log */}
              <div className="flex-1 bg-white border border-gray-300 rounded flex flex-col min-h-0">
                <div className="border-b border-gray-300 bg-gray-50 px-2 py-1">
                  <h2 className="text-xs font-bold text-gray-700">PROGRESS</h2>
                </div>
                <div className="flex-1 overflow-auto p-2 text-xs font-mono">
                  {progress.map((p, i) => (
                    <div key={i} className="py-0.5 border-b border-gray-100">
                      <span className="text-gray-500">[{p.stage}]</span> {p.status}
                      {p.event && <span className="text-gray-400"> - {p.event}</span>}
                    </div>
                  ))}
                  {progress.length === 0 && (
                    <div className="text-gray-400">Waiting for events...</div>
                  )}
                </div>
              </div>

              {/* Puzzle Grids */}
              <div className="bg-white border border-gray-300 rounded">
                <div className="border-b border-gray-300 bg-gray-50 px-2 py-1">
                  <h2 className="text-xs font-bold text-gray-700">PUZZLE GRIDS</h2>
                </div>
                <div className="p-2 space-y-3 max-h-[400px] overflow-y-auto">
                  {task.train.slice(0, 2).map((example, idx) => (
                    <div key={`train-${idx}`} className="space-y-1">
                      <div className="text-[10px] font-bold text-gray-600 uppercase">Training {idx + 1}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <PuzzleGrid grid={example.input} title="In" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} compact maxWidth={100} maxHeight={100} />
                        <PuzzleGrid grid={example.output} title="Out" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} compact maxWidth={100} maxHeight={100} />
                      </div>
                    </div>
                  ))}
                  {task.test.map((testCase, idx) => (
                    <div key={`test-${idx}`} className="space-y-1">
                      <div className="text-[10px] font-bold text-blue-600 uppercase">Test {idx + 1}</div>
                      <PuzzleGrid grid={testCase.input} title="Input" showEmojis={false} emojiSet={DEFAULT_EMOJI_SET} compact maxWidth={100} maxHeight={100} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CENTER: Results (5 cols) */}
            <div className="col-span-5 flex flex-col gap-2 min-h-0">
              {/* Token/Cost Metrics */}
              {cost && (
                <div className="bg-white border border-gray-300 rounded">
                  <div className="grid grid-cols-4 divide-x divide-gray-300">
                    <div className="p-2">
                      <div className="text-xs text-gray-600">Models</div>
                      <div className="text-sm font-bold text-gray-900">{cost.by_model.length}</div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs text-gray-600">Input Tokens</div>
                      <div className="text-sm font-bold text-gray-900">{cost.total_tokens.input.toLocaleString()}</div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs text-gray-600">Output Tokens</div>
                      <div className="text-sm font-bold text-gray-900">{cost.total_tokens.output.toLocaleString()}</div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs text-gray-600">Total Cost</div>
                      <div className="text-sm font-bold text-green-600">{formatCost(cost.total_cost)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Running State */}
              {isRunning && (
                <div className="flex-1 bg-white border border-blue-300 rounded flex flex-col min-h-0">
                  <div className="border-b border-blue-300 bg-blue-50 px-3 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-blue-700">ENSEMBLE RUNNING</h3>
                    <span className="text-xs text-blue-600 font-bold">STREAMING</span>
                  </div>
                  <div className="flex-1 overflow-auto p-3 bg-blue-50">
                    <div className="text-sm text-gray-700">
                      Running {mode === 'testing' ? '3' : '8'} models in parallel...
                      <br /><br />
                      Models will vote on the best prediction. Progress events shown in the left panel.
                    </div>
                  </div>
                </div>
              )}

              {/* Results State */}
              {isDone && results && (
                <div className="flex-1 bg-white border border-green-300 rounded flex flex-col min-h-0">
                  <div className="border-b border-green-300 bg-green-50 px-3 py-2">
                    <h3 className="text-sm font-bold text-green-700">ENSEMBLE RESULT</h3>
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-2">CONSENSUS PREDICTION</div>
                        {results.predictions[0] && (
                          <PuzzleGrid
                            grid={results.predictions[0]}
                            title="Prediction"
                            showEmojis={false}
                            emojiSet={DEFAULT_EMOJI_SET}
                            compact
                            maxWidth={200}
                            maxHeight={200}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Consensus:</span>{' '}
                          <span className="font-bold">
                            {((results.consensus?.strength ?? 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Agreement:</span>{' '}
                          <span className="font-bold">{results.consensus?.agreement_count ?? 0} models</span>
                        </div>
                      </div>
                      <button onClick={clearResults} className="btn btn-outline btn-sm">
                        Run Again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {hasError && (
                <div className="flex-1 bg-white border border-red-300 rounded flex flex-col min-h-0">
                  <div className="border-b border-red-300 bg-red-50 px-3 py-2">
                    <h3 className="text-sm font-bold text-red-700">ERROR</h3>
                  </div>
                  <div className="flex-1 overflow-auto p-3 bg-red-50">
                    <div className="text-sm text-red-700">{error || 'An error occurred'}</div>
                    <button onClick={clearResults} className="btn btn-outline btn-sm mt-4">
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Model Breakdown (3 cols) */}
            <div className="col-span-3 overflow-y-auto">
              <div className="bg-white border border-gray-300 rounded">
                <div className="border-b border-gray-300 bg-gray-50 px-2 py-1">
                  <h2 className="text-xs font-bold text-gray-700">MODEL COSTS</h2>
                </div>
                <div className="p-2 space-y-1">
                  {cost?.by_model.map((m, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="truncate max-w-[120px]">{m.model_name}</span>
                      <span className="font-bold">{formatCost(m.cost)}</span>
                    </div>
                  ))}
                  {(!cost || cost.by_model.length === 0) && (
                    <div className="text-xs text-gray-400">No model data yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Production Confirmation Modal */}
      {showConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-amber-600">Confirm Production Mode</h3>
            <p className="py-4">
              Production mode runs <strong>8 frontier AI models</strong> and costs <strong>$15-$50</strong>.
              This will take 20-45 minutes. Are you sure?
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-warning" onClick={doStart}>Start Production</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

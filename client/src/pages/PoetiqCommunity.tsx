/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-26
 * PURPOSE: Poetiq Community Solver landing page - explains what Poetiq is, shows progress,
 *          and enables community contribution via BYO API keys.
 *          Goal: Let the community collectively verify Poetiq's claims on the ARC2-Eval dataset.
 * 
 * SRP/DRY check: Pass - Page orchestration only, delegates to components and hooks
 */

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { usePoetiqProgress } from '@/hooks/usePoetiqProgress';
import { 
  Users, 
  Zap, 
  ArrowRight, 
  ExternalLink,
  RefreshCw,
  Play,
  Key,
  Loader2,
  CheckCircle,
  Target,
  Code
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PoetiqExplainer } from '@/components/poetiq/PoetiqExplainer';
import { PuzzleProgressGrid } from '@/components/poetiq/PuzzleProgressGrid';
import { usePoetiqCommunityProgress } from '@/hooks/usePoetiqCommunityProgress';

// Poetiq ONLY uses Gemini 3 Pro Preview via OpenRouter
// This is hardcoded in poetiq-solver/arc_agi/config.py
const POETIQ_MODEL = {
  id: 'google/gemini-3-pro-preview',
  name: 'Gemini 3 Pro Preview',
  provider: 'OpenRouter',
  keyUrl: 'https://openrouter.ai/keys',
  keyPlaceholder: 'sk-or-... (from openrouter.ai/keys)',
};

// Expert count options - ONLY 1, 2, 8 (from config.py)
// Gemini-3-a: 1 expert, Gemini-3-b: 2 experts, Gemini-3-c: 8 experts
const EXPERT_OPTIONS = [
  { value: '1', label: 'Gemini-3-a (1 Expert)', description: 'Fastest, lowest cost' },
  { value: '2', label: 'Gemini-3-b (2 Experts)', description: 'Default, good balance' },
  { value: '8', label: 'Gemini-3-c (8 Experts)', description: 'Best accuracy, highest cost' },
];

export default function PoetiqCommunity() {
  const [, navigate] = useLocation();
  const progress = usePoetiqCommunityProgress();
  
  // Configuration state - Poetiq always uses OpenRouter with Gemini 3 Pro
  const [apiKey, setApiKey] = useState('');
  const [numExperts, setNumExperts] = useState('2');
  
  // Active solver state - which puzzle are we currently solving?
  const [activePuzzle, setActivePuzzle] = useState<string | null>(null);
  const solverProgress = usePoetiqProgress(activePuzzle || undefined);

  // Set page title
  useEffect(() => {
    document.title = 'Poetiq Community Solver - Help Verify the Benchmark';
  }, []);

  const nextPuzzle = progress.getNextRecommended();
  const isRunning = solverProgress.state.status === 'running';
  const isDone = solverProgress.state.status === 'completed';
  const hasError = solverProgress.state.status === 'error';
  const canStart = apiKey.trim().length > 10 && nextPuzzle && !isRunning;

  const handleRunNext = () => {
    if (!nextPuzzle || !apiKey.trim()) return;
    
    // Set active puzzle and start solver directly
    setActivePuzzle(nextPuzzle);
    // Poetiq always uses OpenRouter with Gemini 3 Pro Preview
    solverProgress.start({
      apiKey,
      provider: 'openrouter',
      model: POETIQ_MODEL.id,
      numExperts: parseInt(numExperts, 10),
      temperature: 1.0,  // Fixed per config.py
    });
  };

  // When solver completes, refresh progress and clear active puzzle after delay
  useEffect(() => {
    if (isDone || hasError) {
      // Refresh progress grid after completion
      setTimeout(() => {
        progress.refetch();
      }, 2000);
    }
  }, [isDone, hasError, progress]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 py-6">
          <div className="flex items-center justify-center gap-3">
            <Code className="h-10 w-10 text-indigo-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Poetiq Community Solver
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Help verify state-of-the-art ARC solving by donating your API quota
          </p>
          
          {/* Quick Stats */}
          <div className="flex items-center justify-center gap-8 pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600">
                {progress.isLoading ? '...' : progress.total}
              </div>
              <div className="text-sm text-gray-500">Total Puzzles</div>
            </div>
            <div className="h-12 w-px bg-gray-300" />
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {progress.isLoading ? '...' : progress.solved}
              </div>
              <div className="text-sm text-gray-500">Solved</div>
            </div>
            <div className="h-12 w-px bg-gray-300" />
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">
                {progress.isLoading ? '...' : progress.unattempted}
              </div>
              <div className="text-sm text-gray-500">Need Help</div>
            </div>
            <div className="h-12 w-px bg-gray-300" />
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {progress.isLoading ? '...' : `${progress.completionPercentage}%`}
              </div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>

          {/* Progress Bar */}
          {!progress.isLoading && (
            <div className="max-w-md mx-auto pt-2">
              <Progress 
                value={progress.completionPercentage} 
                className="h-3"
              />
            </div>
          )}
        </div>

        {/* Quick Start Card */}
        <Card className="border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              Quick Start — Run the Next Puzzle
            </CardTitle>
            <CardDescription>
              Enter your API key and click to immediately help with the next unsolved puzzle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Next Puzzle Info */}
            {nextPuzzle ? (
              <div className="flex items-center gap-3 bg-green-100 rounded-lg p-3">
                <Target className="h-5 w-5 text-green-600" />
                <div>
                  <span className="text-sm text-green-800">Next puzzle needing help:</span>
                  <Badge variant="outline" className="ml-2 font-mono">
                    {nextPuzzle}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-3">
                <CheckCircle className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {progress.isLoading ? 'Loading puzzles...' : 'All puzzles have been attempted!'}
                </span>
              </div>
            )}

            {/* Model Info - Fixed to Gemini 3 Pro Preview */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-teal-600" />
                <div>
                  <span className="font-medium text-teal-800">Model: {POETIQ_MODEL.name}</span>
                  <span className="text-xs text-teal-600 ml-2">via {POETIQ_MODEL.provider}</span>
                </div>
              </div>
              <p className="text-xs text-teal-700 mt-1">
                Poetiq uses {POETIQ_MODEL.id} - the model is fixed per the solver configuration.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  OpenRouter API Key
                </Label>
                <a 
                  href={POETIQ_MODEL.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                >
                  Get your key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <form onSubmit={(e) => e.preventDefault()}>
                <Input
                  type="password"
                  placeholder={POETIQ_MODEL.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono"
                  autoComplete="new-password"
                />
              </form>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                <h4 className="font-medium text-blue-800 text-sm mb-1">🔐 API Key Security</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Key is passed directly to Python subprocess environment</li>
                  <li>• Never stored in database, files, or server memory</li>
                  <li>• Process terminates → key is permanently destroyed</li>
                  <li>• No logging or persistence of any kind</li>
                  <li>• HTTPS required for key transmission</li>
                </ul>
              </div>
            </div>

            {/* Expert Count */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Expert Count
              </Label>
              <Select value={numExperts} onValueChange={setNumExperts}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-gray-500">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Run Button */}
            <Button
              onClick={handleRunNext}
              disabled={!canStart}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Running on {activePuzzle}...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Run Solver on {nextPuzzle || 'Next Puzzle'}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>

            {!apiKey && !isRunning && (
              <p className="text-center text-sm text-gray-500">
                Enter your API key to start helping
              </p>
            )}

            {/* Live Progress Display */}
            {(isRunning || isDone || hasError) && activePuzzle && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {isDone && solverProgress.state.result?.isPredictionCorrect && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {isDone && !solverProgress.state.result?.isPredictionCorrect && (
                      <Target className="h-4 w-4 text-amber-500" />
                    )}
                    {hasError && <Target className="h-4 w-4 text-red-500" />}
                    <span className="font-medium">Puzzle: {activePuzzle}</span>
                  </div>
                  <Badge variant={isRunning ? 'default' : isDone ? 'secondary' : 'destructive'}>
                    {solverProgress.state.status.toUpperCase()}
                  </Badge>
                </div>
                
                {/* Progress message */}
                {solverProgress.state.message && (
                  <p className="text-sm text-gray-600 mb-2">{solverProgress.state.message}</p>
                )}
                
                {/* Iteration progress bar */}
                {isRunning && solverProgress.state.iteration !== undefined && solverProgress.state.totalIterations && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Iteration {solverProgress.state.iteration}</span>
                      <span>{solverProgress.state.totalIterations} max</span>
                    </div>
                    <Progress 
                      value={(solverProgress.state.iteration / solverProgress.state.totalIterations) * 100}
                      className="h-2"
                    />
                  </div>
                )}
                
                {/* Result display */}
                {isDone && solverProgress.state.result && (
                  <div className="mt-2 p-2 rounded bg-gray-50">
                    <div className="flex items-center gap-2 text-sm">
                      {solverProgress.state.result.isPredictionCorrect ? (
                        <span className="text-green-700 font-medium">✓ Correct!</span>
                      ) : (
                        <span className="text-amber-700 font-medium">✗ Incorrect</span>
                      )}
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">
                        {solverProgress.state.result.iterationCount} iterations
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">
                        {Math.round((solverProgress.state.result.elapsedMs || 0) / 1000)}s
                      </span>
                    </div>
                    <Link href={`/puzzle/poetiq/${activePuzzle}`}>
                      <Button variant="link" size="sm" className="p-0 h-auto mt-1">
                        View full details →
                      </Button>
                    </Link>
                  </div>
                )}
                
                {/* Error display */}
                {hasError && (
                  <div className="mt-2 p-2 rounded bg-red-50 text-red-700 text-sm">
                    {solverProgress.state.message || 'Solver failed'}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works Explainer */}
        <PoetiqExplainer defaultOpen={false} />

        {/* Puzzle Progress Grid */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-800">All Puzzles</h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={progress.refetch}
            disabled={progress.isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${progress.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <PuzzleProgressGrid 
          puzzles={progress.puzzles}
          isLoading={progress.isLoading}
        />

        {/* Footer Links */}
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="py-6">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <a 
                href="https://poetiq.ai/posts/arcagi_announcement/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1"
              >
                Poetiq Blog Post <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-gray-300">|</span>
              <a 
                href="https://github.com/82deutschmark/poetiq-arc-agi-solver"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1"
              >
                Poetiq Solver Repo <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-gray-300">|</span>
              <a 
                href="https://arcprize.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1"
              >
                ARC Prize <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-gray-300">|</span>
              <a 
                href="https://discord.gg/9b77dPAmcA"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1"
              >
                Our Discord <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

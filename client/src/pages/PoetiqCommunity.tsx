/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Poetiq Community Solver landing page - clean, professional, information-dense design
 *          matching the analytics page aesthetic. Shows progress and enables community contribution.
 *
 * SRP/DRY check: Pass - Page orchestration only, delegates to components and hooks
 */

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Users,
  Zap,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Play,
  Key,
  CheckCircle,
  Target,
  Code,
  AlertCircle
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

// Poetiq community page is locked to Gemini 3 Pro Preview
// Can use EITHER OpenRouter OR Gemini Direct API
const POETIQ_PROVIDERS = [
  {
    value: 'openrouter',
    label: 'OpenRouter',
    modelId: 'openrouter/google/gemini-3-pro-preview',
    keyUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-... (from openrouter.ai/keys)'
  },
  {
    value: 'gemini',
    label: 'Gemini Direct',
    modelId: 'gemini/gemini-3-pro-preview',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIza... (from aistudio.google.com)'
  },
] as const;

const POETIQ_MODEL_NAME = 'Gemini 3 Pro Preview';

// Expert count options - ONLY 1, 2, 8 (from config.py)
const EXPERT_OPTIONS = [
  { value: '1', label: 'Gemini-3-a (1 Expert)', description: 'Fastest, lowest cost' },
  { value: '2', label: 'Gemini-3-b (2 Experts)', description: 'Default, good balance' },
  { value: '8', label: 'Gemini-3-c (8 Experts)', description: 'Best accuracy, highest cost' },
];

export default function PoetiqCommunity() {
  const [, navigate] = useLocation();
  const progress = usePoetiqCommunityProgress();

  // Configuration state
  const [provider, setProvider] = useState<'openrouter' | 'gemini'>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [numExperts, setNumExperts] = useState('2');

  // Get selected provider config
  const selectedProvider = POETIQ_PROVIDERS.find(p => p.value === provider)!;

  // Set page title
  useEffect(() => {
    document.title = 'Poetiq Community Solver - Help Verify the Benchmark';
  }, []);

  const nextPuzzle = progress.getNextRecommended();
  const canStart = !!nextPuzzle;
  const usingProjectKey = !apiKey.trim();

  const handleRunNext = () => {
    if (!nextPuzzle) return;

    // Store config in sessionStorage for the solver page to use
    sessionStorage.setItem('poetiq_config', JSON.stringify({
      apiKey,
      provider,
      model: selectedProvider.modelId,
      numExperts: parseInt(numExperts, 10),
      temperature: 1.0,
      autoStart: true,
    }));

    // Navigate to full solver page
    navigate(`/puzzle/poetiq/${nextPuzzle}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-4">

        {/* Header with Stats */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-indigo-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Code className="h-6 w-6 text-indigo-600" />
                  Poetiq Community Solver
                </CardTitle>
                <CardDescription className="mt-1">
                  Help verify state-of-the-art ARC solving by donating your API quota
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress Overview */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600">
                  {progress.isLoading ? '...' : progress.total}
                </div>
                <div className="text-xs text-gray-600">Total Puzzles</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {progress.isLoading ? '...' : progress.solved}
                </div>
                <div className="text-xs text-gray-600">Solved</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">
                  {progress.isLoading ? '...' : progress.unattempted}
                </div>
                <div className="text-xs text-gray-600">Need Help</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600">
                  {progress.isLoading ? '...' : `${progress.completionPercentage}%`}
                </div>
                <div className="text-xs text-gray-600">Complete</div>
              </div>
            </div>

            {/* Progress Bar */}
            {!progress.isLoading && (
              <div>
                <Progress value={progress.completionPercentage} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{progress.solved} solved</span>
                  <span>{progress.unattempted} remaining</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Start Card */}
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              Quick Start — Run Next Puzzle
            </CardTitle>
            <CardDescription>
              Configure your settings and click to immediately solve the next puzzle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Next Puzzle Info */}
            {nextPuzzle ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2 text-sm">
                <Target className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-green-800">Next puzzle:</span>
                <Badge variant="outline" className="font-mono bg-white">
                  {nextPuzzle}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded p-2 text-sm">
                <CheckCircle className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">
                  {progress.isLoading ? 'Loading...' : 'All puzzles attempted!'}
                </span>
              </div>
            )}

            {/* Model Info */}
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="flex items-center gap-2 text-sm">
                <Code className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Model: {POETIQ_MODEL_NAME}</span>
                <span className="text-xs text-blue-600">(locked for community)</span>
              </div>
            </div>

            {/* Provider and Expert Settings */}
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">API Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as 'openrouter' | 'gemini')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POETIQ_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Expert Count
                </Label>
                <Select value={numExperts} onValueChange={setNumExperts}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1">
                  <Key className="h-3 w-3" />
                  {selectedProvider.label} API Key (Optional)
                </Label>
                <a
                  href={selectedProvider.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"
                >
                  Get key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Input
                type="password"
                placeholder={selectedProvider.keyPlaceholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
                autoComplete="new-password"
              />

              {/* Key Status Info */}
              {usingProjectKey ? (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Using project key:</strong> May experience rate limits during peak usage.
                      For guaranteed access, enter your own key above.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-800">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Using your key:</strong> Passed directly to Python subprocess, never stored.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Run Button */}
            <Button
              onClick={handleRunNext}
              disabled={!canStart}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              Run Solver on {nextPuzzle || 'Next Puzzle'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            {usingProjectKey && canStart && (
              <p className="text-center text-xs text-amber-600">
                Using shared project key (may encounter rate limits)
              </p>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <PoetiqExplainer defaultOpen={false} />

        {/* Puzzle Progress Grid */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-800">All Puzzles</h2>
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
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <a
                href="https://poetiq.ai/posts/arcagi_announcement/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1"
              >
                Poetiq Blog <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://github.com/82deutschmark/poetiq-arc-agi-solver"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1"
              >
                Solver Repo <ExternalLink className="h-3 w-3" />
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
                Discord <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

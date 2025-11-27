/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Poetiq Community Solver landing page - compact layout with grid as primary focus
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
  AlertCircle,
  ChevronDown,
  ChevronUp
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
const POETIQ_PROVIDERS = [
  {
    value: 'openrouter',
    label: 'OpenRouter',
    modelId: 'openrouter/google/gemini-3-pro-preview',
    keyUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-...'
  },
  {
    value: 'gemini',
    label: 'Gemini Direct',
    modelId: 'gemini/gemini-3-pro-preview',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIza...'
  },
] as const;

const EXPERT_OPTIONS = [
  { value: '1', label: '1 Expert' },
  { value: '2', label: '2 Experts' },
  { value: '8', label: '8 Experts' },
];

export default function PoetiqCommunity() {
  const [, navigate] = useLocation();
  const progress = usePoetiqCommunityProgress();
  const [showSettings, setShowSettings] = useState(false);

  // Configuration state
  const [provider, setProvider] = useState<'openrouter' | 'gemini'>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [numExperts, setNumExperts] = useState('2');

  const selectedProvider = POETIQ_PROVIDERS.find(p => p.value === provider)!;

  useEffect(() => {
    document.title = 'Poetiq Community Solver';
  }, []);

  const nextPuzzle = progress.getNextRecommended();
  const canStart = !!nextPuzzle;
  const usingProjectKey = !apiKey.trim();

  const handleRunNext = () => {
    if (!nextPuzzle) return;

    sessionStorage.setItem('poetiq_config', JSON.stringify({
      apiKey,
      provider,
      model: selectedProvider.modelId,
      numExperts: parseInt(numExperts, 10),
      temperature: 1.0,
      autoStart: true,
    }));

    navigate(`/puzzle/poetiq/${nextPuzzle}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 space-y-3">

        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Code className="h-5 w-5 text-indigo-600" />
              Poetiq Community Solver
            </h1>
            <p className="text-sm text-gray-600">
              Help verify ARC solving — {progress.solved}/{progress.total} solved ({progress.completionPercentage}%)
            </p>
          </div>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
            size="sm"
          >
            {showSettings ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
            {showSettings ? 'Hide' : 'Show'} Settings
          </Button>
        </div>

        {/* Collapsible Settings */}
        {showSettings && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Start Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Next Puzzle */}
              {nextPuzzle && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2 text-sm">
                  <Target className="h-4 w-4 text-green-600" />
                  <span>Next:</span>
                  <Badge variant="outline" className="font-mono">{nextPuzzle}</Badge>
                </div>
              )}

              {/* Settings Grid */}
              <div className="grid md:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Provider</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POETIQ_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Expert Count</Label>
                  <Select value={numExperts} onValueChange={setNumExperts}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">API Key (Optional)</Label>
                  <Input
                    type="password"
                    placeholder={selectedProvider.keyPlaceholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                {usingProjectKey ? (
                  <span>Using project key (may be rate limited). <a href={selectedProvider.keyUrl} target="_blank" className="text-indigo-600 underline">Get your own</a></span>
                ) : (
                  <span>Using your key — passed directly to Python, never stored</span>
                )}
              </div>

              {/* Run Button */}
              <Button
                onClick={handleRunNext}
                disabled={!canStart}
                className="w-full bg-green-600 hover:bg-green-700 h-9"
              >
                <Play className="h-4 w-4 mr-2" />
                Run Solver on {nextPuzzle || 'Next Puzzle'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Content: Puzzle Grid */}
        <PuzzleProgressGrid
          puzzles={progress.puzzles}
          isLoading={progress.isLoading}
        />

        {/* How It Works - Collapsed by default */}
        <PoetiqExplainer defaultOpen={false} />

        {/* Footer Links */}
        <div className="text-center text-xs text-gray-500 space-x-3">
          <a href="https://poetiq.ai/posts/arcagi_announcement/" target="_blank" className="text-indigo-600 hover:underline">
            Blog
          </a>
          <span>·</span>
          <a href="https://github.com/82deutschmark/poetiq-arc-agi-solver" target="_blank" className="text-indigo-600 hover:underline">
            Repo
          </a>
          <span>·</span>
          <a href="https://arcprize.org/" target="_blank" className="text-indigo-600 hover:underline">
            ARC Prize
          </a>
          <span>·</span>
          <a href="https://discord.gg/9b77dPAmcA" target="_blank" className="text-indigo-600 hover:underline">
            Discord
          </a>
        </div>
      </div>
    </div>
  );
}

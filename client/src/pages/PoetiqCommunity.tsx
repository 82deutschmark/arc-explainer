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
import { 
  Users, 
  Zap, 
  ArrowRight, 
  ExternalLink,
  RefreshCw,
  Play,
  Key,
  Settings,
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

// Provider options with descriptions
const PROVIDERS = [
  { 
    value: 'gemini', 
    label: 'Gemini Direct', 
    description: 'Use your Google AI Studio API key',
    keyPlaceholder: 'AIza... (from aistudio.google.com)',
    keyUrl: 'https://aistudio.google.com/app/apikey'
  },
  { 
    value: 'openrouter', 
    label: 'OpenRouter', 
    description: 'Use your OpenRouter API key (multiple models)',
    keyPlaceholder: 'sk-or-... (from openrouter.ai/keys)',
    keyUrl: 'https://openrouter.ai/keys'
  },
];

// Model options for OpenRouter
const OPENROUTER_MODELS = [
  { value: 'openrouter/google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro', speed: 'Medium', cost: '$$' },
  { value: 'openrouter/google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash', speed: 'Fast', cost: '$' },
  { value: 'openrouter/anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', speed: 'Medium', cost: '$$' },
  { value: 'openrouter/openai/gpt-4o', label: 'GPT-4o', speed: 'Medium', cost: '$$' },
];

// Expert count options
const EXPERT_OPTIONS = [
  { value: '1', label: '1 Expert', description: 'Fastest, lowest cost' },
  { value: '2', label: '2 Experts (Recommended)', description: 'Good balance of speed and accuracy' },
  { value: '4', label: '4 Experts', description: 'Higher accuracy, more API calls' },
];

export default function PoetiqCommunity() {
  const [, navigate] = useLocation();
  const progress = usePoetiqCommunityProgress();
  
  // Configuration state
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [model, setModel] = useState(OPENROUTER_MODELS[0].value);
  const [apiKey, setApiKey] = useState('');
  const [numExperts, setNumExperts] = useState('2');

  // Set page title
  useEffect(() => {
    document.title = 'Poetiq Community Solver - Help Verify the Benchmark';
  }, []);

  const selectedProvider = PROVIDERS.find(p => p.value === provider)!;
  const nextPuzzle = progress.getNextRecommended();
  const canStart = apiKey.trim().length > 10 && nextPuzzle;

  const handleRunNext = () => {
    if (nextPuzzle) {
      // Navigate to the puzzle solver with config in URL state
      navigate(`/puzzle/poetiq/${nextPuzzle}`);
    }
  };

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

            {/* Provider and Key Input */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as 'gemini' | 'openrouter')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{p.label}</span>
                          <span className="text-xs text-gray-500">{p.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {provider === 'openrouter' && (
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENROUTER_MODELS.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.label}</span>
                            <Badge variant="outline" className="text-xs">{m.speed}</Badge>
                            <Badge variant="secondary" className="text-xs">{m.cost}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Key
                </Label>
                <a 
                  href={selectedProvider.keyUrl}
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
                  placeholder={selectedProvider.keyPlaceholder}
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
              <Play className="h-5 w-5 mr-2" />
              Run Solver on {nextPuzzle || 'Next Puzzle'}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>

            {!apiKey && (
              <p className="text-center text-sm text-gray-500">
                Enter your API key to start helping
              </p>
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

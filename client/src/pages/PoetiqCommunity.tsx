/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Poetiq Community Solver landing page - redesigned with Modern Scientific Dashboard aesthetic.
 *          Dark theme with electric cyan/lime accents, glowing effects, and technical typography.
 *          Enables community contribution via BYO API keys for ARC puzzle solving verification.
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
  Loader2,
  CheckCircle,
  Target,
  Code,
  Activity,
  Sparkles
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
// Gemini-3-a: 1 expert, Gemini-3-b: 2 experts, Gemini-3-c: 8 experts
const EXPERT_OPTIONS = [
  { value: '1', label: 'Gemini-3-a (1 Expert)', description: 'Fastest, lowest cost' },
  { value: '2', label: 'Gemini-3-b (2 Experts)', description: 'Default, good balance' },
  { value: '8', label: 'Gemini-3-c (8 Experts)', description: 'Best accuracy, highest cost' },
];

export default function PoetiqCommunity() {
  const [, navigate] = useLocation();
  const progress = usePoetiqCommunityProgress();

  // Configuration state - provider choice (OpenRouter or Gemini Direct), both locked to Gemini 3 Pro
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
  // API key is optional - falls back to project key if not provided
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

    // Navigate to full solver page with rich feedback UI
    navigate(`/puzzle/poetiq/${nextPuzzle}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0f1922 100%)',
    }}>
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `
          linear-gradient(rgba(0, 217, 255, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 217, 255, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        animation: 'gridMove 20s linear infinite',
      }}></div>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
      }}></div>

      <style>{`
        @keyframes gridMove {
          0% { transform: translateY(0); }
          100% { transform: translateY(50px); }
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 217, 255, 0.3), 0 0 40px rgba(0, 217, 255, 0.1); }
          50% { box-shadow: 0 0 30px rgba(0, 217, 255, 0.5), 0 0 60px rgba(0, 217, 255, 0.2); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes slideInUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .animate-slide-in-up {
          animation: slideInUp 0.6s ease-out forwards;
        }

        .glow-border {
          position: relative;
          border: 1px solid rgba(0, 217, 255, 0.3);
        }

        .glow-border::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.4), rgba(180, 255, 57, 0.4));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .glow-border:hover::before {
          opacity: 1;
        }

        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .font-orbitron { font-family: 'Orbitron', sans-serif; }
        .font-ibm { font-family: 'IBM Plex Sans', sans-serif; }
        .font-jetbrains { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">

        {/* Hero Section - Asymmetric Layout */}
        <div className="mb-16 grid md:grid-cols-12 gap-8 items-center animate-slide-in-up">
          <div className="md:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30" style={{
              boxShadow: '0 0 20px rgba(0, 217, 255, 0.2)',
            }}>
              <Activity className="h-4 w-4 text-cyan-400" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              <span className="text-cyan-300 text-sm font-jetbrains font-medium tracking-wide">LIVE RESEARCH STATION</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-orbitron font-black tracking-tight" style={{
              background: 'linear-gradient(135deg, #00d9ff 0%, #b4ff39 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: '1.1',
            }}>
              POETIQ<br/>COMMUNITY<br/>SOLVER
            </h1>

            <p className="text-xl font-ibm text-gray-300 leading-relaxed max-w-xl">
              Join the distributed research effort. Donate your API quota to help verify
              state-of-the-art ARC puzzle solving capabilities.
            </p>

            <div className="flex gap-4 pt-4">
              <a
                href="https://poetiq.ai/posts/arcagi_announcement/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all duration-300 font-ibm font-medium"
                style={{ boxShadow: '0 0 15px rgba(0, 217, 255, 0.15)' }}
              >
                <ExternalLink className="h-4 w-4" />
                Research Blog
              </a>
              <a
                href="https://github.com/82deutschmark/poetiq-arc-agi-solver"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all duration-300 font-ibm font-medium"
              >
                <Code className="h-4 w-4" />
                Source Code
              </a>
            </div>
          </div>

          {/* Stats Dashboard */}
          <div className="md:col-span-5 grid grid-cols-2 gap-4">
            <div className="col-span-2 p-6 rounded-xl glow-border transition-all duration-300" style={{
              background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.05) 0%, rgba(180, 255, 57, 0.05) 100%)',
              backdropFilter: 'blur(10px)',
            }}>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-cyan-400" />
                <span className="text-sm font-jetbrains text-cyan-300 uppercase tracking-wider">Progress</span>
              </div>
              <div className="text-5xl font-orbitron font-black text-white mb-2">
                {progress.isLoading ? '...' : `${progress.completionPercentage}%`}
              </div>
              <Progress
                value={progress.completionPercentage}
                className="h-2 bg-gray-800"
                style={{
                  background: 'rgba(31, 41, 55, 0.5)',
                }}
              />
              <div className="text-sm text-gray-400 mt-2 font-ibm">
                {progress.solved} / {progress.total} puzzles verified
              </div>
            </div>

            <div className="p-6 rounded-xl glow-border transition-all duration-300" style={{
              background: 'rgba(180, 255, 57, 0.05)',
              backdropFilter: 'blur(10px)',
            }}>
              <div className="text-3xl font-orbitron font-black text-lime-400 mb-1">
                {progress.isLoading ? '...' : progress.solved}
              </div>
              <div className="text-xs font-jetbrains text-lime-300/80 uppercase tracking-wider">
                Solved
              </div>
            </div>

            <div className="p-6 rounded-xl glow-border transition-all duration-300" style={{
              background: 'rgba(255, 149, 0, 0.05)',
              backdropFilter: 'blur(10px)',
            }}>
              <div className="text-3xl font-orbitron font-black text-amber-400 mb-1">
                {progress.isLoading ? '...' : progress.unattempted}
              </div>
              <div className="text-xs font-jetbrains text-amber-300/80 uppercase tracking-wider">
                Pending
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Launch Pad */}
        <div className="mb-12 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="p-8 rounded-2xl relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.08) 0%, rgba(180, 255, 57, 0.08) 100%)',
            border: '1px solid rgba(0, 217, 255, 0.2)',
            boxShadow: '0 0 40px rgba(0, 217, 255, 0.15), inset 0 0 60px rgba(0, 217, 255, 0.03)',
          }}>
            {/* Diagonal accent line */}
            <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-lime-400 opacity-50" style={{
              transform: 'skewX(-10deg)',
              transformOrigin: 'top',
            }}></div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/30" style={{
                  animation: 'glow 3s ease-in-out infinite',
                }}>
                  <Zap className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-orbitron font-bold text-white">Launch Mission Control</h2>
                  <p className="text-sm font-ibm text-gray-400">Configure and deploy solver on next priority target</p>
                </div>
              </div>

              {/* Next Puzzle Target */}
              {nextPuzzle ? (
                <div className="mb-6 p-4 rounded-lg flex items-center gap-3" style={{
                  background: 'rgba(180, 255, 57, 0.1)',
                  border: '1px solid rgba(180, 255, 57, 0.3)',
                }}>
                  <Target className="h-5 w-5 text-lime-400" />
                  <div className="flex-1">
                    <span className="text-sm font-ibm text-lime-300">Next Priority Target</span>
                  </div>
                  <Badge className="font-jetbrains bg-lime-500/20 text-lime-300 border-lime-500/30 hover:bg-lime-500/30">
                    {nextPuzzle}
                  </Badge>
                </div>
              ) : (
                <div className="mb-6 p-4 rounded-lg flex items-center gap-3" style={{
                  background: 'rgba(107, 114, 128, 0.1)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                }}>
                  <CheckCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-ibm text-gray-400">
                    {progress.isLoading ? 'Scanning database...' : 'All targets have been engaged'}
                  </span>
                </div>
              )}

              {/* Model Lock Info */}
              <div className="mb-6 p-4 rounded-lg" style={{
                background: 'rgba(0, 217, 255, 0.05)',
                border: '1px solid rgba(0, 217, 255, 0.2)',
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <Code className="h-4 w-4 text-cyan-400" />
                  <span className="font-jetbrains text-cyan-300 text-sm uppercase tracking-wider">System Configuration</span>
                </div>
                <div className="text-white font-ibm font-semibold">{POETIQ_MODEL_NAME}</div>
                <p className="text-xs text-gray-400 mt-1 font-ibm">
                  Community verification locked to Gemini 3 Pro Preview for consistency
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Provider Selection */}
                <div className="space-y-3">
                  <Label className="text-gray-300 font-ibm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    API Provider
                  </Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as 'openrouter' | 'gemini')}>
                    <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white font-ibm hover:border-cyan-500/50 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {POETIQ_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value} className="text-white font-ibm">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Expert Count */}
                <div className="space-y-3">
                  <Label className="text-gray-300 font-ibm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-lime-400" />
                    Expert Configuration
                  </Label>
                  <Select value={numExperts} onValueChange={setNumExperts}>
                    <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white font-ibm hover:border-lime-500/50 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {EXPERT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-white font-ibm">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 font-ibm font-medium flex items-center gap-2">
                    <Key className="h-4 w-4 text-amber-400" />
                    {selectedProvider.label} API Key (Optional)
                  </Label>
                  <a
                    href={selectedProvider.keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-ibm transition-colors"
                  >
                    Obtain Credentials <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  type="password"
                  placeholder={selectedProvider.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-gray-900/50 border-gray-700 text-white font-jetbrains placeholder:text-gray-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                  autoComplete="new-password"
                />

                {/* Security Info */}
                {usingProjectKey ? (
                  <div className="p-3 rounded-lg" style={{
                    background: 'rgba(255, 149, 0, 0.08)',
                    border: '1px solid rgba(255, 149, 0, 0.3)',
                  }}>
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-300 font-ibm leading-relaxed">
                        <strong className="text-amber-200">Using Project API Key:</strong> Shared key may experience rate limits during peak usage.
                        For guaranteed access, provide your own key above.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg" style={{
                    background: 'rgba(180, 255, 57, 0.08)',
                    border: '1px solid rgba(180, 255, 57, 0.3)',
                  }}>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-lime-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-lime-300 font-ibm leading-relaxed">
                        <strong className="text-lime-200">Zero-Persistence Protocol:</strong> Key transmitted via HTTPS, injected into subprocess,
                        never logged. Process termination = permanent destruction.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-6 bg-gray-700/50" />

              {/* Launch Button */}
              <Button
                onClick={handleRunNext}
                disabled={!canStart}
                size="lg"
                className="w-full font-orbitron font-bold text-lg tracking-wide transition-all duration-300 disabled:opacity-50"
                style={{
                  background: canStart
                    ? 'linear-gradient(135deg, #00d9ff 0%, #b4ff39 100%)'
                    : 'rgba(107, 114, 128, 0.3)',
                  color: canStart ? '#0f1419' : '#6b7280',
                  boxShadow: canStart
                    ? '0 0 30px rgba(0, 217, 255, 0.4), 0 4px 20px rgba(0, 0, 0, 0.3)'
                    : 'none',
                }}
              >
                {canStart ? (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    INITIATE SOLVER — {nextPuzzle}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    SCANNING FOR TARGETS
                  </>
                )}
              </Button>

              {usingProjectKey && canStart && (
                <p className="text-center text-sm text-amber-400 mt-3 font-ibm">
                  Using shared project key (may encounter rate limits)
                </p>
              )}

              <p className="text-center text-xs text-gray-500 mt-4 font-ibm">
                Launches full solver interface with live Python execution, reasoning stream, and code generation
              </p>
            </div>
          </div>
        </div>

        {/* Explainer Section */}
        <div className="mb-12 animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
          <PoetiqExplainer defaultOpen={false} />
        </div>

        {/* Puzzle Grid */}
        <div className="animate-slide-in-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-orbitron font-bold text-white flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-lime-400 rounded-full"></div>
              Mission Database
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={progress.refetch}
              disabled={progress.isLoading}
              className="bg-gray-900/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-cyan-500/50 font-ibm transition-all"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${progress.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <PuzzleProgressGrid
            puzzles={progress.puzzles}
            isLoading={progress.isLoading}
          />
        </div>

        {/* Footer Links */}
        <div className="mt-12 p-6 rounded-xl" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-ibm">
            <a
              href="https://poetiq.ai/posts/arcagi_announcement/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Research Publication <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-gray-700">|</span>
            <a
              href="https://github.com/82deutschmark/poetiq-arc-agi-solver"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Solver Repository <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-gray-700">|</span>
            <a
              href="https://arcprize.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              ARC Prize Foundation <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-gray-700">|</span>
            <a
              href="https://discord.gg/9b77dPAmcA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Community Discord <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

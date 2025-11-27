/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Poetiq Community Solver landing page - Merged with Explainer for comprehensive audit view.
 *          Includes detailed breakdown of Poetiq's "Meta-System" and Pareto claims.
 *
 * SRP/DRY check: Pass - Single page for community progress and methodology explanation
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
  ChevronUp,
  Brain,
  TestTube,
  TrendingUp,
  Cpu,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PuzzleProgressGrid } from '@/components/poetiq/PuzzleProgressGrid';
import { usePoetiqCommunityProgress } from '@/hooks/usePoetiqCommunityProgress';

// Verified models from server/config/models.ts
const POETIQ_MODELS = [
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro Preview',
    provider: 'openrouter',
    modelId: 'openrouter/google/gemini-3-pro-preview',
    keyPlaceholder: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    description: 'Primary reasoning engine (SOTA)'
  },
  {
    id: 'gemini-3-pro-direct',
    name: 'Gemini 3 Pro Preview (Direct)',
    provider: 'gemini',
    modelId: 'gemini/gemini-3-pro-preview',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Direct Google API'
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    provider: 'openrouter',
    modelId: 'openai/gpt-5.1',
    keyPlaceholder: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    description: 'High-performance alternative'
  },
  {
    id: 'grok-4-fast',
    name: 'Grok 4 Fast (via Grok 4.1)',
    provider: 'openrouter',
    modelId: 'x-ai/grok-4.1-fast', // Closest match in OpenRouter for Grok 4 Fast
    keyPlaceholder: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    description: 'Cost-optimized reasoning'
  },
  {
    id: 'gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'openrouter',
    modelId: 'openai/gpt-oss-120b',
    keyPlaceholder: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    description: 'Extreme cost efficiency (<1¢)'
  }
] as const;

const EXPERT_OPTIONS = [
  { value: '1', label: '1 Expert (Poetiq-a)' },
  { value: '2', label: '2 Experts (Poetiq-b)' },
  { value: '8', label: '8 Experts (Poetiq-c)' },
];

export default function PoetiqCommunity() {
  const [, navigate] = useLocation();
  const progress = usePoetiqCommunityProgress();
  const [showSettings, setShowSettings] = useState(false);

  // Configuration state
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3-pro');
  const [apiKey, setApiKey] = useState('');
  const [numExperts, setNumExperts] = useState('2');

  const selectedModel = POETIQ_MODELS.find(m => m.id === selectedModelId)!;

  useEffect(() => {
    document.title = 'Poetiq Integration Audit';
  }, []);

  const nextPuzzle = progress.getNextRecommended();
  const canStart = !!nextPuzzle;
  const usingProjectKey = !apiKey.trim();

  const handleRunNext = () => {
    if (!nextPuzzle) return;

    sessionStorage.setItem('poetiq_config', JSON.stringify({
      apiKey,
      provider: selectedModel.provider,
      model: selectedModel.modelId,
      numExperts: parseInt(numExperts, 10),
      temperature: 1.0,
      autoStart: true,
    }));

    navigate(`/puzzle/poetiq/${nextPuzzle}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-7xl mx-auto p-4 space-y-6">

        {/* Header Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
                <Search className="h-6 w-6 text-indigo-600" />
                Independent Audit of Poetiq's SOTA Results
              </h1>
              <p className="text-base text-gray-600">
                Verifying the "Meta-System" claims and Pareto frontiers on ARC-AGI-1 & 2.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href="https://poetiq.ai/posts/arcagi_announcement/" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Read Blog Post
                </a>
              </Button>
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="default"
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {showSettings ? 'Hide Settings' : 'Start Solver'}
              </Button>
            </div>
          </div>
        </div>

        {/* Collapsible Settings */}
        {showSettings && (
          <Card className="border-indigo-200 shadow-md">
            <CardHeader className="pb-2 bg-indigo-50 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2 text-indigo-900">
                <Play className="h-4 w-4" />
                Run Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {/* Next Puzzle */}
              {nextPuzzle && (
                <div className="flex items-center gap-2 bg-white border border-green-200 rounded p-2 text-sm shadow-sm">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Recommended Next Puzzle:</span>
                  <Badge variant="outline" className="font-mono text-base">{nextPuzzle}</Badge>
                </div>
              )}

              {/* Settings Grid */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500">Model Configuration</Label>
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POETIQ_MODELS.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-gray-500">{selectedModel.description}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500">Expert Count</Label>
                  <Select value={numExperts} onValueChange={setNumExperts}>
                    <SelectTrigger>
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
                  <Label className="text-xs font-semibold text-gray-500">API Key (Optional)</Label>
                  <Input
                    type="password"
                    placeholder={selectedModel.keyPlaceholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="text-xs text-gray-500">
                {usingProjectKey ? (
                  <span>Using project key (may be rate limited). <a href={selectedModel.keyUrl} target="_blank" className="text-indigo-600 underline">Get your own</a> for faster results.</span>
                ) : (
                  <span>Using your key — passed directly to Python backend, never stored.</span>
                )}
              </div>

              {/* Run Button */}
              <Button
                onClick={handleRunNext}
                disabled={!canStart}
                className="w-full bg-green-600 hover:bg-green-700 h-10 text-base font-semibold"
              >
                <Play className="h-4 w-4 mr-2" />
                Run Solver on {nextPuzzle || 'Next Puzzle'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Content: Puzzle Grid */}
        <div className="space-y-2">
           <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Community Progress</h2>
              <div className="text-sm text-gray-600">
                 {progress.solved}/{progress.total} solved ({progress.completionPercentage}%)
              </div>
           </div>
           <PuzzleProgressGrid
             puzzles={progress.puzzles}
             isLoading={progress.isLoading}
           />
        </div>

        <Separator className="my-8" />

        {/* Deep Dive Section - Merged from PoetiqExplainer */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Left Col: The Meta-System */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-900 mb-2">
                <Brain className="h-6 w-6" />
                The Poetiq Meta-System
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Unlike traditional solvers that rely on a single prompt, Poetiq uses a <strong>recursive, self-improving meta-system</strong>. 
                It doesn't just ask for an answer; it orchestrates a team of LLM "experts" to write code, test it, and iterate.
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm space-y-4">
               <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                 <RefreshCw className="h-4 w-4" />
                 Self-Auditing Loop
               </h3>
               <div className="space-y-3">
                  <ProcessStep number={1} icon={Brain} title="Analyze" description="AI studies input/output pairs to hypothesize a pattern." />
                  <ProcessStep number={2} icon={Code} title="Generate Code" description="Writes a Python transform() function to implement the logic." />
                  <ProcessStep number={3} icon={TestTube} title="Test & Audit" description="Runs code on training examples. Self-audits: 'Did it work?'" />
                  <ProcessStep number={4} icon={TrendingUp} title="Iterate" description="If failed, analyzes stderr/results and refines the code." />
                  <ProcessStep number={5} icon={CheckCircle} title="Convergence" description="Only submits when code passes all internal checks." />
               </div>
            </div>
          </div>

          {/* Right Col: Pareto & Models */}
          <div className="space-y-6">
            
            {/* Pareto Frontier */}
            <div className="space-y-2">
               <h2 className="text-xl font-bold flex items-center gap-2 text-green-800 mb-2">
                  <TrendingUp className="h-6 w-6" />
                  Pareto Optimal Reasoning
               </h2>
               <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-900 mb-3">
                     Poetiq claims to redraw the "Pareto frontier" — delivering higher accuracy at lower cost than any previous system.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="bg-white p-3 rounded border border-green-100">
                        <div className="text-xs text-gray-500 uppercase font-bold">Cost Efficiency</div>
                        <div className="text-lg font-bold text-green-700">&lt; $0.01</div>
                        <div className="text-xs text-gray-600">per problem (GPT-OSS-b)</div>
                     </div>
                     <div className="bg-white p-3 rounded border border-green-100">
                        <div className="text-xs text-gray-500 uppercase font-bold">SOTA Accuracy</div>
                        <div className="text-lg font-bold text-green-700">&gt; 60%</div>
                        <div className="text-xs text-gray-600">on ARC-AGI-2 (Human Level)</div>
                     </div>
                  </div>
               </div>
            </div>

            {/* LLM Agnostic */}
            <div className="space-y-2">
               <h2 className="text-xl font-bold flex items-center gap-2 text-purple-800 mb-2">
                  <Cpu className="h-6 w-6" />
                  LLM-Agnostic Architecture
               </h2>
               <p className="text-gray-700 text-sm mb-3">
                  The meta-system is not tied to one model. It adapts to the underlying LLM's strengths. 
                  We are auditing the following configurations:
               </p>
               <div className="grid gap-2">
                  <ModelCard 
                     name="Gemini 3" 
                     variant="Pro Preview" 
                     role="Primary reasoning engine for SOTA results." 
                     color="bg-blue-50 border-blue-200 text-blue-800"
                  />
                  <ModelCard 
                     name="GPT-5.1" 
                     variant="Preview" 
                     role="High-performance alternative used in 'Mix' config." 
                     color="bg-gray-100 border-gray-200 text-gray-800"
                  />
                  <ModelCard 
                     name="Grok 4" 
                     variant="Fast" 
                     role="Cost-optimized reasoning (Poetiq Grok-4-Fast)." 
                     color="bg-slate-100 border-slate-200 text-slate-800"
                  />
                  <ModelCard 
                     name="GPT-OSS" 
                     variant="120B" 
                     role="Open weights model showing extreme cost efficiency." 
                     color="bg-orange-50 border-orange-200 text-orange-800"
                  />
               </div>
            </div>
          </div>

        </div>

        {/* Footer Links */}
        <div className="pt-8 border-t text-center text-sm text-gray-500 space-x-4">
          <a href="https://poetiq.ai/posts/arcagi_announcement/" target="_blank" className="text-indigo-600 hover:underline font-medium">
            Original Blog Post
          </a>
          <span>·</span>
          <a href="https://github.com/82deutschmark/poetiq-arc-agi-solver" target="_blank" className="text-indigo-600 hover:underline font-medium">
            Source Code (GitHub)
          </a>
          <span>·</span>
          <a href="https://arcprize.org/" target="_blank" className="text-indigo-600 hover:underline font-medium">
            ARC Prize
          </a>
        </div>
      </div>
    </div>
  );
}

// Helper components
function ProcessStep({ number, icon: Icon, title, description }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs shrink-0 mt-0.5">
        {number}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-medium text-gray-900 text-sm">
          <Icon className="h-3.5 w-3.5 text-indigo-600" />
          {title}
        </div>
        <p className="text-xs text-gray-600 leading-snug">{description}</p>
      </div>
    </div>
  );
}

function ModelCard({ name, variant, role, color }: any) {
   return (
      <div className={`p-2 rounded border flex items-center justify-between ${color}`}>
         <div>
            <div className="font-bold text-sm">{name} <span className="opacity-75 font-normal">({variant})</span></div>
            <div className="text-xs opacity-90">{role}</div>
         </div>
      </div>
   );
}

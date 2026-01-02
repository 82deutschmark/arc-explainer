/**
 * Author: Claude Sonnet 4 (Fixed by Claude Haiku)
 * Date: 2026-01-02
 * PURPOSE: LLM Council page for multi-model consensus evaluation of ARC puzzles.
 *          Uses SSE streaming for live event updates during deliberation.
 *          Handles URL parameter :taskId for direct puzzle linking.
 * SRP/DRY check: Pass - Single responsibility: Council assessment UI with streaming.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Users,
  Brain,
  AlertCircle,
  CheckCircle2,
  Trophy,
  Play,
  ArrowRight,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface CouncilStage1Result {
  model: string;
  response: string;
}

interface CouncilStage2Result {
  model: string;
  ranking: string;
  parsed_ranking: string[];
}

interface CouncilStage3Result {
  model: string;
  response: string;
}

interface CouncilMetadata {
  label_to_model: Record<string, string>;
  aggregate_rankings: Array<{
    model: string;
    average_rank: number;
    rankings_count: number;
  }>;
}

interface CouncilAssessmentResult {
  taskId: string;
  mode: 'solve' | 'assess';
  stage1: CouncilStage1Result[];
  stage2: CouncilStage2Result[];
  stage3: CouncilStage3Result;
  metadata: CouncilMetadata;
  promptUsed: string;
}

interface ExplanationForCouncil {
  id: number;
  modelName: string;
  explanation: string;
  predictedOutput?: number[][];
  isCorrect?: boolean;
  confidenceScore?: number;
  createdAt: string;
}

interface StreamEvent {
  type: string;
  [key: string]: any;
}

// Unsolved puzzles from the user's list
const UNSOLVED_PUZZLES = [
  '78332cb0', 'de809cff', '62593bfd', '5545f144', 'f560132c',
  'eee78d87', '2b83f449', '4c416de3', '8b7bacbf', '7b0280bc',
  '7b80bb43', 'b9e38dc0', '446ef5d2', '4e34c42c', '88bcf3b4',
  '221dfab4', 'faa9f03d', '269e22fb', '21897d95', 'e12f9a14',
  '4c7dc4dd', '3a25b0d8', 'a32d8b75', '9bbf930d', '6ffbe589',
  'd35bdbdc', '13e47133', '88e364bc'
];

export default function LLMCouncil() {
  const params = useParams();
  const urlTaskId = params?.taskId as string | undefined;

  const [selectedPuzzle, setSelectedPuzzle] = useState<string>(urlTaskId || '');
  const [mode, setMode] = useState<'solve' | 'assess'>('solve');
  const [selectedExplanationIds, setSelectedExplanationIds] = useState<number[]>([]);
  const [assessmentResult, setAssessmentResult] = useState<CouncilAssessmentResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamAbortController = useRef<AbortController | null>(null);

  // Update selectedPuzzle when URL changes
  useEffect(() => {
    if (urlTaskId) {
      setSelectedPuzzle(urlTaskId);
    }
  }, [urlTaskId]);

  // Set page title
  useEffect(() => {
    document.title = 'LLM Council - ARC Puzzle Assessment';
  }, []);

  // Check council health
  const { data: healthData, isLoading: isCheckingHealth } = useQuery({
    queryKey: ['council-health'],
    queryFn: async () => {
      const res = await fetch('/api/council/health');
      const data = await res.json();
      return data;
    },
    refetchInterval: 30000,
  });

  const councilHealthy = healthData?.success && healthData?.data?.status === 'healthy';

  // Fetch explanations for selected puzzle
  const { data: explanationsData, isLoading: isLoadingExplanations } = useQuery({
    queryKey: ['council-explanations', selectedPuzzle],
    queryFn: async () => {
      if (!selectedPuzzle) return null;
      const res = await fetch(`/api/council/puzzle/${selectedPuzzle}/explanations?limit=20`);
      const data = await res.json();
      return data;
    },
    enabled: !!selectedPuzzle && mode === 'assess',
  });

  const explanations: ExplanationForCouncil[] = explanationsData?.success ? explanationsData.data.explanations : [];

  const toggleExplanationSelection = (id: number) => {
    setSelectedExplanationIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const handleStartAssessment = async () => {
    if (!selectedPuzzle) return;
    if (mode === 'assess' && selectedExplanationIds.length === 0) return;

    setIsStreaming(true);
    setStreamEvents([]);
    setStreamError(null);
    setAssessmentResult(null);

    try {
      streamAbortController.current = new AbortController();

      const body = {
        taskId: selectedPuzzle,
        mode,
        ...(mode === 'assess' && { explanationIds: selectedExplanationIds }),
      };

      const res = await fetch('/api/council/assess/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: streamAbortController.current.signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6)) as StreamEvent;
              setStreamEvents(prev => [...prev, evt]);

              // Capture final result
              if (evt.type === 'done' && evt.result) {
                setAssessmentResult(evt.result as CouncilAssessmentResult);
              }
            } catch (e) {
              console.error('Failed to parse event:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStreamError(error.message);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const getStageProgress = () => {
    let stage1Done = streamEvents.some(e => e.type === 'stage1_complete');
    let stage2Done = streamEvents.some(e => e.type === 'stage2_complete');
    let stage3Done = streamEvents.some(e => e.type === 'stage3_complete');
    return { stage1Done, stage2Done, stage3Done };
  };

  const { stage1Done, stage2Done, stage3Done } = getStageProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex flex-col">
      {/* Header - Edge-to-edge */}
      <div className="border-b border-purple-200 bg-white/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-3xl font-bold text-purple-900">Council</h1>
            <p className="text-sm text-purple-600">
              Multi-model consensus evaluation
            </p>
          </div>
        </div>
      </div>

      {/* Health Warning - Full width */}
      {!councilHealthy && !isCheckingHealth && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <Alert variant="destructive" className="bg-transparent border-0 p-0">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Council Service Unavailable</AlertTitle>
            <AlertDescription>
              The LLM Council service is not running. Start it with:
              <code className="block mt-2 p-2 bg-red-100 rounded text-xs font-mono">
                cd llm-council && uv run python -m backend.main
              </code>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content - Edge-to-edge grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[28rem_1fr] gap-0">
        {/* Left Panel - Configuration Rail */}
        <div className="border-r border-purple-200 bg-white/30 px-6 py-6 overflow-y-auto space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-purple-900 mb-3">Puzzle</h2>
            <Select value={selectedPuzzle} onValueChange={setSelectedPuzzle}>
              <SelectTrigger>
                <SelectValue placeholder="Select a puzzle..." />
              </SelectTrigger>
              <SelectContent>
                {UNSOLVED_PUZZLES.map(puzzleId => (
                  <SelectItem key={puzzleId} value={puzzleId}>
                    {puzzleId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPuzzle && (
              <div className="flex gap-2 mt-3">
                <Link href={`/puzzle/${selectedPuzzle}`}>
                  <Button variant="outline" size="sm" className="text-xs flex-1">
                    View <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
                <Link href={`/council/${selectedPuzzle}`}>
                  <Button variant="ghost" size="sm" className="text-xs flex-1">
                    Link <Zap className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <Separator className="my-2" />

          <div>
            <h2 className="text-sm font-semibold text-purple-900 mb-3">Mode</h2>
            <div className="flex gap-2">
              <Button
                variant={mode === 'solve' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('solve')}
                className="flex-1 text-xs"
                disabled={isStreaming}
              >
                <Brain className="h-4 w-4 mr-1" />
                Solve
              </Button>
              <Button
                variant={mode === 'assess' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('assess')}
                className="flex-1 text-xs"
                disabled={isStreaming}
              >
                <Trophy className="h-4 w-4 mr-1" />
                Assess
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mode === 'solve'
                ? 'Council members independently solve and rank each other'
                : 'Council evaluates existing explanations'}
            </p>
          </div>

          {/* Explanation Selection for Assess Mode */}
          {mode === 'assess' && selectedPuzzle && (
            <>
              <Separator className="my-2" />
              <div>
                <h2 className="text-sm font-semibold text-purple-900 mb-3">
                  Explanations ({selectedExplanationIds.length}/{explanations.length})
                </h2>
                {isLoadingExplanations ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : explanations.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2 bg-red-50 rounded border border-red-200">
                    No explanations found for this puzzle. Try "Solve" mode instead.
                  </div>
                ) : (
                  <ScrollArea className="h-40 border rounded bg-white/50">
                    <div className="space-y-2 p-2">
                      {explanations.map(exp => (
                        <div
                          key={exp.id}
                          className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                            selectedExplanationIds.includes(exp.id)
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                          onClick={() => toggleExplanationSelection(exp.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate flex-1">
                              {exp.modelName}
                            </span>
                            {exp.isCorrect !== undefined && (
                              <Badge variant={exp.isCorrect ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                {exp.isCorrect ? 'OK' : 'Wrong'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}

          <Separator className="my-2" />

          {/* Start Button */}
          <Button
            className="w-full"
            size="sm"
            disabled={
              !councilHealthy ||
              !selectedPuzzle ||
              isStreaming ||
              (mode === 'assess' && selectedExplanationIds.length === 0)
            }
            onClick={handleStartAssessment}
          >
            {isStreaming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start
              </>
            )}
          </Button>

          {streamError && (
            <div className="p-3 bg-red-50 rounded border border-red-200">
              <p className="text-xs text-red-700">{streamError}</p>
            </div>
          )}
        </div>

        {/* Right Panel - Results & Stream */}
        <div className="px-6 py-6 overflow-y-auto">
          {isStreaming ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-purple-900">Deliberation in Progress</h2>

              {/* Progress Indicators */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {stage1Done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                  )}
                  <span className="text-sm">Stage 1: Individual Responses</span>
                </div>
                <div className="flex items-center gap-3">
                  {stage2Done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : stage1Done ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />
                  )}
                  <span className="text-sm">Stage 2: Peer Rankings</span>
                </div>
                <div className="flex items-center gap-3">
                  {stage3Done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : stage2Done ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />
                  )}
                  <span className="text-sm">Stage 3: Final Synthesis</span>
                </div>
              </div>

              {/* Event Log */}
              <div>
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Event Log</h3>
                <ScrollArea className="h-48 border rounded p-3 bg-gray-900 border-gray-700">
                  <div className="space-y-1">
                    {streamEvents.map((evt, idx) => (
                      <div key={idx} className="text-xs font-mono text-gray-300">
                        <span className="text-blue-400">[{evt.type}]</span>
                        {evt.message && <span className="text-gray-400"> {evt.message}</span>}
                        {evt.count && <span className="text-gray-500"> ({evt.count})</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : assessmentResult ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-purple-900">Council Assessment</h2>
                <p className="text-xs text-muted-foreground">
                  {assessmentResult.taskId} ({assessmentResult.mode}, {assessmentResult.stage1.length} models)
                </p>
              </div>

              <Tabs defaultValue="synthesis" className="w-full">
                <TabsList className="grid w-full grid-cols-4 text-xs">
                  <TabsTrigger value="synthesis">Final</TabsTrigger>
                  <TabsTrigger value="stage1">Stage 1</TabsTrigger>
                  <TabsTrigger value="stage2">Stage 2</TabsTrigger>
                  <TabsTrigger value="aggregate">Ranks</TabsTrigger>
                </TabsList>

                {/* Final Synthesis */}
                <TabsContent value="synthesis" className="mt-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-sm text-green-800">
                        Chairman: {assessmentResult.stage3.model}
                      </span>
                    </div>
                    <pre className="text-xs bg-white p-3 rounded border max-h-80 overflow-auto whitespace-pre-wrap break-words">
                      {assessmentResult.stage3.response}
                    </pre>
                  </div>
                </TabsContent>

                {/* Stage 1 - Individual Responses */}
                <TabsContent value="stage1" className="mt-4">
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {assessmentResult.stage1.map((result, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-xs text-blue-800">
                            {result.model}
                          </span>
                        </div>
                        <pre className="text-xs bg-white p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap break-words">
                          {result.response}
                        </pre>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Stage 2 - Rankings */}
                <TabsContent value="stage2" className="mt-4">
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {assessmentResult.stage2.map((result, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-medium text-xs text-amber-800">
                            {result.model}
                          </span>
                          {result.parsed_ranking.length > 0 && (
                            <div className="flex items-center gap-1">
                              {result.parsed_ranking.slice(0, 3).map((label, i) => (
                                <React.Fragment key={i}>
                                  <Badge variant="outline" className="text-[9px] py-0 px-1">
                                    {assessmentResult.metadata.label_to_model[label] || label}
                                  </Badge>
                                  {i < Math.min(2, result.parsed_ranking.length - 1) && (
                                    <ArrowRight className="h-2 w-2 text-amber-400" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                        <pre className="text-xs bg-white p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap break-words">
                          {result.ranking}
                        </pre>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Aggregate Rankings */}
                <TabsContent value="aggregate" className="mt-4">
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {assessmentResult.metadata.aggregate_rankings.map((ranking, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-purple-600">
                            #{idx + 1}
                          </span>
                          <span className="font-medium text-sm">{ranking.model}</span>
                        </div>
                        <div className="text-right text-xs">
                          <div>Avg: {ranking.average_rank.toFixed(1)}</div>
                          <div className="text-muted-foreground">{ranking.rankings_count} votes</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-purple-200 mb-3" />
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                No Assessment Yet
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Select a puzzle and click start to begin the council deliberation process.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

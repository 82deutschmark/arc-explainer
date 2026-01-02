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
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-purple-900">LLM Council</h1>
            <p className="text-sm text-purple-600">
              Multi-model consensus evaluation for ARC puzzles
            </p>
          </div>
          <Badge
            variant={councilHealthy ? 'default' : 'destructive'}
            className="ml-auto"
          >
            {isCheckingHealth ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : councilHealthy ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            {councilHealthy ? 'Council Online' : 'Council Offline'}
          </Badge>
        </div>

        {/* Health Warning */}
        {!councilHealthy && !isCheckingHealth && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Council Service Unavailable</AlertTitle>
            <AlertDescription>
              The LLM Council service is not running. Please start the council backend:
              <pre className="mt-2 p-2 bg-red-50 rounded text-xs">
                cd llm-council && uv run python -m backend.main
              </pre>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Configuration */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Puzzle</CardTitle>
                <CardDescription>
                  Choose an unsolved ARC2 Evaluation puzzle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="flex gap-2">
                    <Link href={`/puzzle/${selectedPuzzle}`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        View Puzzle <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                    <Link href={`/council/${selectedPuzzle}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Link <Zap className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assessment Mode</CardTitle>
                <CardDescription>
                  How should the council evaluate?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={mode === 'solve' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('solve')}
                    className="flex-1"
                    disabled={isStreaming}
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    Solve
                  </Button>
                  <Button
                    variant={mode === 'assess' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('assess')}
                    className="flex-1"
                    disabled={isStreaming}
                  >
                    <Trophy className="h-4 w-4 mr-1" />
                    Assess
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === 'solve'
                    ? 'Council members will independently solve the puzzle and rank each other.'
                    : 'Council will evaluate existing explanations from the database.'}
                </p>
              </CardContent>
            </Card>

            {/* Explanation Selection for Assess Mode */}
            {mode === 'assess' && selectedPuzzle && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Explanations</CardTitle>
                  <CardDescription>
                    {selectedExplanationIds.length} of {explanations.length} selected
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingExplanations ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading explanations...</span>
                    </div>
                  ) : explanations.length === 0 ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No explanations found for this puzzle. Try "Solve" mode instead.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <ScrollArea className="h-48">
                      <div className="space-y-2 pr-4">
                        {explanations.map(exp => (
                          <div
                            key={exp.id}
                            className={`p-2 rounded border cursor-pointer transition-colors ${
                              selectedExplanationIds.includes(exp.id)
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                            onClick={() => toggleExplanationSelection(exp.id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate">
                                {exp.modelName}
                              </span>
                              {exp.isCorrect !== undefined && (
                                <Badge variant={exp.isCorrect ? 'default' : 'secondary'} className="text-[10px]">
                                  {exp.isCorrect ? 'Correct' : 'Incorrect'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-1">
                              {exp.explanation.slice(0, 80)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Start Button */}
            <Button
              className="w-full"
              size="lg"
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
                  Deliberating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Assessment
                </>
              )}
            </Button>

            {streamError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{streamError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Panel - Results & Stream */}
          <div className="lg:col-span-2">
            {isStreaming ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Deliberation in Progress</CardTitle>
                  <CardDescription>
                    Watch the council's 3-stage deliberation process
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Indicators */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {stage1Done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      )}
                      <span className="text-sm font-medium">Stage 1: Individual Responses</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {stage2Done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : stage1Done ? (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-sm font-medium">Stage 2: Peer Rankings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {stage3Done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : stage2Done ? (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-sm font-medium">Stage 3: Final Synthesis</span>
                    </div>
                  </div>

                  {/* Event Log */}
                  <Separator />
                  <ScrollArea className="h-64 border rounded p-3 bg-gray-50">
                    <div className="space-y-2">
                      {streamEvents.map((evt, idx) => (
                        <div key={idx} className="text-xs font-mono text-gray-600">
                          <span className="text-blue-600">[{evt.type}]</span>
                          {evt.message && <span> {evt.message}</span>}
                          {evt.count && <span> ({evt.count} results)</span>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : assessmentResult ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Council Assessment: {assessmentResult.taskId}</CardTitle>
                      <CardDescription>
                        Mode: {assessmentResult.mode}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {assessmentResult.stage1.length} models
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="synthesis" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="synthesis">Final Synthesis</TabsTrigger>
                      <TabsTrigger value="stage1">Stage 1</TabsTrigger>
                      <TabsTrigger value="stage2">Stage 2</TabsTrigger>
                      <TabsTrigger value="aggregate">Aggregate</TabsTrigger>
                    </TabsList>

                    {/* Final Synthesis */}
                    <TabsContent value="synthesis" className="mt-4">
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-800">
                            Chairman: {assessmentResult.stage3.model}
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap text-sm bg-white p-3 rounded border max-h-96 overflow-auto">
                          {assessmentResult.stage3.response}
                        </pre>
                      </div>
                    </TabsContent>

                    {/* Stage 1 - Individual Responses */}
                    <TabsContent value="stage1" className="mt-4">
                      <div className="space-y-4">
                        {assessmentResult.stage1.map((result, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-800 text-sm">
                                {result.model}
                              </span>
                            </div>
                            <ScrollArea className="h-40">
                              <pre className="whitespace-pre-wrap text-xs bg-white p-2 rounded">
                                {result.response}
                              </pre>
                            </ScrollArea>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    {/* Stage 2 - Rankings */}
                    <TabsContent value="stage2" className="mt-4">
                      <div className="space-y-4">
                        {assessmentResult.stage2.map((result, idx) => (
                          <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-amber-800 text-sm">
                                {result.model}'s Ranking
                              </span>
                              {result.parsed_ranking.length > 0 && (
                                <div className="flex items-center gap-1 text-xs">
                                  {result.parsed_ranking.map((label, i) => (
                                    <React.Fragment key={i}>
                                      <Badge variant="outline" className="text-[10px]">
                                        {assessmentResult.metadata.label_to_model[label] || label}
                                      </Badge>
                                      {i < result.parsed_ranking.length - 1 && (
                                        <ArrowRight className="h-3 w-3 text-amber-400" />
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                            </div>
                            <ScrollArea className="h-32">
                              <pre className="whitespace-pre-wrap text-xs bg-white p-2 rounded">
                                {result.ranking}
                              </pre>
                            </ScrollArea>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    {/* Aggregate Rankings */}
                    <TabsContent value="aggregate" className="mt-4">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Aggregate Rankings (by average position)</h4>
                        {assessmentResult.metadata.aggregate_rankings.map((ranking, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-bold text-purple-600">
                                #{idx + 1}
                              </span>
                              <span className="font-medium">{ranking.model}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                Avg Rank: {ranking.average_rank.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {ranking.rankings_count} votes
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-4" />

                      <div className="text-xs text-muted-foreground">
                        <strong>Label Mapping:</strong>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(assessmentResult.metadata.label_to_model).map(([label, model]) => (
                            <Badge key={label} variant="outline" className="text-[10px]">
                              {label} = {model}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center">
                  <Users className="h-16 w-16 mx-auto text-purple-200 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    No Assessment Yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Select a puzzle and start an assessment to see the council's
                    deliberation process. Stream events will appear here in real-time.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

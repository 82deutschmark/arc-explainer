/**
 * PuzzleDiscussion.tsx - AI Self-Conversation Interface
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: Progressive reasoning refinement through AI self-conversation.
 * One model refines its own analysis across multiple turns with full context chaining.
 * Mirrors ModelDebate structure but auto-locks to single model conversing with itself.
 * SRP/DRY check: Pass - Reuses all ModelDebate components (IndividualDebate, ExplanationsList, etc.)
 * shadcn/ui: Pass - Uses shadcn/ui components via reused components
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Loader2, Sparkles, AlertTriangle, Brain, Link2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Reuse ModelDebate components - same UI, same flow
import { PuzzleDebateHeader } from '@/components/puzzle/debate/PuzzleDebateHeader';
import { CompactPuzzleDisplay } from '@/components/puzzle/CompactPuzzleDisplay';
import { ExplanationsList } from '@/components/puzzle/debate/ExplanationsList';
import { IndividualDebate } from '@/components/puzzle/debate/IndividualDebate';

import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';
import { useDebateState } from '@/hooks/debate/useDebateState';
import { useEligibleExplanations } from '@/hooks/useEligibleExplanations';

// Utility: Identify models that support server-side reasoning persistence
// OpenAI GPT-5, o-series (o3, o4, o4-mini) and xAI Grok-4 models support Responses API
const isReasoningModel = (modelName: string): boolean => {
  const normalizedModel = modelName.toLowerCase();
  // OpenAI GPT-5 models
  if (normalizedModel.includes('gpt-5')) {
    return true;
  }
  // OpenAI o-series models
  if (normalizedModel.includes('o3') || normalizedModel.includes('o4')) {
    return true;
  }
  // xAI Grok-4 models (NOT grok-3)
  if (normalizedModel.includes('grok-4')) {
    return true;
  }
  return false;
};

// Get human-readable provider name from model key
const getProviderName = (modelName: string): string => {
  const normalizedModel = modelName.toLowerCase();
  if (normalizedModel.includes('gpt') || normalizedModel.includes('o1') || normalizedModel.includes('o3') || normalizedModel.includes('o4')) {
    return 'OpenAI';
  }
  if (normalizedModel.includes('grok')) {
    return 'xAI';
  }
  return 'Unknown';
};

export default function PuzzleDiscussion() {
  const { taskId } = useParams<{ taskId?: string }>();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [searchPuzzleId, setSearchPuzzleId] = useState('');

  // Parse ?select=123 query parameter for auto-selection
  const selectId = useMemo(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const id = params.get('select');
    return id ? parseInt(id, 10) : null;
  }, [location]);

  // Page title
  useEffect(() => {
    document.title = taskId ? `AI Self-Conversation - Puzzle ${taskId}` : 'AI Self-Conversation';
  }, [taskId]);

  // Data hooks (same as ModelDebate)
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { explanations, isLoading: isLoadingExplanations, refetchExplanations } = usePuzzleWithExplanation(taskId || '');
  const { data: models } = useModels();
  
  // Fetch eligible explanations for landing page
  const { data: eligibleData, isLoading: isLoadingEligible } = useEligibleExplanations(20, 0);
  const eligibleExplanations = eligibleData?.explanations || [];

  // State management (reuse useDebateState)
  const debateState = useDebateState();

  const selectedExplanation = explanations?.find(e => e.id === debateState.selectedExplanationId);

  // Analysis hook for refinement generation (same as ModelDebate)
  const {
    analyzeAndSaveMutation,
    processingModels,
    analyzerErrors,
    promptId,
    setPromptId,
    temperature,
    isGPT5ReasoningModel,
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType,
    topP,
    candidateCount,
    thinkingBudget
  } = useAnalysisResults({
    taskId: taskId || '',
    refetchExplanations,
    omitAnswer: false,
    originalExplanation: selectedExplanation,
    customChallenge: debateState.customChallenge,
    previousResponseId: debateState.getLastResponseId(debateState.challengerModel)
  });

  // Set promptId when active (same as ModelDebate)
  useEffect(() => {
    if (debateState.isDebateActive && selectedExplanation) {
      setPromptId('debate');
    } else {
      setPromptId('solver');
    }
  }, [debateState.isDebateActive, selectedExplanation, setPromptId]);

  // Generate refinement (same logic as ModelDebate's handleGenerateChallenge)
  const handleGenerateRefinement = async () => {
    if (!debateState.challengerModel || !debateState.selectedExplanationId || !taskId) return;
    if (!selectedExplanation) return;

    try {
      setPromptId('debate');
      const lastResponseId = debateState.getLastResponseId(debateState.challengerModel);

      const lastMessage = debateState.debateMessages[debateState.debateMessages.length - 1];
      const lastProvider = lastMessage ? debateState.extractProvider(lastMessage.modelName) : 'none';
      const challengerProvider = debateState.extractProvider(debateState.challengerModel);

      const payload: any = {
        modelKey: debateState.challengerModel,
        temperature,
        topP,
        candidateCount,
        thinkingBudget,
        ...(isGPT5ReasoningModel(debateState.challengerModel) ? {
          reasoningEffort,
          reasoningVerbosity,
          reasoningSummaryType
        } : {})
      };

      if (lastResponseId) {
        console.log(`[Self-Conversation] ✅ Continuing ${challengerProvider} conversation with response ID: ${lastResponseId}`);
      } else {
        console.log('[Self-Conversation] Starting new conversation');
      }

      const savedData = await analyzeAndSaveMutation.mutateAsync(payload);
      await refetchExplanations();

      const newExplanationData = savedData?.explanations?.[debateState.challengerModel];

      if (newExplanationData) {
        debateState.addChallengeMessage(newExplanationData);
        toast({
          title: "Analysis Refined!",
          description: `${models?.find(m => m.key === debateState.challengerModel)?.name || debateState.challengerModel} has refined its analysis.`,
        });
      } else {
        throw new Error("Failed to retrieve refinement");
      }

      debateState.setCustomChallenge('');
    } catch (error) {
      console.error('Refinement error:', error);
      toast({
        title: "Refinement Failed",
        description: error instanceof Error ? error.message : "Failed to generate refinement.",
        variant: "destructive",
      });
    }
  };

  // Search handler
  const handlePuzzleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchPuzzleId.trim()) {
      navigate(`/discussion/${searchPuzzleId.trim()}`);
    }
  };

  // KEY DIFFERENCE: Auto-lock challenger to same model
  const handleStartConversation = (explanationId: number) => {
    const explanation = explanations?.find(e => e.id === explanationId);
    if (explanation) {
      debateState.startDebate(explanation);
      // AUTO-LOCK: Same model refines itself
      debateState.setChallengerModel(explanation.modelName);
    }
  };

  // Filter explanations to only show eligible ones (has provider response ID + within 30-day retention window)
  const filteredEligibleExplanations = useMemo(() => {
    if (!explanations) return [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return explanations.filter(exp => {
      // Must be less than 30 days old (provider retention window)
      const createdAt = new Date(exp.createdAt);
      if (createdAt < thirtyDaysAgo) return false;
      
      // Must have provider response ID (required for conversation chaining)
      if (!exp.providerResponseId) return false;
      
      return true;
    });
  }, [explanations]);

  // Auto-start conversation when ?select= parameter is present
  useEffect(() => {
    if (selectId && explanations && !debateState.isDebateActive) {
      const explanation = explanations.find(e => e.id === selectId);
      if (explanation) {
        console.log(`[PuzzleDiscussion] Auto-selecting explanation #${selectId} from URL parameter`);
        handleStartConversation(selectId);
      }
    }
  }, [selectId, explanations, debateState.isDebateActive]);

  // Loading states
  if (isLoadingTask || isLoadingExplanations) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading puzzle and explanations...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error states
  if (taskError || (taskId && !task)) {
    return (
      <div className="w-full">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No taskId - show search and recent eligible explanations
  if (!taskId) {
    return (
      <div className="w-full space-y-4">
        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600" />
              Progressive Reasoning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Refine AI analyses through multi-turn conversations with full server-side reasoning retention (30 days).
            </p>
            
            {/* Search Box */}
            <form onSubmit={handlePuzzleSearch} className="flex gap-2">
              <Input
                placeholder="Enter puzzle ID to begin..."
                value={searchPuzzleId}
                onChange={(e) => setSearchPuzzleId(e.target.value)}
              />
              <Button type="submit" disabled={!searchPuzzleId.trim()}>
                <Search className="h-4 w-4 mr-2" />
                Go
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Eligible Explanations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Eligible Analyses</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingEligible ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : eligibleExplanations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Puzzle ID</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleExplanations.map(exp => (
                    <TableRow key={exp.id}>
                      <TableCell>
                        <Link href={`/discussion/${exp.puzzleId}`} className="text-blue-600 hover:underline font-mono">
                          {exp.puzzleId}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{exp.modelName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{exp.provider.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{exp.daysOld}d ago</Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => navigate(`/discussion/${exp.puzzleId}?select=${exp.id}`)}
                        >
                          Refine
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No eligible analyses found. Generate new analyses from reasoning models (GPT-5, o-series, Grok-4).
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main interface (same structure as ModelDebate)
  return (
    <div className="w-full space-y-1">
      <PuzzleDebateHeader taskId={taskId} />

      <CompactPuzzleDisplay
        trainExamples={task!.train}
        testCases={task!.test}
      />

      {debateState.isDebateActive && explanations ? (
        (() => {
          const selectedExplanation = explanations.find(e => e.id === debateState.selectedExplanationId);
          if (!selectedExplanation) {
            return (
              <Alert>
                <AlertDescription>
                  Selected explanation not found. <Button variant="link" onClick={debateState.endDebate}>Return to list</Button>
                </AlertDescription>
              </Alert>
            );
          }

          // Calculate total reasoning tokens from all messages
          const totalReasoningTokens = debateState.debateMessages.reduce(
            (sum, msg) => sum + (msg.content.reasoningTokens || 0),
            0
          );

          // Get provider name from challenger model
          const provider = getProviderName(debateState.challengerModel);

          return (
            <>
              {/* Model Selection Warning for Non-Reasoning Models */}
              {selectedExplanation && !isReasoningModel(selectedExplanation.modelName) && (
                <Alert className="bg-amber-50 border-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    <strong>Limited Reasoning Persistence:</strong> This model ({selectedExplanation.modelName})
                    may not fully support server-side reasoning storage. For best results, use OpenAI GPT-5, o-series
                    (o3, o4, o4-mini) or xAI Grok-4 models.
                  </AlertDescription>
                </Alert>
              )}

              {/* Conversation Status Alert */}
              {debateState.debateMessages.length > 0 && (
                <Alert className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300">
                  <Link2 className="h-4 w-4 text-purple-600" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-semibold text-purple-900">
                        <Brain className="h-4 w-4 inline mr-1" />
                        Reasoning Chain Active: {debateState.debateMessages.length} turns
                      </div>
                      <p className="text-sm text-purple-800">
                        Model has access to {totalReasoningTokens > 0 ? `${totalReasoningTokens.toLocaleString()}+` : 'all'} reasoning tokens from previous turns.
                        All reasoning is retrieved automatically from {provider} servers.
                      </p>
                      <div className="flex gap-2 text-xs">
                        <Badge variant="outline" className="bg-purple-100 text-purple-800">
                          {provider.toUpperCase()} Persisted
                        </Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          30-day retention
                        </Badge>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <IndividualDebate
                originalExplanation={selectedExplanation}
                debateMessages={debateState.debateMessages}
                taskId={taskId}
                testCases={task!.test}
                models={models}
                task={task}
                challengerModel={debateState.challengerModel}
                customChallenge={debateState.customChallenge}
                processingModels={processingModels}
                analyzerErrors={analyzerErrors}
                onBackToList={debateState.endDebate}
                onResetDebate={debateState.resetDebate}
                onChallengerModelChange={debateState.setChallengerModel}
                onCustomChallengeChange={debateState.setCustomChallenge}
                onGenerateChallenge={handleGenerateRefinement}
                challengeButtonText="Refine Analysis"
              />
            </>
          );
        })()
      ) : filteredEligibleExplanations.length > 0 ? (
        <ExplanationsList
          explanations={filteredEligibleExplanations}
          models={models}
          testCases={task!.test}
          correctnessFilter={debateState.correctnessFilter}
          onCorrectnessFilterChange={debateState.setCorrectnessFilter}
          onStartDebate={handleStartConversation}
          pageContext="discussion"
        />
      ) : explanations && explanations.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">No eligible analyses for discussion</p>
              <p className="text-sm">
                This puzzle has {explanations.length} explanation{explanations.length > 1 ? 's' : ''}, but none are eligible for discussion.
              </p>
              <p className="text-sm">Eligible explanations must:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>Be less than 30 days old (provider retention window)</li>
                <li>Have a provider response ID (for conversation chaining)</li>
              </ul>
              <Link href={`/puzzle/${taskId}`}>
                <Button variant="outline" size="sm" className="mt-2">
                  Generate New Analysis
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No explanations for this puzzle yet.</p>
            <p className="text-sm text-gray-400 mb-4">Generate an AI explanation first, then start a self-conversation.</p>
            <Link href={`/puzzle/${taskId}`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate First Explanation
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

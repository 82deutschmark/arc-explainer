/**
 * ModelDebate.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-29
 * PURPOSE: Model debate page where AI models challenge existing explanations from the database.
 * Features clean workflow: puzzle overview → explanation list → individual debates.
 * SRP/DRY check: Pass - Reuses existing components, filtering logic from PuzzleExaminer
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 *
 * ARCHITECTURE:
 * - Clean 3-step workflow: puzzle input → explanation browsing → focused debates
 * - Reuses correctness filtering from PuzzleExaminer
 * - Uses new AnalysisResultListCard for compact explanation browsing
 * - Individual debate interface for focused AI-vs-AI conversations
 * - Reuses existing hooks and components following DRY principles
 */

import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, MessageSquare, ArrowLeft, Star, Plus, Send, RotateCcw, Trophy, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Reuse existing components
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { AnalysisResultListCard } from '@/components/puzzle/AnalysisResultListCard';

// Hooks
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';

// Types
import type { ARCExample } from '@shared/types';
import type { ExplanationData } from '@/types/puzzle';

// Available models for challenging
const CHALLENGER_MODELS = [
  'gpt-4o',
  'claude-3-5-sonnet-20241022',
  'gemini-1.5-pro',
  'grok-beta',
  'deepseek-chat'
];

interface DebateMessage {
  id: string;
  modelName: string;
  messageType: 'original' | 'challenge';
  content: ExplanationData;
  timestamp: string;
}

export default function ModelDebate() {
  const { taskId } = useParams<{ taskId?: string }>();
  const [inputPuzzleId, setInputPuzzleId] = useState('');
  const [selectedExplanationId, setSelectedExplanationId] = useState<number | null>(null);
  const [challengerModel, setChallengerModel] = useState<string>('');
  const [customChallenge, setCustomChallenge] = useState('');
  const [debateMessages, setDebateMessages] = useState<DebateMessage[]>([]);
  // Reuse correctness filtering from PuzzleExaminer
  const [correctnessFilter, setCorrectnessFilter] = useState<'all' | 'correct' | 'incorrect'>('incorrect');

  // Fetch puzzle data
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  
  // Fetch existing explanations for this puzzle
  const {
    explanations,
    isLoading: isLoadingExplanations,
    refetchExplanations
  } = usePuzzleWithExplanation(taskId || '');

  // Filter explanations based on correctness (reuse PuzzleExaminer logic)
  const filteredExplanations = React.useMemo(() => {
    if (!explanations || correctnessFilter === 'all') {
      return explanations;
    }

    return explanations.filter((explanation) => {
      const hasMultiTest = explanation.hasMultiplePredictions &&
        (explanation.multiTestAllCorrect !== undefined || explanation.multiTestAverageAccuracy !== undefined);

      const isMultiTestCorrect = explanation.multiTestAllCorrect === true;
      const isSingleTestCorrect = explanation.isPredictionCorrect === true;

      const isCorrect = hasMultiTest ? isMultiTestCorrect : isSingleTestCorrect;

      return correctnessFilter === 'correct' ? isCorrect : !isCorrect;
    });
  }, [explanations, correctnessFilter]);

  // Use existing analysis hook for generating challenges
  const {
    analyzeWithModel,
    processingModels,
    analyzerErrors,
    setCustomPrompt
  } = useAnalysisResults({
    taskId: taskId || '',
    refetchExplanations,
    omitAnswer: false
  });

  // Fetch available models for proper model config
  const { models } = useModels();

  // Set page title
  React.useEffect(() => {
    document.title = taskId ? `Model Debate - Puzzle ${taskId}` : 'Model Debate';
  }, [taskId]);

  // Handle starting a debate for a specific explanation
  const handleStartDebate = (explanationId: number) => {
    const explanation = explanations?.find(e => e.id === explanationId);
    if (!explanation) return;

    setSelectedExplanationId(explanationId);
    setDebateMessages([{
      id: `original-${explanationId}`,
      modelName: explanation.modelName,
      messageType: 'original',
      content: explanation,
      timestamp: explanation.createdAt
    }]);
  };

  // Generate AI challenge using existing infrastructure
  const generateChallenge = async () => {
    if (!challengerModel || !selectedExplanationId || !taskId) return;

    const originalExplanation = explanations?.find(e => e.id === selectedExplanationId);
    if (!originalExplanation) return;

    // Determine if the explanation was incorrect and create targeted challenge prompt
    const wasIncorrect = originalExplanation.isPredictionCorrect === false ||
      (originalExplanation.hasMultiplePredictions && originalExplanation.multiTestAllCorrect === false);

    const challengePrompt = `You are participating in an AI model debate about an ARC-AGI puzzle solution. Another AI model provided ${wasIncorrect ? 'an INCORRECT' : 'this'} explanation, and your job is to challenge their reasoning and provide a better solution.

🧩 **Original AI's ${wasIncorrect ? 'INCORRECT ' : ''}Explanation:**
• Model: ${originalExplanation.modelName}
• Pattern: ${originalExplanation.patternDescription}
• Strategy: ${originalExplanation.solvingStrategy}
• Hints: ${originalExplanation.hints.join(', ')}
• Confidence: ${originalExplanation.confidence}%
${wasIncorrect ? '• ❌ Result: INCORRECT prediction' : ''}

${customChallenge ? `🎯 **Human Focus Area:** ${customChallenge}\n\n` : ''}
**Your Challenge Task:**
1. ${wasIncorrect ? 'Explain why their prediction was wrong' : 'Identify potential flaws in their reasoning'}
2. Provide your own analysis of the correct pattern/transformation
3. Give a better solving strategy with clear steps
4. ${wasIncorrect ? 'Show the correct solution' : 'Question their confidence level'}
5. Be specific, constructive, and demonstrate superior reasoning

🔍 **Focus on:** Clear logical reasoning, pattern recognition accuracy, and providing the correct solution.`;

    // Set the custom prompt and trigger analysis
    setCustomPrompt(challengePrompt);
    analyzeWithModel(challengerModel, true);
    setCustomChallenge('');
  };

  // Listen for new explanations and add them as challenge messages
  React.useEffect(() => {
    if (explanations && selectedExplanationId) {
      const originalExplanation = explanations.find(e => e.id === selectedExplanationId);
      const challengeExplanations = explanations.filter(e => 
        e.id !== selectedExplanationId && 
        new Date(e.createdAt) > new Date(originalExplanation?.createdAt || 0)
      );

      const newMessages = challengeExplanations.map(exp => ({
        id: `challenge-${exp.id}`,
        modelName: exp.modelName,
        messageType: 'challenge' as const,
        content: exp,
        timestamp: exp.createdAt
      }));

      if (newMessages.length > debateMessages.length - 1) {
        setDebateMessages(prev => {
          const original = prev.find(m => m.messageType === 'original');
          if (original) {
            return [original, ...newMessages];
          }
          return newMessages;
        });
      }
    }
  }, [explanations, selectedExplanationId]);

  const handlePuzzleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPuzzleId.trim()) {
      window.location.href = `/debate/${inputPuzzleId.trim()}`;
    }
  };

  // Extract debate interface logic to avoid complex JSX
  const originalExplanation = selectedExplanationId ? explanations?.find(e => e.id === selectedExplanationId) : null;
  const wasIncorrect = originalExplanation?.isPredictionCorrect === false ||
    (originalExplanation?.hasMultiplePredictions && originalExplanation?.multiTestAllCorrect === false);

  // Loading states
  if (isLoadingTask || isLoadingExplanations) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
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
  if (taskError || !task) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Model Debate
          </h1>
          <p className="text-gray-600">
            Watch AI models challenge each other's puzzle explanations
          </p>
          
          <form onSubmit={handlePuzzleIdSubmit} className="flex items-center justify-center gap-2 max-w-md mx-auto">
            <input
              type="text"
              value={inputPuzzleId}
              onChange={(e) => setInputPuzzleId(e.target.value)}
              placeholder="Enter puzzle ID to start debate..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button type="submit" disabled={!inputPuzzleId.trim()}>
              Start Debate
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Model Debate
            <Badge variant="outline" className="ml-2">
              Puzzle {taskId}
            </Badge>
          </h1>
          <p className="text-gray-600">
            Watch AI models challenge each other's reasoning and propose alternative explanations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browser
            </Button>
          </Link>
          <form onSubmit={handlePuzzleIdSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={inputPuzzleId}
              onChange={(e) => setInputPuzzleId(e.target.value)}
              placeholder="Enter puzzle ID..."
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!inputPuzzleId.trim()}>
              Switch Puzzle
            </Button>
          </form>
        </div>
      </div>

      {/* Puzzle Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Puzzle Pattern
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Compact puzzle overview */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Training examples in compact format */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  Training Examples
                  <Badge variant="outline" className="text-xs">{task.train.length}</Badge>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {task.train.slice(0, 4).map((example: ARCExample, index: number) => (
                    <div key={index} className="border border-gray-200 rounded p-2">
                      <div className="text-xs text-center mb-1">Ex {index + 1}</div>
                      <div className="flex items-center gap-1">
                        <div className="scale-75 origin-top-left">
                          <PuzzleGrid grid={example.input} title="" showEmojis={false} />
                        </div>
                        <div className="text-sm text-gray-400">→</div>
                        <div className="scale-75 origin-top-right">
                          <PuzzleGrid grid={example.output} title="" showEmojis={false} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {task.train.length > 4 && (
                  <p className="text-xs text-gray-500 mt-1">...and {task.train.length - 4} more examples</p>
                )}
              </div>

              {/* Test case */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Test Question</h3>
                <div className="border border-gray-200 rounded p-2">
                  <div className="flex justify-center">
                    <PuzzleGrid
                      grid={task.test[0].input}
                      title="Solve this"
                      showEmojis={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explanation List with Filtering */}
      {!selectedExplanationId && explanations && explanations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Explanations Available for Debate
                  <Badge variant="outline" className="ml-2">
                    {filteredExplanations?.length || 0} of {explanations.length}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Browse existing explanations and start debates on incorrect ones
                </p>
              </div>

              {/* Correctness Filter - reused from PuzzleExaminer */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <ToggleGroup
                  type="single"
                  value={correctnessFilter}
                  onValueChange={(value) => setCorrectnessFilter(value as 'all' | 'correct' | 'incorrect' || 'incorrect')}
                  className="bg-white border border-gray-200 rounded-md"
                >
                  <ToggleGroupItem value="all" className="px-3 py-1 text-xs">
                    All ({explanations.length})
                  </ToggleGroupItem>
                  <ToggleGroupItem value="incorrect" className="px-3 py-1 text-xs">
                    Incorrect
                  </ToggleGroupItem>
                  <ToggleGroupItem value="correct" className="px-3 py-1 text-xs">
                    Correct
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredExplanations && filteredExplanations.length > 0 ? (
              <div className="space-y-3">
                {filteredExplanations.map((explanation) => (
                  <AnalysisResultListCard
                    key={explanation.id}
                    result={explanation}
                    modelKey={explanation.modelName}
                    model={models?.find(m => m.key === explanation.modelName)}
                    testCases={task.test}
                    onStartDebate={handleStartDebate}
                    showDebateButton={true}
                    compact={true}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No {correctnessFilter === 'correct' ? 'correct' : correctnessFilter === 'incorrect' ? 'incorrect' : ''} explanations found.</p>
                <p className="text-sm mt-1">
                  {correctnessFilter === 'incorrect'
                    ? 'All explanations appear to be correct, or switch to "All" to see all results.'
                    : correctnessFilter === 'correct'
                    ? 'No correct explanations found, or switch to "All" to see all results.'
                    : 'No explanations available for this puzzle yet.'}
                </p>
                {filteredExplanations?.length === 0 && explanations.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setCorrectnessFilter('all')}
                  >
                    Show All Explanations
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Debate Interface */}
      {selectedExplanationId && originalExplanation && (
        <div className="space-y-4">
          {/* Debate Header with Back Button */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${wasIncorrect ? 'bg-red-100' : 'bg-blue-100'}`}>
                      <MessageSquare className={`h-5 w-5 ${wasIncorrect ? 'text-red-600' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        Debating: {originalExplanation?.modelName}
                        {wasIncorrect && <Badge variant="destructive" className="text-xs">Incorrect Prediction</Badge>}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Challenge this explanation with a better AI analysis
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedExplanationId(null);
                      setDebateMessages([]);
                      setChallengerModel('');
                      setCustomChallenge('');
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to List
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Debate Messages */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      AI Model Debate
                      <Badge variant="outline">{debateMessages.length} participants</Badge>
                    </CardTitle>
                  </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {debateMessages.map((message) => (
                    <div key={message.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={message.messageType === 'original' ? 'default' : 'destructive'}>
                          {message.modelName}
                        </Badge>
                        <Badge variant="outline">
                          {message.messageType === 'original' ? 'Original Explanation' : 'Challenge'}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {/* Reuse existing AnalysisResultCard for consistent display */}
                      <AnalysisResultCard
                        result={message.content}
                        modelKey={message.modelName}
                        model={models?.find(m => m.key === message.modelName)}
                        testCases={task.test}
                        eloMode={true}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Challenge Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Challenge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Challenger Model</label>
                  <Select value={challengerModel} onValueChange={setChallengerModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a model to challenge..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CHALLENGER_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Custom Challenge Focus (Optional)
                  </label>
                  <Textarea
                    value={customChallenge}
                    onChange={(e) => setCustomChallenge(e.target.value)}
                    placeholder="Guide the challenger's focus..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={generateChallenge}
                  disabled={!challengerModel || processingModels.has(challengerModel)}
                  className="w-full"
                >
                  {processingModels.has(challengerModel) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Challenge...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Generate Challenge
                    </>
                  )}
                </Button>

                {analyzerErrors.has(challengerModel) && (
                  <Alert>
                    <AlertDescription>
                      {analyzerErrors.get(challengerModel)?.message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Debate Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedExplanationId(null);
                      setDebateMessages([]);
                      setChallengerModel('');
                      setCustomChallenge('');
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Choose Different Explanation
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setDebateMessages(debateMessages.slice(0, 1)); // Keep only original
                      setChallengerModel('');
                      setCustomChallenge('');
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset This Debate
                  </Button>

                  <Link href={`/elo/${taskId}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Trophy className="h-4 w-4 mr-2" />
                      Compare in ELO Mode
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
      )}

      {/* No explanations available */}
      {!selectedExplanationId && explanations && explanations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">
              No explanations available for this puzzle yet.
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Generate some AI explanations first, then return here to start debates.
            </p>
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

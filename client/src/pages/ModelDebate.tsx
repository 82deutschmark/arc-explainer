/**
 * ModelDebate.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-01-01
 * PURPOSE: Model debate page where AI models challenge existing explanations from the database
 * SRP/DRY check: Pass - Reuses existing AnalysisResultCard, PuzzleGrid, useAnalysisResults hooks
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 *
 * ARCHITECTURE:
 * - Similar to ELO page but for model debates
 * - Pulls existing explanation from DB
 * - Has other models challenge/rebut the explanation
 * - Shows chat-like conversation between models
 * - Reuses existing components and patterns
 */

import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, ArrowLeft, Star, Plus, Send, RotateCcw, Trophy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Reuse existing components
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';

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

  // Fetch puzzle data
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  
  // Fetch existing explanations for this puzzle
  const { 
    explanations, 
    isLoading: isLoadingExplanations, 
    refetchExplanations 
  } = usePuzzleWithExplanation(taskId || '');

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

  // Initialize debate with selected explanation
  const initializeDebate = (explanation: ExplanationData) => {
    setSelectedExplanationId(explanation.id);
    setDebateMessages([{
      id: `original-${explanation.id}`,
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

    // Create challenge prompt
    const challengePrompt = `You are reviewing another AI's explanation of an ARC-AGI puzzle. Your job is to challenge their reasoning and propose alternative interpretations.

Original AI's explanation:
Pattern: ${originalExplanation.patternDescription}
Strategy: ${originalExplanation.solvingStrategy}
Hints: ${originalExplanation.hints.join(', ')}
Confidence: ${originalExplanation.confidence}%

${customChallenge ? `Human guidance: ${customChallenge}` : ''}

Please:
1. Identify potential flaws in their reasoning
2. Propose alternative pattern interpretations
3. Question their confidence level
4. Suggest a better approach if you see one

Be specific and constructive in your criticism.`;

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
          <div className="space-y-6">
            {/* Training Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Training Examples
                <Badge variant="outline">{task.train.length} examples</Badge>
              </h3>
              <div className="space-y-4">
                {task.train.map((example: ARCExample, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-6">
                      <PuzzleGrid grid={example.input} title="Input" showEmojis={false} />
                      <div className="text-3xl text-gray-400">→</div>
                      <PuzzleGrid grid={example.output} title="Output" showEmojis={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Case */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 text-center">Test Question</h3>
              <div className="flex items-center justify-center">
                <PuzzleGrid
                  grid={task.test[0].input}
                  title="What should this become?"
                  showEmojis={false}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explanation Selection */}
      {!selectedExplanationId && explanations && explanations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose an Explanation to Challenge</CardTitle>
            <p className="text-sm text-gray-600">
              Select an existing explanation to start the debate
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {explanations.map((explanation) => (
                <div key={explanation.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{explanation.modelName}</Badge>
                      <Badge variant="secondary">Confidence: {explanation.confidence}%</Badge>
                    </div>
                    <Button 
                      onClick={() => initializeDebate(explanation)}
                      size="sm"
                    >
                      Start Debate
                    </Button>
                  </div>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Pattern:</strong> {explanation.patternDescription}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Strategy:</strong> {explanation.solvingStrategy}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debate Interface */}
      {selectedExplanationId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Debate Messages */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Debate Conversation
                  <Badge variant="outline">{debateMessages.length} messages</Badge>
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
                <CardTitle>Quick Actions</CardTitle>
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
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Start New Debate
                </Button>
                
                <Link href={`/elo/${taskId}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    <Trophy className="h-4 w-4 mr-2" />
                    Compare in ELO
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* No explanations available */}
      {explanations && explanations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">
              No explanations available for this puzzle yet.
            </p>
            <Link href={`/puzzle/${taskId}`}>
              <Button>
                Generate First Explanation
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

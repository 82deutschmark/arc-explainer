/**
 * IndividualDebate.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-29
 * PURPOSE: Focused component for handling individual AI-vs-AI debate interface.
 * Single responsibility: Manage one debate session between AI models about a specific explanation.
 * SRP/DRY check: Pass - Single responsibility (debate UI), reuses AnalysisResultCard
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MessageSquare,
  ArrowLeft,
  Plus,
  Send,
  RotateCcw,
  Trophy,
  Loader2,
  Eye
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Reuse existing components
import { DebateAnalysisResultCard } from '@/components/puzzle/debate/DebateAnalysisResultCard';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';

// Types
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface DebateMessage {
  id: string;
  modelName: string;
  messageType: 'original' | 'challenge';
  content: ExplanationData;
  timestamp: string;
}

interface IndividualDebateProps {
  // Core data
  originalExplanation: ExplanationData;
  debateMessages: DebateMessage[];
  taskId: string;
  testCases: ARCExample[];
  models?: ModelConfig[];
  task?: any; // Full task object for prompt preview

  // State
  challengerModel: string;
  customChallenge: string;
  processingModels: Set<string>;
  analyzerErrors: Map<string, Error>;

  // Actions
  onBackToList: () => void;
  onResetDebate: () => void;
  onChallengerModelChange: (model: string) => void;
  onCustomChallengeChange: (challenge: string) => void;
  onGenerateChallenge: () => void;
}

export const IndividualDebate: React.FC<IndividualDebateProps> = ({
  originalExplanation,
  debateMessages,
  taskId,
  testCases,
  models,
  task,
  challengerModel,
  customChallenge,
  processingModels,
  analyzerErrors,
  onBackToList,
  onResetDebate,
  onChallengerModelChange,
  onCustomChallengeChange,
  onGenerateChallenge
}) => {
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Handle prompt preview - now uses API-based prompt generation
  const handlePreviewPrompt = () => {
    setShowPromptPreview(true);
  };

  // Everything is debatable unless explicitly correct
  const hasMultiTest = originalExplanation.hasMultiplePredictions &&
    (originalExplanation.multiTestAllCorrect !== undefined || originalExplanation.multiTestAverageAccuracy !== undefined);

  const isExplicitlyCorrect = hasMultiTest
    ? originalExplanation.multiTestAllCorrect === true
    : originalExplanation.isPredictionCorrect === true;

  const wasIncorrect = !isExplicitlyCorrect;

  return (
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
                  Debating: {originalExplanation.modelName}
                  {wasIncorrect && (
                    <Badge variant="destructive" className="text-xs">
                      {(hasMultiTest ? originalExplanation.multiTestAllCorrect : originalExplanation.isPredictionCorrect) === false
                        ? 'Incorrect Prediction'
                        : 'Available for Debate'}
                    </Badge>
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  Challenge this explanation with a better AI analysis
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={onBackToList}>
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

                    {/* Use scaled DebateAnalysisResultCard for compact display */}
                    <DebateAnalysisResultCard
                      result={message.content}
                      modelKey={message.modelName}
                      model={models?.find(m => m.key === message.modelName)}
                      testCases={testCases}
                      eloMode={true}
                      gridScale={0.5}
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
                <Select value={challengerModel} onValueChange={onChallengerModelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a model to challenge..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models?.map((model) => (
                      <SelectItem key={model.key} value={model.key}>
                        {model.name}
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
                  onChange={(e) => onCustomChallengeChange(e.target.value)}
                  placeholder="Guide the challenger's focus..."
                  rows={3}
                />
              </div>

              {/* Preview Prompt Button */}
              <Button
                variant="outline"
                onClick={handlePreviewPrompt}
                disabled={!challengerModel}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Challenge Prompt
              </Button>

              <Button
                onClick={onGenerateChallenge}
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
                onClick={onBackToList}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Choose Different Explanation
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onResetDebate}
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

      {/* Prompt Preview Modal */}
      {task && (
        <PromptPreviewModal
          isOpen={showPromptPreview}
          onClose={() => setShowPromptPreview(false)}
          task={task}
          taskId={taskId}
          promptId="debate"
          options={{
            omitAnswer: false,
            originalExplanation: originalExplanation,
            customChallenge: customChallenge
          }}
        />
      )}
    </div>
  );
};
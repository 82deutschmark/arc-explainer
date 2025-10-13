/**
 * IndividualDebate.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-03T22:40:00-04:00
 * PURPOSE: Full-width debate interface that properly displays large multi-test grids.
 * FIXED: Removed nested scroll box (overflow-y-auto with fixed height) that was constraining display.
 * Now flows naturally with page scroll like PuzzleExaminer, allowing full visibility of all cards.
 * Maintains sidebar for challenge controls while ensuring debate results display like PuzzleExaminer.
 * Single responsibility: Manage one debate session between AI models about a specific explanation.
 * SRP/DRY check: Pass - Single responsibility (debate UI), reuses AnalysisResultCard via wrapper components
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
  Eye,
  ArrowRight,
  Link2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Reuse existing components
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';
import { OriginalExplanationCard } from './OriginalExplanationCard';
import { RebuttalCard } from './RebuttalCard';

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

  // UI Customization
  challengeButtonText?: string; // Custom text for the challenge button (e.g., "Refine Analysis" for self-conversation)
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
  onGenerateChallenge,
  challengeButtonText = 'Generate Challenge' // Default for ModelDebate
}) => {
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message when debate updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debateMessages.length]);

  // Fetch rebuttal chain if this explanation is part of a chain
  const { data: rebuttalChain, isLoading: chainLoading } = useQuery({
    queryKey: ['rebuttal-chain', originalExplanation.id],
    queryFn: async () => {
      if (!originalExplanation.id) return null;
      const response: any = await apiRequest('GET', `/api/explanations/${originalExplanation.id}/chain`);
      // API returns {success, data} or {success, error} format
      return response?.data || response || [];
    },
    enabled: !!originalExplanation.id,
    staleTime: 30000 // Cache for 30 seconds
  });

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
    <div className="space-y-3">
      {/* Compact Header with Controls */}
      <Card className={wasIncorrect ? 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50' : 'border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50'}>
        <CardContent className="p-3 space-y-3">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${wasIncorrect ? 'bg-red-100' : 'bg-blue-100'}`}>
                <MessageSquare className={`h-5 w-5 ${wasIncorrect ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">AI Model Debate</h2>
                <p className="text-xs text-gray-600">
                  {debateMessages.length} participant{debateMessages.length !== 1 ? 's' : ''} • Challenge and refine
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onResetDebate}
                disabled={debateMessages.length <= 1}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset
              </Button>
              <Link href={`/elo/${taskId}`}>
                <Button variant="outline" size="sm" className="text-xs">
                  <Trophy className="h-3 w-3 mr-1.5" />
                  ELO Mode
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={onBackToList}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>

          {/* Original Explanation Info Row */}
          <div className="pt-3 border-t border-gray-300">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-700">Original Analysis:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {originalExplanation.modelName}
              </Badge>
              {wasIncorrect && (
                <Badge variant="destructive" className="text-xs">
                  {(hasMultiTest ? originalExplanation.multiTestAllCorrect : originalExplanation.isPredictionCorrect) === false
                    ? 'Incorrect Prediction'
                    : 'Available for Debate'}
                </Badge>
              )}
              {originalExplanation.rebuttingExplanationId && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Rebuttal
                </Badge>
              )}
              
              {/* Rebuttal Chain Breadcrumb */}
              {rebuttalChain && rebuttalChain.length > 1 && (
                <>
                  <span className="text-gray-400">•</span>
                  <Link2 className="h-3 w-3 text-gray-600" />
                  <span className="text-xs text-gray-600">Chain:</span>
                  {rebuttalChain.map((exp: any, idx: number) => (
                    <React.Fragment key={exp.id}>
                      {idx > 0 && <ArrowRight className="h-3 w-3 text-gray-400" />}
                      <Badge 
                        variant={exp.id === originalExplanation.id ? "default" : "outline"}
                        className="text-xs cursor-pointer hover:bg-gray-100"
                      >
                        {exp.modelName}
                      </Badge>
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Challenge Controls Row */}
          <div className="pt-3 border-t border-gray-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              {/* Challenger Model Selection - 3 cols */}
              <div className="lg:col-span-3">
                <label className="text-xs font-medium mb-1.5 block text-gray-700">Challenger Model</label>
                <Select value={challengerModel} onValueChange={onChallengerModelChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose model..." />
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

              {/* Custom Challenge Input - 6 cols */}
              <div className="lg:col-span-6">
                <label className="text-xs font-medium mb-1.5 block text-gray-700">
                  Custom Challenge Focus (Optional)
                </label>
                <Textarea
                  value={customChallenge}
                  onChange={(e) => onCustomChallengeChange(e.target.value)}
                  placeholder="Leave blank for general challenge"
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              {/* Action Buttons - 3 cols */}
              <div className="lg:col-span-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreviewPrompt}
                  disabled={!challengerModel}
                  className="h-[72px] text-xs"
                  size="sm"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  onClick={onGenerateChallenge}
                  disabled={!challengerModel || processingModels.has(challengerModel)}
                  className="h-[72px] text-sm bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                >
                  {processingModels.has(challengerModel) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      {challengeButtonText}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {analyzerErrors.has(challengerModel) && (
              <Alert variant="destructive" className="mt-3 py-2">
                <AlertDescription className="text-xs">
                  {analyzerErrors.get(challengerModel)?.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debate content - full width */}
      <div className="space-y-3">
        {debateMessages.map((message, index) => {
          // Calculate cumulative reasoning tokens up to this point
          const cumulativeReasoningTokens = debateMessages
            .slice(0, index + 1)
            .reduce((sum, msg) => sum + (msg.content.reasoningTokens || 0), 0);

          return message.messageType === 'original' ? (
            <OriginalExplanationCard
              key={message.id}
              explanation={message.content}
              models={models}
              testCases={testCases}
              timestamp={message.timestamp}
            />
          ) : (
            <RebuttalCard
              key={message.id}
              explanation={message.content}
              models={models}
              testCases={testCases}
              timestamp={message.timestamp}
              rebuttalNumber={debateMessages.slice(0, index).filter(m => m.messageType === 'challenge').length + 1}
              cumulativeReasoningTokens={cumulativeReasoningTokens}
            />
          );
        })}
        {/* Anchor for auto-scroll to bottom */}
        <div ref={messagesEndRef} />
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
            omitAnswer: true,  // CRITICAL: Debate mode is SOLVER behavior - models should NOT see correct answers
            originalExplanation: originalExplanation,
            customChallenge: customChallenge
          }}
        />
      )}
    </div>
  );
};
/**
 * IndividualDebate.tsx
 *
 * Author: Cascade using GPT-4.1
 * Date: 2025-09-29T17:15:00-04:00
 * PURPOSE: Ultra-compact debate interface with 1/5 scale grids (20%), minimal padding/whitespace.
 * Fixed massive grid overlap and wasted space by reducing all padding from p-4 to p-2, 
 * shrinking grids from 50% to 20% scale, and reducing all text/icon sizes by ~40%.
 * Single responsibility: Manage one debate session between AI models about a specific explanation.
 * SRP/DRY check: Pass - Single responsibility (debate UI), reuses DebateAnalysisResultCard
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState } from 'react';
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
    <div className="space-y-2">
      {/* Debate Header with Back Button */}
      <Card>
        <CardContent className="p-2">
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
                  {originalExplanation.rebuttingExplanationId && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      Rebuttal
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
          
          {/* Rebuttal Chain Breadcrumb */}
          {rebuttalChain && rebuttalChain.length > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                <Link2 className="h-3 w-3" />
                <span className="font-medium">Debate Chain:</span>
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
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {rebuttalChain.length} models in this debate thread
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Debate Messages */}
        <div className="lg:col-span-2 space-y-2">
          {/* Header Card */}
          <Card>
            <CardHeader className="p-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                AI Model Debate
                <Badge variant="outline" className="text-xs">{debateMessages.length} participants</Badge>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Scrollable debate content */}
          <div className="space-y-2 max-h-[800px] overflow-y-auto">
            {debateMessages.map((message, index) => (
              message.messageType === 'original' ? (
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
                />
              )
            ))}
          </div>
        </div>

        {/* Challenge Controls */}
        <div className="space-y-2">
          <Card>
            <CardHeader className="p-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" />
                Add Challenge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Challenger Model</label>
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
                <label className="text-xs font-medium mb-1 block">
                  Custom Challenge Focus (Optional)
                </label>
                <Textarea
                  value={customChallenge}
                  onChange={(e) => onCustomChallengeChange(e.target.value)}
                  placeholder="Guide the challenger's focus..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              {/* Preview Prompt Button */}
              <Button
                variant="outline"
                onClick={handlePreviewPrompt}
                disabled={!challengerModel}
                className="w-full h-8 text-xs"
                size="sm"
              >
                <Eye className="h-3 w-3 mr-1" />
                Preview Challenge Prompt
              </Button>

              <Button
                onClick={onGenerateChallenge}
                disabled={!challengerModel || processingModels.has(challengerModel)}
                className="w-full h-8 text-xs"
                size="sm"
              >
                {processingModels.has(challengerModel) ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Ask other LLM
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
            <CardHeader className="p-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plus className="h-3 w-3" />
                Debate Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={onBackToList}
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Choose Different
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={onResetDebate}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset Debate
              </Button>

              <Link href={`/elo/${taskId}`}>
                <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                  <Trophy className="h-3 w-3 mr-1" />
                  ELO Mode
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
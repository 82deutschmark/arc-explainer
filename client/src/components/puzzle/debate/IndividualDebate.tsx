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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import {
  MessageSquare,
  ArrowLeft,
  Send,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Reuse existing components
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';
import { RebuttalCard } from './RebuttalCard';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { AdvancedControls } from '@/components/puzzle/AdvancedControls';

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

  // Model configuration
  temperature: number;
  onTemperatureChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
  candidateCount: number;
  onCandidateCountChange: (value: number) => void;
  thinkingBudget: number;
  onThinkingBudgetChange: (value: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  onReasoningEffortChange: (value: 'minimal' | 'low' | 'medium' | 'high') => void;
  reasoningVerbosity: 'low' | 'medium' | 'high';
  onReasoningVerbosityChange: (value: 'low' | 'medium' | 'high') => void;
  reasoningSummaryType: 'auto' | 'detailed';
  onReasoningSummaryTypeChange: (value: 'auto' | 'detailed') => void;

  includeGridImages: boolean;
  onIncludeGridImagesChange: (value: boolean) => void;

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
  temperature,
  onTemperatureChange,
  topP,
  onTopPChange,
  candidateCount,
  onCandidateCountChange,
  thinkingBudget,
  onThinkingBudgetChange,
  reasoningEffort,
  onReasoningEffortChange,
  reasoningVerbosity,
  onReasoningVerbosityChange,
  reasoningSummaryType,
  onReasoningSummaryTypeChange,
  includeGridImages,
  onIncludeGridImagesChange,
  onBackToList,
  onResetDebate,
  onChallengerModelChange,
  onCustomChallengeChange,
  onGenerateChallenge,
  challengeButtonText = 'Generate Challenge' // Default for ModelDebate
}) => {
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'view' | 'run' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(debateMessages.length);

  // Auto-scroll ONLY when a NEW message is added (not on initial mount)
  useEffect(() => {
    if (debateMessages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = debateMessages.length;
  }, [debateMessages.length]);

  // Handle prompt preview - now uses API-based prompt generation
  const openPromptPreview = (mode: 'view' | 'run') => {
    setPreviewMode(mode);
    setShowPromptPreview(true);
  };

  const handleGenerateChallengeClick = () => {
    openPromptPreview('run');
  };

  const handleClosePromptPreview = () => {
    setShowPromptPreview(false);
    setPreviewMode(null);
  };

  const handleConfirmChallenge = async () => {
    await Promise.resolve(onGenerateChallenge());
    handleClosePromptPreview();
  };

  // Everything is debatable unless explicitly correct
  const hasMultiTest = originalExplanation.hasMultiplePredictions &&
    (originalExplanation.multiTestAllCorrect !== undefined || originalExplanation.multiTestAverageAccuracy !== undefined);

  const isExplicitlyCorrect = hasMultiTest
    ? originalExplanation.multiTestAllCorrect === true
    : originalExplanation.isPredictionCorrect === true;

  const wasIncorrect = !isExplicitlyCorrect;

  // Smart control visibility based on selected model
  const selectedModel = models?.find(m => m.key === challengerModel);
  const isGPT5Model = challengerModel?.includes('gpt-5') || challengerModel?.includes('o1') || challengerModel?.includes('o3');
  const isGeminiModel = challengerModel?.includes('gemini');
  const showAdvancedControls = isGPT5Model || isGeminiModel;

  return (
    <div className="space-y-2">
      {/* Compact Test Grid Preview */}
      {testCases && testCases.length > 0 && (
        <Card className="border-gray-300">
          <CardHeader className="p-2 pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              Test Cases
              <Badge variant="outline" className="text-xs">{testCases.length} test{testCases.length !== 1 ? 's' : ''}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {testCases.map((testCase, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-[10px] font-medium text-gray-600">Test {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <div className="text-[9px] text-gray-500 mb-0.5">Input</div>
                      <TinyGrid grid={testCase.input} className="border border-gray-300 rounded" />
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-500 mb-0.5">Output</div>
                      <TinyGrid grid={testCase.output} className="border border-gray-300 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Compact Challenge Controls Card */}
      <Card className="border-gray-200 bg-white">
        <CardContent className="p-3 space-y-3">
          {/* Simple Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-600" />
              <span className="font-medium text-sm">Challenge Controls</span>
              <Badge variant="outline" className="text-xs">
                {debateMessages.filter(m => m.messageType === 'challenge').length} challenge{debateMessages.filter(m => m.messageType === 'challenge').length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onResetDebate}
                disabled={debateMessages.length <= 1}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={onBackToList}>
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back to List
              </Button>
            </div>
          </div>

          {/* Challenge Controls */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
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

              {/* Smart Advanced Controls - Only show for GPT-5/Gemini - 6 cols */}
              {showAdvancedControls && challengerModel && (
                <div className="lg:col-span-6">
                  <label className="text-xs font-medium mb-1.5 block text-gray-700">Model Settings</label>
                  <Card className="p-2 bg-white">
                    <AdvancedControls
                      temperature={temperature}
                      onTemperatureChange={onTemperatureChange}
                      topP={topP}
                      onTopPChange={onTopPChange}
                      candidateCount={candidateCount}
                      onCandidateCountChange={onCandidateCountChange}
                      thinkingBudget={thinkingBudget}
                      onThinkingBudgetChange={onThinkingBudgetChange}
                      reasoningEffort={reasoningEffort}
                      onReasoningEffortChange={onReasoningEffortChange}
                      reasoningVerbosity={reasoningVerbosity}
                      onReasoningVerbosityChange={onReasoningVerbosityChange}
                      reasoningSummaryType={reasoningSummaryType}
                      onReasoningSummaryTypeChange={onReasoningSummaryTypeChange}
                      includeGridImages={includeGridImages}
                      onIncludeGridImagesChange={onIncludeGridImagesChange}
                    />
                  </Card>
                </div>
              )}

              {/* Custom Challenge Input - 3 cols (or 6 if no advanced controls) */}
              <div className={showAdvancedControls && challengerModel ? "lg:col-span-3" : "lg:col-span-6"}>
                <label className="text-xs font-medium mb-1.5 block text-gray-700">
                  Custom Challenge Focus (Optional)
                </label>
                <Textarea
                  value={customChallenge}
                  onChange={(e) => onCustomChallengeChange(e.target.value)}
                  placeholder="Leave blank for general challenge"
                  rows={showAdvancedControls && challengerModel ? 3 : 2}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            {/* Generate Challenge Button - Full width */}
            <Button
              onClick={handleGenerateChallengeClick}
              disabled={!challengerModel || processingModels.has(challengerModel)}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
            >
              {processingModels.has(challengerModel) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {challengeButtonText}
                </>
              )}
            </Button>

            {/* Error Display */}
            {analyzerErrors.has(challengerModel) && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  {analyzerErrors.get(challengerModel)?.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Challenge Responses Only (skip original - already shown above) */}
      <div className="space-y-2">
        {debateMessages.filter(message => message.messageType === 'challenge').map((message, index) => {
          const challengeIndex = debateMessages.slice(0, debateMessages.indexOf(message) + 1).filter(m => m.messageType === 'challenge').length;
          const cumulativeReasoningTokens = debateMessages
            .slice(0, debateMessages.indexOf(message) + 1)
            .reduce((sum, msg) => sum + (msg.content.reasoningTokens || 0), 0);

          return (
            <RebuttalCard
              key={message.id}
              explanation={message.content}
              models={models}
              testCases={testCases}
              timestamp={message.timestamp}
              rebuttalNumber={challengeIndex}
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
          onClose={handleClosePromptPreview}
          task={task}
          taskId={taskId}
          promptId="debate"
          options={{
            omitAnswer: true,  // CRITICAL: Debate mode is SOLVER behavior - models should NOT see correct answers
            originalExplanation: originalExplanation,
            customChallenge: customChallenge
          }}
          confirmMode={previewMode === 'run'}
          onConfirm={previewMode === 'run' ? handleConfirmChallenge : undefined}
          confirmButtonText="Send Challenge"
        />
      )}
    </div>
  );
};
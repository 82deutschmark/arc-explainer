/**
 * RefinementControls.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Control panel for progressive reasoning refinement.
 * Shows locked model, user guidance input, and refinement actions.
 * Single responsibility: Refinement control UI only.
 * SRP/DRY check: Pass - Focused only on control panel UI
 * shadcn/ui: Pass - Uses shadcn/ui Card, Button, Badge, Textarea, Alert components
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Send, RotateCcw, ArrowLeft, Loader2, Sparkles } from 'lucide-react';

interface RefinementControlsProps {
  // Model info
  activeModel: string;
  modelDisplayName?: string;

  // User guidance
  userGuidance: string;
  onUserGuidanceChange: (guidance: string) => void;

  // Current state
  currentIteration: number;
  isProcessing: boolean;
  error?: Error | null;
  totalReasoningTokens?: number;

  // Actions
  onContinueRefinement: () => void;
  onReset: () => void;
  onBackToList: () => void;
}

export const RefinementControls: React.FC<RefinementControlsProps> = ({
  activeModel,
  modelDisplayName,
  userGuidance,
  onUserGuidanceChange,
  currentIteration,
  isProcessing,
  error,
  totalReasoningTokens,
  onContinueRefinement,
  onReset,
  onBackToList
}) => {
  return (
    <div className="space-y-3">
      {/* Active Model Card */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-purple-600" />
            Active Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-100 text-purple-900 border-purple-300 font-mono text-xs">
              {modelDisplayName || activeModel}
            </Badge>
            <span className="text-xs text-gray-600">Locked</span>
          </div>

          {totalReasoningTokens !== undefined && totalReasoningTokens > 0 && (
            <div className="bg-purple-100/50 border border-purple-200 rounded p-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-purple-600" />
                <span className="text-xs font-medium text-purple-900">
                  Total Reasoning: {totalReasoningTokens.toLocaleString()} tokens
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Current Iteration:</span>
            <Badge variant="secondary" className="text-xs">
              #{currentIteration}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Refinement Controls Card */}
      <Card className="border-blue-200">
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Send className="h-4 w-4 text-blue-600" />
            Continue Refinement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0">
          <div>
            <label className="text-xs font-medium mb-1.5 block text-gray-700">
              User Guidance (Optional)
            </label>
            <Textarea
              value={userGuidance}
              onChange={(e) => onUserGuidanceChange(e.target.value)}
              placeholder="What should the model focus on in the next iteration? (e.g., 'Look more carefully at the colors', 'Consider rotational symmetry')"
              rows={3}
              className="text-xs resize-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Leave blank for the model to refine based on its own analysis
            </p>
          </div>

          <Button
            onClick={onContinueRefinement}
            disabled={isProcessing}
            className="w-full h-9 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Continue Refinement
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {error.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card className="border-gray-200">
        <CardHeader className="p-3">
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={onBackToList}
          >
            <ArrowLeft className="h-3 w-3 mr-1.5" />
            Choose Different Analysis
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
            onClick={onReset}
            disabled={currentIteration === 0}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Reset to Original
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * TestCaseViewer.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-11 (Refactored for grid modularization)
 * PURPOSE: Displays test cases with optional answer reveal toggle.
 * Uses modular grid components (InputGridDisplay, OutputGridDisplay) for consistency.
 * SRP: Single responsibility = orchestrate test case display with answer reveal
 * DRY: Delegates grid rendering to specialized components
 * shadcn/ui: Uses Switch, Badge, Label
 */

import React, { useState } from 'react';
import { GridDisplay } from '@/components/puzzle/grids/GridDisplay';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import type { EmojiSet } from '@/lib/spaceEmojis';

interface TestCaseViewerProps {
  testCases: Array<{ input: number[][]; output: number[][] }>;
  showEmojis: boolean;
  emojiSet?: EmojiSet;
}

/**
 * Test case viewer with answer reveal toggle.
 * Shows test inputs prominently; user can toggle to reveal correct answers.
 */
export function TestCaseViewer({
  testCases,
  showEmojis,
  emojiSet
}: TestCaseViewerProps) {
  const [showAnswers, setShowAnswers] = useState(true);

  return (
    <div className="border-t pt-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Test Cases</h3>
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
            {testCases.length} {testCases.length === 1 ? 'test' : 'tests'}
          </Badge>
        </div>

        {/* Answer reveal toggle */}
        <div className="flex items-center gap-2">
          <Label htmlFor="show-answers" className="text-sm cursor-pointer flex items-center gap-1.5">
            {showAnswers ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Show Answers
          </Label>
          <Switch
            id="show-answers"
            checked={showAnswers}
            onCheckedChange={setShowAnswers}
          />
        </div>
      </div>

      {/* Test cases grid - now using modular GridDisplay */}
      <div className="space-y-4">
        {testCases.map((testCase, index) => (
          <div key={index} className="flex items-center justify-center gap-6 p-3 bg-gray-50 rounded-lg">
            <GridDisplay 
              grid={testCase.input}
              label={`Test ${index + 1} - Input`}
              sizeClass="max-w-[20rem] max-h-[20rem]"
              showDimensions={true}
            />

            {showAnswers && (
              <>
                <ArrowRight className="h-6 w-6 text-green-600" />
                
                <div className="bg-green-50 p-2 rounded-lg border-2 border-green-300">
                  <GridDisplay 
                    grid={testCase.output}
                    label={`Test ${index + 1} - Correct Answer`}
                    sizeClass="max-w-[20rem] max-h-[20rem]"
                    showDimensions={true}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

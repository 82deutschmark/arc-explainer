/**
 * TestCaseViewer.tsx
 * 
 * Author: Cascade using Sonnet 4
 * Date: 2025-10-11T19:30:00Z
 * PURPOSE: Displays test cases with optional answer reveal.
 * Compact layout showing inputs prominently, with toggle to show/hide correct outputs.
 * SRP: Single responsibility = render test cases with answer reveal controls
 * DRY: Reuses PuzzleGrid, no duplication
 * shadcn/ui: Uses Switch for toggle, Badge for counts
 */

import React, { useState } from 'react';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
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

      {/* Test cases grid */}
      <div className="space-y-4">
        {testCases.map((testCase, index) => (
          <div key={index} className="flex items-center justify-center gap-6 p-3 bg-gray-50 rounded-lg">
            <div>
              <PuzzleGrid 
                grid={testCase.input}
                title={`Test ${index + 1} - Input`}
                showEmojis={showEmojis}
                emojiSet={emojiSet}
              />
            </div>

            {showAnswers && (
              <>
                <ArrowRight className="h-6 w-6 text-green-600" />
                
                <div>
                  <PuzzleGrid 
                    grid={testCase.output}
                    title={`Test ${index + 1} - Correct Answer`}
                    showEmojis={showEmojis}
                    emojiSet={emojiSet}
                    highlight={true}
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

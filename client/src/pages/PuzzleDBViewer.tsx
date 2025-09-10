/**
 * PuzzleDBViewer.tsx
 * 
 * @author Cascade, Claude (refactored)
 * @description Displays puzzle details with LLM analysis results and community solutions.
 * Refactored to follow SRP and DRY principles using composition pattern.
 */

import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import puzzle components
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { ExplanationResultsSection } from '@/components/puzzle/ExplanationResultsSection';
import { CommunitySolutionsSection } from '@/components/puzzle/CommunitySolutionsSection';
import { SolutionSubmissionForm } from '@/components/puzzle/SolutionSubmissionForm';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';


export default function PuzzleDBViewer() {
  const { taskId } = useParams<{ taskId: string }>();
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  
  // Set page title with puzzle ID
  React.useEffect(() => {
    document.title = taskId ? `ARC Puzzle ${taskId} - Database View` : 'ARC Puzzle Database';
  }, [taskId]);

  // Fetch puzzle data
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);

  // Early return if no taskId
  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>Invalid puzzle ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (isLoadingTask) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading puzzle...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (taskError || !task) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-3 max-w-6xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              Puzzle {taskId} - Database View
            </h1>
            <p className="text-gray-600">
              LLM analysis results and community solutions
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href={`/examine/${taskId}`}>
            <Button variant="default" size="sm" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Analyze with AI
            </Button>
          </Link>
          <Button
            variant={showEmojis ? "default" : "outline"}
            size="sm"
            onClick={() => setShowEmojis(!showEmojis)}
          >
            {showEmojis ? '🔢 Show Numbers' : '🛸 Show Emojis'}
          </Button>
        </div>
      </div>

      {/* Puzzle Grid Display */}
      <Card>
        <CardHeader>
          <CardTitle>Puzzle Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Training Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Training Examples 
                <Badge variant="outline">{task.train.length} examples</Badge>
              </h3>
              <div className="space-y-4">
                {task.train.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-6">
                      <PuzzleGrid 
                        grid={example.input}
                        title="Input"  
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                      />
                      <div className="text-3xl text-gray-400">→</div>
                      <PuzzleGrid 
                        grid={example.output}
                        title="Output"
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Case */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 text-center">Test Case</h3>
              {task.test.map((testCase, index) => (
                <div key={index} className="flex items-center justify-center gap-6">
                  <PuzzleGrid 
                    grid={testCase.input}
                    title="Test Question"
                    showEmojis={showEmojis}
                    emojiSet={emojiSet}
                  />
                  <div className="text-3xl text-green-600">→</div>
                  <PuzzleGrid 
                    grid={testCase.output}
                    title="Correct Answer"
                    showEmojis={showEmojis}
                    emojiSet={emojiSet}
                    highlight={true}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LLM Analysis Results & Community Solutions */}
      <Tabs defaultValue="llm-analysis" className="w-full">
        <TabsList className="grid grid-cols-3 mb-2">
          <TabsTrigger value="llm-analysis">LLM Analysis Results</TabsTrigger>
          <TabsTrigger value="community">Community Solutions</TabsTrigger>
          <TabsTrigger value="submit">Submit Solution</TabsTrigger>
        </TabsList>
        
        <TabsContent value="llm-analysis">
          <ExplanationResultsSection taskId={taskId} />
        </TabsContent>
        
        <TabsContent value="community">
          <CommunitySolutionsSection puzzleId={taskId} />
        </TabsContent>
        
        <TabsContent value="submit">
          <SolutionSubmissionForm puzzleId={taskId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

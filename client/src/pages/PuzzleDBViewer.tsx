/**
 * PuzzleDBViewer.tsx
 * 
 * @author Cascade
 * @description This component displays puzzle details and allows users to submit their own solutions.
 * It reuses many elements from PuzzleExaminer but focuses on solution viewing/submission rather than AI analysis.
 * Part of the solution submission system outlined in the Gemini plan.
 */

import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Eye, ArrowLeft, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import our components
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';
import axios from 'axios';

// Define the solution type
interface Solution {
  id: string;
  puzzleId: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  feedbackType: string;
}

export default function PuzzleDBViewer() {
  const { taskId } = useParams<{ taskId: string }>();
  const { toast } = useToast();
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [isLoadingSolutions, setIsLoadingSolutions] = useState(false);
  const [solutionInput, setSolutionInput] = useState('');
  const [isSubmittingSolution, setIsSubmittingSolution] = useState(false);
  
  // Set page title with puzzle ID
  React.useEffect(() => {
    document.title = taskId ? `ARC Puzzle ${taskId} - Solutions` : 'ARC Puzzle Solutions';
  }, [taskId]);

  // Fetch puzzle data
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);

  // Fetch solutions for this puzzle
  React.useEffect(() => {
    if (taskId) {
      fetchSolutions();
    }
  }, [taskId]);

  const fetchSolutions = async () => {
    try {
      setIsLoadingSolutions(true);
      const response = await axios.get(`/api/puzzles/${taskId}/solutions`);
      if (response.data.success) {
        setSolutions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch solutions:', error);
      toast({
        title: "Error",
        description: "Failed to load solutions. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSolutions(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (!solutionInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a solution explanation",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmittingSolution(true);
      const response = await axios.post(`/api/puzzles/${taskId}/solutions`, {
        comment: solutionInput
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Your solution has been submitted!",
          variant: "default"
        });
        setSolutionInput('');
        // Refresh the solutions list
        fetchSolutions();
      }
    } catch (error) {
      console.error('Failed to submit solution:', error);
      toast({
        title: "Error",
        description: "Failed to submit solution. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingSolution(false);
    }
  };

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

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
              Puzzle {taskId} - Solutions
            </h1>
            <p className="text-gray-600">
              View community solutions and submit your own
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href={`/examine/${taskId}`}>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
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

      {/* Solution Submission & Viewing */}
      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid grid-cols-2 mb-2">
          <TabsTrigger value="view">View Solutions</TabsTrigger>
          <TabsTrigger value="submit">Submit Your Solution</TabsTrigger>
        </TabsList>
        
        <TabsContent value="view">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Community Solutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSolutions ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Loading solutions...</span>
                </div>
              ) : solutions.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-md">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-700">No solutions yet</h3>
                  <p className="text-gray-500 text-sm mt-1">Be the first to submit a solution for this puzzle!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {solutions.map((solution) => (
                    <div key={solution.id} className="border border-gray-200 rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm text-gray-500">
                          Submitted on {formatDate(solution.createdAt)}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4" />
                            <span>Helpful</span>
                          </Button>
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <ThumbsDown className="h-4 w-4" />
                            <span>Not Helpful</span>
                          </Button>
                        </div>
                      </div>
                      <div className="text-gray-800 whitespace-pre-line">
                        {solution.comment}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>Submit Your Solution</CardTitle>
              <p className="text-gray-500 text-sm">
                Share your explanation for how this puzzle is solved
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="solution" className="text-gray-700">Your Solution Explanation</Label>
                  <Textarea
                    id="solution"
                    placeholder="Describe your solution approach for this puzzle..."
                    className="min-h-[200px] mt-1"
                    value={solutionInput}
                    onChange={(e) => setSolutionInput(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum 10 characters. Be clear and concise in your explanation.
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch id="terms" />
                    <Label htmlFor="terms" className="text-sm">
                      I confirm this is my original solution
                    </Label>
                  </div>
                  <Button 
                    onClick={handleSubmitSolution}
                    disabled={isSubmittingSolution || solutionInput.trim().length < 10}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmittingSolution && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Submit Solution
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

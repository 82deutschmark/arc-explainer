/**
 * SolutionSubmissionForm Component
 * 
 * Form for submitting community solutions.
 * Single responsibility: Handle solution submission with validation.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useSolutions } from '@/hooks/useSolutions';

interface SolutionSubmissionFormProps {
  puzzleId: string;
}

export function SolutionSubmissionForm({ puzzleId }: SolutionSubmissionFormProps) {
  const [solutionInput, setSolutionInput] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { submitSolution, isSubmitting } = useSolutions(puzzleId);

  const handleSubmit = () => {
    if (!solutionInput.trim() || solutionInput.trim().length < 10) {
      return;
    }

    submitSolution({ comment: solutionInput.trim() });
    
    // Clear form on successful submission
    setSolutionInput('');
    setIsConfirmed(false);
  };

  const isValid = solutionInput.trim().length >= 10 && isConfirmed;

  return (
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
            <Label htmlFor="solution" className="text-gray-700">
              Your Solution Explanation
            </Label>
            <Textarea
              id="solution"
              placeholder="Describe your solution approach for this puzzle..."
              className="min-h-[200px] mt-1"
              value={solutionInput}
              onChange={(e) => setSolutionInput(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 10 characters. Be clear and concise in your explanation.
              {solutionInput.trim().length > 0 && (
                <span className={`ml-2 ${solutionInput.trim().length >= 10 ? 'text-green-600' : 'text-orange-600'}`}>
                  ({solutionInput.trim().length}/10)
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Switch 
                id="terms" 
                checked={isConfirmed}
                onCheckedChange={setIsConfirmed}
                disabled={isSubmitting}
              />
              <Label htmlFor="terms" className="text-sm">
                I confirm this is my original solution
              </Label>
            </div>
            <Button 
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Solution
            </Button>
          </div>
          
          {!isValid && solutionInput.trim().length > 0 && (
            <div className="text-sm text-orange-600 mt-2">
              {solutionInput.trim().length < 10 && "Solution must be at least 10 characters long. "}
              {!isConfirmed && "Please confirm this is your original solution."}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
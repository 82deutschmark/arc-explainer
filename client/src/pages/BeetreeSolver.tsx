/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Main Beetree ensemble solver page with real-time progress tracking and cost monitoring
 * SRP/DRY check: Pass - Reuses existing patterns from PoetiqSolver with Beetree-specific adaptations
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Play, Square, DollarSign, Clock, Users, Zap, ArrowLeft, AlertTriangle } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useBeetreeRun } from '@/hooks/useBeetreeRun';
import { BeetreeProgressDashboard } from '@/components/beetree/BeetreeProgressDashboard';
import { BeetreeResultsPanel } from '@/components/beetree/BeetreeResultsPanel';
import { BeetreeCostEstimator } from '@/components/beetree/BeetreeCostEstimator';
import { BeetreeCostDisplay } from '@/components/beetree/BeetreeCostDisplay';

export default function BeetreeSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  
  // Load task data
  const { task, isLoadingTask } = usePuzzle(taskId || '');
  
  // Form state
  const [mode, setMode] = useState<'testing' | 'production'>('testing');
  const [showProductionConfirm, setShowProductionConfirm] = useState(false);
  
  // Beetree run hook
  const {
    run,
    status,
    progress,
    results,
    cost,
    error,
    isLoading,
    isConnected,
    startAnalysis,
    cancelAnalysis,
    clearResults
  } = useBeetreeRun();

  const handleStart = () => {
    if (!taskId) return;
    
    // Show confirmation modal for production mode
    if (mode === 'production') {
      setShowProductionConfirm(true);
      return;
    }
    
    doStartAnalysis();
  };

  const doStartAnalysis = () => {
    if (!taskId) return;
    
    setShowProductionConfirm(false);
    startAnalysis({
      taskId,
      testIndex: 0,
      mode,
      runTimestamp: `beetree_${Date.now()}`
    });
  };

  const handleCancel = () => {
    cancelAnalysis();
  };

  const handleClear = () => {
    clearResults();
  };

  const isRunning = status === 'running';
  const hasResults = results && !error;

  if (isLoadingTask) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="w-8 h-8 text-emerald-600" />
              Beetree Ensemble Solver
            </h1>
            <p className="text-muted-foreground mt-1">
              Multi-model consensus analysis with real-time cost tracking
              {taskId && <span className="ml-2">• Task: {taskId}</span>}
            </p>
          </div>
          
          {taskId && (
            <Link href={`/puzzle/${taskId}`}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Puzzle
              </Button>
            </Link>
          )}
        </div>

        {/* Configuration Panel */}
        {!isRunning && !hasResults && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Analysis Mode</label>
                <Select value={mode} onValueChange={(value: 'testing' | 'production') => setMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="testing">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Testing</Badge>
                        <span>3 models, 2-6 min, $0.50-$2.00</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="production">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Production</Badge>
                        <span>8 models, 20-45 min, $15-$50</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Task Info */}
              {task && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Task</label>
                  <div className="text-sm text-muted-foreground">
                    {taskId} • 
                    {task.train?.length || 0} training examples • 
                    {task.test?.length || 0} test cases
                  </div>
                </div>
              )}
            </div>

            {/* Cost Estimator */}
            <div className="mt-6">
              <BeetreeCostEstimator mode={mode} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button 
                onClick={handleStart}
                disabled={!taskId || isLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Analysis
                  </>
                )}
              </Button>
              
              {results && (
                <Button variant="outline" onClick={handleClear}>
                  Clear Results
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress Dashboard */}
        {isRunning && (
          <BeetreeProgressDashboard
            status={status}
            progress={progress}
            cost={cost}
            onCancel={handleCancel}
          />
        )}

        {/* Results Panel */}
        {hasResults && cost && (
          <BeetreeResultsPanel
            results={results}
            cost={cost}
            mode={mode}
            onNewAnalysis={() => clearResults()}
          />
        )}

        {/* Cost Breakdown */}
        {cost && (isRunning || hasResults) && (
          <BeetreeCostDisplay cost={cost} mode={mode} />
        )}

        {/* Connection Status */}
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <div className={`flex items-center gap-1 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600 animate-pulse'}`} />
            {isConnected ? 'Connected to Beetree stream' : 'Disconnected from stream'}
          </div>
        </div>
      </div>

      {/* Production Mode Confirmation Modal */}
      <AlertDialog open={showProductionConfirm} onOpenChange={setShowProductionConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Production Mode
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Production mode runs <strong>8 frontier AI models</strong> including GPT-5.1, 
                Claude Opus, and Gemini Pro for comprehensive analysis.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                <p className="font-semibold">Estimated Cost: $15 - $50</p>
                <p className="text-sm">Duration: 20 - 45 minutes</p>
              </div>
              <p className="text-sm">
                Are you sure you want to proceed? This will incur real API charges.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={doStartAnalysis}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Start Production Analysis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T23:51:00-04:00
 * PURPOSE: Dedicated full page for displaying puzzle-by-puzzle model comparison matrix.
 * Shows NewModelComparisonResults component with comparison data from backend.
 * 
 * FEATURES:
 * - Puzzle-by-puzzle comparison matrix (✅/❌/⏳)
 * - Summary statistics at the top
 * - Scrollable table with sticky columns
 * - Clickable puzzle badges
 * 
 * SRP and DRY check: Pass - Single responsibility is displaying comparison matrix
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, GitCompare } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NewModelComparisonResults } from '@/components/analytics/NewModelComparisonResults';
import { ModelComparisonResult } from './AnalyticsOverview';
import { Card, CardContent } from '@/components/ui/card';

export default function ModelComparisonPage() {
  const [, navigate] = useLocation();
  
  // Get comparison data from location state
  const [comparisonData, setComparisonData] = useState<ModelComparisonResult | null>(() => {
    return (window.history.state?.usr?.comparisonData as ModelComparisonResult | null) || null;
  });

  // Update state when location changes
  React.useEffect(() => {
    const stateData = window.history.state?.usr?.comparisonData as ModelComparisonResult | null;
    if (stateData) {
      setComparisonData(stateData);
    }
  }, []);

  if (!comparisonData) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertDescription>
            No comparison data found. Please run a comparison from the Analytics page.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/analytics')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Analytics
        </Button>
      </div>
    );
  }

  const { summary } = comparisonData;
  const activeModels = [
    summary.model1Name,
    summary.model2Name,
    summary.model3Name,
    summary.model4Name
  ].filter(Boolean);

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/analytics')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Analytics
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitCompare className="h-8 w-8" />
            Model Comparison
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comparing {activeModels.join(', ')} on {summary.dataset} dataset ({summary.totalPuzzles} puzzles)
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="All Correct"
          value={summary.allCorrect}
          description="All models solved"
          variant="success"
        />
        <StatCard
          label="All Incorrect"
          value={summary.allIncorrect}
          description="All models failed"
          variant="error"
        />
        <StatCard
          label="Not Attempted"
          value={summary.allNotAttempted}
          description="No model attempted"
          variant="muted"
        />
        <StatCard
          label="Disagreements"
          value={summary.totalPuzzles - summary.allCorrect - summary.allIncorrect - summary.allNotAttempted}
          description="Models disagree"
          variant="info"
        />
      </div>

      {/* Comparison Matrix */}
      <NewModelComparisonResults result={comparisonData} />
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  description: string;
  variant: 'success' | 'error' | 'info' | 'muted';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, description, variant }) => {
  const variants = {
    success: 'border-green-200 bg-green-50 text-green-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    muted: 'border-gray-200 bg-gray-50 text-gray-700',
  };

  return (
    <Card className={`border ${variants[variant]}`}>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm font-medium mt-1">{label}</div>
        <div className="text-xs text-muted-foreground mt-2">{description}</div>
      </CardContent>
    </Card>
  );
};

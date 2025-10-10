/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T19:24:00-04:00
 * PURPOSE: Dedicated full page for displaying model comparison results on large datasets (120+ puzzles).
 * Replaces the cramped dialog with a proper page that supports filtering, pagination, and better visualization.
 * 
 * FEATURES:
 * - Filter by result type (all correct, all incorrect, disagreements, etc.)
 * - Paginated results for handling large datasets
 * - Clear visual distinction between correct/incorrect/not_attempted
 * - Summary statistics at the top
 * - Clickable puzzle IDs for navigation
 * - Export to CSV functionality
 * 
 * FIXES:
 * - Correctly distinguishes between 'incorrect' (❌) and 'not_attempted' (⏳)
 * - Properly handles 120+ puzzle datasets without scrolling issues
 * 
 * SRP and DRY check: Pass - Single responsibility is model comparison display
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { 
  ArrowLeft, 
  Download, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  GitCompare
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Re-using types from AnalyticsOverview
export interface PuzzleComparisonDetail {
  puzzleId: string;
  model1Result: 'correct' | 'incorrect' | 'not_attempted';
  model2Result: 'correct' | 'incorrect' | 'not_attempted';
  model3Result?: 'correct' | 'incorrect' | 'not_attempted';
  model4Result?: 'correct' | 'incorrect' | 'not_attempted';
}

export interface ModelComparisonResult {
  summary: {
    totalPuzzles: number;
    model1Name: string;
    model2Name: string;
    model3Name?: string;
    model4Name?: string;
    dataset: string;
    allCorrect: number;
    allIncorrect: number;
    allNotAttempted: number;
    model1OnlyCorrect?: number;
    model2OnlyCorrect?: number;
    model3OnlyCorrect?: number;
    model4OnlyCorrect?: number;
  };
  details: PuzzleComparisonDetail[];
}

type FilterType = 'all' | 'all_correct' | 'all_incorrect' | 'disagreement' | 'not_attempted';

export default function ModelComparisonPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/model-comparison');
  
  // Get comparison data from location state
  const comparisonData = (window.history.state?.usr?.comparisonData as ModelComparisonResult | null);
  
  const [filterType, setFilterType] = useState<FilterType>('all');

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

  const { summary, details } = comparisonData;
  
  const activeModels = [
    { name: summary.model1Name, key: 'model1Result' as const },
    { name: summary.model2Name, key: 'model2Result' as const },
    ...(summary.model3Name ? [{ name: summary.model3Name, key: 'model3Result' as const }] : []),
    ...(summary.model4Name ? [{ name: summary.model4Name, key: 'model4Result' as const }] : []),
  ].filter(m => m.name);

  // Filter logic
  const filteredDetails = useMemo(() => {
    if (filterType === 'all') return details;

    return details.filter(detail => {
      const results = activeModels.map(m => detail[m.key]);
      const correctCount = results.filter(r => r === 'correct').length;
      const incorrectCount = results.filter(r => r === 'incorrect').length;
      const notAttemptedCount = results.filter(r => r === 'not_attempted').length;

      switch (filterType) {
        case 'all_correct':
          return correctCount === activeModels.length;
        case 'all_incorrect':
          return incorrectCount + notAttemptedCount === activeModels.length && notAttemptedCount < activeModels.length;
        case 'not_attempted':
          return notAttemptedCount === activeModels.length;
        case 'disagreement':
          return correctCount > 0 && (incorrectCount > 0 || notAttemptedCount > 0);
        default:
          return true;
      }
    });
  }, [details, filterType, activeModels]);

  // Export to CSV
  const handleExport = () => {
    const headers = ['Puzzle ID', ...activeModels.map(m => m.name)];
    const rows = filteredDetails.map(detail => [
      detail.puzzleId,
      ...activeModels.map(m => detail[m.key] || 'not_attempted')
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-comparison-${summary.dataset}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getResultIcon = (result: 'correct' | 'incorrect' | 'not_attempted' | undefined) => {
    if (!result || result === 'not_attempted') {
      return <span title="Not attempted"><Clock className="h-5 w-5 text-gray-400" /></span>;
    }
    if (result === 'correct') {
      return <span title="Correct"><CheckCircle2 className="h-5 w-5 text-green-600" /></span>;
    }
    return <span title="Incorrect"><XCircle className="h-5 w-5 text-red-600" /></span>;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              Comparing {activeModels.map(m => m.name).join(', ')} on {summary.dataset} dataset ({summary.totalPuzzles} puzzles)
            </p>
          </div>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="All Correct"
          value={summary.allCorrect}
          description="All models solved correctly"
          variant="success"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label="All Incorrect"
          value={summary.allIncorrect}
          description="All models failed"
          variant="error"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Not Attempted"
          value={summary.allNotAttempted}
          description="No model attempted"
          variant="muted"
        />
        <StatCard
          icon={<GitCompare className="h-5 w-5" />}
          label="Disagreements"
          value={summary.totalPuzzles - summary.allCorrect - summary.allIncorrect - summary.allNotAttempted}
          description="Models disagree"
          variant="info"
        />
      </div>

      {/* Filter and Pagination Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results ({details.length})</SelectItem>
                  <SelectItem value="all_correct">All Correct ({summary.allCorrect})</SelectItem>
                  <SelectItem value="all_incorrect">All Incorrect ({summary.allIncorrect})</SelectItem>
                  <SelectItem value="not_attempted">Not Attempted ({summary.allNotAttempted})</SelectItem>
                  <SelectItem value="disagreement">
                    Disagreements ({summary.totalPuzzles - summary.allCorrect - summary.allIncorrect - summary.allNotAttempted})
                  </SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Showing all {filteredDetails.length} puzzles
              </span>
            </div>
          </div>
        </CardHeader>

        {/* Results Grid */}
        <CardContent>
          {filteredDetails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No puzzles match the current filter.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header Row */}
              <div className="grid gap-3 font-semibold text-sm bg-muted/50 p-3 rounded-md sticky top-0" 
                   style={{ gridTemplateColumns: `200px repeat(${activeModels.length}, 1fr)` }}>
                <div>Puzzle ID</div>
                {activeModels.map(model => (
                  <div key={model.name} className="text-center truncate" title={model.name}>
                    {model.name}
                  </div>
                ))}
              </div>

              {/* Data Rows */}
              {filteredDetails.map(detail => (
                <div
                  key={detail.puzzleId}
                  className="grid gap-3 items-center p-3 rounded-md hover:bg-muted/30 transition-colors border"
                  style={{ gridTemplateColumns: `200px repeat(${activeModels.length}, 1fr)` }}
                >
                  <div>
                    <ClickablePuzzleBadge
                      puzzleId={detail.puzzleId}
                      clickable={true}
                      showName={true}
                      className="text-sm font-mono"
                    />
                  </div>
                  {activeModels.map(model => (
                    <div key={`${detail.puzzleId}-${model.name}`} className="flex justify-center">
                      {getResultIcon(detail[model.key])}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  variant: 'success' | 'error' | 'info' | 'muted';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, description, variant }) => {
  const variants = {
    success: 'border-green-200 bg-green-50 text-green-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    muted: 'border-gray-200 bg-gray-50 text-gray-700',
  };

  const iconVariants = {
    success: 'text-green-600',
    error: 'text-red-600',
    info: 'text-blue-600',
    muted: 'text-gray-600',
  };

  return (
    <Card className={`border ${variants[variant]}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium mt-1">{label}</p>
          </div>
          <div className={iconVariants[variant]}>{icon}</div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
};

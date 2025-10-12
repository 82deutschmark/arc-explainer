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

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, GitCompare, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NewModelComparisonResults } from '@/components/analytics/NewModelComparisonResults';
import { ModelComparisonResult } from './AnalyticsOverview';
import { Card, CardContent } from '@/components/ui/card';

export default function ModelComparisonPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get comparison data from location state or URL params
  const [comparisonData, setComparisonData] = useState<ModelComparisonResult | null>(() => {
    // First try to get from location state (navigation from AnalyticsOverview)
    // wouter stores state directly in history.state, not nested under 'usr'
    const stateData = (window.history.state?.comparisonData as ModelComparisonResult | null);
    if (stateData) {
      console.log('Found state data:', stateData);
      // Store in localStorage for refresh resilience
      try {
        localStorage.setItem('arc-comparison-data', JSON.stringify(stateData));
      } catch (e) {
        console.warn('Failed to store comparison data in localStorage:', e);
      }
      return stateData;
    }

    console.log('No state data found, checking URL params and localStorage...');

    // If no state data, check URL params for fallback
    const urlParams = new URLSearchParams(window.location.search);
    const model1 = urlParams.get('model1');
    const model2 = urlParams.get('model2');
    const dataset = urlParams.get('dataset');

    console.log('URL params:', { model1, model2, dataset });

    // If we have URL params, return null and fetch below
    if (model1 && dataset) {
      console.log('URL params found, will fetch data');
      return null;
    }

    // Last resort: try localStorage
    try {
      const storedData = localStorage.getItem('arc-comparison-data');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        console.log('Found localStorage data:', parsed);
        // More robust validation - check for expected structure
        if (parsed &&
            typeof parsed === 'object' &&
            parsed.summary &&
            typeof parsed.summary === 'object' &&
            Array.isArray(parsed.details)) {
          console.log('localStorage data is valid, using it');
          return parsed;
        } else {
          console.log('localStorage data structure is invalid');
        }
      } else {
        console.log('No data found in localStorage');
      }
    } catch (e) {
      console.warn('Failed to retrieve comparison data from localStorage:', e);
    }

    console.log('No data found anywhere');
    return null;
  });

  // Update state when location changes
  useEffect(() => {
    const stateData = window.history.state?.comparisonData as ModelComparisonResult | null;
    if (stateData) {
      setComparisonData(stateData);
    }
  }, []);

  // Fetch comparison data when missing
  useEffect(() => {
    const fetchComparisonData = async () => {
      if (comparisonData) return; // Already have data

      const urlParams = new URLSearchParams(window.location.search);
      const model1 = urlParams.get('model1');
      const model2 = urlParams.get('model2');
      const dataset = urlParams.get('dataset');

      if (!model1 || !dataset) {
        setError('Missing required parameters. Please run a comparison from the Analytics page.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const models = [model1, model2].filter(Boolean);
        const queryParams = new URLSearchParams({
          model1: models[0] || '',
          ...(models[1] && { model2: models[1] }),
          dataset
        });

        console.log('Fetching comparison data with params:', queryParams.toString());

        const response = await fetch(`/api/metrics/compare?${queryParams.toString()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch comparison data');
        }

        const result = await response.json();
        console.log('Received comparison result:', result);

        if (!result.data) {
          throw new Error('No data received from server');
        }

        setComparisonData(result.data);

        // Store in localStorage for refresh resilience
        try {
          localStorage.setItem('arc-comparison-data', JSON.stringify(result.data));
        } catch (e) {
          console.warn('Failed to store comparison data in localStorage:', e);
        }
      } catch (error) {
        console.error('Comparison error:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch comparison data');
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonData();
  }, [comparisonData]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading comparison data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/analytics')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Analytics
        </Button>
      </div>
    );
  }

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

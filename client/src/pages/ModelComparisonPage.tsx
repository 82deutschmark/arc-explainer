/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T22:30:00-04:00
 * PURPOSE: Dedicated full page for side-by-side model performance comparison.
 * Shows model performance panels (like AnalyticsOverview) for 2-4 models simultaneously.
 * 
 * FEATURES:
 * - Side-by-side model performance panels with success rates
 * - Correct/Incorrect/Not Attempted stats with puzzle IDs
 * - Metric badges (cost, time, tokens)
 * - Visual progress bars
 * - Responsive grid layout (1-4 columns)
 * 
 * SRP and DRY check: Pass - Single responsibility is model comparison display via reusable panels
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ModelPerformancePanel } from '@/components/analytics/ModelPerformancePanel';

interface ModelComparisonState {
  models: string[];
  dataset: string;
}

export default function ModelComparisonPage() {
  const [, navigate] = useLocation();
  
  // Get comparison state from location
  const [comparisonState, setComparisonState] = useState<ModelComparisonState | null>(() => {
    return (window.history.state?.usr?.comparisonState as ModelComparisonState | null) || null;
  });

  // Update state when location changes
  React.useEffect(() => {
    const stateData = window.history.state?.usr?.comparisonState as ModelComparisonState | null;
    if (stateData) {
      setComparisonState(stateData);
    }
  }, []);

  if (!comparisonState) {
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

  const { models, dataset } = comparisonState;
  const gridCols = models.length === 2 ? 'md:grid-cols-2' : models.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4';


  return (
    <div className="container mx-auto p-6 max-w-[98vw] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/analytics')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Analytics
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Model Comparison</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comparing {models.join(', ')} on {dataset} dataset
          </p>
        </div>
      </div>

      {/* Model Performance Panels - Side by Side */}
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {models.map((model) => (
          <ModelPerformancePanel
            key={model}
            modelName={model}
            dataset={dataset}
          />
        ))}
      </div>
    </div>
  );
}

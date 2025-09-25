/**
 * ModelComparisonMatrix Component
 *
 * Cross-model comparison table showing accuracy, trustworthiness, user satisfaction,
 * speed, and cost efficiency metrics side by side.
 * Uses data from MetricsRepository via /api/metrics/comprehensive-dashboard
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, BarChart3, Target, Shield, Heart, Zap, DollarSign } from 'lucide-react';

interface ModelComparison {
  modelName: string;
  accuracy: number;
  trustworthiness: number;
  userSatisfaction: number;
  attempts: number;
  totalCost: number;
  avgCost: number;
}

interface ModelComparisonMatrixProps {
  modelComparisons?: ModelComparison[];
  isLoading?: boolean;
  onModelClick?: (modelName: string) => void;
}

type SortField = 'modelName' | 'accuracy' | 'trustworthiness' | 'userSatisfaction' | 'attempts' | 'totalCost' | 'avgCost' | 'costPerCorrectAnswer';
type SortOrder = 'asc' | 'desc';

export function ModelComparisonMatrix({ 
  modelComparisons, 
  isLoading, 
  onModelClick 
}: ModelComparisonMatrixProps) {
  const [sortField, setSortField] = useState<SortField>('accuracy');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getBadgeVariant = (score: number | undefined | null, type: 'percentage' | 'cost' | 'cost_efficiency'): 'default' | 'secondary' | 'destructive' | 'outline' => {
    // Handle missing data
    if (score === undefined || score === null || isNaN(score)) return 'outline';

    if (type === 'cost') {
      // Lower total costs are better
      if (score <= 0.01) return 'default'; // Good - under 1 cent
      if (score <= 1.00) return 'secondary'; // Moderate - under $1
      return 'destructive'; // High cost - over $1
    } else if (type === 'cost_efficiency') {
      // Lower cost per correct answer is better
      if (score <= 0.05) return 'default'; // Excellent - under 5 cents per correct
      if (score <= 0.15) return 'secondary'; // Good - under 15 cents per correct
      if (score <= 0.30) return 'outline'; // Moderate - under 30 cents per correct
      return 'destructive'; // Poor efficiency - over 30 cents per correct
    } else {
      // Higher percentages are better
      if (score >= 80) return 'default'; // Good performance
      if (score >= 60) return 'secondary'; // Moderate performance
      return 'outline'; // Poor performance
    }
  };

  const formatCostEfficiency = (cost: number | undefined | null) => {
    // Handle missing or invalid cost data
    if (cost === undefined || cost === null || isNaN(cost)) return 'No data';
    if (cost === 0) return 'Free'; // Handle free models from OpenRouter
    if (cost < 0) return '$0';
    if (cost >= 1000) return '$999+';

    const cents = cost * 100;

    if (cents < 100) {
      // Show as cents with 2 decimal places (e.g., "6.23¢")
      return `${cents.toFixed(2)}¢`;
    } else {
      // Convert to dollars with 2 decimal places (e.g., "$1.50")
      return `$${cost.toFixed(2)}`;
    }
  };

  const formatCostPerCorrect = (cost: number | undefined | null) => {
    // Handle missing or invalid cost per correct answer data
    if (cost === undefined || cost === null || isNaN(cost)) return 'No data';
    if (cost === 0) return 'Free';
    if (cost < 0) return '$0.00';
    if (cost >= 100) return '$99+';

    // Always show cost per correct as dollars with appropriate precision
    if (cost < 0.01) {
      return `${(cost * 1000).toFixed(1)}m`; // Show as thousandths (e.g., "2.5m")
    } else if (cost < 1) {
      return `${(cost * 100).toFixed(1)}¢`; // Show as cents (e.g., "12.3¢")
    } else {
      return `$${cost.toFixed(2)}`; // Show as dollars (e.g., "$2.45")
    }
  };

  const sortedModels = React.useMemo(() => {
    if (!modelComparisons) return [];

    return [...modelComparisons].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle potentially undefined values for new fields
      if (sortField === 'costPerCorrectAnswer') {
        aValue = aValue ?? Infinity; // Treat missing data as worst (highest cost)
        bValue = bValue ?? Infinity;
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue);
      }

      return sortOrder === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [modelComparisons, sortField, sortOrder]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Cross-Model Comparison Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="animate-pulse">
              <div className="grid grid-cols-7 gap-4 p-3 bg-gray-100 rounded-lg">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="grid grid-cols-7 gap-4 p-3 bg-gray-50 rounded-lg">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sortedModels.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Cross-Model Comparison Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No comparison data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          Cross-Model Comparison Matrix
        </CardTitle>
        <div className="text-sm text-gray-600">
          Compare models across all performance dimensions
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Header Row */}
          <div className="grid grid-cols-7 gap-4 p-3 bg-gray-100 rounded-lg mb-2 min-w-[900px]">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 p-1 font-semibold"
              onClick={() => handleSort('modelName')}
            >
              Model {getSortIcon('modelName')}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="justify-center h-8 p-1 font-semibold"
              onClick={() => handleSort('accuracy')}
            >
              <Target className="h-3 w-3 mr-1" />
              Accuracy {getSortIcon('accuracy')}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="justify-center h-8 p-1 font-semibold"
              onClick={() => handleSort('trustworthiness')}
            >
              <Shield className="h-3 w-3 mr-1" />
              Trust {getSortIcon('trustworthiness')}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="justify-center h-8 p-1 font-semibold"
              onClick={() => handleSort('userSatisfaction')}
            >
              <Heart className="h-3 w-3 mr-1" />
              Satisfaction {getSortIcon('userSatisfaction')}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="justify-center h-8 p-1 font-semibold"
              onClick={() => handleSort('attempts')}
            >
              <Zap className="h-3 w-3 mr-1" />
              Attempts {getSortIcon('attempts')}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="justify-center h-8 p-1 font-semibold"
              onClick={() => handleSort('totalCost')}
            >
              <DollarSign className="h-3 w-3 mr-1" />
              Total Cost {getSortIcon('totalCost')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="justify-center h-8 p-1 font-semibold"
              onClick={() => handleSort('costPerCorrectAnswer')}
            >
              <Calculator className="h-3 w-3 mr-1" />
              Cost/Correct {getSortIcon('costPerCorrectAnswer')}
            </Button>
          </div>

          {/* Data Rows */}
          <div className="space-y-1 min-w-[900px]">
            {sortedModels.map((model) => (
              <div
                key={model.modelName}
                className={`grid grid-cols-7 gap-4 p-3 rounded-lg transition-colors ${
                  onModelClick ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'
                }`}
                onClick={() => onModelClick?.(model.modelName)}
              >
                <div className="text-sm font-medium truncate" title={model.modelName}>
                  {model.modelName}
                </div>

                <div className="flex justify-center">
                  <Badge
                    variant={getBadgeVariant(model.accuracy, 'percentage')}
                    className="text-xs"
                  >
                    {model.accuracy.toFixed(1)}%
                  </Badge>
                </div>

                <div className="flex justify-center">
                  <Badge
                    variant={getBadgeVariant(model.trustworthiness * 100, 'percentage')}
                    className="text-xs"
                  >
                    {(model.trustworthiness * 100).toFixed(1)}%
                  </Badge>
                </div>

                <div className="flex justify-center">
                  <Badge
                    variant={getBadgeVariant(model.userSatisfaction, 'percentage')}
                    className="text-xs"
                  >
                    {model.userSatisfaction.toFixed(1)}%
                  </Badge>
                </div>

                <div className="flex justify-center">
                  <span className="text-sm text-gray-600">
                    {model.attempts.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-center">
                  <Badge
                    variant={getBadgeVariant(model.totalCost, 'cost')}
                    className="text-xs"
                  >
                    {formatCostEfficiency(model.totalCost)}
                  </Badge>
                </div>

                <div className="flex justify-center">
                  <Badge
                    variant={getBadgeVariant(model.costPerCorrectAnswer, 'cost_efficiency')}
                    className="text-xs"
                  >
                    {formatCostPerCorrect(model.costPerCorrectAnswer)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t text-center">
          <p className="text-xs text-gray-500">
            Click any model name to view detailed information •
            Click column headers to sort •
            Enhanced with cost per correct answer for efficiency analysis
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Cost estimator component for Beetree ensemble solver before running analysis
 * SRP/DRY check: Pass - Centralizes cost estimation logic
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, 
  Users, 
  Clock, 
  Zap,
  Info,
  TrendingUp,
  Target,
  Brain
} from 'lucide-react';

interface BeetreeCostEstimatorProps {
  mode: 'testing' | 'production';
}

export const BeetreeCostEstimator: React.FC<BeetreeCostEstimatorProps> = ({ mode }) => {
  const testingEstimate = {
    cost: { min: 0.50, max: 2.00, average: 1.25 },
    duration: { min: 2 * 60, max: 6 * 60, average: 4 * 60 }, // in seconds
    models: 3,
    tokens: { input: 50000, output: 10000, reasoning: 15000 },
    stages: 5
  };

  const productionEstimate = {
    cost: { min: 15.00, max: 50.00, average: 32.50 },
    duration: { min: 20 * 60, max: 45 * 60, average: 32 * 60 }, // in seconds
    models: 8,
    tokens: { input: 200000, output: 40000, reasoning: 60000 },
    stages: 5
  };

  const estimate = mode === 'testing' ? testingEstimate : productionEstimate;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const getCostPerToken = () => {
    const totalTokens = estimate.tokens.input + estimate.tokens.output + estimate.tokens.reasoning;
    return estimate.cost.average / totalTokens;
  };

  const getComplexityFactors = () => {
    return [
      {
        factor: 'Number of Models',
        impact: mode === 'testing' ? 'Low' : 'High',
        description: mode === 'testing' ? 
          '3 models provide quick consensus' : 
          '8 models provide comprehensive analysis'
      },
      {
        factor: 'Search Depth',
        impact: mode === 'testing' ? 'Medium' : 'High',
        description: mode === 'testing' ? 
          'Limited search for speed' : 
          'Deep search for accuracy'
      },
      {
        factor: 'Token Usage',
        impact: mode === 'testing' ? 'Low' : 'High',
        description: mode === 'testing' ? 
          'Conservative token usage' : 
          'Extensive reasoning and analysis'
      },
      {
        factor: 'Consensus Analysis',
        impact: mode === 'testing' ? 'Medium' : 'High',
        description: mode === 'testing' ? 
          'Basic consensus checking' : 
          'Advanced consensus with diversity scoring'
      }
    ];
  };

  const getModelBreakdown = () => {
    const models = mode === 'testing' ? 
      [
        { name: 'GPT-5.1 Mini', cost: 0.30, tokens: 20000 },
        { name: 'Claude Opus', cost: 0.45, tokens: 25000 },
        { name: 'Gemini Pro', cost: 0.50, tokens: 30000 }
      ] :
      [
        { name: 'GPT-5.1', cost: 8.00, tokens: 80000 },
        { name: 'Claude Opus', cost: 6.50, tokens: 70000 },
        { name: 'Gemini Pro', cost: 5.00, tokens: 60000 },
        { name: 'GPT-4 Turbo', cost: 4.00, tokens: 50000 },
        { name: 'Claude Sonnet', cost: 3.50, tokens: 45000 },
        { name: 'Gemini Flash', cost: 2.50, tokens: 40000 },
        { name: 'DeepSeek Coder', cost: 2.00, tokens: 35000 },
        { name: 'Grok Mini', cost: 1.00, tokens: 20000 }
      ];

    return models;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-5 h-5 text-green-600" />
        <h3 className="text-lg font-semibold">Cost Estimate</h3>
        <Badge variant={mode === 'testing' ? 'secondary' : 'default'}>
          {mode === 'testing' ? 'Testing' : 'Production'} Mode
        </Badge>
      </div>

      {/* Main Estimate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
          <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600" />
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(estimate.cost.min)} - {formatCurrency(estimate.cost.max)}
          </div>
          <div className="text-sm text-muted-foreground">
            Estimated cost (avg: {formatCurrency(estimate.cost.average)})
          </div>
        </div>

        <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
          <div className="text-2xl font-bold text-blue-600">
            {formatDuration(estimate.duration.min)} - {formatDuration(estimate.duration.max)}
          </div>
          <div className="text-sm text-muted-foreground">
            Estimated time (avg: {formatDuration(estimate.duration.average)})
          </div>
        </div>

        <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <Users className="w-6 h-6 mx-auto mb-2 text-purple-600" />
          <div className="text-2xl font-bold text-purple-600">
            {estimate.models}
          </div>
          <div className="text-sm text-muted-foreground">
            Models in ensemble
          </div>
        </div>
      </div>

      {/* Cost Factors */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="font-medium">What affects the cost:</div>
            <ul className="text-sm space-y-1 ml-4">
              <li>• Number of AI models used in the ensemble</li>
              <li>• Search depth and reasoning complexity</li>
              <li>• Token usage (input, output, reasoning)</li>
              <li>• Consensus analysis and diversity scoring</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Detailed Breakdown */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Token Breakdown */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-600" />
              Estimated Token Usage
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Input Tokens:</span>
                <span className="font-medium">{formatTokens(estimate.tokens.input)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Output Tokens:</span>
                <span className="font-medium">{formatTokens(estimate.tokens.output)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Reasoning Tokens:</span>
                <span className="font-medium">{formatTokens(estimate.tokens.reasoning)}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium">Total Tokens:</span>
                  <span className="font-bold">
                    {formatTokens(estimate.tokens.input + estimate.tokens.output + estimate.tokens.reasoning)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Cost per 1K tokens:</span>
                  <span>{formatCurrency(getCostPerToken() * 1000)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Complexity Factors */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-600" />
              Complexity Factors
            </h4>
            <div className="space-y-2">
              {getComplexityFactors().map((factor, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{factor.factor}</div>
                    <div className="text-xs text-muted-foreground">{factor.description}</div>
                  </div>
                  <Badge 
                    variant={factor.impact === 'Low' ? 'secondary' : factor.impact === 'Medium' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {factor.impact}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Model Breakdown */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            Model Cost Breakdown
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {getModelBreakdown().map((model, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-background rounded">
                <div>
                  <div className="text-sm font-medium">{model.name}</div>
                  <div className="text-xs text-muted-foreground">{formatTokens(model.tokens)} tokens</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(model.cost)}</div>
                  <div className="text-xs text-muted-foreground">
                    {((model.cost / estimate.cost.average) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mode Comparison */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            Mode Comparison
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="font-medium mb-2">Testing Mode</div>
              <div className="text-sm space-y-1">
                <div>• Quick consensus (2-6 min)</div>
                <div>• Conservative cost ($0.50-$2.00)</div>
                <div>• Good for prototyping</div>
                <div>• 3 models, basic analysis</div>
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="font-medium mb-2">Production Mode</div>
              <div className="text-sm space-y-1">
                <div>• Comprehensive analysis (20-45 min)</div>
                <div>• Higher cost ($15-$50)</div>
                <div>• Best for final solutions</div>
                <div>• 8 models, advanced consensus</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

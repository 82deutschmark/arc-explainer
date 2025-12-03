/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Cost display component for Beetree ensemble solver with breakdowns
 * SRP/DRY check: Pass - Centralizes cost display logic
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  Users, 
  Zap, 
  TrendingUp,
  Clock,
  Brain,
  Target
} from 'lucide-react';
import { BeetreeCost } from '@/hooks/useBeetreeRun';

interface BeetreeCostDisplayProps {
  cost: BeetreeCost;
  mode: 'testing' | 'production';
}

export const BeetreeCostDisplay: React.FC<BeetreeCostDisplayProps> = ({ cost, mode }) => {
  // Compute total tokens since it's not a property
  const totalTokens = cost.total_tokens.input + cost.total_tokens.output + cost.total_tokens.reasoning;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const getCostEfficiency = () => {
    // Calculate cost efficiency based on tokens vs cost
    const tokensPerDollar = totalTokens / cost.total_cost;
    if (tokensPerDollar > 10000) return 'Excellent';
    if (tokensPerDollar > 5000) return 'Good';
    if (tokensPerDollar > 1000) return 'Fair';
    return 'Poor';
  };

  const getEfficiencyColor = () => {
    const efficiency = getCostEfficiency();
    switch (efficiency) {
      case 'Excellent': return 'text-green-600';
      case 'Good': return 'text-emerald-600';
      case 'Fair': return 'text-yellow-600';
      default: return 'text-red-600';
    }
  };

  const mostExpensiveModel = cost.by_model.reduce((max, model) => 
    model.cost > max.cost ? model : max, cost.by_model[0]
  );

  const mostExpensiveStage = cost.by_stage.reduce((max, stage) => 
    stage.cost > max.cost ? stage : max, cost.by_stage[0]
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-5 h-5 text-green-600" />
        <h3 className="text-lg font-semibold">Cost Analysis</h3>
        <Badge variant="outline">{mode === 'testing' ? 'Testing' : 'Production'}</Badge>
      </div>

      {/* Total Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
          <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600" />
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(cost.total_cost)}
          </div>
          <div className="text-sm text-muted-foreground">Total Cost</div>
        </div>

        <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Brain className="w-6 h-6 mx-auto mb-2 text-blue-600" />
          <div className="text-3xl font-bold text-blue-600">
            {formatTokens(totalTokens)}
          </div>
          <div className="text-sm text-muted-foreground">Total Tokens</div>
        </div>

        <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-600" />
          <div className="text-3xl font-bold text-purple-600">
            {getCostEfficiency()}
          </div>
          <div className="text-sm text-muted-foreground">Cost Efficiency</div>
        </div>
      </div>

      {/* Token Breakdown */}
      <div className="mb-6">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-600" />
          Token Usage Breakdown
        </h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Input Tokens</span>
              <span>{formatTokens(cost.total_tokens.input)}</span>
            </div>
            <Progress 
              value={(cost.total_tokens.input / totalTokens) * 100} 
              className="h-2"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Output Tokens</span>
              <span>{formatTokens(cost.total_tokens.output)}</span>
            </div>
            <Progress 
              value={(cost.total_tokens.output / totalTokens) * 100} 
              className="h-2"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Reasoning Tokens</span>
              <span>{formatTokens(cost.total_tokens.reasoning)}</span>
            </div>
            <Progress 
              value={(cost.total_tokens.reasoning / totalTokens) * 100} 
              className="h-2"
            />
          </div>
        </div>
      </div>

      {/* Cost by Model */}
      <div className="mb-6">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          Cost by Model
        </h4>
        <div className="space-y-2">
          {cost.by_model.map((model, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{model.model_name}</span>
                  {model.model_name === mostExpensiveModel.model_name && (
                    <Badge variant="secondary" className="text-xs">Highest Cost</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatTokens(model.input_tokens + model.output_tokens + model.reasoning_tokens)} tokens
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatCurrency(model.cost)}</div>
                <div className="text-xs text-muted-foreground">
                  {((model.cost / cost.total_cost) * 100).toFixed(1)}% of total
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost by Stage */}
      <div className="mb-6">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-600" />
          Cost by Stage
        </h4>
        <div className="space-y-2">
          {cost.by_stage.map((stage, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{stage.stage}</span>
                  {stage.stage === mostExpensiveStage.stage && (
                    <Badge variant="secondary" className="text-xs">Highest Cost</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {Math.round(stage.duration_ms / 1000)}s
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatCurrency(stage.cost)}</div>
                <div className="text-xs text-muted-foreground">
                  {((stage.cost / cost.total_cost) * 100).toFixed(1)}% of total
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Insights */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-600" />
          Cost Insights
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-1">Average Cost per Model</div>
            <div className="text-lg font-bold">
              {formatCurrency(cost.total_cost / cost.by_model.length)}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-1">Average Cost per Stage</div>
            <div className="text-lg font-bold">
              {formatCurrency(cost.total_cost / cost.by_stage.length)}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-1">Cost per 1K Tokens</div>
            <div className="text-lg font-bold">
              {formatCurrency((cost.total_cost / totalTokens) * 1000)}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-1">Efficiency Rating</div>
            <div className={`text-lg font-bold ${getEfficiencyColor()}`}>
              {getCostEfficiency()}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

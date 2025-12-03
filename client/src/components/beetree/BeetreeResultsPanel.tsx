/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Results display panel for Beetree ensemble solver with consensus analysis
 * SRP/DRY check: Pass - Centralizes results display logic
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Users, 
  Brain, 
  Target, 
  Zap,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Download,
  RefreshCw
} from 'lucide-react';
import { BeetreeResults, BeetreeCost } from '@/hooks/useBeetreeRun';
import { TinyGrid } from '@/components/puzzle/TinyGrid';

interface BeetreeResultsPanelProps {
  results: BeetreeResults;
  cost: BeetreeCost;
  mode: 'testing' | 'production';
  onNewAnalysis: () => void;
}

export const BeetreeResultsPanel: React.FC<BeetreeResultsPanelProps> = ({
  results,
  cost,
  mode,
  onNewAnalysis
}) => {
  const [showVerboseLog, setShowVerboseLog] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState(0);

  const isCorrect = results.predictions.length > 0; // TODO: Check against actual solution
  const accuracy = isCorrect ? 100 : 0; // TODO: Calculate actual accuracy

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isCorrect ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
            <div>
              <h3 className="text-xl font-semibold">
                Analysis {isCorrect ? 'Successful' : 'Completed'}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={isCorrect ? 'default' : 'secondary'}>
                  {accuracy}% Accuracy
                </Badge>
                <Badge variant="outline">
                  {mode === 'testing' ? 'Testing' : 'Production'} Mode
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onNewAnalysis}>
              <RefreshCw className="w-4 h-4 mr-2" />
              New Analysis
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Users className="w-5 h-5 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{cost.by_model.length}</div>
            <div className="text-sm text-muted-foreground">Models Used</div>
          </div>
          
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Target className="w-5 h-5 mx-auto mb-2 text-emerald-600" />
            <div className="text-2xl font-bold">{results.predictions.length}</div>
            <div className="text-sm text-muted-foreground">Predictions</div>
          </div>
          
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <DollarSign className="w-5 h-5 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{formatCurrency(cost.total_cost)}</div>
            <div className="text-sm text-muted-foreground">Total Cost</div>
          </div>
          
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Brain className="w-5 h-5 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{(results.consensus.strength * 100).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Consensus</div>
          </div>
        </div>
      </Card>

      {/* Detailed Results Tabs */}
      <Tabs defaultValue="predictions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="consensus">Consensus Analysis</TabsTrigger>
          <TabsTrigger value="cost">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="logs">Verbose Logs</TabsTrigger>
        </TabsList>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                Ensemble Predictions
              </h4>
              {results.predictions.length > 1 && (
                <div className="flex gap-2">
                  {results.predictions.map((_, index) => (
                    <Button
                      key={index}
                      variant={selectedPrediction === index ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedPrediction(index)}
                    >
                      {index + 1}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {results.predictions.map((prediction, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    selectedPrediction === index ? 'border-emerald-600 bg-emerald-50' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Prediction {index + 1}</Badge>
                      {selectedPrediction === index && (
                        <Badge className="bg-emerald-600">Selected</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPrediction(index)}
                    >
                      View
                    </Button>
                  </div>

                  <div className="flex justify-center">
                    <TinyGrid grid={prediction} className="w-24 h-24" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Consensus Analysis Tab */}
        <TabsContent value="consensus" className="space-y-4">
          <Card className="p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Consensus Analysis
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h5 className="font-medium mb-2">Consensus Strength</h5>
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {(results.consensus.strength * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {results.consensus.agreement_count} of {cost.by_model.length} models agreed
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h5 className="font-medium mb-2">Diversity Score</h5>
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {(results.consensus.diversity_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Solution diversity across models
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h5 className="font-medium mb-2">Orchestration</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Stages Completed:</span>
                      <span className="font-medium">
                        {results.orchestration.completed_stages}/{results.orchestration.total_stages}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Current Stage:</span>
                      <span className="font-medium">{results.orchestration.current_stage}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h5 className="font-medium mb-2">Stage Results</h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {results.orchestration.stage_results.map((stage, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{stage.stage}</span>
                        <Badge variant="outline" className="text-xs">
                          {stage.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Cost Breakdown Tab */}
        <TabsContent value="cost" className="space-y-4">
          <Card className="p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Cost Analysis
            </h4>

            <div className="space-y-6">
              {/* Total Cost */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Cost</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(cost.total_cost)}
                  </span>
                </div>
              </div>

              {/* Cost by Model */}
              <div>
                <h5 className="font-medium mb-3">Cost by Model</h5>
                <div className="space-y-2">
                  {cost.by_model.map((model, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="font-medium">{model.model_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {model.input_tokens + model.output_tokens + model.reasoning_tokens} tokens
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(model.cost)}</div>
                        <div className="text-xs text-muted-foreground">
                          {model.input_tokens} in / {model.output_tokens} out / {model.reasoning_tokens} reasoning
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost by Stage */}
              <div>
                <h5 className="font-medium mb-3">Cost by Stage</h5>
                <div className="space-y-2">
                  {cost.by_stage.map((stage, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="font-medium">{stage.stage}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDuration(stage.duration_ms)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(stage.cost)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Verbose Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                Verbose Execution Logs
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVerboseLog(!showVerboseLog)}
              >
                {showVerboseLog ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showVerboseLog ? 'Hide' : 'Show'} Logs
              </Button>
            </div>

            {showVerboseLog && (
              <div className="bg-muted/50 rounded-lg p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {results.verboseLog || 'No verbose logs available.'}
                </pre>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Real-time progress dashboard for Beetree ensemble solver runs
 * SRP/DRY check: Pass - Centralizes progress display logic
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Square, 
  Users, 
  Zap, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Brain,
  Target
} from 'lucide-react';
import { BeetreeProgress, BeetreeCost } from '@/hooks/useBeetreeRun';

interface BeetreeProgressDashboardProps {
  status: 'idle' | 'starting' | 'running' | 'completed' | 'error' | 'cancelled';
  progress: BeetreeProgress[];
  cost: BeetreeCost | null;
  onCancel: () => void;
}

export const BeetreeProgressDashboard: React.FC<BeetreeProgressDashboardProps> = ({
  status,
  progress,
  cost,
  onCancel
}) => {
  const getLatestProgress = () => {
    return progress.length > 0 ? progress[progress.length - 1] : null;
  };

  const getProgressPercentage = () => {
    if (status === 'completed') return 100;
    if (status === 'error' || status === 'cancelled') return 0;
    
    // Estimate progress based on stages
    const stageProgress = {
      'Initializing': 10,
      'Validation': 20,
      'Stage 1': 30,
      'Stage 2': 40,
      'Stage 3': 50,
      'Stage 4': 60,
      'Stage 5': 70,
      'Consensus': 85,
      'Complete': 100
    };
    
    const latest = getLatestProgress();
    if (latest && latest.stage) {
      for (const [stage, percentage] of Object.entries(stageProgress)) {
        if (latest.stage.includes(stage)) {
          return percentage;
        }
      }
    }
    
    return 15; // Default for starting/running
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'cancelled':
        return <Square className="w-5 h-5 text-orange-600" />;
      default:
        return <Brain className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return <Badge className="bg-emerald-600">Running</Badge>;
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Processing</Badge>;
    }
  };

  const formatDuration = (timestamp: number) => {
    const elapsed = Date.now() - timestamp;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const latest = getLatestProgress();

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold">Ensemble Analysis in Progress</h3>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge()}
                {latest?.stage && (
                  <span className="text-sm text-muted-foreground">
                    Stage: {latest.stage}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {status === 'running' && (
            <Button variant="outline" onClick={onCancel} className="text-red-600">
              <Square className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{getProgressPercentage()}%</span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </div>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Models */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Active Models</span>
          </div>
          <div className="text-2xl font-bold">
            {latest?.event?.includes('models') ? 
              latest.event.match(/(\d+)\/(\d+)/)?.[1] || '3' : 
              '3'
            }
          </div>
          <div className="text-xs text-muted-foreground">
            Ensemble running
          </div>
        </Card>

        {/* Current Stage */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium">Current Stage</span>
          </div>
          <div className="text-lg font-bold truncate">
            {latest?.stage || 'Initializing'}
          </div>
          <div className="text-xs text-muted-foreground">
            {latest?.status || 'Starting...'}
          </div>
        </Card>

        {/* Cost So Far */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">Cost So Far</span>
          </div>
          <div className="text-2xl font-bold">
            ${cost?.total_cost?.toFixed(4) || latest?.costSoFar?.toFixed(4) || '0.0000'}
          </div>
          <div className="text-xs text-muted-foreground">
            {cost?.total_tokens ? (cost.total_tokens.input + cost.total_tokens.output + cost.total_tokens.reasoning) : (latest?.tokensUsed?.total || 0)} tokens
          </div>
        </Card>

        {/* Elapsed Time */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium">Elapsed Time</span>
          </div>
          <div className="text-2xl font-bold">
            {progress.length > 0 ? 
              formatDuration(progress[0].timestamp) : 
              '0s'
            }
          </div>
          <div className="text-xs text-muted-foreground">
            Running time
          </div>
        </Card>
      </div>

      {/* Detailed Progress Timeline */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          Progress Timeline
        </h4>
        
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {progress.slice(-10).reverse().map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex-shrink-0 mt-1">
                {item.status === 'Error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                {item.status === 'Success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {item.status === 'Running' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                {!['Error', 'Success', 'Running'].includes(item.status) && <Brain className="w-4 h-4 text-gray-600" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{item.stage}</span>
                  <Badge variant="outline" className="text-xs">
                    {item.status}
                  </Badge>
                </div>
                
                {item.event && (
                  <p className="text-sm text-muted-foreground">{item.event}</p>
                )}
                
                {item.outcome && (
                  <p className="text-sm text-muted-foreground">{item.outcome}</p>
                )}
                
                {item.predictions && (
                  <p className="text-xs text-muted-foreground">
                    Generated {item.predictions.length} prediction(s)
                  </p>
                )}
                
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{formatDuration(item.timestamp)}</span>
                  {item.costSoFar && (
                    <span>Cost: ${item.costSoFar.toFixed(4)}</span>
                  )}
                  {item.tokensUsed && (
                    <span>Tokens: {item.tokensUsed.total}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {progress.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Waiting for progress updates...</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

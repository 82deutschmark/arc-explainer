/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-01
 * PURPOSE: Admin hub dashboard providing centralized access to administrative tools
 *          including model management, dataset ingestion, and system health monitoring.
 *          Displays quick stats and recent activity for administrative oversight.
 * SRP/DRY check: Pass - Single responsibility (admin navigation hub), reuses shadcn/ui components
 * shadcn/ui: Pass - Uses Card, Button, Badge, Separator components
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Database, Settings, Upload, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe } from 'lucide-react';

interface QuickStats {
  totalModels: number;
  totalExplanations: number;
  databaseConnected: boolean;
  lastIngestion: string | null;
  timestamp: string;
}

interface IngestionRun {
  id: number;
  datasetName: string;
  source: string;
  totalPuzzles: number;
  successful: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  accuracyPercent: number | null;
  duration: number;
}

interface RecentActivity {
  runs: IngestionRun[];
}

export default function AdminHub() {
  // Fetch quick stats
  const { data: stats, isLoading: statsLoading } = useQuery<QuickStats>({
    queryKey: ['admin-quick-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/quick-stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Fetch recent activity
  const { data: activity } = useQuery<RecentActivity>({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      const response = await fetch('/api/admin/recent-activity');
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    }
  });

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Hub</h1>
        <p className="text-muted-foreground mt-1">
          Central dashboard for administrative operations
        </p>
      </div>

      {/* Database Status Alert */}
      {stats && !stats.databaseConnected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Database is not connected. Check your DATABASE_URL environment variable.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Total Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalModels || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configured AI models
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Explanations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalExplanations.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Stored in database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {stats?.databaseConnected ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-700">Disconnected</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Last Ingestion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {stats?.lastIngestion ? (
                <span className="text-muted-foreground">
                  {formatDate(stats.lastIngestion)}
                </span>
              ) : (
                <span className="text-muted-foreground">No ingestions yet</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tools Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/admin/models">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Settings className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Model Configuration</CardTitle>
                  <CardDescription>
                    View and manage AI model configurations
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Open Model Management
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/admin/ingest-hf">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Upload className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Dataset Ingestion</CardTitle>
                  <CardDescription>
                    Import external model predictions from HuggingFace
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Open HuggingFace Ingestion
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/admin/openrouter">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Globe className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>OpenRouter Models</CardTitle>
                  <CardDescription>
                    Discover and import new OpenRouter slugs
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Open OpenRouter Manager
              </Button>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      {activity && activity.runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Ingestion Runs</CardTitle>
            <CardDescription>Last 10 dataset ingestion operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity.runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{run.datasetName}</span>
                      {run.dryRun && (
                        <Badge variant="outline" className="text-xs">
                          Dry Run
                        </Badge>
                      )}
                      {run.source && (
                        <Badge variant="secondary" className="text-xs">
                          {run.source}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(run.startedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-green-600 font-medium">{run.successful}</span>
                      <span className="text-muted-foreground"> / {run.totalPuzzles * 2}</span>
                    </div>
                    {run.failed > 0 && (
                      <span className="text-red-600 font-medium">
                        {run.failed} failed
                      </span>
                    )}
                    {run.accuracyPercent !== null && (
                      <Badge variant="outline">
                        {run.accuracyPercent.toFixed(1)}% accuracy
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {formatDuration(run.duration)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

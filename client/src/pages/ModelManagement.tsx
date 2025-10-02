/*
 * Author: Cascade using Deep Research Model
 * Date: 2025-09-30T16:35:00Z
 * PURPOSE: Model management GUI page for viewing, searching, and managing AI model configurations
 *          Provides unlinked route at /models for admin access
 * SRP/DRY check: Pass - Handles only model management UI
 * shadcn/ui: Pass - Uses Badge, Button, Card, Input, Select, Table components
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, TrendingDown, Clock, DollarSign, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ModelConfig {
  key: string;
  name: string;
  provider: string;
  color: string;
  premium: boolean;
  cost: {
    input: string;
    output: string;
  };
  supportsTemperature: boolean;
  isReasoning: boolean;
  responseTime: {
    speed: 'fast' | 'moderate' | 'slow';
    estimate: string;
  };
  contextWindow?: number;
  maxOutputTokens?: number;
  releaseDate?: string;
  index: number;
}

interface ModelListResponse {
  models: ModelConfig[];
  total: number;
  providers: string[];
  timestamp: string;
}

interface ModelStats {
  total: number;
  byProvider: Record<string, number>;
  byType: {
    premium: number;
    free: number;
    reasoning: number;
    chat: number;
  };
  bySpeed: {
    fast: number;
    moderate: number;
    slow: number;
  };
  newest: Array<{
    key: string;
    name: string;
    releaseDate: string;
    provider: string;
  }>;
}

export default function ModelManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [premiumFilter, setPremiumFilter] = useState<string>('all');
  const [speedFilter, setSpeedFilter] = useState<string>('all');

  // Fetch model list
  const { data: modelData, isLoading, refetch } = useQuery<ModelListResponse>({
    queryKey: ['model-management-list'],
    queryFn: async () => {
      const response = await fetch('/api/model-management/list');
      if (!response.ok) throw new Error('Failed to fetch models');
      return response.json();
    }
  });

  // Fetch model stats
  const { data: stats } = useQuery<ModelStats>({
    queryKey: ['model-management-stats'],
    queryFn: async () => {
      const response = await fetch('/api/model-management/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Filter models
  const filteredModels = useMemo(() => {
    if (!modelData?.models) return [];

    return modelData.models.filter(model => {
      // Search filter
      const matchesSearch = 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchQuery.toLowerCase());

      // Provider filter
      const matchesProvider = providerFilter === 'all' || model.provider === providerFilter;

      // Premium filter
      const matchesPremium = 
        premiumFilter === 'all' ||
        (premiumFilter === 'premium' && model.premium) ||
        (premiumFilter === 'free' && !model.premium);

      // Speed filter
      const matchesSpeed = speedFilter === 'all' || model.responseTime.speed === speedFilter;

      return matchesSearch && matchesProvider && matchesPremium && matchesSpeed;
    });
  }, [modelData?.models, searchQuery, providerFilter, premiumFilter, speedFilter]);

  const getSpeedIcon = (speed: string) => {
    switch (speed) {
      case 'fast':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'slow':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getSpeedColor = (speed: string) => {
    switch (speed) {
      case 'fast':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'slow':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Model Management</h1>
          <p className="text-muted-foreground mt-1">
            View and manage AI model configurations
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.byProvider).length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Reasoning Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byType.reasoning}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.byType.reasoning / stats.total) * 100).toFixed(0)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Premium Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byType.premium}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.byType.premium / stats.total) * 100).toFixed(0)}% of total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter model configurations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Provider Filter */}
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {modelData?.providers.map(provider => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Premium Filter */}
            <Select value={premiumFilter} onValueChange={setPremiumFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="premium">Premium Only</SelectItem>
                <SelectItem value="free">Free Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Speed Filter */}
            <Select value={speedFilter} onValueChange={setSpeedFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Speeds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Speeds</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="slow">Slow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredModels.length} of {modelData?.total || 0} models
          </div>
        </CardContent>
      </Card>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <CardTitle>Model Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Cost (per M tokens)</TableHead>
                  <TableHead>Release</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map(model => (
                  <TableRow key={model.key}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {model.key}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{model.provider}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {model.premium && (
                          <Badge variant="secondary" className="text-xs">
                            Premium
                          </Badge>
                        )}
                        {model.isReasoning && (
                          <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-700">
                            Reasoning
                          </Badge>
                        )}
                        {model.supportsTemperature && (
                          <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-700">
                            Temp
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSpeedIcon(model.responseTime.speed)}
                        <Badge variant="outline" className={getSpeedColor(model.responseTime.speed)}>
                          {model.responseTime.estimate}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {model.contextWindow ? (
                          <>
                            <div>{(model.contextWindow / 1000).toFixed(0)}K</div>
                            {model.maxOutputTokens && (
                              <div className="text-xs text-muted-foreground">
                                Out: {(model.maxOutputTokens / 1000).toFixed(0)}K
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-green-600">{model.cost.input}</span>
                          <span className="text-muted-foreground">in</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-red-600">{model.cost.output}</span>
                          <span className="text-muted-foreground">out</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.releaseDate ? (
                        <Badge variant="outline" className="text-xs">
                          {model.releaseDate}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredModels.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No models match your filters
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Breakdown */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Provider Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(stats.byProvider).map(([provider, count]) => (
                <div key={provider} className="text-center">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground">{provider}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Models */}
      {stats?.newest && stats.newest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Released Models</CardTitle>
            <CardDescription>Latest model additions by release date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.newest.map(model => (
                <div key={model.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-muted-foreground">{model.key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{model.provider}</Badge>
                    <Badge variant="secondary">{model.releaseDate}</Badge>
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

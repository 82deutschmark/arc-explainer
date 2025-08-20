/**
 * FeedbackModal Component
 * @author Claude Code
 * 
 * Detailed feedback browser in modal overlay with filtering, pagination, and export.
 * Provides comprehensive feedback management interface for administrators and users.
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  Filter, 
  Search, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { FeedbackViewer } from './FeedbackViewer';
import { FeedbackSummary } from './FeedbackSummary';
import type { DetailedFeedback, FeedbackStats, FeedbackFilters } from '@shared/types';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPuzzleId?: string;
  initialExplanationId?: number;
}

export function FeedbackModal({ 
  open, 
  onOpenChange, 
  initialPuzzleId,
  initialExplanationId 
}: FeedbackModalProps) {
  const [filters, setFilters] = useState<FeedbackFilters>({
    puzzleId: initialPuzzleId || '',
    modelName: '',
    voteType: undefined,
    limit: 20,
    offset: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Fetch feedback data
  const { data: feedbackData, isLoading: feedbackLoading, refetch: refetchFeedback } = useQuery({
    queryKey: ['feedback', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
      
      const response = await apiRequest('GET', `/api/feedback?${params.toString()}`);
      return response.data as DetailedFeedback[];
    },
    enabled: open
  });

  // Fetch feedback statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['feedback-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/feedback/stats');
      return response.data as FeedbackStats;
    },
    enabled: open
  });

  // Filter feedback by search term
  const filteredFeedback = useMemo(() => {
    if (!feedbackData || !searchTerm.trim()) return feedbackData || [];
    
    const term = searchTerm.toLowerCase();
    return feedbackData.filter(feedback => 
      feedback.comment?.toLowerCase().includes(term) ||
      feedback.puzzleId.toLowerCase().includes(term) ||
      feedback.modelName.toLowerCase().includes(term) ||
      feedback.patternDescription?.toLowerCase().includes(term)
    );
  }, [feedbackData, searchTerm]);

  // Pagination
  const totalPages = Math.ceil((filteredFeedback?.length || 0) / itemsPerPage);
  const paginatedFeedback = filteredFeedback?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique model names for filter dropdown
  const uniqueModels = useMemo(() => {
    if (!feedbackData) return [];
    return [...new Set(feedbackData.map(f => f.modelName))].sort();
  }, [feedbackData]);

  const handleFilterChange = (key: keyof FeedbackFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      puzzleId: '',
      modelName: '',
      voteType: undefined,
      limit: 20,
      offset: 0
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const exportFeedback = () => {
    if (!filteredFeedback) return;
    
    const csvContent = [
      'ID,Puzzle ID,Model,Vote Type,Comment,Created At,Confidence,Pattern Description',
      ...filteredFeedback.map(feedback => [
        feedback.id,
        feedback.puzzleId,
        feedback.modelName,
        feedback.voteType,
        `"${feedback.comment?.replace(/"/g, '""') || ''}"`,
        feedback.createdAt,
        feedback.confidence,
        `"${feedback.patternDescription?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Feedback Management
            {filteredFeedback && (
              <Badge variant="outline" className="ml-2">
                {filteredFeedback.length} items
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="feedback" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="feedback">Feedback List</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="feedback" className="flex-1 flex flex-col space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search feedback..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Input
                placeholder="Puzzle ID"
                value={filters.puzzleId || ''}
                onChange={(e) => handleFilterChange('puzzleId', e.target.value)}
              />

              <Select 
                value={filters.modelName || ''} 
                onValueChange={(value) => handleFilterChange('modelName', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All models</SelectItem>
                  {uniqueModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filters.voteType || ''} 
                onValueChange={(value) => handleFilterChange('voteType', value as 'helpful' | 'not_helpful' | undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vote type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All votes</SelectItem>
                  <SelectItem value="helpful">Helpful</SelectItem>
                  <SelectItem value="not_helpful">Not Helpful</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetchFeedback()}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={exportFeedback}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>

            {/* Feedback list */}
            <ScrollArea className="flex-1">
              {feedbackLoading ? (
                <div className="text-center py-8">Loading feedback...</div>
              ) : (
                <FeedbackViewer 
                  feedback={paginatedFeedback || []} 
                  showExplanationContext={true}
                />
              )}
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} 
                  ({filteredFeedback?.length || 0} total items)
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="flex-1">
            <ScrollArea className="h-full">
              {statsLoading ? (
                <div className="text-center py-8">Loading analytics...</div>
              ) : statsData ? (
                <FeedbackSummary 
                  stats={statsData} 
                  showModelBreakdown={true}
                  showDailyTrends={true}
                />
              ) : (
                <div className="text-center py-8">No analytics data available</div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
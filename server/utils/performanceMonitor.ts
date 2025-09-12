/**
 * Query Performance Monitoring Utility
 * 
 * Railway-safe performance monitoring for database operations and API endpoints.
 * Provides non-intrusive timing and performance tracking without affecting
 * existing API behavior or external consumer contracts.
 * 
 * DESIGN PRINCIPLES:
 * - Read-only monitoring: No impact on API responses
 * - Fail-safe: Monitoring failures don't affect operations
 * - External-API friendly: Transparent to external consumers
 * - Lightweight: Minimal performance overhead
 * 
 * @author Claude Code Architecture Agent
 * @date 2025-09-11
 */

import { logger } from './logger.ts';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  errorType?: string;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  operation: string;
  totalCalls: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  recentSamples: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 operations
  private readonly SLOW_QUERY_THRESHOLD = 2000; // 2 seconds

  /**
   * Time an async operation and record performance metrics
   * 
   * FAIL-SAFE: If monitoring fails, the operation continues normally
   * 
   * @param operation - Name/identifier for the operation
   * @param fn - The async function to monitor
   * @param metadata - Optional additional context
   * @returns Promise<T> - The result of the operation
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let errorType: string | undefined;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      throw error; // Re-throw original error
    } finally {
      // Record metrics (fail silently if monitoring fails)
      this.tryRecordMetric({
        operation,
        duration: Date.now() - startTime,
        timestamp: startTime,
        success,
        errorType,
        metadata,
      });
    }
  }

  /**
   * Record a metric with graceful failure handling
   * Private method - monitoring failures don't affect main operation
   */
  private tryRecordMetric(metric: PerformanceMetric): void {
    try {
      // Add to metrics array
      this.metrics.push(metric);

      // Maintain maximum size (remove oldest)
      if (this.metrics.length > this.MAX_METRICS) {
        this.metrics.shift();
      }

      // Log slow operations
      if (metric.duration > this.SLOW_QUERY_THRESHOLD) {
        logger.warn(`Slow operation detected: ${metric.operation} took ${metric.duration}ms`, 'performance');
      }

      // Log successful completion for expensive operations
      if (metric.success && metric.duration > 1000) {
        logger.debug(`Operation completed: ${metric.operation} (${metric.duration}ms)`, 'performance');
      }

    } catch (error) {
      // Monitoring failure - log but don't affect operation
      logger.warn(`Performance monitoring failed for ${metric.operation}: ${error instanceof Error ? error.message : String(error)}`, 'performance');
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getOperationStats(operation: string): PerformanceStats | null {
    try {
      const operationMetrics = this.metrics.filter(m => m.operation === operation);
      
      if (operationMetrics.length === 0) {
        return null;
      }

      const durations = operationMetrics.map(m => m.duration);
      const successCount = operationMetrics.filter(m => m.success).length;

      return {
        operation,
        totalCalls: operationMetrics.length,
        averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        successRate: Math.round((successCount / operationMetrics.length) * 100 * 100) / 100,
        recentSamples: operationMetrics.length,
      };
    } catch (error) {
      logger.warn(`Failed to get stats for operation ${operation}: ${error instanceof Error ? error.message : String(error)}`, 'performance');
      return null;
    }
  }

  /**
   * Get performance statistics for all monitored operations
   */
  getAllStats(): PerformanceStats[] {
    try {
      const operations = [...new Set(this.metrics.map(m => m.operation))];
      return operations
        .map(op => this.getOperationStats(op))
        .filter((stats): stats is PerformanceStats => stats !== null);
    } catch (error) {
      logger.warn(`Failed to get all performance stats: ${error instanceof Error ? error.message : String(error)}`, 'performance');
      return [];
    }
  }

  /**
   * Get recent slow operations (for debugging)
   */
  getRecentSlowOperations(limit: number = 10): PerformanceMetric[] {
    try {
      return this.metrics
        .filter(m => m.duration > this.SLOW_QUERY_THRESHOLD)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      logger.warn(`Failed to get slow operations: ${error instanceof Error ? error.message : String(error)}`, 'performance');
      return [];
    }
  }

  /**
   * Clear all performance metrics
   * Useful for resetting monitoring periods
   */
  clear(): void {
    try {
      const count = this.metrics.length;
      this.metrics = [];
      logger.info(`Performance metrics cleared - ${count} entries removed`, 'performance');
    } catch (error) {
      logger.warn(`Failed to clear performance metrics: ${error instanceof Error ? error.message : String(error)}`, 'performance');
    }
  }

  /**
   * Get summary of overall performance
   */
  getSummary(): {
    totalOperations: number;
    uniqueOperations: number;
    averageResponseTime: number;
    slowOperationsCount: number;
    overallSuccessRate: number;
  } {
    try {
      if (this.metrics.length === 0) {
        return {
          totalOperations: 0,
          uniqueOperations: 0,
          averageResponseTime: 0,
          slowOperationsCount: 0,
          overallSuccessRate: 100,
        };
      }

      const uniqueOperations = new Set(this.metrics.map(m => m.operation)).size;
      const averageResponseTime = Math.round(
        this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
      );
      const slowOperationsCount = this.metrics.filter(m => m.duration > this.SLOW_QUERY_THRESHOLD).length;
      const successCount = this.metrics.filter(m => m.success).length;
      const overallSuccessRate = Math.round((successCount / this.metrics.length) * 100 * 100) / 100;

      return {
        totalOperations: this.metrics.length,
        uniqueOperations,
        averageResponseTime,
        slowOperationsCount,
        overallSuccessRate,
      };
    } catch (error) {
      logger.warn(`Failed to get performance summary: ${error instanceof Error ? error.message : String(error)}`, 'performance');
      return {
        totalOperations: 0,
        uniqueOperations: 0,
        averageResponseTime: 0,
        slowOperationsCount: 0,
        overallSuccessRate: 0,
      };
    }
  }
}

// Singleton instance for application-wide use
const performanceMonitor = new PerformanceMonitor();

// Operation name constants for consistency
export const Operations = {
  // MetricsRepository operations
  COMPREHENSIVE_DASHBOARD: 'metrics:comprehensive-dashboard',
  GENERAL_MODEL_STATS: 'metrics:general-model-stats',
  MODEL_RELIABILITY_STATS: 'metrics:model-reliability',
  MODEL_COMPARISONS: 'metrics:model-comparisons',
  
  // AccuracyRepository operations
  PURE_ACCURACY_STATS: 'accuracy:pure-stats',
  TOP_ACCURATE_MODELS: 'accuracy:top-models',
  DANGEROUS_MODELS: 'accuracy:dangerous-models',
  
  // TrustworthinessRepository operations
  TRUSTWORTHINESS_STATS: 'trustworthiness:stats',
  CONFIDENCE_STATS: 'trustworthiness:confidence',
  PERFORMANCE_LEADERBOARDS: 'trustworthiness:performance',
  
  // FeedbackRepository operations
  FEEDBACK_SUMMARY: 'feedback:summary',
  RECENT_FEEDBACK: 'feedback:recent',
} as const;

// Main export - the monitor instance
export { performanceMonitor };

// Helper function for timing database queries
export const timeQuery = <T>(operation: string, queryFn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> => {
  return performanceMonitor.time(operation, queryFn, metadata);
};
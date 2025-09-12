/**
 * Application-Level Query Caching System
 * 
 * Railway-Safe caching implementation for expensive database operations.
 * Features automatic fallback to direct queries if caching fails, ensuring
 * API stability for external consumers while providing performance benefits.
 * 
 * DESIGN PRINCIPLES:
 * - Fail-safe: Always falls back to direct query execution
 * - Non-disruptive: Caching failures don't affect API responses  
 * - External-API friendly: Maintains consistent response patterns
 * - Railway compatible: Uses in-memory caching (no external dependencies)
 * 
 * @author Claude Code Architecture Agent
 * @date 2025-09-11
 */

import { logger } from './logger.ts';

// Cache configuration constants
const CACHE_CONFIG = {
  // Cache TTL (Time To Live) settings
  TTL: {
    DASHBOARD_DATA: 5 * 60 * 1000,      // 5 minutes for dashboard queries
    MODEL_STATS: 3 * 60 * 1000,        // 3 minutes for model statistics
    RELIABILITY_DATA: 10 * 60 * 1000,   // 10 minutes for reliability stats
  },
  
  // Cache size limits (prevent memory bloat)
  MAX_CACHE_SIZE: 100,
  
  // Performance monitoring
  ENABLE_METRICS: true,
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  failedReads: number;
  failedWrites: number;
  evictions: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private metrics: CacheMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failedReads: 0,
    failedWrites: 0,
    evictions: 0,
  };

  /**
   * Retrieve cached data or execute fallback function
   * 
   * FAIL-SAFE DESIGN: If caching fails at any point, executes fallback directly
   * 
   * @param key - Unique cache key
   * @param fallback - Function to execute if cache miss or failure
   * @param ttl - Cache TTL in milliseconds (default: 5 minutes)
   * @returns Promise<T> - Cached data or fresh data from fallback
   */
  async get<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl: number = CACHE_CONFIG.TTL.DASHBOARD_DATA
  ): Promise<T> {
    this.metrics.totalRequests++;

    try {
      // Try to retrieve from cache
      const entry = this.cache.get(key);
      
      if (entry && this.isValidEntry(entry)) {
        entry.hits++;
        this.metrics.cacheHits++;
        
        if (CACHE_CONFIG.ENABLE_METRICS) {
          logger.debug(`Cache HIT for key: ${key} (${entry.hits} hits)`, 'cache');
        }
        
        return entry.data;
      }

      // Cache miss - remove expired entry if exists
      if (entry) {
        this.cache.delete(key);
      }
      
    } catch (error) {
      // Cache read failure - log and continue to fallback
      this.metrics.failedReads++;
      logger.warn(`Cache read failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`, 'cache');
    }

    // Execute fallback (cache miss or error)
    this.metrics.cacheMisses++;
    
    if (CACHE_CONFIG.ENABLE_METRICS) {
      logger.debug(`Cache MISS for key: ${key} - executing fallback`, 'cache');
    }

    try {
      const data = await fallback();
      
      // Try to cache the result (fail silently if caching fails)
      this.trySet(key, data, ttl);
      
      return data;
    } catch (error) {
      // Fallback execution failed - this is the original error, not a caching issue
      logger.error(`Fallback execution failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`, 'cache');
      throw error;
    }
  }

  /**
   * Attempt to set cache entry with graceful failure handling
   * Private method - caching failures don't affect main operation
   */
  private trySet<T>(key: string, data: T, ttl: number): void {
    try {
      // Enforce cache size limit
      if (this.cache.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
        this.evictOldestEntry();
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        hits: 0,
      };

      this.cache.set(key, entry);
      
      if (CACHE_CONFIG.ENABLE_METRICS) {
        logger.debug(`Cache SET for key: ${key} (TTL: ${ttl}ms)`, 'cache');
      }
      
    } catch (error) {
      // Cache write failure - log but don't affect operation
      this.metrics.failedWrites++;
      logger.warn(`Cache write failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`, 'cache');
    }
  }

  /**
   * Check if cache entry is still valid (not expired)
   */
  private isValidEntry<T>(entry: CacheEntry<T>): boolean {
    return (Date.now() - entry.timestamp) < entry.ttl;
  }

  /**
   * Evict the oldest cache entry to maintain size limits
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
      
      if (CACHE_CONFIG.ENABLE_METRICS) {
        logger.debug(`Evicted oldest cache entry: ${oldestKey}`, 'cache');
      }
    }
  }

  /**
   * Invalidate specific cache entry
   * Used when data changes that would affect cached results
   */
  invalidate(key: string): void {
    try {
      const deleted = this.cache.delete(key);
      if (deleted && CACHE_CONFIG.ENABLE_METRICS) {
        logger.debug(`Cache invalidated for key: ${key}`, 'cache');
      }
    } catch (error) {
      logger.warn(`Cache invalidation failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`, 'cache');
    }
  }

  /**
   * Clear all cached entries
   * Nuclear option for cache issues
   */
  clear(): void {
    try {
      const size = this.cache.size;
      this.cache.clear();
      logger.info(`Cache cleared - ${size} entries removed`, 'cache');
    } catch (error) {
      logger.warn(`Cache clear failed: ${error instanceof Error ? error.message : String(error)}`, 'cache');
    }
  }

  /**
   * Get cache performance metrics
   * Useful for monitoring and optimization
   */
  getMetrics(): CacheMetrics & { hitRate: number; size: number } {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100 
      : 0;

    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
    };
  }

  /**
   * Reset performance metrics
   * For monitoring periods
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failedReads: 0,
      failedWrites: 0,
      evictions: 0,
    };
    
    logger.info('Cache metrics reset', 'cache');
  }
}

// Singleton instance for application-wide use
const queryCache = new QueryCache();

// Helper functions for common cache key patterns
export const CacheKeys = {
  comprehensiveDashboard: () => 'dashboard:comprehensive',
  modelReliabilityStats: () => 'reliability:all-models',
  generalModelStats: () => 'models:general-stats',
  modelAccuracyRanking: (limit: number) => `accuracy:ranking:${limit}`,
  dangerousModels: (limit: number) => `accuracy:dangerous:${limit}`,
  trustworthinessStats: () => 'trustworthiness:stats',
  confidenceStats: () => 'trustworthiness:confidence',
  feedbackSummary: () => 'feedback:summary',
} as const;

// TTL constants for different data types
export const CacheTTL = CACHE_CONFIG.TTL;

// Main export - the cache instance
export { queryCache };

// Export for testing purposes
export { CACHE_CONFIG };
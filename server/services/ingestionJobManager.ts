/**
 * server/services/ingestionJobManager.ts
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-01
 * PURPOSE: Manages HuggingFace dataset ingestion jobs with real-time progress tracking
 *          Supports pause/resume/cancel operations via EventEmitter pattern
 *          Broadcasts progress updates via WebSocket (reuses wsService infrastructure)
 * SRP/DRY check: Pass - Single responsibility (job management), reuses wsService
 * 
 * Architecture Pattern: Inspired by Saturn Visual Solver session management
 * - Each job gets unique jobId and EventEmitter
 * - State machine: idle → running → paused → completed/error/cancelled
 * - Progress updates broadcast via existing wsService
 * - Pause/resume via flags + EventEmitter.once() waiting
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { broadcast } from './wsService.js';
import type { IngestionConfig } from '../scripts/ingest-huggingface-dataset';

export interface IngestionProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentPuzzle: string | null;
  startTime: number;
  pauseTime: number | null;
  resumeTime: number | null;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
}

export interface IngestionJobState {
  jobId: string;
  config: IngestionConfig;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: IngestionProgress;
  emitter: EventEmitter;
  pauseRequested: boolean;
  cancelRequested: boolean;
  errorMessage?: string;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    accuracyPercent: number;
    durationMs: number;
  };
}

class IngestionJobManager {
  private jobs: Map<string, IngestionJobState> = new Map();

  /**
   * Create a new ingestion job
   */
  createJob(config: IngestionConfig): IngestionJobState {
    const jobId = randomUUID();
    const emitter = new EventEmitter();
    
    const job: IngestionJobState = {
      jobId,
      config,
      status: 'idle',
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        currentPuzzle: null,
        startTime: Date.now(),
        pauseTime: null,
        resumeTime: null,
        elapsedMs: 0,
        estimatedRemainingMs: null
      },
      emitter,
      pauseRequested: false,
      cancelRequested: false
    };

    this.jobs.set(jobId, job);

    // Auto-cleanup after 1 hour
    setTimeout(() => {
      console.log(`[JobManager] Cleaning up job ${jobId} after 1 hour`);
      this.jobs.delete(jobId);
    }, 3600000);

    console.log(`[JobManager] Created job ${jobId} for dataset: ${config.datasetName}`);
    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): IngestionJobState | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Pause a running job
   */
  pauseJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') {
      console.log(`[JobManager] Cannot pause job ${jobId} - not running (status: ${job?.status})`);
      return false;
    }
    
    job.pauseRequested = true;
    job.progress.pauseTime = Date.now();
    
    console.log(`[JobManager] Pause requested for job ${jobId}`);
    
    // Broadcast pause request
    this.broadcastProgress(jobId);
    
    return true;
  }

  /**
   * Resume a paused job
   */
  resumeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'paused') {
      console.log(`[JobManager] Cannot resume job ${jobId} - not paused (status: ${job?.status})`);
      return false;
    }
    
    job.pauseRequested = false;
    job.status = 'running';
    job.progress.resumeTime = Date.now();
    
    console.log(`[JobManager] Resuming job ${jobId}`);
    
    // Emit resume event to wake up waiting script
    job.emitter.emit('resume');
    
    // Broadcast resume
    this.broadcastProgress(jobId);
    
    return true;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.log(`[JobManager] Job ${jobId} not found`);
      return false;
    }
    
    if (job.status === 'completed' || job.status === 'error' || job.status === 'cancelled') {
      console.log(`[JobManager] Job ${jobId} already finished (status: ${job.status})`);
      return false;
    }
    
    job.cancelRequested = true;
    job.status = 'cancelled';
    
    console.log(`[JobManager] Cancelling job ${jobId}`);
    
    // Emit cancel event
    job.emitter.emit('cancel');
    
    // Broadcast cancellation
    this.broadcastProgress(jobId);
    
    return true;
  }

  /**
   * Update progress and broadcast to connected clients
   */
  updateProgress(jobId: string, update: Partial<IngestionProgress>) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    // Update progress
    job.progress = { ...job.progress, ...update };
    
    // Calculate elapsed time
    const now = Date.now();
    const pausedTime = job.progress.pauseTime && job.progress.resumeTime 
      ? job.progress.resumeTime - job.progress.pauseTime 
      : 0;
    job.progress.elapsedMs = now - job.progress.startTime - pausedTime;
    
    // Estimate remaining time
    if (job.progress.processed > 0 && job.progress.total > 0) {
      const avgTimePerPuzzle = job.progress.elapsedMs / job.progress.processed;
      const remaining = job.progress.total - job.progress.processed;
      job.progress.estimatedRemainingMs = avgTimePerPuzzle * remaining;
    }
    
    // Broadcast update
    this.broadcastProgress(jobId);
  }

  /**
   * Mark job as completed with summary
   */
  completeJob(jobId: string, summary: IngestionJobState['summary']) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.status = 'completed';
    job.summary = summary;
    
    console.log(`[JobManager] Job ${jobId} completed - ${summary.successful}/${summary.total} successful`);
    
    // Broadcast completion
    broadcast(jobId, {
      status: job.status,
      progress: job.progress,
      summary: job.summary,
      message: `Ingestion complete! ${summary.successful}/${summary.total} successful (${summary.accuracyPercent.toFixed(1)}% accuracy)`,
      timestamp: Date.now()
    });
  }

  /**
   * Mark job as failed with error
   */
  failJob(jobId: string, error: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.status = 'error';
    job.errorMessage = error;
    
    console.error(`[JobManager] Job ${jobId} failed:`, error);
    
    // Broadcast error
    broadcast(jobId, {
      status: job.status,
      progress: job.progress,
      error: error,
      message: `Ingestion failed: ${error}`,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast current progress state
   */
  private broadcastProgress(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    const message = job.status === 'paused' 
      ? 'Paused - click Resume to continue'
      : job.status === 'cancelled'
      ? 'Cancelled by user'
      : job.progress.currentPuzzle
      ? `Processing ${job.progress.currentPuzzle}...`
      : 'Initializing...';
    
    broadcast(jobId, {
      status: job.status,
      progress: job.progress,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Get all active jobs (for debugging)
   */
  getActiveJobs(): IngestionJobState[] {
    return Array.from(this.jobs.values()).filter(
      j => j.status === 'running' || j.status === 'paused'
    );
  }
}

// Export singleton instance
export const ingestionJobManager = new IngestionJobManager();

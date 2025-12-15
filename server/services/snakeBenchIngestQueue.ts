/**
 * server/services/snakeBenchIngestQueue.ts
 *
 * Author: Codex / GPT-5
 * Date: 2025-12-10
 * PURPOSE: Serialize SnakeBench replay ingestion so we never trigger
 *          Postgres deadlocks or fall back to lossy inserts.
 * SRP/DRY check: Pass — dedicated to queuing and retrying ingest jobs.
 */

import { logger } from '../utils/logger.ts';
import type { SnakeBenchRecordMatchParams } from '../repositories/SnakeBenchRepository.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { publishSnakeBenchReplayToGitHub } from './snakeBenchGitHubPublisher.ts';

interface SnakeBenchIngestJob {
  id: string;
  params: SnakeBenchRecordMatchParams;
  attempts: number;
}

const MAX_RETRIES = Number.parseInt(process.env.SNAKEBENCH_INGEST_MAX_RETRIES || '', 10) || 5;
const RETRY_DELAY_MS = Number.parseInt(process.env.SNAKEBENCH_INGEST_RETRY_DELAY_MS || '', 10) || 5_000;

export class SnakeBenchIngestQueue {
  private queue: SnakeBenchIngestJob[] = [];
  private isProcessing = false;
  private jobCounter = 0;

  enqueue(params: SnakeBenchRecordMatchParams): void {
    const job: SnakeBenchIngestJob = {
      id: `snakebench-ingest-${Date.now()}-${this.jobCounter += 1}`,
      params,
      attempts: 0,
    };

    this.queue.push(job);
    logger.info(
      `SnakeBenchIngestQueue: queued job ${job.id} (pending: ${this.queue.length})`,
      'snakebench-queue',
    );
    void this.processNext();
  }

  getPendingJobCount(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    const nextJob = this.queue.shift();
    if (!nextJob) return;

    this.isProcessing = true;

    try {
      let publishedRawUrl: string | null = null;
      const completedGamePath = nextJob.params.result.completedGamePath;
      if (completedGamePath) {
        const published = await publishSnakeBenchReplayToGitHub({
          gameId: nextJob.params.result.gameId,
          completedGamePath,
        });
        publishedRawUrl = published?.rawUrl ?? null;
      }

      await repositoryService.snakeBench.recordMatchFromResult(nextJob.params);

      if (publishedRawUrl) {
        try {
          await repositoryService.snakeBench.setReplayPath(nextJob.params.result.gameId, publishedRawUrl);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(
            `SnakeBenchIngestQueue: failed to persist published replay_path for ${nextJob.params.result.gameId}: ${message}`,
            'snakebench-queue',
          );
        }
      }
      logger.info(`SnakeBenchIngestQueue: completed job ${nextJob.id}`, 'snakebench-queue');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      nextJob.attempts += 1;

      if (nextJob.attempts > MAX_RETRIES) {
        logger.error(
          `SnakeBenchIngestQueue: job ${nextJob.id} exhausted retries (${MAX_RETRIES}) :: ${message}`,
          'snakebench-queue',
        );
      } else {
        logger.warn(
          `SnakeBenchIngestQueue: retrying job ${nextJob.id} attempt ${nextJob.attempts}/${MAX_RETRIES} :: ${message}`,
          'snakebench-queue',
        );
        setTimeout(() => {
          this.queue.unshift(nextJob);
          void this.processNext();
        }, RETRY_DELAY_MS);
        this.isProcessing = false;
        return;
      }
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      void this.processNext();
    }
  }
}

export const snakeBenchIngestQueue = new SnakeBenchIngestQueue();

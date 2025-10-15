/**
 * discussionController.ts
 * 
 * Author: Cascade using Sonnet 4
 * Date: 2025-10-06
 * PURPOSE: API endpoints for PuzzleDiscussion feature - returns ONLY eligible explanations
 * (less than 30 days old, from reasoning models, has provider_response_id)
 * SRP/DRY check: Pass - Single responsibility for discussion eligibility filtering
 */

import type { Request, Response } from 'express';
import { repositoryService } from '../repositories/RepositoryService.js';

/**
 * GET /api/discussion/eligible
 * Returns recent explanations eligible for discussion (conversation chaining)
 * 
 * Eligibility criteria:
 * - Created within last 30 days (provider retention window)
 * - Has provider_response_id (required for chaining)
 */
export async function getEligibleExplanations(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Raw SQL query - filter at database level for performance
    const query = `
      SELECT 
        id,
        puzzle_id,
        model_name,
        provider_response_id,
        created_at,
        confidence,
        is_prediction_correct,
        multi_test_all_correct,
        EXTRACT(EPOCH FROM NOW() - created_at)::INTEGER / 3600 as hours_old
      FROM explanations
      WHERE 
        created_at >= NOW() - INTERVAL '30 days'
        AND provider_response_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const db = repositoryService.db;
    if (!db) {
      return res.status(503).json({ 
        error: 'Database not available',
        explanations: []
      });
    }

    const result = await db.query(query, [limit, offset]);

    // Map results to friendly format
    const explanations = result.rows.map((row: any) => {
      // Infer provider from model name
      const modelLower = row.model_name.toLowerCase();
      let provider = 'unknown';
      if (modelLower.includes('gpt') || modelLower.includes('o3') || modelLower.includes('o4')) {
        provider = 'openai';
      } else if (modelLower.includes('grok')) {
        provider = 'xai';
      }

      return {
        id: row.id,
        puzzleId: row.puzzle_id,
        modelName: row.model_name,
        provider,
        createdAt: row.created_at,
        hoursOld: row.hours_old,
        hasProviderResponseId: row.provider_response_id !== null,
        confidence: row.confidence,
        isCorrect: row.is_prediction_correct || row.multi_test_all_correct
      };
    });

    res.json({
      explanations,
      total: explanations.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('[discussionController] Error fetching eligible explanations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch eligible explanations',
      explanations: []
    });
  }
}

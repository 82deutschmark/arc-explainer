/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: Express router exposing the ARC3 agent playground API backed by the OpenAI Agents SDK runner.
SRP/DRY check: Pass — isolates HTTP contract and validation for ARC3 playground endpoints.
*/

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { Arc3AgentRunner } from '../services/arc3/Arc3AgentRunner';
import { formatResponse } from '../utils/responseFormatter';

const router = Router();
const runner = new Arc3AgentRunner();

const runSchema = z.object({
  agentName: z.string().trim().max(60).optional(),
  instructions: z
    .string({ required_error: 'instructions is required' })
    .trim()
    .min(1, 'instructions must not be empty'),
  model: z.string().trim().max(120).optional(),
  maxTurns: z
    .coerce.number()
    .int()
    .min(2)
    .max(24)
    .optional(),
  scenarioId: z.string().trim().max(120).optional(),
});

router.post(
  '/agent-playground/run',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = runSchema.parse(req.body);
    const result = await runner.run(payload);
    res.json(formatResponse.success(result));
  }),
);

export default router;

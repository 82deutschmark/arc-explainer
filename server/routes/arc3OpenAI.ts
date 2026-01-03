/**
 * Author: Cascade (ChatGPT 5.1 Codex)
 * Date: 2026-01-02
 * PURPOSE: Express routes for lightweight ARC3 OpenAI runner (Responses API, no Agents SDK).
 * SRP/DRY check: Pass — HTTP contract only.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { formatResponse } from "../utils/responseFormatter";
import { sseStreamManager } from "../services/streaming/SSEStreamManager";
import { arc3OpenAIStreamService } from "../services/arc3/Arc3OpenAIStreamService";
import { Arc3ApiClient } from "../services/arc3/Arc3ApiClient";

const router = Router();
const arc3ApiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || "");

const runSchema = z.object({
  game_id: z.string().trim(),
  model: z.string().trim(),
  instructions: z.string().trim().min(1),
  systemPrompt: z.string().trim().optional(),
  maxTurns: z.coerce.number().int().min(1).optional(),
  apiKey: z.string().trim().optional(),
});

const manualActionSchema = z.object({
  game_id: z.string().trim(),
  guid: z.string().trim(),
  action: z.enum(["RESET", "ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION6"]),
  coordinates: z.tuple([z.number().int(), z.number().int()]).optional(),
  card_id: z.string().trim().optional(),
});

router.post(
  "/stream/prepare",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatResponse.error("VALIDATION_ERROR", parsed.error.errors.map((e) => e.message).join("; ")));
    }

    const sessionId = arc3OpenAIStreamService.savePayload(parsed.data);
    res.json(formatResponse.success({ sessionId, provider: "openai" }));
  }),
);

router.get(
  "/stream/:sessionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const payload = arc3OpenAIStreamService.getPayload(sessionId);
    if (!payload) {
      return res.status(404).json(formatResponse.error("SESSION_NOT_FOUND", "No pending session"));
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Register SSE then flush
    sseStreamManager.register(sessionId, res);
    res.flushHeaders();

    try {
      await arc3OpenAIStreamService.startStreaming(req, { ...payload, sessionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sseStreamManager.error(sessionId, "STREAMING_ERROR", message);
    }
  }),
);

router.post(
  "/stream/:sessionId/cancel",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    arc3OpenAIStreamService.cancel(sessionId);
    res.json(formatResponse.success({ sessionId, cancelled: true }));
  }),
);

router.post(
  "/manual-action",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = manualActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatResponse.error("VALIDATION_ERROR", parsed.error.errors.map((e) => e.message).join("; ")));
    }

    const { game_id, guid, action, coordinates, card_id } = parsed.data;
    if (action === "ACTION6" && !coordinates) {
      return res.status(400).json(formatResponse.error("MISSING_COORDINATES", "ACTION6 requires coordinates [x, y]."));
    }
    if (action === "RESET" && !card_id) {
      return res.status(400).json(formatResponse.error("MISSING_CARD_ID", "RESET requires card_id from openScorecard."));
    }

    const frame = await arc3ApiClient.executeAction(
      game_id,
      guid,
      { action, coordinates: coordinates ? [coordinates[0], coordinates[1]] : undefined },
      undefined,
      card_id,
    );

    res.json(formatResponse.success({ frame, action, coordinates }));
  }),
);

router.get(
  "/health",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(formatResponse.success({ status: "healthy", provider: "openai", timestamp: Date.now() }));
  }),
);

export default router;

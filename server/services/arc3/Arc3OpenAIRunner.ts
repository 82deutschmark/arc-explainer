/**
 * Author: Cascade (ChatGPT 5.1 Codex)
 * Date: 2026-01-02
 * PURPOSE: Lightweight ARC3 runner using OpenAI Responses API directly (no Agents SDK).
 *          Opens scorecard, loops over frames, asks model to choose an action via tool calls,
 *          executes ARC3 HTTP commands, and streams minimal events.
 * SRP/DRY check: Pass — single responsibility: coordinate ARC3 API with OpenAI Responses API.
 */

import { Arc3ApiClient, type FrameData } from "./Arc3ApiClient";
import { logger } from "../utils/logger";
import { ARC3_API_BASE_URL } from "./utils/constants";

export interface Arc3OpenAIRunConfig {
  game_id: string;
  model: string;
  maxTurns?: number;
  systemPrompt?: string;
  instructions: string;
  apiKey?: string; // optional BYOK; falls back to process.env.OPENAI_API_KEY
}

export interface Arc3OpenAIRunResult {
  gameGuid: string;
  frames: FrameData[];
  timeline: any[];
  finalState: string;
}

export interface Arc3OpenAIStreamHarness {
  sessionId: string;
  emit: (chunk: any) => void;
  emitEvent: (event: string, data: any) => void;
  end: (summary: any) => void;
}

export class Arc3OpenAIRunner {
  constructor(private readonly apiClient: Arc3ApiClient) {}

  async runWithStreaming(config: Arc3OpenAIRunConfig, stream: Arc3OpenAIStreamHarness): Promise<Arc3OpenAIRunResult> {
    const maxTurns = config.maxTurns ?? 50;
    const frames: FrameData[] = [];
    const timeline: any[] = [];
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is required (provide apiKey or OPENAI_API_KEY).");
    }

    stream.emitEvent("stream.init", { state: "starting", game_id: config.game_id, provider: "openai" });

    // 1) Open scorecard and start game
    const cardId = await this.apiClient.openScorecard(["openai-runner"], "arc-explainer");
    let frame = await this.apiClient.startGame(config.game_id, undefined, cardId);
    frames.push(frame);

    stream.emitEvent("game.frame_update", { frame, turn: 0 });
    stream.emitEvent("stream.status", { state: "running", message: "Started game via OpenAI runner" });

    let turn = 0;
    for (; turn < maxTurns; turn++) {
      if (frame.state === "WIN" || frame.state === "GAME_OVER") break;

      const action = await this.chooseAction(apiKey, config.model, frame, config.systemPrompt, config.instructions);
      if (!action) {
        logger.warn(`[Arc3OpenAIRunner] No action returned; stopping at turn ${turn}`, "arc3-openai");
        break;
      }

      stream.emitEvent("game.action_start", { turn, action });

      frame = await this.apiClient.executeAction(
        config.game_id,
        frame.guid,
        {
          action: action.type,
          coordinates: action.coordinates ? [action.coordinates.x, action.coordinates.y] : undefined,
        },
        undefined,
        cardId
      );

      frames.push(frame);
      timeline.push({ turn, action: action.type, coordinates: action.coordinates, state: frame.state, score: frame.score });

      stream.emitEvent("game.action_result", {
        turn,
        action,
        frame,
      });

      stream.emitEvent("game.frame_update", { frame, turn: turn + 1 });
    }

    const finalState = frame.state;
    stream.emitEvent("agent.completed", {
      finalState,
      turns: turn,
      gameGuid: frame.guid,
    });
    stream.end({ finalState, turns: turn, framesCount: frames.length });

    return { gameGuid: frame.guid, frames, timeline, finalState };
  }

  private buildTools(frame: FrameData) {
    const tools: any[] = [
      { name: "RESET", description: "Reset the game", parameters: { type: "object", properties: {} } },
      { name: "ACTION1", description: "Primary action", parameters: { type: "object", properties: {} } },
      { name: "ACTION2", description: "Secondary action", parameters: { type: "object", properties: {} } },
      { name: "ACTION3", description: "Tertiary action", parameters: { type: "object", properties: {} } },
      { name: "ACTION4", description: "Quaternary action", parameters: { type: "object", properties: {} } },
      { name: "ACTION5", description: "Fifth action", parameters: { type: "object", properties: {} } },
      {
        name: "ACTION6",
        description: "Coordinate selection",
        parameters: {
          type: "object",
          properties: {
            x: { type: "integer", minimum: 0, maximum: 63 },
            y: { type: "integer", minimum: 0, maximum: 63 },
          },
          required: ["x", "y"],
        },
      },
    ];

    const available = frame.available_actions;
    if (Array.isArray(available) && available.length > 0) {
      const allowed = new Set(
        available.map((t: any) => {
          if (typeof t === "string") return t.toUpperCase();
          if (typeof t === "number") {
            if (t === 0) return "RESET";
            return `ACTION${t}`;
          }
          return null;
        }).filter(Boolean) as string[]
      );
      return tools.filter((t) => allowed.has(t.name));
    }

    return tools;
  }

  private async chooseAction(
    apiKey: string,
    model: string,
    frame: FrameData,
    systemPrompt: string | undefined,
    instructions: string
  ): Promise<{ type: string; coordinates?: { x: number; y: number } } | null> {
    const tools = this.buildTools(frame);
    const body = {
      model,
      input: [
        ...(systemPrompt
          ? [
              {
                role: "system",
                content: [{ type: "text", text: systemPrompt }],
              },
            ]
          : []),
        {
          role: "user",
          content: [
            { type: "text", text: `${instructions}\nCurrent state: ${frame.state} | Score: ${frame.score}` },
            { type: "text", text: `Grid:\n${JSON.stringify(frame.frame)}` },
          ],
        },
      ],
      response_format: {
        type: "tool_calls",
        tools,
        tool_choice: "auto",
      },
      reasoning: { effort: "medium", summary: "auto" },
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI Responses API failed: ${response.status} ${text}`);
    }

    const result = await response.json();
    const toolCalls = result.output?.[0]?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) return null;

    const call = toolCalls[0];
    const name = call.name as string;
    const args = call.arguments || {};
    if (name === "ACTION6" && (typeof args.x !== "number" || typeof args.y !== "number")) {
      return null;
    }

    return name === "ACTION6"
      ? { type: name, coordinates: { x: args.x, y: args.y } }
      : { type: name };
  }
}

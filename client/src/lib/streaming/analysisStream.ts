/**
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Client-side helper to manage SSE analysis streams, normalizing chunk/status events and exposing a simple subscribe/close interface for UI hooks.
 * SRP/DRY check: Pass — no prior SSE utility in client/src/lib/streaming.
 * shadcn/ui: Pass — logic module without UI components.
 */

type StreamStatus =
  | { state: "requested" | "in_progress" | "completed" }
  | { state: "failed"; message?: string }
  | { state: string; [key: string]: unknown };

export interface StreamChunkPayload {
  type: string;
  delta?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
  raw?: unknown;
}

export interface StreamSummary {
  status: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  responseSummary?: Record<string, unknown> & { analysis?: Record<string, unknown> };
}

export interface AnalysisStreamParams {
  taskId: string;
  modelKey: string;
  temperature?: number;
  promptId?: string;
  customPrompt?: string;
  emojiSetKey?: string;
  omitAnswer?: boolean;
  topP?: number;
  candidateCount?: number;
  thinkingBudget?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  systemPromptMode?: string;
  previousResponseId?: string;
  captureReasoning?: boolean;
  sessionId?: string;
  retryMode?: boolean;
  originalExplanationId?: number;
  originalExplanation?: Record<string, unknown>;
  customChallenge?: string;
}

export interface AnalysisStreamHandlers {
  onInit?: (payload: {
    sessionId: string;
    taskId: string;
    modelKey: string;
    createdAt: string;
    expiresAt?: string;
  }) => void;
  onChunk?: (chunk: StreamChunkPayload) => void;
  onStatus?: (status: StreamStatus) => void;
  onComplete?: (summary: StreamSummary) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export interface AnalysisStreamHandle {
  close: () => void;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "";

export async function createAnalysisStream(
  params: AnalysisStreamParams,
  handlers: AnalysisStreamHandlers = {}
): Promise<AnalysisStreamHandle> {
  const encodedModel = encodeURIComponent(params.modelKey);
  const baseUrl = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;

  const { sessionId: _ignoredSessionId, ...handshakePayload } = params;

  const handshakeResponse = await fetch(`${baseUrl}/api/stream/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(handshakePayload),
  });

  if (!handshakeResponse.ok) {
    let errorMessage = `Handshake failed (${handshakeResponse.status})`;
    try {
      const errorJson = await handshakeResponse.json();
      if (typeof errorJson?.error === "string") {
        errorMessage = errorJson.error;
      }
      if (Array.isArray(errorJson?.details) && errorJson.details.length > 0) {
        errorMessage = `${errorMessage}: ${errorJson.details.join(", ")}`;
      }
    } catch {
      // Ignore JSON parse failure and use default message
    }
    throw new Error(errorMessage);
  }

  const handshakeJson = (await handshakeResponse.json()) as { sessionId?: string };
  if (!handshakeJson?.sessionId) {
    throw new Error("Handshake response missing sessionId");
  }

  const streamUrl = `${baseUrl}/api/stream/analyze/${params.taskId}/${encodedModel}/${handshakeJson.sessionId}`;
  const eventSource = new EventSource(streamUrl, { withCredentials: false });

  const handleChunk = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as StreamChunkPayload;
      handlers.onChunk?.(payload);
    } catch (error) {
      console.error("[SSE] Failed to parse chunk", error);
    }
  };

  const handleStatus = (event: MessageEvent<string>) => {
    try {
      const status = JSON.parse(event.data) as StreamStatus;
      handlers.onStatus?.(status);
    } catch {
      handlers.onStatus?.({ state: "unknown", raw: event.data });
    }
  };

  const handleInit = (event: MessageEvent<string>) => {
    try {
      const initPayload = JSON.parse(event.data) as {
        sessionId: string;
        taskId: string;
        modelKey: string;
        createdAt: string;
        expiresAt?: string;
      };
      handlers.onInit?.(initPayload);
    } catch (error) {
      console.error("[SSE] Failed to parse init payload", error);
    }
  };

  const handleComplete = (event: MessageEvent<string>) => {
    try {
      const summary = JSON.parse(event.data) as StreamSummary;
      handlers.onComplete?.(summary);
    } catch (error) {
      console.error("[SSE] Failed to parse completion payload", error);
    }
  };

  const handleError = (event: MessageEvent<string>) => {
    try {
      const errorPayload = JSON.parse(event.data) as { code: string; message: string };
      handlers.onError?.(errorPayload);
    } catch {
      handlers.onError?.({ code: "UNKNOWN", message: event.data });
    }
  };

  eventSource.addEventListener("stream.init", handleInit);
  eventSource.addEventListener("stream.chunk", handleChunk);
  eventSource.addEventListener("stream.status", handleStatus);
  eventSource.addEventListener("stream.complete", handleComplete);
  eventSource.addEventListener("stream.error", handleError);

  eventSource.onerror = () => {
    handlers.onError?.({ code: "CONNECTION", message: "SSE connection lost" });
  };

  return {
    close: () => {
      eventSource.removeEventListener("stream.init", handleInit);
      eventSource.removeEventListener("stream.chunk", handleChunk);
      eventSource.removeEventListener("stream.status", handleStatus);
      eventSource.removeEventListener("stream.complete", handleComplete);
      eventSource.removeEventListener("stream.error", handleError);
      eventSource.close();
    }
  };
}



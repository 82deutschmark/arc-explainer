/**
 * server/services/wsService.ts
 *
 * WebSocket hub for real-time progress streaming.
 * Attaches a ws.WebSocketServer to the existing HTTP server and manages
 * session-based channels so backend services can broadcast progress updates
 * to all clients connected for a given sessionId.
 *
 * Supports multiple solver paths:
 * - /api/saturn/progress?sessionId=... (Saturn Visual Solver)
 * - /api/grover/progress?sessionId=... (Grover Iterative Solver)
 * - /api/poetiq/progress?sessionId=... (Poetiq Code-Generation Solver)
 * - /api/beetree/progress?sessionId=... (Beetree Ensemble Solver)
 *
 * Exposes:
 * - attach(server): initialize ws server and URL routing
 * - broadcast(sessionId, data): send JSON to all clients subscribed to sessionId
 * - getSessionSnapshot(sessionId): return last known snapshot for polling API
 *
 * Author: Cascade (model: Cascade)
 * Updated: Sonnet 4.5 (2025-10-09) - Added Grover support
 * Updated: Claude Sonnet 4 (2025-11-25) - Added Poetiq support
 */

import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// Map sessionId -> Set<WebSocket>
const sessionClients: Map<string, Set<WebSocket>> = new Map();
// Keep last known snapshot for polling GET /status
const sessionSnapshots: Map<string, any> = new Map();
let wss: WebSocketServer | null = null;

function parseSessionId(url?: string | null): string | null {
  if (!url) return null;
  try {
    // Expect URL like /api/saturn/progress?sessionId=..., /api/grover/progress?sessionId=..., /api/poetiq/progress?sessionId=..., or /api/beetree/progress?sessionId=...
    const qs = url.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    const sid = params.get('sessionId');
    return sid || null;
  } catch {}
  return null;
}

export function attach(server: Server) {
  if (wss) return wss;
  // Attach without path restriction - handles Saturn, Grover, Poetiq, and Beetree solver progress endpoints
  // Clients connect to ws(s)://host/api/{solver}/progress?sessionId=...
  wss = new WebSocketServer({ 
    server,
    // No path restriction - verifyClient will check the URL
    verifyClient: (info, cb) => {
      const url = info.req.url || '';
      // Accept Saturn, Grover, Poetiq, and Beetree progress WebSocket paths
      if (
        url.startsWith('/api/saturn/progress') || 
        url.startsWith('/api/grover/progress') ||
        url.startsWith('/api/poetiq/progress') ||
        url.startsWith('/api/beetree/progress')
      ) {
        cb(true);
      } else {
        cb(false, 404, 'WebSocket path not found');
      }
    }
  });

  wss.on('connection', (ws, req) => {
    const url = req.url || '';
    const sessionId = parseSessionId(url);
    if (!sessionId) {
      ws.close(1008, 'Missing sessionId');
      return;
    }

    let set = sessionClients.get(sessionId);
    if (!set) {
      set = new Set();
      sessionClients.set(sessionId, set);
    }
    set.add(ws);

    // Send current snapshot to newly connected client if available
    const snapshot = sessionSnapshots.get(sessionId);
    if (snapshot) {
      try { ws.send(JSON.stringify({ type: 'snapshot', data: snapshot })); } catch {}
    }

    ws.on('close', () => {
      const s = sessionClients.get(sessionId);
      if (s) {
        s.delete(ws);
        if (s.size === 0) sessionClients.delete(sessionId);
      }
    });
  });

  return wss;
}

export function broadcast(sessionId: string, data: any) {
  // Update snapshot for polling API
  sessionSnapshots.set(sessionId, data);
  const set = sessionClients.get(sessionId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify({ type: 'progress', data });
  for (const ws of set) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    } catch {}
  }
}

export function getSessionSnapshot(sessionId: string) {
  return sessionSnapshots.get(sessionId) || null;
}

export function clearSession(sessionId: string) {
  sessionClients.delete(sessionId);
  sessionSnapshots.delete(sessionId);
}

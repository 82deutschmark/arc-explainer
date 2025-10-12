##  Determined this was overboard for now.  Might need if SSE fails.
Date: 2025-10-11





1. Shared Streaming Contract (EventEnvelope v1)
TypeScript (shared/eventEnvelope.ts):
```ts
export type EnvelopeType =
  | 'saturn.step'
  | 'saturn.image'
  | 'saturn.done'
  | 'grover.token'
  | 'grover.done'
  | 'status'
  | 'error';

export interface EventEnvelope<T = unknown> {
  v: '1'; // version
  id: string; // uuid for this event
  type: EnvelopeType;
  seq: number; // monotonically increasing sequence
  ts: number; // epoch ms
  corrId?: string; // correlation id for a stream/session
  data: T; // typed payload
}

// Example payloads
export interface SaturnStep {
  message: string;
  step: number;
  total?: number;
}
export interface SaturnImage {
  label: string;
  url: string; // server-provided URL or data: URL
  width?: number;
  height?: number;
}
export interface GroverToken { token: string; index: number; }
export interface ErrorData { code?: string; message: string; details?: unknown }
```

Versioning guidance:
- Only add fields in minor revisions; for breaking schema changes, bump v to '2'.
- The frontend must ignore unknown fields; the server must tolerate missing optional fields.

2. Python: Pydantic Models for Saturn Events
python_saturn/saturn_event_models.py (new):
```py
from pydantic import BaseModel, Field
from typing import Literal, Optional
import time, uuid, json

EnvelopeType = Literal[
    'saturn.step','saturn.image','saturn.done','status','error'
]

class BaseEnvelope(BaseModel):
    v: Literal['1'] = '1'
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: EnvelopeType
    seq: int
    ts: int = Field(default_factory=lambda: int(time.time() * 1000))
    corrId: Optional[str] = None

class SaturnStep(BaseModel):
    message: str
    step: int
    total: Optional[int] = None

class SaturnImage(BaseModel):
    label: str
    url: str
    width: Optional[int] = None
    height: Optional[int] = None

class ErrorData(BaseModel):
    code: Optional[str] = None
    message: str
    details: Optional[dict] = None

class SaturnEnvelope(BaseEnvelope):
    data: dict

    def to_ndjson(self) -> str:
        return self.model_dump_json()
```

server/python/saturn_wrapper.py (edit):
- Wrap all printed events through Pydantic validation before printing.
- Maintain seq per run; include corrId from server.
```py
# ... existing code ...
seq = 0
corr_id = os.environ.get('SATURN_CORR_ID')

# emit step
env = SaturnEnvelope(
    type='saturn.step', seq=seq, corrId=corr_id,
    data=SaturnStep(message='Loaded images', step=1, total=5).model_dump()
)
print(env.to_ndjson(), flush=True)
seq += 1
# ... emit images, errors, done similarly ...
```

3. Node/Express: SSE StreamManager and Adapters
server/services/streaming/StreamManager.ts (new):
```ts
export type Client = { id: string; res: import('express').Response; lastSeq: number; corrId: string };

export class StreamManager {
  private clients = new Map<string, Client>();
  private interval?: NodeJS.Timer;

  constructor(private heartbeatMs = 10000) {}

  addClient(id: string, res: any, corrId: string) {
    this.clients.set(id, { id, res, lastSeq: 0, corrId });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  }

  send<T>(clientId: string, ev: import('./types').EventEnvelope<T>) {
    const c = this.clients.get(clientId); if (!c) return;
    c.lastSeq = ev.seq;
    c.res.write(`id: ${ev.seq}\n`);
    c.res.write(`event: message\n`);
    c.res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  broadcast<T>(ev: import('./types').EventEnvelope<T>) {
    for (const id of this.clients.keys()) this.send(id, ev);
  }

  startHeartbeat() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      for (const c of this.clients.values()) {
        c.res.write(`: ping ${Date.now()}\n\n`); // SSE comment heartbeat
      }
    }, this.heartbeatMs);
  }

  removeClient(id: string) { this.clients.delete(id); }
  stop() { if (this.interval) clearInterval(this.interval); }
}
```

server/services/streaming/saturnSSE.ts (new):
- Start Python process with SATURN_CORR_ID env and parse NDJSON lines.
- For each line: JSON.parse → validate with a light TS guard → forward via manager.send().
- Map Python payloads to EventEnvelope<'saturn.*'> preserving seq, corrId.

server/services/streaming/groverSSE.ts (new):
- Call existing Grover/xAI provider stream function (token callbacks) and wrap each token in EventEnvelope<'grover.token'> with seq++.
- Emit 'grover.done' on finish or 'error' on failure.

server/routes.ts (edit):
- GET /api/stream/saturn/:taskId → creates corrId, registers client, starts saturn process, pipes events, supports Last-Event-ID via req.header('last-event-id').
- GET /api/stream/grover/:taskId → similar, no Python.
- POST /api/stream/cancel/:corrId → signals process termination and closes client.

4. Client: useEventSource hook and Stream Console
client/src/hooks/useEventSource.ts (new):
```ts
export function useEventSource(url: string, opts?: { onMessage?: (e: MessageEvent) => void; onError?: (e: Event) => void; }) {
  const [connected, setConnected] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  useEffect(() => {
    const es = new EventSource(url, { withCredentials: false });
    es.onopen = () => setConnected(true);
    es.onerror = (e) => { setConnected(false); opts?.onError?.(e); };
    es.onmessage = (e) => { setLastEventId(e.lastEventId || null); opts?.onMessage?.(e); };
    return () => es.close();
  }, [url]);
  return { connected, lastEventId };
}
```

client/src/pages/StreamConsole.tsx (new):
- Two panes using shadcn/ui: left for Python Saturn events (steps/images), right for Grover tokens.
- Controls: Start buttons for Saturn and Grover streams, Pause, Clear, and Save Transcript.

client/src/components/TokenAnimator.tsx (new):
- Appends tokens with requestAnimationFrame batching; supports pause/resume.

client/src/components/GridRenderer.tsx (new):
- Renders small ARC grids with color legend; supports hover/zoom.

client/src/components/ImageGallery.tsx (new):
- Masonry-ish grid with lazy-loading, hover zoom, and full-screen modal using shadcn/ui Dialog.

5. Logfire Instrumentation (observability only)
server/logging/logfire_config.ts (new):
```ts
import logfire from 'logfire';
export const lf = logfire.init({ token: process.env.LOGFIRE_TOKEN, service: 'arc-explainer', sampleRate: 0.2 });
export const withCorr = (corrId: string) => lf.child({ corrId });
```

- In saturnSSE/groverSSE adapters: lf.info('stream.start', { provider:'saturn'|'grover', corrId }), lf.debug('stream.event', { type, seq }), lf.error('stream.error', { message, code }) with redaction.
- Python: optional logfire-python (future). For now, log to stdout with corrId; the Node side correlates.

6. Provider Adapter Notes (Grover)
- Use the existing grok/grover service streaming API if available; otherwise, simulate token streaming by chunking the text response server-side for the demo.
- Normalize provider quirks in a thin adapter: onToken, onDone, onError. Don’t bake provider specifics into the SSE layer.

7. Server Routing Changes
- routes.ts: register SSE routes with no-cache headers and CORS allowance.
- Add POST /api/stream/cancel/:corrId to terminate Python subprocess (Saturn) and close clients.

8. Testing and Resilience
- Unit: Python Pydantic models (invalid payloads rejected), TS guards for EventEnvelope.
- Integration: SSE lifecycle (connect, heartbeat every 10s, disconnect, resume via Last-Event-ID), graceful cancel.
- Manual E2E: 2–3 minutes streaming under throttled network; verify UI stays responsive and memory stable.

9. Rollout Order
- Phase 1 (Day 1–2): Saturn SSE path + Stream Console skeleton + TokenAnimator, basic ImageGallery.
- Phase 2 (Day 2–4): Grover token streaming adapter + Logfire instrumentation + polish animations.
- Phase 3 (Optional): Pyodide toggle for in-browser Python snippets; document tradeoffs; keep off by default.

10. Minimal Code Snippets to Implement
- Saturn NDJSON → SSE forwarder (Node):
```ts
// for each line from python
const parsed = JSON.parse(line);
assert(parsed.v==='1' && parsed.type?.startsWith('saturn'));
manager.send(clientId, parsed);
```
- Grover token callbacks → SSE:
```ts
provider.stream({ prompt }, {
  onToken: (t, i) => send<GroverToken>({ type:'grover.token', data:{ token:t, index:i } }),
  onDone: () => send({ type:'grover.done', data:{} }),
  onError: (err) => send({ type:'error', data:{ message:String(err) } })
});
```

11. UI Wiring (pseudo)
```tsx
const saturn = useEventSource(`/api/stream/saturn/${taskId}`);
const grover = useEventSource(`/api/stream/grover/${taskId}`);

onSaturnMessage = (e) => {
  const env = JSON.parse(e.data) as EventEnvelope;
  switch(env.type){
    case 'saturn.step': setSteps(s => [...s, env.data]); break;
    case 'saturn.image': setImages(g => [...g, env.data]); break;
    case 'saturn.done': setSaturnDone(true); break;
    case 'error': toast.error(env.data.message); break;
  }
};

onGroverMessage = (e) => {
  const env = JSON.parse(e.data) as EventEnvelope;
  if(env.type==='grover.token') tokenAnimator.append(env.data.token);
  if(env.type==='grover.done') tokenAnimator.finish();
};
```

12. Config and Env
- Ensure LOGFIRE_TOKEN present in .env (already is per user). Add .env.example with placeholder.
- hosting allows SSE: disable proxy buffering, keep-alive > 60s.  5 minute max connection time!

13. Acceptance Criteria
- One page shows Python steps/images and token-by-token LLM updates concurrently with smooth UI.
- No WebSockets in the path; SSE only.
- Pydantic validation blocks malformed Saturn events; errors surface to UI.
- Logfire displays correlated traces for sessions (sampled) with no secrets.

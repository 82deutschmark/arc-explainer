/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: Guards the upload side of the team-only ARC-AGI-2 eval runs (server/routes/teamEvals.ts):
 *          run and output keys are checked, a document must belong to the address it is sent to
 *          and stay under its size cap, the eval box's own token (ARC2_EVAL_UPLOAD_TOKEN, not the
 *          arc3 admin token) is required and the route is closed while it is unset or short, and
 *          the routes refuse in that order before touching storage (with no database the write
 *          answers 503 rather than claiming success). Also the sign-in return path
 *          (teamAuth.ts safeNext), which now lets an eval link's ?o=<output> survive sign-in
 *          while still refusing anything outside the team pages.
 *          2026-10-21 (Claude Opus 5.5), the runs API: version 2 documents of every kind
 *          (accuracy needs rows; speed / kernel / profile need arms with unique names, a known
 *          status and numeric metrics), unknown versions and kinds refused, and the token-checked
 *          schema route.
 *          No database: storage is BaseRepository's, unconnected here.
 * SRP/DRY check: Pass - exercises the real middleware and router with minimal stand-ins, as
 *          tests/teamSession.test.ts does.
 */
import { afterEach, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireArc2EvalToken } from '../server/middleware/arc2EvalToken';
import teamEvalsRouter, {
  EVAL_OUTPUT_KEY, EVAL_RUN_KEY, MAX_RUN_BYTES, MAX_TRACE_BYTES, checkRunUpload, checkTraceUpload,
} from '../server/routes/teamEvals';
import { safeNext } from '../server/routes/teamAuth';

const TOKEN = 'e'.repeat(40);

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    locals: {} as Record<string, unknown>,
    set() { return res; },
    type() { return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; return res; },
    send(body: unknown) { res.body = body; return res; },
  };
  return res;
}

const req = (headers: Record<string, string> = {}, params: Record<string, string> = {}, body: unknown = undefined) =>
  ({ headers, params, body } as unknown as Request);

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── keys and documents ──────────────────────────────────────────────────────────────────

test('run keys: the publisher\'s lowercase names, up to 100 characters', () => {
  for (const ok of ['arc2fnx-acc-t30-k340-1021', 'a', '0run', 'run.v2_b-1', 'a'.repeat(100)]) expect(EVAL_RUN_KEY.test(ok), ok).toBe(true);
  for (const bad of ['', 'Run', '-run', '.run', '_run', 'a'.repeat(101), 'run/x', 'run key', '../x', 'run%2F']) {
    expect(EVAL_RUN_KEY.test(bad), bad).toBe(false);
  }
});

test('output keys: an 8-hex task id, an underscore and a one- or two-digit test index', () => {
  for (const ok of ['7b5033c1_0', '7b5033c1_12', '00000000_9']) expect(EVAL_OUTPUT_KEY.test(ok), ok).toBe(true);
  for (const bad of ['7B5033C1_0', '7b5033c_0', '7b5033c11_0', '7b5033c1_123', '7b5033c1-0', '7b5033c1_', 'g7b5033c_0', '7b5033c1_0 ']) {
    expect(EVAL_OUTPUT_KEY.test(bad), bad).toBe(false);
  }
});

test('a run upload must be this run\'s document, with rows, under 4 MB', () => {
  const doc = { apiVersion: 1, key: 'arc2-k340', title: 'x', rows: [], extra: { kept: true } };
  const ok = checkRunUpload('arc2-k340', doc);
  expect(ok).toEqual({ ok: true, body: JSON.stringify(doc), kind: 'accuracy' });
  expect(checkRunUpload('Arc2', { ...doc, key: 'Arc2' })).toMatchObject({ ok: false, status: 400, code: 'bad_key' });
  expect(checkRunUpload('arc2-k340', { ...doc, key: 'other' })).toMatchObject({ ok: false, status: 400, code: 'bad_document' });
  expect(checkRunUpload('arc2-k340', { key: 'arc2-k340', rows: {} })).toMatchObject({ ok: false, code: 'bad_document' });
  expect(checkRunUpload('arc2-k340', [doc])).toMatchObject({ ok: false, code: 'bad_document' });
  expect(checkRunUpload('arc2-k340', undefined)).toMatchObject({ ok: false, code: 'bad_document' });
  const big = { ...doc, notes: 'x'.repeat(MAX_RUN_BYTES) };
  expect(checkRunUpload('arc2-k340', big)).toMatchObject({ ok: false, status: 413, code: 'too_large' });
});

test('version 2 names its kind: accuracy runs carry rows, speed / kernel / profile runs carry arms', () => {
  const arms = [
    { name: 'marlin', status: 'ok', metrics: { genTokS: 448.4, stepMs: 75.8, kvTokens: null }, profile: { familiesMs: { moe: 30.1 } } },
    { name: 'triton', status: 'failed', error: 'bench check failed' },
  ];
  for (const kind of ['speed', 'kernel', 'profile']) {
    const doc = { apiVersion: 2, kind, key: 'arc2fnx-int8k', arms };
    expect(checkRunUpload('arc2fnx-int8k', doc), kind).toEqual({ ok: true, body: JSON.stringify(doc), kind });
  }
  const acc = { apiVersion: 2, kind: 'accuracy', key: 'arc2-acc', rows: [] };
  expect(checkRunUpload('arc2-acc', acc)).toMatchObject({ ok: true, kind: 'accuracy' });
  expect(checkRunUpload('arc2-acc', { ...acc, rows: undefined })).toMatchObject({ ok: false, code: 'bad_document' });

  const speed = { apiVersion: 2, kind: 'speed', key: 'arc2-s', arms };
  expect(checkRunUpload('arc2-s', { ...speed, apiVersion: 3 })).toMatchObject({ ok: false, status: 400, code: 'unsupported_version' });
  expect(checkRunUpload('arc2-s', { ...speed, apiVersion: '2' })).toMatchObject({ ok: false, code: 'unsupported_version' });
  expect(checkRunUpload('arc2-s', { ...speed, kind: undefined })).toMatchObject({ ok: false, code: 'bad_kind' });
  expect(checkRunUpload('arc2-s', { ...speed, kind: 'bench' })).toMatchObject({ ok: false, code: 'bad_kind' });
  expect(checkRunUpload('arc2-s', { ...speed, apiVersion: 1 })).toMatchObject({ ok: false, code: 'bad_kind' });
  for (const bad of [undefined, [], {}, Array.from({ length: 65 }, (_, i) => ({ name: `a${i}` })),
    [{ name: '' }], [{ name: 'x'.repeat(81) }], [{ metrics: {} }], [{ name: 'a' }, { name: 'a' }],
    [{ name: 'a', status: 'done' }], [{ name: 'a', metrics: [1] }], [{ name: 'a', metrics: { genTokS: '448' } }],
    [{ name: 'a', metrics: { genTokS: Number.NaN } }]]) {
    expect(checkRunUpload('arc2-s', { ...speed, arms: bad }), JSON.stringify(bad)).toMatchObject({ ok: false, status: 400, code: 'bad_arms' });
  }
});

test('a trace upload must be this output\'s trace, under 3 MB', () => {
  const trace = { apiVersion: 1, key: 'arc2-k340', outputKey: '7b5033c1_0', reasoning: 'r', answer: null };
  expect(checkTraceUpload('arc2-k340', '7b5033c1_0', trace)).toEqual({ ok: true, body: JSON.stringify(trace) });
  expect(checkTraceUpload('arc2-k340', '7b5033c1-0', trace)).toMatchObject({ ok: false, status: 400, code: 'bad_output' });
  expect(checkTraceUpload('arc2-k340', '7b5033c1_1', trace)).toMatchObject({ ok: false, code: 'bad_document' });
  expect(checkTraceUpload('arc2-other', '7b5033c1_0', trace)).toMatchObject({ ok: false, code: 'bad_document' });
  const big = { ...trace, reasoning: 'x'.repeat(MAX_TRACE_BYTES) };
  expect(checkTraceUpload('arc2-k340', '7b5033c1_0', big)).toMatchObject({ ok: false, status: 413, code: 'too_large' });
});

// ── the eval box's token ────────────────────────────────────────────────────────────────

test('uploads are closed while the token is unset or too short to be a secret', () => {
  for (const value of [undefined, '', 'short-token', 'x'.repeat(31)]) {
    if (value === undefined) vi.stubEnv('ARC2_EVAL_UPLOAD_TOKEN', undefined as unknown as string);
    else vi.stubEnv('ARC2_EVAL_UPLOAD_TOKEN', value);
    const res = fakeRes();
    const next = vi.fn();
    requireArc2EvalToken(req({ 'x-arc2-eval-token': value ?? 'anything' }), res as unknown as Response, next);
    expect(res.statusCode, String(value)).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: 'eval_uploads_not_configured' });
    expect(next).not.toHaveBeenCalled();
  }
});

test('a missing or wrong token gets 401; the arc3 admin token is not accepted', () => {
  vi.stubEnv('ARC2_EVAL_UPLOAD_TOKEN', TOKEN);
  vi.stubEnv('ARC3_COMMUNITY_ADMIN_TOKEN', 'a'.repeat(40));
  for (const headers of [{}, { 'x-arc2-eval-token': 'e'.repeat(39) }, { 'x-arc2-eval-token': `${TOKEN}x` },
    { 'x-arc3-admin-token': 'a'.repeat(40) }, { 'x-api-key': TOKEN }] as Array<Record<string, string>>) {
    const res = fakeRes();
    const next = vi.fn();
    requireArc2EvalToken(req(headers), res as unknown as Response, next);
    expect(res.statusCode, JSON.stringify(headers)).toBe(401);
    expect(next).not.toHaveBeenCalled();
  }
});

test('the right token passes', () => {
  vi.stubEnv('ARC2_EVAL_UPLOAD_TOKEN', TOKEN);
  const res = fakeRes();
  const next = vi.fn();
  requireArc2EvalToken(req({ 'x-arc2-eval-token': TOKEN }), res as unknown as Response, next);
  expect(next).toHaveBeenCalledOnce();
  expect(res.statusCode).toBe(200);
});

// ── the routes, end to end without the rate limiter ─────────────────────────────────────

type Handler = (req: Request, res: Response, next: (err?: unknown) => void) => unknown;
type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> } };

/** Run a route's middleware after the rate limiter, in order, until one answers. */
async function call(method: string, path: string, request: Request) {
  const layer = (teamEvalsRouter as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
  const handlers = layer!.route!.stack.slice(1).map((s) => s.handle);   // skip the rate limiter
  const res = fakeRes();
  await new Promise<void>((resolve, reject) => {
    const run = (i: number) => {
      if (i >= handlers.length) return resolve();
      let advanced = false;
      handlers[i](request, res as unknown as Response, (err?: unknown) => {
        advanced = true;
        if (err) reject(err); else run(i + 1);
      });
      // The last handler is async (asyncHandler doesn't hand back its promise): wait for its answer.
      const settle = () => (res.body !== undefined ? resolve() : advanced ? undefined : setTimeout(settle, 1));
      settle();
    };
    run(0);
  });
  return res;
}

test('machine routes check the token first, then the address and document, then storage', async () => {
  const doc = { key: 'arc2-k340', rows: [] };
  vi.stubEnv('ARC2_EVAL_UPLOAD_TOKEN', '');
  expect((await call('put', '/arc2-evals/machine/runs/:key', req({}, { key: 'arc2-k340' }, doc))).statusCode).toBe(503);

  vi.stubEnv('ARC2_EVAL_UPLOAD_TOKEN', TOKEN);
  expect((await call('put', '/arc2-evals/machine/runs/:key', req({}, { key: 'arc2-k340' }, doc))).statusCode).toBe(401);

  const auth = { 'x-arc2-eval-token': TOKEN };
  expect((await call('get', '/arc2-evals/machine/schema', req())).statusCode).toBe(401);
  const schema = await call('get', '/arc2-evals/machine/schema', req(auth));
  expect(schema.statusCode).toBe(200);
  expect(schema.body).toMatchObject({ success: true, data: { apiVersions: [1, 2], kinds: ['accuracy', 'speed', 'kernel', 'profile'] } });

  const badArms = await call('put', '/arc2-evals/machine/runs/:key', req(auth, { key: 'arc2-k340' }, { apiVersion: 2, kind: 'speed', key: 'arc2-k340', arms: [] }));
  expect(badArms.statusCode).toBe(400);
  expect(badArms.body).toMatchObject({ error: 'bad_arms' });

  const badKey = await call('put', '/arc2-evals/machine/runs/:key', req(auth, { key: 'BAD' }, doc));
  expect(badKey.statusCode).toBe(400);
  expect(badKey.body).toMatchObject({ error: 'bad_key' });

  const badOutput = await call('put', '/arc2-evals/machine/runs/:key/traces/:output',
    req(auth, { key: 'arc2-k340', output: 'nope' }, { key: 'arc2-k340', outputKey: 'nope' }));
  expect(badOutput.body).toMatchObject({ error: 'bad_output' });

  // Valid uploads reach storage; with no database connected they fail loudly, not silently.
  const run = await call('put', '/arc2-evals/machine/runs/:key', req(auth, { key: 'arc2-k340' }, doc));
  expect(run.statusCode).toBe(503);
  expect(run.body).toMatchObject({ error: 'no_database' });
  const trace = await call('put', '/arc2-evals/machine/runs/:key/traces/:output',
    req(auth, { key: 'arc2-k340', output: '7b5033c1_0' }, { key: 'arc2-k340', outputKey: '7b5033c1_0' }));
  expect(trace.statusCode).toBe(503);
  const removed = await call('delete', '/arc2-evals/machine/runs/:key', req(auth, { key: 'arc2-k340' }));
  expect(removed.statusCode).toBe(503);
});

test('the team routes need the team sign-in', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'our-client.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret');
  vi.stubEnv('TEAM_SESSION_SECRET', 'x'.repeat(48));
  vi.stubEnv('TEAM_EMAILS', 'boss@example.com');
  vi.stubEnv('ARC2_EVAL_UPLOAD_TOKEN', TOKEN);
  for (const [path, params] of [
    ['/arc2-evals', {}], ['/arc2-evals/:key', { key: 'arc2-k340' }], ['/arc2-evals/:key/traces/:output', { key: 'arc2-k340', output: '7b5033c1_0' }],
  ] as const) {
    const layer = (teamEvalsRouter as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === path && l.route.methods.get);
    const res = fakeRes();
    const next = vi.fn();
    // The eval box's token is no way in to the team pages.
    layer!.route!.stack[0].handle(req({ 'x-arc2-eval-token': TOKEN }, params), res as unknown as Response, next);
    expect(res.statusCode, path).toBe(401);
    expect(res.body).toMatchObject({ error: 'team_sign_in_required' });
    expect(next).not.toHaveBeenCalled();
  }
});

// ── back to the same output after sign-in ───────────────────────────────────────────────

test('sign-in returns to a team page, now with dots and a plain query', () => {
  for (const ok of ['/team/arc2-runs', '/team/arc2-runs/123', '/team/arc2-evals', '/team/arc2-evals/arc2fnx-acc-t30-k340-1021?o=7b5033c1_0',
    '/team/arc2-evals/run.v2?o=7b5033c1_0', '/team/']) {
    expect(safeNext(ok), ok).toBe(ok);
  }
  for (const bad of ['/team/../admin', '/team/./x', '/team//evil.example', '//evil.example', 'https://evil.example/team/x',
    '/team/x?next=//evil.example', '/team/x?u=https:x', '/team/x?q=%2F%2Fevil', '/teamx', '/admin', '/team/x#frag', 7, undefined]) {
    expect(safeNext(bad), String(bad)).toBe('/team/arc2-runs');
  }
});

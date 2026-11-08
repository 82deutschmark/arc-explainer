/*
Author: Claude Opus 5.5 Medium
Date: 08-November-2026
PURPOSE: Storage for shared review comments on special pages (Google-Docs-style comments on the
         Turducken write-up first, so Son, the Boss and other reviewers all see the same notes).
         The HTTP layer is routes/reviewComments.ts; the page is
         client/public/specials/2026-11-06-arc3-solution-draft-review.html.

         APPEND-ONLY LOG. Each document has one JSON-lines file. Every action (new comment,
         reply, resolve or reopen, delete) is appended as one event line and never rewritten, so
         two reviewers posting at the same moment cannot overwrite each other and the file is a
         full history. The current state is rebuilt from the events on every read; the files stay
         small (one line per action), so no compaction or cache is needed. A delete is a
         tombstone event: the comment disappears from the page but its text stays in the file,
         recoverable by hand.

         DURABLE ON PURPOSE. The file lives under the Railway persistent volume
         (RAILWAY_VOLUME_MOUNT_PATH/review-comments), NOT in the per-deployment specials overlay,
         which is wiped on every deploy. REVIEW_COMMENTS_ROOT overrides the location (tests, local
         runs). With neither set, storage is off and the route answers 503 so the page can say so.

         Only documents in REVIEW_DOCUMENTS can be written, so the open (no-login) write route
         cannot be used to create arbitrary files. Add an entry there to review another page.
SRP/DRY check: Pass -- storage and validation only; HTTP lives in the route. Checked
         services/specialsOverlay.ts (per-deploy, so unsuitable for durable data) and the
         repositories layer (needs a migration; a volume file is the smaller durable change).
*/

import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

/** Documents that accept comments: id -> the page under review. */
export const REVIEW_DOCUMENTS: Record<string, { title: string; page: string }> = {
  'turducken-2026-11-06': {
    title: 'Stuffing the Turducken',
    page: '/specials/2026-11-06-arc3-solution-draft.html',
  },
};

export const REVIEW_LIMITS = {
  author: 60,
  body: 5000,
  exact: 3000,
  context: 200,
  heading: 300,
  /** A log this big means something is spamming it; refuse further writes rather than fill the volume. */
  fileBytes: 8 * 1024 * 1024,
  importThreads: 1000,
};

const ID = /^[A-Za-z0-9_-]{6,64}$/;

export interface ReviewAnchor {
  /** The highlighted text exactly as selected. */
  exact: string;
  /** Up to REVIEW_LIMITS.context characters just before and after, for re-anchoring after edits. */
  prefix: string;
  suffix: string;
  /** Character offset of the quote in the article's text when it was made: a tie-breaker only. */
  start: number;
  /** Nearest heading above the quote, so an exported note says where it is. */
  heading: string;
}

export interface ReviewReply {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ReviewThread {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  anchor: ReviewAnchor;
  status: 'open' | 'resolved';
  statusBy: string | null;
  statusAt: string | null;
  replies: ReviewReply[];
}

type ReviewEvent =
  | { type: 'thread'; at: string; id: string; author: string; body: string; anchor: ReviewAnchor }
  | { type: 'reply'; at: string; id: string; threadId: string; author: string; body: string }
  | { type: 'status'; at: string; threadId: string; author: string; status: 'open' | 'resolved' }
  | { type: 'delete'; at: string; threadId: string; replyId?: string; author: string };

export class ReviewInputError extends Error {}
export class ReviewNotFoundError extends Error {}
export class ReviewStorageFullError extends Error {}

/** Folder holding one log per document, or null when no volume is configured. */
export function reviewCommentsDir(): string | null {
  const explicit = process.env.REVIEW_COMMENTS_ROOT;
  if (explicit) return path.resolve(explicit);
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return volume ? path.resolve(volume, 'review-comments') : null;
}

export function isReviewDocument(doc: unknown): doc is string {
  return typeof doc === 'string' && Object.prototype.hasOwnProperty.call(REVIEW_DOCUMENTS, doc);
}

function logPath(root: string, doc: string): string {
  // doc is always a REVIEW_DOCUMENTS key (checked by callers), never raw request text.
  return path.join(root, `${doc}.jsonl`);
}

// ---------- validation ----------

function text(value: unknown, field: string, max: number, { required = true, trim = true } = {}): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new ReviewInputError(`${field} must be text.`);
  const out = trim ? value.trim() : value;
  if (required && out.length === 0) throw new ReviewInputError(`${field} is required.`);
  if (out.length > max) throw new ReviewInputError(`${field} is longer than ${max} characters.`);
  return out;
}

function author(value: unknown): string {
  return text(value, 'author', REVIEW_LIMITS.author);
}

export function parseAnchor(value: unknown): ReviewAnchor {
  if (!value || typeof value !== 'object') throw new ReviewInputError('anchor is required.');
  const a = value as Record<string, unknown>;
  // The quote and its context are kept untrimmed: spaces are part of what re-anchoring matches.
  const exact = text(a.exact, 'anchor.exact', REVIEW_LIMITS.exact, { trim: false });
  if (exact.trim().length === 0) throw new ReviewInputError('anchor.exact is required.');
  const start = Number.isInteger(a.start) && (a.start as number) >= 0 ? (a.start as number) : 0;
  return {
    exact,
    prefix: text(a.prefix, 'anchor.prefix', REVIEW_LIMITS.context, { required: false, trim: false }),
    suffix: text(a.suffix, 'anchor.suffix', REVIEW_LIMITS.context, { required: false, trim: false }),
    start,
    heading: text(a.heading, 'anchor.heading', REVIEW_LIMITS.heading, { required: false }),
  };
}

// ---------- reading ----------

/** Replays events in order into the current threads. Bad lines and events for unknown ids are skipped. */
export function replay(events: ReviewEvent[]): ReviewThread[] {
  const threads = new Map<string, ReviewThread>();
  for (const e of events) {
    if (e.type === 'thread') {
      if (threads.has(e.id)) continue;
      threads.set(e.id, {
        id: e.id, author: e.author, body: e.body, createdAt: e.at, anchor: e.anchor,
        status: 'open', statusBy: null, statusAt: null, replies: [],
      });
      continue;
    }
    const thread = threads.get(e.threadId);
    if (!thread) continue;
    if (e.type === 'reply') {
      if (!thread.replies.some((r) => r.id === e.id)) {
        thread.replies.push({ id: e.id, author: e.author, body: e.body, createdAt: e.at });
      }
    } else if (e.type === 'status') {
      thread.status = e.status;
      thread.statusBy = e.author;
      thread.statusAt = e.at;
    } else if (e.type === 'delete') {
      if (e.replyId) thread.replies = thread.replies.filter((r) => r.id !== e.replyId);
      else threads.delete(e.threadId);
    }
  }
  return [...threads.values()];
}

async function readEvents(root: string, doc: string): Promise<ReviewEvent[]> {
  let raw: string;
  try {
    raw = await fs.promises.readFile(logPath(root, doc), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const events: ReviewEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as ReviewEvent);
    } catch {
      // A torn last line (crash mid-append) is skipped; every earlier line is still good.
    }
  }
  return events;
}

export async function listThreads(root: string, doc: string): Promise<ReviewThread[]> {
  return replay(await readEvents(root, doc));
}

// ---------- writing ----------

/** One queue per document: appends and the existence checks before them run one at a time. */
const queues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  queues.set(key, next);
  return next;
}

async function append(root: string, doc: string, events: ReviewEvent[]): Promise<void> {
  const file = logPath(root, doc);
  await fs.promises.mkdir(root, { recursive: true });
  let lead = '';
  try {
    const stats = await fs.promises.stat(file);
    if (stats.size > REVIEW_LIMITS.fileBytes) throw new ReviewStorageFullError('This document has too many comments stored.');
    if (stats.size > 0) {
      // If a crash left a torn last line, start on a fresh line so the new event is not glued onto it.
      const handle = await fs.promises.open(file, 'r');
      try {
        const last = Buffer.alloc(1);
        await handle.read(last, 0, 1, stats.size - 1);
        if (last[0] !== 0x0a) lead = '\n';
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.promises.appendFile(file, lead + events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
}

function findThread(threads: ReviewThread[], threadId: string): ReviewThread {
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) throw new ReviewNotFoundError('No such comment (it may have been deleted).');
  return thread;
}

const now = () => new Date().toISOString();

export function createThread(root: string, doc: string, input: Record<string, unknown>): Promise<ReviewThread> {
  const event = {
    type: 'thread' as const,
    at: now(),
    id: randomUUID(),
    author: author(input.author),
    body: text(input.body, 'body', REVIEW_LIMITS.body),
    anchor: parseAnchor(input.anchor),
  };
  return serialized(doc, async () => {
    await append(root, doc, [event]);
    return findThread(replay([event]), event.id);
  });
}

export function addReply(root: string, doc: string, threadId: string, input: Record<string, unknown>): Promise<ReviewThread> {
  const fields = { author: author(input.author), body: text(input.body, 'body', REVIEW_LIMITS.body) };
  return serialized(doc, async () => {
    const events = await readEvents(root, doc);
    findThread(replay(events), threadId);
    const event: ReviewEvent = { type: 'reply', at: now(), id: randomUUID(), threadId, ...fields };
    await append(root, doc, [event]);
    return findThread(replay([...events, event]), threadId);
  });
}

export function setStatus(root: string, doc: string, threadId: string, input: Record<string, unknown>): Promise<ReviewThread> {
  if (input.status !== 'open' && input.status !== 'resolved') throw new ReviewInputError('status must be open or resolved.');
  const fields = { author: author(input.author), status: input.status as 'open' | 'resolved' };
  return serialized(doc, async () => {
    const events = await readEvents(root, doc);
    findThread(replay(events), threadId);
    const event: ReviewEvent = { type: 'status', at: now(), threadId, ...fields };
    await append(root, doc, [event]);
    return findThread(replay([...events, event]), threadId);
  });
}

export function deleteItem(
  root: string, doc: string, threadId: string, replyId: string | undefined, input: Record<string, unknown>,
): Promise<void> {
  const who = author(input.author);
  return serialized(doc, async () => {
    const thread = findThread(await listThreads(root, doc), threadId);
    if (replyId && !thread.replies.some((r) => r.id === replyId)) throw new ReviewNotFoundError('No such reply.');
    await append(root, doc, [{ type: 'delete', at: now(), threadId, ...(replyId ? { replyId } : {}), author: who }]);
  });
}

/**
 * Restores threads from a page export (the JSON backup button). Threads whose id is already
 * stored are skipped, so importing the same file twice adds nothing.
 */
export function importThreads(root: string, doc: string, input: unknown): Promise<{ added: number; skipped: number }> {
  if (!Array.isArray(input)) throw new ReviewInputError('threads must be a list.');
  if (input.length > REVIEW_LIMITS.importThreads) throw new ReviewInputError('Too many threads in one import.');
  const incoming = input.map((raw, i) => {
    const t = (raw ?? {}) as Record<string, unknown>;
    if (typeof t.id !== 'string' || !ID.test(t.id)) throw new ReviewInputError(`threads[${i}].id is not a valid id.`);
    const at = typeof t.createdAt === 'string' && !Number.isNaN(Date.parse(t.createdAt)) ? new Date(t.createdAt).toISOString() : now();
    const replies = Array.isArray(t.replies) ? t.replies : [];
    return {
      thread: { type: 'thread' as const, at, id: t.id, author: author(t.author), body: text(t.body, 'body', REVIEW_LIMITS.body), anchor: parseAnchor(t.anchor) },
      replies: replies.map((r: Record<string, unknown>, j: number) => {
        if (typeof r?.id !== 'string' || !ID.test(r.id)) throw new ReviewInputError(`threads[${i}].replies[${j}].id is not a valid id.`);
        const rAt = typeof r.createdAt === 'string' && !Number.isNaN(Date.parse(r.createdAt)) ? new Date(r.createdAt).toISOString() : at;
        return { type: 'reply' as const, at: rAt, id: r.id, threadId: t.id as string, author: author(r.author), body: text(r.body, 'body', REVIEW_LIMITS.body) };
      }),
      resolved: t.status === 'resolved',
      resolver: typeof t.statusBy === 'string' && t.statusBy.trim() ? author(t.statusBy) : author(t.author),
    };
  });
  return serialized(doc, async () => {
    const known = new Set((await readEvents(root, doc)).filter((e) => e.type === 'thread').map((e) => (e as { id: string }).id));
    const events: ReviewEvent[] = [];
    let skipped = 0;
    for (const item of incoming) {
      if (known.has(item.thread.id)) { skipped += 1; continue; }
      known.add(item.thread.id);
      events.push(item.thread, ...item.replies);
      if (item.resolved) events.push({ type: 'status', at: now(), threadId: item.thread.id, author: item.resolver, status: 'resolved' });
    }
    if (events.length) await append(root, doc, events);
    return { added: incoming.length - skipped, skipped };
  });
}

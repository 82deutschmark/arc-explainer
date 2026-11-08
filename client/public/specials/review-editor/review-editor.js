/*
Author: Claude Opus 5.5 Medium
Date: 08-November-2026
PURPOSE: Google-Docs-style review layer for a special page. The review page (for now
         /specials/2026-11-06-arc3-solution-draft-review.html) is an empty shell; this script
         fetches the LIVE article page, copies in its styles and its <main>, and lets a reader
         select text, press Comment, and leave a note that every reviewer sees. Comments can be
         replied to, resolved, reopened and deleted; the author name is remembered in this browser.

         SHARED STORAGE: /api/review-comments/<doc> (server/routes/reviewComments.ts), an
         append-only log on the Railway volume. The page re-reads it every 20 seconds and when the
         tab regains focus, so other reviewers' notes appear without a reload. If that API cannot be
         reached the page says so plainly and keeps comments in this browser only; the Backup and
         Restore buttons move them to the shared store later.

         ANCHORING: a comment stores the quoted text plus up to 64 characters before and after it,
         its character position and the nearest heading. On every load the quote is looked up again
         in the article's current text: exact match (context picks among repeats) -> the same with
         whitespace differences ignored -> the text between the old before/after context (the quote
         itself was reworded) -> otherwise the comment is listed as "not found in the current text"
         with its quote. Nothing is dropped.

         EXPORT: "Export open" writes every open comment as plain text (section, quote, comment,
         replies) to copy into an agent that applies the edits. The article's wording is never
         changed by this page.

         Configured by <body data-review-doc data-review-article data-review-api>.
SRP/DRY check: Pass -- review UI only. Storage rules live in server/services/reviewComments.ts;
         the article stays the single source of its own text and styles (fetched, not copied).
*/

(() => {
  'use strict';

  const body = document.body;
  const DOC = body.dataset.reviewDoc;
  const ARTICLE_URL = body.dataset.reviewArticle;
  const API = `${body.dataset.reviewApi || '/api/review-comments'}/${encodeURIComponent(DOC)}`;
  const AUTHOR_KEY = 'rv-author';
  const LOCAL_KEY = `rv-local-${DOC}`;
  const CONTEXT = 64;
  const POLL_MS = 20000;

  const state = {
    threads: [],
    shared: true,
    filter: 'open',
    activeId: null,
    pending: null, // { anchor, range: {start,end} } while the composer is open
    drafts: new Map(), // threadId -> unsent reply text, kept across re-renders
    signature: '',
    resolved: new Map(), // threadId -> { start, end, mode } or null (not found)
  };

  let articleRoot = null; // the article's <main>, inside #rv-article
  let index = null; // { nodes, starts, text }

  // ---------- small DOM helpers ----------

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  const $ = (sel) => document.querySelector(sel);
  const author = () => ($('#rv-author').value || '').trim();

  function when(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function setStatus(message, bad = false) {
    const node = $('#rv-status');
    node.textContent = message;
    node.classList.toggle('rv-bad', bad);
  }

  function banner(message) {
    const node = $('#rv-banner');
    node.hidden = !message;
    node.textContent = message || '';
  }

  // ---------- storage: shared API, or this browser as a fallback ----------

  async function api(method, path, payload) {
    const res = await fetch(API + path, {
      method,
      headers: payload ? { 'Content-Type': 'application/json' } : {},
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok || !json || !json.success) {
      const error = new Error((json && json.message) || `The server answered ${res.status}.`);
      error.status = res.status;
      throw error;
    }
    return json.data;
  }

  const local = {
    read() {
      try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
    },
    write(threads) { localStorage.setItem(LOCAL_KEY, JSON.stringify(threads)); },
    id() { return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; },
  };

  const store = {
    async list() {
      try {
        const data = await api('GET', '');
        state.shared = true;
        return data.threads;
      } catch (error) {
        state.shared = false;
        return local.read();
      }
    },
    async create(anchor, text) {
      if (state.shared) return api('POST', '/threads', { author: author(), body: text, anchor });
      const threads = local.read();
      threads.push({ id: local.id(), author: author(), body: text, anchor, createdAt: new Date().toISOString(), status: 'open', statusBy: null, statusAt: null, replies: [] });
      local.write(threads);
    },
    async reply(id, text) {
      if (state.shared) return api('POST', `/threads/${encodeURIComponent(id)}/replies`, { author: author(), body: text });
      this.editLocal(id, (t) => t.replies.push({ id: local.id(), author: author(), body: text, createdAt: new Date().toISOString() }));
    },
    async status(id, status) {
      if (state.shared) return api('PATCH', `/threads/${encodeURIComponent(id)}`, { author: author(), status });
      this.editLocal(id, (t) => { t.status = status; t.statusBy = author(); t.statusAt = new Date().toISOString(); });
    },
    async remove(id, replyId) {
      const path = `/threads/${encodeURIComponent(id)}${replyId ? `/replies/${encodeURIComponent(replyId)}` : ''}`;
      if (state.shared) return api('DELETE', path, { author: author() });
      if (replyId) this.editLocal(id, (t) => { t.replies = t.replies.filter((r) => r.id !== replyId); });
      else local.write(local.read().filter((t) => t.id !== id));
    },
    async restore(threads) {
      if (state.shared) return api('POST', '/import', { threads });
      const mine = local.read();
      const known = new Set(mine.map((t) => t.id));
      const fresh = threads.filter((t) => t && t.id && !known.has(t.id));
      local.write(mine.concat(fresh));
      return { added: fresh.length, skipped: threads.length - fresh.length };
    },
    editLocal(id, change) {
      const threads = local.read();
      const thread = threads.find((t) => t.id === id);
      if (thread) change(thread);
      local.write(threads);
    },
  };

  // ---------- the article's text, as one string with a map back to text nodes ----------

  function buildIndex() {
    const nodes = [];
    const starts = [];
    let text = '';
    const walker = document.createTreeWalker(articleRoot, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (parent && parent.closest('script, style, noscript')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
      starts.push(text.length);
      text += walker.currentNode.nodeValue;
    }
    index = { nodes, starts, text };
  }

  /** A DOM boundary point -> character offset in index.text. */
  function pointToOffset(container, offset) {
    if (container.nodeType === Node.TEXT_NODE) {
      const i = index.nodes.indexOf(container);
      if (i >= 0) return index.starts[i] + Math.min(offset, container.nodeValue.length);
    }
    const probe = document.createRange();
    probe.setStart(container, offset);
    for (let i = 0; i < index.nodes.length; i += 1) {
      // First text node that starts at or after the boundary.
      if (probe.comparePoint(index.nodes[i], 0) >= 0) return index.starts[i];
    }
    return index.text.length;
  }

  function headingBefore(node) {
    let found = '';
    for (const h of articleRoot.querySelectorAll('h1, h2, h3, h4')) {
      if (h === node || (h.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) found = h.textContent.trim();
      else break;
    }
    return found;
  }

  function nodeAt(offset) {
    let lo = 0;
    let hi = index.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (index.starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return index.nodes[lo];
  }

  /** The current selection inside the article -> an anchor, or null. */
  function selectionAnchor() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!articleRoot.contains(range.commonAncestorContainer)) return null;
    let start = pointToOffset(range.startContainer, range.startOffset);
    let end = pointToOffset(range.endContainer, range.endOffset);
    // Leading and trailing spaces in a drag-selection are noise; keep the words.
    while (start < end && /\s/.test(index.text[start])) start += 1;
    while (end > start && /\s/.test(index.text[end - 1])) end -= 1;
    if (end <= start) return null;
    const exact = index.text.slice(start, end);
    if (exact.length > 3000) return { tooLong: true };
    return {
      anchor: {
        exact,
        prefix: index.text.slice(Math.max(0, start - CONTEXT), start),
        suffix: index.text.slice(end, end + CONTEXT),
        start,
        heading: headingBefore(nodeAt(start)),
      },
      range: { start, end },
    };
  }

  // ---------- re-anchoring ----------

  /** Whitespace-collapsed copy of a string with, for each kept character, its index in the original. */
  function collapse(source) {
    let out = '';
    const map = [];
    let lastSpace = false;
    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (/\s/.test(ch)) {
        if (lastSpace) continue;
        lastSpace = true;
        out += ' ';
      } else {
        lastSpace = false;
        out += ch;
      }
      map.push(i);
    }
    map.push(source.length);
    return { text: out, map };
  }

  function sharedTail(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
    return n;
  }

  function sharedHead(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
    return n;
  }

  function occurrences(haystack, needle) {
    const hits = [];
    if (!needle) return hits;
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      hits.push(at);
      at = haystack.indexOf(needle, at + 1);
    }
    return hits;
  }

  /** Best of several hits: most surrounding context in common, then nearest the old position. */
  function bestHit(hits, haystack, length, prefix, suffix, near) {
    let best = null;
    for (const at of hits) {
      const score = sharedTail(haystack.slice(Math.max(0, at - prefix.length), at), prefix)
        + sharedHead(haystack.slice(at + length, at + length + suffix.length), suffix);
      const distance = Math.abs(at - near);
      if (!best || score > best.score || (score === best.score && distance < best.distance)) best = { at, score, distance };
    }
    return best ? best.at : null;
  }

  function locate(anchor) {
    const text = index.text;
    const exactHits = occurrences(text, anchor.exact);
    if (exactHits.length) {
      const at = bestHit(exactHits, text, anchor.exact.length, anchor.prefix, anchor.suffix, anchor.start);
      return { start: at, end: at + anchor.exact.length, mode: at === anchor.start ? 'same' : 'moved' };
    }

    // Same words, different spacing or line breaks.
    const hay = collapse(text);
    const needle = collapse(anchor.exact).text.trim();
    const pre = collapse(anchor.prefix).text;
    const suf = collapse(anchor.suffix).text;
    const nearC = hay.map.findIndex((orig) => orig >= anchor.start);
    const spacedHits = occurrences(hay.text, needle);
    if (needle && spacedHits.length) {
      const at = bestHit(spacedHits, hay.text, needle.length, pre, suf, nearC);
      return { start: hay.map[at], end: hay.map[at + needle.length - 1] + 1, mode: 'moved' };
    }

    // The quote itself was reworded: find the old surrounding text and take what is between.
    const preKey = pre.trimStart().slice(-32);
    const sufKey = suf.trimEnd().slice(0, 32);
    if (preKey.length >= 12 && sufKey.length >= 12) {
      const maxGap = Math.max(needle.length * 3, needle.length + 200);
      let best = null;
      for (const p of occurrences(hay.text, preKey)) {
        const from = p + preKey.length;
        const s = hay.text.indexOf(sufKey, from);
        if (s === -1 || s - from > maxGap) continue;
        let a = from;
        let b = s;
        while (a < b && hay.text[a] === ' ') a += 1;
        while (b > a && hay.text[b - 1] === ' ') b -= 1;
        if (b <= a) continue;
        const distance = Math.abs(p - nearC);
        if (!best || distance < best.distance) best = { a, b, distance };
      }
      if (best) return { start: hay.map[best.a], end: hay.map[best.b - 1] + 1, mode: 'edited' };
    }
    return null;
  }

  // ---------- highlights ----------

  function clearHighlights() {
    const parents = new Set();
    for (const mark of articleRoot.querySelectorAll('mark.rv-hl')) {
      parents.add(mark.parentNode);
      mark.replaceWith(...mark.childNodes);
    }
    // Rejoin the split text nodes so the article's text nodes are as parsed again.
    for (const parent of parents) if (parent.isConnected) parent.normalize();
  }

  /**
   * Wraps every highlighted stretch in <mark>. All stretches are worked out first against the
   * pristine text nodes, then each text node is split once, so overlapping comments simply share
   * a mark (data-threads lists both) and no offset is invalidated mid-way.
   */
  function applyHighlights(spans) {
    const perNode = new Map();
    for (const span of spans) {
      for (let i = 0; i < index.nodes.length; i += 1) {
        const nodeStart = index.starts[i];
        const nodeEnd = nodeStart + index.nodes[i].nodeValue.length;
        if (nodeEnd <= span.start) continue;
        if (nodeStart >= span.end) break;
        const list = perNode.get(i) || [];
        list.push({ from: Math.max(span.start, nodeStart) - nodeStart, to: Math.min(span.end, nodeEnd) - nodeStart, span });
        perNode.set(i, list);
      }
    }
    for (const [i, pieces] of perNode) {
      const node = index.nodes[i];
      const value = node.nodeValue;
      const cuts = new Set([0, value.length]);
      for (const p of pieces) { cuts.add(p.from); cuts.add(p.to); }
      const points = [...cuts].sort((a, b) => a - b);
      const parts = [];
      for (let k = 0; k < points.length - 1; k += 1) {
        const a = points[k];
        const b = points[k + 1];
        const chunk = value.slice(a, b);
        const covering = pieces.filter((p) => p.from <= a && p.to >= b).map((p) => p.span);
        // Whitespace-only text between block elements is left alone so layout never shifts.
        if (!covering.length || !chunk.trim()) { parts.push(document.createTextNode(chunk)); continue; }
        const mark = el('mark', { class: 'rv-hl', 'data-threads': covering.map((s) => s.id).join(' ') }, chunk);
        if (covering.every((s) => s.pending)) mark.classList.add('rv-pending');
        else if (covering.every((s) => s.resolved)) mark.classList.add('rv-resolved');
        if (covering.length > 1) mark.classList.add('rv-multi');
        parts.push(mark);
      }
      node.replaceWith(...parts);
    }
  }

  function visible(thread) {
    if (state.filter === 'all') return true;
    return state.filter === 'resolved' ? thread.status === 'resolved' : thread.status !== 'resolved';
  }

  function renderHighlights() {
    clearHighlights();
    buildIndex();
    state.resolved = new Map();
    const spans = [];
    for (const thread of state.threads) {
      const hit = locate(thread.anchor || { exact: '', prefix: '', suffix: '', start: 0 });
      state.resolved.set(thread.id, hit);
      if (hit && visible(thread)) spans.push({ id: thread.id, start: hit.start, end: hit.end, resolved: thread.status === 'resolved' });
    }
    if (state.pending) spans.push({ id: 'pending', start: state.pending.range.start, end: state.pending.range.end, pending: true });
    applyHighlights(spans);
    // Splitting replaced some text nodes; re-read them (the text itself is unchanged, so every offset still holds).
    buildIndex();
    markActive();
  }

  function markActive() {
    for (const mark of articleRoot.querySelectorAll('mark.rv-hl')) {
      mark.classList.toggle('rv-active', !!state.activeId && mark.dataset.threads.split(' ').includes(state.activeId));
    }
    for (const card of document.querySelectorAll('.rv-card[data-id]')) card.classList.toggle('rv-active', card.dataset.id === state.activeId);
  }

  function focusThread(id, { scrollArticle = false, scrollPanel = false } = {}) {
    state.activeId = id;
    markActive();
    if (scrollPanel) {
      const card = document.querySelector(`.rv-card[data-id="${CSS.escape(id)}"]`);
      if (card) card.scrollIntoView({ block: 'nearest' });
      openPanel();
    }
    if (scrollArticle) {
      const mark = [...articleRoot.querySelectorAll('mark.rv-hl')].find((m) => m.dataset.threads.split(' ').includes(id));
      if (mark) mark.scrollIntoView({ block: 'center' });
    }
  }

  // ---------- panel ----------

  function openPanel() { $('#rv-panel').classList.add('rv-open'); }

  function message(entry, onDelete) {
    return el('div', { class: 'rv-msg' },
      el('div', { class: 'rv-meta' },
        el('b', { text: entry.author }),
        el('time', { datetime: entry.createdAt, text: when(entry.createdAt) }),
        onDelete ? el('button', { class: 'rv-x', type: 'button', title: 'Delete this reply', onclick: (e) => { e.stopPropagation(); onDelete(); } }, 'delete') : null),
      el('div', { class: 'rv-text', text: entry.body }));
  }

  function needName() {
    if (author()) return false;
    const input = $('#rv-author');
    input.focus();
    setStatus('Type your name first (top bar).', true);
    return true;
  }

  async function act(label, work) {
    try {
      setStatus(`${label}…`);
      await work();
      await refresh(true);
      setStatus(state.shared ? 'Saved for everyone' : 'Saved in this browser only', !state.shared);
    } catch (error) {
      setStatus(`${label} failed: ${error.message}`, true);
    }
  }

  function threadCard(thread) {
    const hit = state.resolved.get(thread.id);
    const resolved = thread.status === 'resolved';
    const classes = ['rv-card', resolved ? 'rv-resolved' : '', hit ? '' : 'rv-orphan', thread.id === state.activeId ? 'rv-active' : ''].filter(Boolean).join(' ');
    const quote = thread.anchor.exact.length > 280 ? `${thread.anchor.exact.slice(0, 280)}…` : thread.anchor.exact;

    const draft = el('textarea', { class: 'rv-input', rows: '2', placeholder: 'Reply…', 'data-reply': thread.id });
    draft.value = state.drafts.get(thread.id) || '';
    draft.classList.toggle('rv-filled', !!draft.value);
    draft.addEventListener('input', () => { state.drafts.set(thread.id, draft.value); draft.classList.toggle('rv-filled', !!draft.value); });
    draft.addEventListener('click', (e) => e.stopPropagation());
    const sendReply = () => {
      const text = draft.value.trim();
      if (!text || needName()) return;
      act('Replying', async () => { await store.reply(thread.id, text); state.drafts.delete(thread.id); });
    };
    draft.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); });

    return el('div', {
      class: classes,
      'data-id': thread.id,
      onclick: () => focusThread(thread.id, { scrollArticle: true }),
    },
    el('div', { class: 'rv-quote', text: quote }),
    thread.anchor.heading ? el('div', { class: 'rv-where', text: thread.anchor.heading }) : null,
    hit && hit.mode === 'edited' ? el('div', { class: 'rv-note', text: 'The quoted words have changed since this comment; the highlight shows what is there now.' }) : null,
    message(thread, null),
    thread.replies.map((reply) => message(reply, () => {
      if (!confirm('Delete this reply for everyone?') || needName()) return;
      act('Deleting reply', () => store.remove(thread.id, reply.id));
    })),
    resolved ? el('div', { class: 'rv-where', text: `Resolved by ${thread.statusBy || 'someone'} · ${when(thread.statusAt)}` }) : null,
    el('div', { class: 'rv-reply' }, draft,
      el('div', { class: 'rv-actions' },
        el('button', { class: 'rv-btn rv-quiet', type: 'button', onclick: (e) => {
          e.stopPropagation();
          if (needName()) return;
          act(resolved ? 'Reopening' : 'Resolving', () => store.status(thread.id, resolved ? 'open' : 'resolved'));
        } }, resolved ? 'Reopen' : 'Resolve'),
        el('button', { class: 'rv-btn rv-quiet rv-danger', type: 'button', onclick: (e) => {
          e.stopPropagation();
          if (!confirm('Delete this comment and its replies for everyone?') || needName()) return;
          act('Deleting', () => store.remove(thread.id));
        } }, 'Delete'),
        el('span', { class: 'rv-grow' }),
        el('button', { class: 'rv-btn', type: 'button', onclick: (e) => { e.stopPropagation(); sendReply(); } }, 'Reply'))));
  }

  function composerCard() {
    const { anchor } = state.pending;
    const box = el('textarea', { class: 'rv-input', rows: '4', placeholder: 'Your comment…', id: 'rv-new-body' });
    box.value = state.pending.draft || '';
    box.addEventListener('input', () => { state.pending.draft = box.value; });
    const save = () => {
      const text = box.value.trim();
      if (!text || needName()) return;
      act('Saving', async () => {
        await store.create(anchor, text);
        state.pending = null;
      });
    };
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
      if (e.key === 'Escape') cancelPending();
    });
    return el('div', { class: 'rv-card rv-composer' },
      el('div', { class: 'rv-quote', text: anchor.exact.length > 280 ? `${anchor.exact.slice(0, 280)}…` : anchor.exact }),
      anchor.heading ? el('div', { class: 'rv-where', text: anchor.heading }) : null,
      box,
      el('div', { class: 'rv-actions' },
        el('span', { class: 'rv-where', text: 'Ctrl/⌘ + Enter to save' }),
        el('span', { class: 'rv-grow' }),
        el('button', { class: 'rv-btn rv-quiet', type: 'button', onclick: cancelPending }, 'Cancel'),
        el('button', { class: 'rv-btn rv-primary', type: 'button', onclick: save }, 'Comment')));
  }

  function renderPanel() {
    const list = $('#rv-list');
    const focused = document.activeElement;
    const refocus = focused && focused.dataset && focused.dataset.reply ? focused.dataset.reply : (focused && focused.id === 'rv-new-body' ? 'new' : null);
    const scroll = list.scrollTop;
    list.replaceChildren();

    if (state.pending) list.append(composerCard());

    const shown = state.threads.filter(visible);
    const anchored = shown.filter((t) => state.resolved.get(t.id)).sort((a, b) => state.resolved.get(a.id).start - state.resolved.get(b.id).start);
    const orphans = shown.filter((t) => !state.resolved.get(t.id));

    if (!anchored.length && !orphans.length && !state.pending) {
      list.append(el('div', { class: 'rv-empty', text: state.filter === 'resolved'
        ? 'No resolved comments.'
        : 'No comments yet. Select some text in the article, then press Comment.' }));
    }
    anchored.forEach((t) => list.append(threadCard(t)));
    if (orphans.length) {
      list.append(el('div', { class: 'rv-section' }, 'Not found in the current text',
        el('small', { text: 'The words these comments point at were changed or removed. The comment and its quote are kept.' })));
      orphans.forEach((t) => list.append(threadCard(t)));
    }

    const open = state.threads.filter((t) => t.status !== 'resolved').length;
    $('#rv-tab-open').textContent = `Open (${open})`;
    $('#rv-tab-resolved').textContent = `Resolved (${state.threads.length - open})`;
    $('#rv-toggle').textContent = `Comments (${open})`;

    list.scrollTop = scroll;
    if (refocus === 'new') { const box = $('#rv-new-body'); if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); } }
    else if (refocus) { const box = list.querySelector(`textarea[data-reply="${CSS.escape(refocus)}"]`); if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); } }
  }

  function render() {
    renderHighlights();
    renderPanel();
  }

  async function refresh(force = false) {
    const threads = await store.list();
    banner(state.shared ? '' : 'Shared comment storage cannot be reached right now, so new comments are saved in this browser only and other reviewers will not see them. Use Backup, then Restore once it is back.');
    const signature = JSON.stringify(threads);
    if (!force && signature === state.signature) return;
    state.signature = signature;
    state.threads = threads;
    render();
  }

  // ---------- selecting text -> Comment ----------

  const addButton = () => $('#rv-add');

  function placeAddButton() {
    const button = addButton();
    const picked = articleRoot && selectionAnchor();
    if (!picked || picked.tooLong) {
      button.classList.remove('rv-on');
      if (picked && picked.tooLong) setStatus('That selection is too long to comment on; pick a shorter passage.', true);
      return;
    }
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    button.style.top = `${window.scrollY + rect.bottom + 8}px`;
    button.style.left = `${Math.max(8, Math.min(window.scrollX + rect.right - 40, document.documentElement.clientWidth - 110))}px`;
    button.classList.add('rv-on');
  }

  function startComment() {
    const picked = selectionAnchor();
    addButton().classList.remove('rv-on');
    if (!picked || picked.tooLong) return;
    state.pending = { anchor: picked.anchor, range: picked.range, draft: state.pending ? state.pending.draft : '' };
    window.getSelection().removeAllRanges();
    state.filter = state.filter === 'resolved' ? 'open' : state.filter;
    syncTabs();
    render();
    openPanel();
    $('#rv-list').scrollTop = 0;
    const box = $('#rv-new-body');
    if (box) box.focus();
    if (!author()) setStatus('Type your name in the top bar before saving.', true);
  }

  function cancelPending() {
    state.pending = null;
    render();
  }

  // ---------- export, backup, restore ----------

  function exportText() {
    const open = state.threads.filter((t) => t.status !== 'resolved');
    const placed = open.filter((t) => state.resolved.get(t.id)).sort((a, b) => state.resolved.get(a.id).start - state.resolved.get(b.id).start);
    const lost = open.filter((t) => !state.resolved.get(t.id));
    const title = document.title.replace(/^Review:\s*/, '');
    const lines = [
      `Open review comments on "${title}"`,
      `Article: ${new URL(ARTICLE_URL, location.href).href}`,
      `Exported ${new Date().toLocaleString()} · ${open.length} open comment${open.length === 1 ? '' : 's'}`,
      'Each item gives the section, the exact quoted text from the article, then the comment and any replies.',
      '',
    ];
    const item = (t, n) => {
      const hit = state.resolved.get(t.id);
      const current = hit ? index.text.slice(hit.start, hit.end) : null;
      lines.push(`${n}. Section: ${t.anchor.heading || '(top of the article)'}`);
      lines.push(`   Quote: "${t.anchor.exact.replace(/\s+/g, ' ')}"`);
      if (hit && hit.mode === 'edited') lines.push(`   (Those words have since changed; the article now reads: "${current.replace(/\s+/g, ' ')}")`);
      lines.push(`   ${t.author}: ${t.body.replace(/\n/g, '\n   ')}`);
      for (const r of t.replies) lines.push(`   Reply from ${r.author}: ${r.body.replace(/\n/g, '\n   ')}`);
      lines.push('');
    };
    placed.forEach((t, i) => item(t, i + 1));
    if (lost.length) {
      lines.push('Comments whose quoted text is no longer in the article (they may already be done):', '');
      lost.forEach((t, i) => item(t, placed.length + i + 1));
    }
    if (!open.length) lines.push('No open comments.');
    return lines.join('\n');
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showExport() {
    const dialog = $('#rv-export');
    const area = dialog.querySelector('textarea');
    area.value = exportText();
    dialog.showModal();
    area.focus();
    area.select();
  }

  function backup() {
    const payload = { document: DOC, article: ARTICLE_URL, exportedAt: new Date().toISOString(), threads: state.threads };
    download(`${DOC}-comments-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  async function restore(file) {
    let threads;
    try {
      const data = JSON.parse(await file.text());
      threads = Array.isArray(data) ? data : data.threads;
      if (!Array.isArray(threads)) throw new Error('no comment list in that file');
    } catch (error) {
      setStatus(`Restore failed: ${error.message}`, true);
      return;
    }
    // Comments first made in this browser while the server was away carry local ids; give them server-safe ones.
    threads = threads.map((t) => ({ ...t, id: String(t.id).replace(/[^A-Za-z0-9_-]/g, '-'), replies: (t.replies || []).map((r) => ({ ...r, id: String(r.id).replace(/[^A-Za-z0-9_-]/g, '-') })) }));
    let result = null;
    await act('Restoring', async () => { result = await store.restore(threads); });
    if (result) setStatus(`Restored ${result.added}, ${result.skipped} were already there`);
  }

  // ---------- startup ----------

  function syncTabs() {
    for (const tab of document.querySelectorAll('.rv-tab')) tab.classList.toggle('rv-on', tab.dataset.filter === state.filter);
  }

  async function loadArticle() {
    const res = await fetch(ARTICLE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`the article answered ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const main = doc.querySelector('main');
    if (!main) throw new Error('the article has no main section');
    // The article's own styles go in ahead of this editor's stylesheet, so its look is unchanged
    // and the rv- rules still win where they overlap.
    const ours = document.querySelector('link[data-rv-css]');
    for (const style of doc.head.querySelectorAll('style')) document.head.insertBefore(document.importNode(style, true), ours);
    const title = doc.querySelector('title');
    if (title) {
      document.title = `Review: ${title.textContent}`;
      $('#rv-doc-title').textContent = `Review: ${title.textContent.split('—')[0].trim()}`;
    }
    for (const script of main.querySelectorAll('script')) script.remove();
    articleRoot = document.importNode(main, true);
    $('#rv-article').replaceWith(articleRoot);
    articleRoot.id = 'rv-article';
  }

  function wire() {
    const nameInput = $('#rv-author');
    nameInput.value = localStorage.getItem(AUTHOR_KEY) || '';
    nameInput.addEventListener('input', () => {
      localStorage.setItem(AUTHOR_KEY, nameInput.value.trim());
      if (nameInput.value.trim()) setStatus(state.shared ? 'Comments are shared' : 'This browser only', !state.shared);
    });

    document.addEventListener('mouseup', (e) => { if (!e.target.closest('.rv-add, .rv-panel, .rv-bar')) setTimeout(placeAddButton, 0); });
    document.addEventListener('keyup', (e) => { if (e.shiftKey || (e.key || '').startsWith('Arrow')) placeAddButton(); });
    let touchTimer = null;
    document.addEventListener('selectionchange', () => {
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => {
        if (window.getSelection().isCollapsed) addButton().classList.remove('rv-on');
        else if (matchMedia('(pointer: coarse)').matches) placeAddButton();
      }, 250);
    });
    // mousedown keeps the selection alive until the click lands.
    addButton().addEventListener('mousedown', (e) => e.preventDefault());
    addButton().addEventListener('click', startComment);

    articleRoot.addEventListener('click', (e) => {
      const mark = e.target.closest('mark.rv-hl');
      if (!mark || mark.classList.contains('rv-pending') || !window.getSelection().isCollapsed) return;
      const ids = mark.dataset.threads.split(' ');
      // Clicking an overlap again cycles through the comments that share it.
      const next = ids[(ids.indexOf(state.activeId) + 1) % ids.length];
      focusThread(next, { scrollPanel: true });
    });

    for (const tab of document.querySelectorAll('.rv-tab')) {
      tab.addEventListener('click', () => { state.filter = tab.dataset.filter; syncTabs(); render(); });
    }
    $('#rv-toggle').addEventListener('click', () => $('#rv-panel').classList.toggle('rv-open'));
    $('#rv-panel-close').addEventListener('click', () => $('#rv-panel').classList.remove('rv-open'));
    $('#rv-export-btn').addEventListener('click', showExport);
    $('#rv-backup-btn').addEventListener('click', backup);
    $('#rv-restore-btn').addEventListener('click', () => $('#rv-restore-file').click());
    $('#rv-restore-file').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); });

    const dialog = $('#rv-export');
    dialog.querySelector('[data-copy]').addEventListener('click', async () => {
      const area = dialog.querySelector('textarea');
      try { await navigator.clipboard.writeText(area.value); setStatus('Copied the open comments'); }
      catch { area.select(); document.execCommand('copy'); setStatus('Copied the open comments'); }
    });
    dialog.querySelector('[data-download]').addEventListener('click', () => download(`${DOC}-open-comments.txt`, dialog.querySelector('textarea').value, 'text/plain'));
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());

    const poll = () => { if (document.visibilityState === 'visible') refresh().catch(() => {}); };
    setInterval(poll, POLL_MS);
    window.addEventListener('focus', poll);
  }

  async function start() {
    try {
      await loadArticle();
    } catch (error) {
      $('#rv-article').textContent = `Could not load the article: ${error.message}. Reload to try again.`;
      setStatus('Article not loaded', true);
      return;
    }
    wire();
    syncTabs();
    await refresh(true);
    setStatus(state.shared ? 'Comments are shared' : 'This browser only', !state.shared);
    // A link like ...review.html#c=<id> opens straight onto one comment.
    const wanted = new URLSearchParams(location.hash.slice(1)).get('c');
    if (wanted && state.threads.some((t) => t.id === wanted)) focusThread(wanted, { scrollArticle: true, scrollPanel: true });
  }

  start();
})();

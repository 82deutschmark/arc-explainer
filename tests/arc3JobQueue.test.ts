/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-19
 * PURPOSE: Guard /arc3/jobs (the ARC-3 team's GPU job queue): the public overview renders jobs and busy boxes
 *          with no money, boxes or log on the page; the team details (spend, costs, boxes, dispatcher log)
 *          appear only once a queue view password is held; progress wording for both job kinds.
 * SRP/DRY check: Pass — exercises the real page and queueData helpers with in-memory query cache data, like
 *          tests/kaggleLeaderboard.test.ts.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Router } from 'wouter';
import { afterEach, expect, test, vi } from 'vitest';
import Arc3JobQueue from '../client/src/pages/Arc3JobQueue';
import { shardProgress, type QueueDoc, type QueueJob } from '../client/src/components/arc3Jobs/queueData';

const NOW = new Date().toISOString();

const boxJob: QueueJob = {
  id: 'a1', user: 'jack', client_key: 'exp042-lr3e-5', kind: 'box', machine: 'l4x4',
  what: 'exp/train.py · 6 h limit · network off', status: 'running', created_at: NOW,
  shards: [{ k: 0, status: 'running', attempt: 2, files: 14, preemptions: 1 }],
};
const evalJob: QueueJob = {
  id: 'b2', user: 'keith', client_key: 'grpo7-step0120-eval', kind: 'eq32', machine: 'g4',
  what: '32-equal × 2 plays · 151 min · eq32-all4 · LoRA', status: 'queued', created_at: NOW,
  shards: [{ k: 0, status: 'pending', preemptions: 0 }, { k: 1, status: 'pending', preemptions: 0 }],
};
const publicDoc: QueueDoc = {
  generated_at: NOW, paused: false, public: true,
  machines: { g4: { label: '1x RTX PRO 6000', live: 0, max_vms: 8 }, l4x4: { label: '4x L4', live: 1, max_vms: 4 } },
  jobs: [boxJob, evalJob],
};
const fullDoc: QueueDoc = {
  ...publicDoc, public: undefined,
  machines: { ...publicDoc.machines, l4x4: { ...publicDoc.machines.l4x4, price_per_vm_hour: 2.4 } },
  jobs: [{ ...boxJob, cost_usd: 3.21, est_usd: 15.32,
           shards: [{ ...boxJob.shards[0], zone: 'us-east1-c', gpu: [[97, 20000], [95, 20100]], log_tail: ['step 1200 loss 0.41'] }] },
         { ...evalJob, cost_usd: 0, est_usd: 11.02 }],
  users: { jack: { spend_today_usd: 3.21, cap_usd: 100, max_vms: 4, kinds: ['box'], live: 1 } },
  vms: [{ name: 'arc3-kjob-a1-s0-a2', zone: 'us-east1-c', status: 'RUNNING', machine: 'l4x4', user: 'jack', created: NOW }],
  log: ['2026-10-19T15:00:00Z launched arc3-kjob-a1-s0-a2 in us-east1-c'],
};

function render(password: string | null) {
  vi.stubGlobal('React', React);
  vi.stubGlobal('sessionStorage', { getItem: () => password, setItem: () => undefined, removeItem: () => undefined });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['arc3-jobs-queue', 'public'], publicDoc);
  if (password) client.setQueryData(['arc3-jobs-queue', 'full', password], fullDoc);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(HelmetProvider, {}, createElement(Router, { ssrPath: '/arc3/jobs', children: createElement(Arc3JobQueue) }))));
}
afterEach(() => vi.unstubAllGlobals());

test('the public overview shows jobs and busy boxes, and nothing behind the password', () => {
  const html = render(null);
  expect(html).toContain('ARC-3 job queue');
  expect(html).toContain('exp042-lr3e-5');
  expect(html).toContain('try 2 · 14 output files · preempted once');
  expect(html).toContain('4x L4 boxes');
  expect(html).toContain('Queue view password');
  for (const hidden of ['Dispatcher log', '$3.21', 'us-east1-c', 'arc3-kjob-', 'step 1200', 'Daily cap']) {
    expect(html).not.toContain(hidden);
  }
});

test('with the password the team details appear and the form goes away', () => {
  const html = render('qv_test');
  expect(html).toContain('Dispatcher log');
  expect(html).toContain('$3.21');
  expect(html).toContain('arc3-kjob-a1-s0-a2');
  expect(html).toContain('step 1200 loss 0.41');
  expect(html).not.toContain('Queue view password');
});

test('progress wording for both job kinds', () => {
  expect(shardProgress(evalJob, { k: 1, status: 'running', attempt: 1, minute: 34.4, moving: 32 }))
    .toBe('play 2 · try 1 · minute 34 · 32 plays moving');
  expect(shardProgress(evalJob, { k: 0, status: 'pending', launch_error: 'daily cap $200 reached (New York day)' }))
    .toBe('play 1 · waiting: daily cap $200 reached (New York day)');
  expect(shardProgress(boxJob, { k: 0, status: 'running', attempt: 1, zone: 'us-east4-a', gpu: [[90, 1], [100, 1]] }))
    .toBe('try 1 · us-east4-a · GPU 95%');
  expect(shardProgress(boxJob, { k: 0, status: 'done', outcome: 'exited (exit 0)', preemptions: 3 }))
    .toBe('exited (exit 0) · preempted 3 times');
});

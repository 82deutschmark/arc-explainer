/**
 * Author: Codex (GPT-5)
 * Date: 2025-11-26
 * PURPOSE: Poll existing Poetiq session IDs until they finish so we can report results.
 */

const API_BASE = 'http://localhost:5000';
const POLL_INTERVAL_MS = 6000;

const sessions = [
  { puzzleId: '2ba387bc', sessionId: '0a2fb293-39c7-4bac-9a87-634c51b35a24' },
  { puzzleId: '3a25b0d8', sessionId: 'fab59a9a-b98b-4235-8142-886663b2f019' },
  { puzzleId: '4c7dc4dd', sessionId: 'befb8035-f1ba-4e48-8e29-0015c93ec5d3' },
  { puzzleId: '8f3a5a89', sessionId: '8b11a5c4-3083-422c-91d5-f2c879ae8298' },
  { puzzleId: '9385bd28', sessionId: 'da16d4d0-08fd-475b-a256-78cbd6902798' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollSession(entry) {
  const response = await fetch(`${API_BASE}/api/poetiq/status/${entry.sessionId}`);
  if (!response.ok) {
    throw new Error(`Status ${response.status}`);
  }
  const payload = await response.json();
  return payload?.data?.snapshot;
}

(async function main() {
  console.log('Polling existing Poetiq sessions…');
  const statusMap = new Map();

  let pending = sessions.length;
  while (pending > 0) {
    for (const entry of sessions) {
      if (statusMap.get(entry.sessionId)?.done) {
        continue;
      }

      process.stdout.write(`Checking ${entry.puzzleId} (${entry.sessionId})… `);
      try {
        const snapshot = await pollSession(entry);
        const status = snapshot?.status;
        process.stdout.write(`${status}\n`);

        if (status === 'completed' || status === 'error') {
          statusMap.set(entry.sessionId, { done: true, snapshot, puzzleId: entry.puzzleId });
          pending -= 1;
        } else {
          statusMap.set(entry.sessionId, { done: false, snapshot, puzzleId: entry.puzzleId });
        }
      } catch (error) {
        process.stdout.write(`ERROR (${error instanceof Error ? error.message : error})\n`);
      }
    }

    if (pending > 0) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.log('\nFinal statuses:');
  for (const entry of sessions) {
    const status = statusMap.get(entry.sessionId);
    const completed = status?.snapshot?.status === 'completed';
    console.log(`  ${entry.puzzleId}: ${completed ? '✅ completed' : '❌ ' + status?.snapshot?.status}`);
  }
})().catch((err) => {
  console.error('Polling script failed:', err);
  process.exitCode = 1;
});

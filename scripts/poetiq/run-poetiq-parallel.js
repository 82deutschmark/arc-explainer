/**
 * Author: Codex (GPT-5)
 * Date: 2025-11-26
 * PURPOSE: Fire five Poetiq solver runs simultaneously instead of the default sequential batch.
 * SRP/DRY check: Pass - single responsibility is orchestrating parallel requests/polling.
 * Notes: Requires the backend server to already be running with OpenRouter credentials.
 */

const puzzleIds = [
  '2ba387bc',
  '3a25b0d8',
  '4c7dc4dd',
  '8f3a5a89',
  '9385bd28'
];

const API_BASE = 'http://localhost:5000';
const MODEL = 'openrouter/google/gemini-3-pro-preview';
const NUM_EXPERTS = 2;
const MAX_ITERATIONS = 10;
const POLL_INTERVAL_MS = 6000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startRun(puzzleId) {
  const response = await fetch(`${API_BASE}/api/poetiq/solve/${puzzleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'openrouter',
      model: MODEL,
      numExperts: NUM_EXPERTS,
      maxIterations: MAX_ITERATIONS,
      temperature: 1.0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Start failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  if (!payload.success || !payload.data?.sessionId) {
    throw new Error('Solver start returned no sessionId');
  }

  return payload.data.sessionId;
}

async function waitForCompletion(sessionId, puzzleId) {
  while (true) {
    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await fetch(`${API_BASE}/api/poetiq/status/${sessionId}`);
    if (!statusResponse.ok) {
      throw new Error(`Status check failed (${statusResponse.status}) for ${puzzleId}`);
    }

    const statusPayload = await statusResponse.json();
    const snapshot = statusPayload?.data?.snapshot;

    if (snapshot?.status === 'completed' || snapshot?.status === 'error') {
      return snapshot;
    }
  }
}

async function runPuzzle(puzzleId) {
  console.log(`Starting ${puzzleId}…`);
  try {
    const sessionId = await startRun(puzzleId);
    console.log(`  sessionId=${sessionId}`);

    const snapshot = await waitForCompletion(sessionId, puzzleId);
    const success = snapshot?.status === 'completed' && snapshot?.result?.success;

    console.log(`  ${puzzleId} ${success ? 'completed' : 'failed'} (${snapshot?.status})`);
    return { puzzleId, success, snapshot };
  } catch (error) {
    console.error(`  ${puzzleId} ERROR:`, error instanceof Error ? error.message : error);
    return { puzzleId, success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

(async function main() {
  console.log('Starting 5-parallel Poetiq run via OpenRouter');
  const jobs = puzzleIds.map((id) => runPuzzle(id));
  const results = await Promise.all(jobs);

  const succeeded = results.filter((r) => r.success).length;
  console.log('\nSummary:');
  console.log(`  ${succeeded}/${puzzleIds.length} puzzles completed successfully`);
  results.forEach((result) => {
    console.log(`  - ${result.puzzleId}: ${result.success ? '✅' : '❌'} ${result.error ?? result.snapshot?.status}`);
  });
})().catch((err) => {
  console.error('Batch runner crashed:', err);
  process.exitCode = 1;
});

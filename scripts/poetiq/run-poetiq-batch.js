/**
 * Author: Codex (GPT-5)
 * Date: 2025-11-26
 * PURPOSE: Run Poetiq solver on 20 ARC2-Eval puzzles sequentially using the OpenRouter Gemini proxy with two experts.
 * SRP and DRY check: Pass - Single purpose script coordinating Poetiq batch execution.
 */

const puzzleIds = [
  '0934a4d8',
  '135a2760',
  '136b0064',
  '13e47133',
  '142ca369',
  '16b78196',
  '16de56c4',
  '1818057f',
  '195c6913',
  '1ae2feb7',
  '20270e3b',
  '20a9e565',
  '21897d95',
  '221dfab4',
  '247ef758',
  '269e22fb',
  '271d71e2',
  '28a6681f',
  '291dc1e1',
  '2b83f449'
];

const TOTAL_PUZZLES = puzzleIds.length;
const API_BASE = 'http://localhost:5000';
const MODEL = 'openrouter/google/gemini-3-pro-preview'; // OpenRouter Gemini proxy
const MAX_ITERATIONS = 10;
const NUM_EXPERTS = 2;
const POLL_INTERVAL_MS = 10_000;

async function runPoetiqSolver(taskId, index) {
  const startTime = Date.now();
  console.log(`\n[${'='.repeat(60)}]`);
  console.log(`[${index + 1}/${TOTAL_PUZZLES}] Starting Poetiq solver for puzzle: ${taskId}`);
  console.log(
    `[${new Date().toLocaleTimeString()}] Model: ${MODEL}, Iterations: ${MAX_ITERATIONS}, Experts: ${NUM_EXPERTS}`
  );
  console.log(`[${'='.repeat(60)}]\n`);

  try {
    const response = await fetch(`${API_BASE}/api/poetiq/solve/${taskId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        maxIterations: MAX_ITERATIONS,
        numExperts: NUM_EXPERTS,
        temperature: 1.0
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API returned ${response.status}: ${error}`);
    }

    const data = await response.json();
    const sessionId = data?.data?.sessionId;
    if (!sessionId) {
      throw new Error('Solver response missing sessionId');
    }

    console.log(`[INFO] Solver started for ${taskId}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log('  Polling for completion...\n');

    let completed = false;
    let lastUpdate = Date.now();

    while (!completed) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      const statusResponse = await fetch(`${API_BASE}/api/poetiq/status/${sessionId}`);
      if (!statusResponse.ok) {
        const statusText = await statusResponse.text();
        throw new Error(`Status check failed (${statusResponse.status}): ${statusText}`);
      }

      const statusData = await statusResponse.json();
      const snapshot = statusData?.data?.snapshot;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const timeSinceUpdate = Math.round((Date.now() - lastUpdate) / 1000);

      if (snapshot?.status === 'completed' || snapshot?.status === 'error') {
        completed = true;
        const result = snapshot.result || {};
        const isCorrect = result.isPredictionCorrect === true || result.multiTestAllCorrect === true;

        console.log(`\n[COMPLETE] ${taskId} (${elapsed}s total)`);
        console.log(`  Correct: ${isCorrect ? 'YES' : 'NO'}`);
        console.log(`  Iterations: ${result.iterationCount ?? 'unknown'}`);
        console.log(`  Accuracy: ${result.accuracy ? (result.accuracy * 100).toFixed(1) + '%' : 'unknown'}`);

        return {
          taskId,
          success: snapshot.status === 'completed',
          correct: isCorrect,
          elapsed
        };
      }

      if (timeSinceUpdate >= 60) {
        console.log(`  [${elapsed}s] Still running... (${snapshot?.phase || 'working'})`);
        lastUpdate = Date.now();
      }
    }
  } catch (error) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[FAILED] ${taskId} (${elapsed}s)`);
    console.error(`  Error: ${message}`);

    return {
      taskId,
      success: false,
      error: message,
      elapsed
    };
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log(`POETIQ SOLVER BATCH RUN - ${TOTAL_PUZZLES} ARC2-EVAL PUZZLES`);
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Model: ${MODEL} (OpenRouter proxy)`);
  console.log(`Puzzles: ${TOTAL_PUZZLES}`);
  console.log('='.repeat(70) + '\n');

  const results = [];
  const batchStartTime = Date.now();

  for (let i = 0; i < puzzleIds.length; i += 1) {
    const result = await runPoetiqSolver(puzzleIds[i], i);
    results.push(result);

    const completed = i + 1;
    const correct = results.filter(r => r.success && r.correct).length;
    const failed = results.filter(r => !r.success).length;
    const avgTime = Math.round(results.reduce((sum, r) => sum + r.elapsed, 0) / results.length);

    console.log(`\n[PROGRESS] ${completed}/${TOTAL_PUZZLES} completed | ${correct} correct | ${failed} failed | ${avgTime}s avg`);
  }

  const totalTime = Math.round((Date.now() - batchStartTime) / 1000);
  const successful = results.filter(r => r.success).length;
  const correct = results.filter(r => r.success && r.correct).length;
  const correctPct = TOTAL_PUZZLES > 0 ? ((correct / TOTAL_PUZZLES) * 100).toFixed(1) : '0.0';

  console.log('\n' + '='.repeat(70));
  console.log('FINAL RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Time: ${totalTime}s (${Math.round(totalTime / 60)} minutes)`);
  console.log(`Completed: ${successful}/${TOTAL_PUZZLES}`);
  console.log(`Correct: ${correct}/${TOTAL_PUZZLES} (${correctPct}%)`);
  console.log(`Failed: ${TOTAL_PUZZLES - successful}/${TOTAL_PUZZLES}`);
  console.log('\nPer-puzzle results:');
  results.forEach((r, i) => {
    const status = !r.success ? '[ERROR]' : r.correct ? '[CORRECT]' : '[WRONG]';
    const detail = r.error ? ` | ${r.error}` : '';
    console.log(`  ${i + 1}. ${r.taskId}: ${status} (${r.elapsed}s)${detail}`);
  });
  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('Batch runner crashed:', error);
  process.exitCode = 1;
});

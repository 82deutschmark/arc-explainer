/**
 * Author: Claude Code (Sonnet 4.5)
 * Date: 2025-11-26
 * PURPOSE: Run Poetiq solver on 10 ARC2-Eval puzzles sequentially using Direct Gemini API
 * SRP and DRY check: Pass - Single purpose script for batch execution
 */

const puzzleIds = [
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

const API_BASE = 'http://localhost:5000';
const MODEL = 'gemini/gemini-3-pro-preview'; // Direct Gemini API
const MAX_ITERATIONS = 10;
const NUM_EXPERTS = 1;

async function runPoetiqSolver(taskId, index) {
  const startTime = Date.now();
  console.log(`\n[${'='.repeat(60)}]`);
  console.log(`[${index + 1}/10] Starting Poetiq solver for puzzle: ${taskId}`);
  console.log(`[${new Date().toLocaleTimeString()}] Model: ${MODEL}, Iterations: ${MAX_ITERATIONS}`);
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
    const sessionId = data.data.sessionId;

    console.log(`✓ Solver started for ${taskId}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log(`  Now polling for completion...\n`);

    // Poll for completion
    let completed = false;
    let lastUpdate = Date.now();

    while (!completed) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds

      const statusResponse = await fetch(`${API_BASE}/api/poetiq/status/${sessionId}`);
      const statusData = await statusResponse.json();
      const snapshot = statusData.data.snapshot;

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const timeSinceUpdate = Math.round((Date.now() - lastUpdate) / 1000);

      if (snapshot?.status === 'completed' || snapshot?.status === 'error') {
        completed = true;
        const result = snapshot.result || {};

        console.log(`\n✅ COMPLETED: ${taskId} (${elapsed}s total)`);
        console.log(`  Correct: ${result.isPredictionCorrect ? 'YES ✓' : 'NO ✗'}`);
        console.log(`  Iterations: ${result.iterationCount || 'unknown'}`);
        console.log(`  Accuracy: ${result.accuracy ? (result.accuracy * 100).toFixed(1) + '%' : 'unknown'}`);

        return {
          taskId,
          success: true,
          correct: result.isPredictionCorrect,
          elapsed
        };
      } else if (timeSinceUpdate >= 60) {
        // Log progress update every minute
        console.log(`  [${elapsed}s] Still running... (${snapshot?.phase || 'working'})`);
        lastUpdate = Date.now();
      }
    }
  } catch (error) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`\n❌ FAILED: ${taskId} (${elapsed}s)`);
    console.error(`  Error: ${error.message}`);

    return {
      taskId,
      success: false,
      error: error.message,
      elapsed
    };
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('POETIQ SOLVER BATCH RUN - 10 ARC2-EVAL PUZZLES');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Model: ${MODEL} (Direct Gemini API)`);
  console.log(`Puzzles: ${puzzleIds.length}`);
  console.log('='.repeat(70) + '\n');

  const results = [];
  const batchStartTime = Date.now();

  for (let i = 0; i < puzzleIds.length; i++) {
    const result = await runPoetiqSolver(puzzleIds[i], i);
    results.push(result);

    // Summary after each puzzle
    const completed = i + 1;
    const correct = results.filter(r => r.success && r.correct).length;
    const failed = results.filter(r => !r.success).length;
    const avgTime = Math.round(results.reduce((sum, r) => sum + r.elapsed, 0) / results.length);

    console.log(`\n[PROGRESS] ${completed}/10 completed | ${correct} correct | ${failed} failed | ${avgTime}s avg`);
  }

  // Final summary
  const totalTime = Math.round((Date.now() - batchStartTime) / 1000);
  const successful = results.filter(r => r.success).length;
  const correct = results.filter(r => r.success && r.correct).length;

  console.log('\n' + '='.repeat(70));
  console.log('FINAL RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Time: ${totalTime}s (${Math.round(totalTime / 60)} minutes)`);
  console.log(`Completed: ${successful}/10`);
  console.log(`Correct: ${correct}/10 (${(correct / 10 * 100).toFixed(1)}%)`);
  console.log(`Failed: ${10 - successful}/10`);
  console.log('\nPer-puzzle results:');
  results.forEach((r, i) => {
    const status = !r.success ? '❌ ERROR' : r.correct ? '✅ CORRECT' : '❌ WRONG';
    console.log(`  ${i + 1}. ${r.taskId}: ${status} (${r.elapsed}s)`);
  });
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);

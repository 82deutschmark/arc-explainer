/**
 * E2E test for Saturn Visual Solver streaming endpoint
 * Tests puzzle 56ff96f3 with gpt-5-mini-2025-08-07
 */

import { EventSource } from 'eventsource';

const PUZZLE_ID = '56ff96f3';
const MODEL_KEY = 'gpt-5-mini-2025-08-07';
const BASE_URL = 'http://localhost:5000';

const params = new URLSearchParams({
  temperature: '0.2',
  promptId: 'solver',
  reasoningEffort: 'high',
  reasoningVerbosity: 'high',
  reasoningSummaryType: 'detailed'
});

const streamUrl = `${BASE_URL}/api/stream/saturn/${PUZZLE_ID}/${encodeURIComponent(MODEL_KEY)}?${params.toString()}`;

console.log('🔍 Testing Saturn Streaming Endpoint');
console.log('URL:', streamUrl);
console.log('Puzzle:', PUZZLE_ID);
console.log('Model:', MODEL_KEY);
console.log('---');

const eventSource = new EventSource(streamUrl);
let hasReceivedInit = false;
let hasReceivedChunk = false;
let chunkCount = 0;

eventSource.addEventListener('stream.init', (evt) => {
  hasReceivedInit = true;
  console.log('✅ stream.init received');
  const data = JSON.parse(evt.data);
  console.log('   Session:', data.sessionId);
  console.log('   TaskId:', data.taskId);
  console.log('   ModelKey:', data.modelKey);
});

eventSource.addEventListener('stream.status', (evt) => {
  const data = JSON.parse(evt.data);
  console.log('📊 stream.status:', data.state || data.phase);
  if (data.message) {
    console.log('   Message:', data.message.substring(0, 100));
  }
});

eventSource.addEventListener('stream.chunk', (evt) => {
  hasReceivedChunk = true;
  chunkCount++;
  if (chunkCount <= 3) {
    const data = JSON.parse(evt.data);
    console.log(`📦 stream.chunk #${chunkCount}:`, data.type);
    if (data.delta) {
      console.log('   Delta:', data.delta.substring(0, 50));
    }
  }
});

eventSource.addEventListener('stream.complete', (evt) => {
  console.log('✅ stream.complete received');
  const data = JSON.parse(evt.data);
  console.log('   Status:', data.status);
  if (data.responseSummary?.analysis) {
    console.log('   Analysis keys:', Object.keys(data.responseSummary.analysis));
  }
  cleanup();
});

eventSource.addEventListener('stream.error', (evt) => {
  console.error('❌ stream.error received');
  const data = JSON.parse(evt.data);
  console.error('   Error:', data.message);
  cleanup();
});

eventSource.onerror = (err) => {
  console.error('❌ EventSource error');
  console.error('   ReadyState:', eventSource.readyState);
  if (!hasReceivedInit) {
    console.error('   ERROR: No init event received - endpoint may not be responding');
  }
  cleanup();
};

function cleanup() {
  console.log('---');
  console.log('📈 Summary:');
  console.log('   Init received:', hasReceivedInit);
  console.log('   Chunks received:', chunkCount);
  console.log('   Has chunk data:', hasReceivedChunk);
  eventSource.close();
  process.exit(hasReceivedInit ? 0 : 1);
}

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏱️ Timeout reached');
  cleanup();
}, 30000);

console.log('⏳ Waiting for events...');

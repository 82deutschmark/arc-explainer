/**
 * Test WebSocket connection for Grover
 */

import WebSocket from 'ws';

const TEST_SESSION_ID = 'test-' + Date.now();
const WS_URL = `ws://localhost:5000/api/grover/progress?sessionId=${TEST_SESSION_ID}`;

console.log(`\n🔍 Testing WebSocket connection...`);
console.log(`URL: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

let connected = false;

ws.on('open', () => {
  connected = true;
  console.log('✅ WebSocket CONNECTED successfully!');
  console.log('   Server is accepting connections.\n');
  
  // Send a test message
  ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
  
  setTimeout(() => {
    console.log('Closing connection...');
    ws.close();
  }, 2000);
});

ws.on('message', (data) => {
  console.log('📨 Received message from server:');
  console.log(data.toString());
});

ws.on('error', (error) => {
  console.log('❌ WebSocket ERROR:');
  console.log(error.message);
  console.log('\nPossible causes:');
  console.log('1. Server not running on port 5000');
  console.log('2. WebSocket server not attached to HTTP server');
  console.log('3. Path /api/grover/progress not registered');
  console.log('4. CORS or firewall blocking connection');
});

ws.on('close', (code, reason) => {
  if (connected) {
    console.log(`\n✅ WebSocket closed normally (code: ${code})`);
    console.log('\n🎉 TEST PASSED: WebSocket is working!');
  } else {
    console.log(`\n❌ WebSocket closed before connecting (code: ${code})`);
    console.log(`Reason: ${reason || 'No reason provided'}`);
    console.log('\n🔧 TEST FAILED: WebSocket server not responding');
  }
  process.exit(connected ? 0 : 1);
});

// Timeout after 5 seconds
setTimeout(() => {
  if (!connected) {
    console.log('\n⏱️  TIMEOUT: No connection after 5 seconds');
    console.log('Server may not be running or WebSocket not attached.');
    ws.close();
  }
}, 5000);

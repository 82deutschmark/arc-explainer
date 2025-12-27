/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-26
 * PURPOSE: Unit tests for RE-ARC task ID codec (XOR seed recovery and steganographic encoding).
 *          Comprehensive tests for simplified architecture.
 * SRP/DRY check: Pass - Focused tests for reArcCodec utility functions.
 */

import test from 'node:test';
import { strict as assert } from 'node:assert';

import {
  recoverSeed,
  generateTaskIds,
  decodeTaskIds,
  verifySeed,
  SimplePRNG,
  getTaskIdUpper,
  getTaskIdLower,
} from '../server/utils/reArcCodec.ts';

// ============================================================================
// PRNG Tests
// ============================================================================

test('SimplePRNG: generates deterministic sequence', () => {
  const rng1 = new SimplePRNG(42);
  const rng2 = new SimplePRNG(42);

  for (let i = 0; i < 100; i++) {
    assert.strictEqual(rng1.next(), rng2.next());
  }
});

test('SimplePRNG: different seeds produce different sequences', () => {
  const rng1 = new SimplePRNG(42);
  const rng2 = new SimplePRNG(43);

  let different = false;
  for (let i = 0; i < 10; i++) {
    if (rng1.next() !== rng2.next()) {
      different = true;
      break;
    }
  }
  assert.ok(different, 'Different seeds should produce different sequences');
});

test('SimplePRNG: next16() returns 16-bit values', () => {
  const rng = new SimplePRNG(12345);

  for (let i = 0; i < 100; i++) {
    const val = rng.next16();
    assert.ok(val >= 0 && val <= 0xffff, `Value ${val} out of 16-bit range`);
  }
});

test('SimplePRNG: shuffle() is deterministic', () => {
  const seed = 42;
  const array1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const array2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  new SimplePRNG(seed).shuffle(array1);
  new SimplePRNG(seed).shuffle(array2);

  assert.deepStrictEqual(array1, array2, 'Same seed should produce same shuffle');
});

test('SimplePRNG: shuffle() actually shuffles', () => {
  const seed = 99999;
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const array = [...original];

  new SimplePRNG(seed).shuffle(array);

  // Should not be identical to original (probability of identity is 1/10! ≈ 0.0000003)
  assert.notDeepStrictEqual(array, original, 'Shuffle should change array order');

  // Should contain same elements
  assert.deepStrictEqual(array.sort(), original.sort(), 'Should contain same elements');
});

test('SimplePRNG: shuffle() modifies array in-place', () => {
  const seed = 12345;
  const array = [1, 2, 3, 4, 5];
  const reference = array;

  const result = new SimplePRNG(seed).shuffle(array);

  assert.strictEqual(result, reference, 'Should return same array reference');
  assert.strictEqual(result, array, 'Should modify original array');
});

test('SimplePRNG: shuffle() works with different types', () => {
  const seed = 54321;
  const strings = ['a', 'b', 'c', 'd', 'e'];
  const objects = [{ id: 1 }, { id: 2 }, { id: 3 }];

  new SimplePRNG(seed).shuffle(strings);
  new SimplePRNG(seed + 1).shuffle(objects);

  // Just verify no errors and arrays still have same length
  assert.strictEqual(strings.length, 5);
  assert.strictEqual(objects.length, 3);
});

// ============================================================================
// Helper Functions Tests
// ============================================================================

test('getTaskIdUpper: extracts upper 16 bits', () => {
  assert.strictEqual(getTaskIdUpper('abcd1234'), 0xabcd);
  assert.strictEqual(getTaskIdUpper('ffff0000'), 0xffff);
  assert.strictEqual(getTaskIdUpper('00001234'), 0x0000);
});

test('getTaskIdLower: extracts lower 16 bits', () => {
  assert.strictEqual(getTaskIdLower('abcd1234'), 0x1234);
  assert.strictEqual(getTaskIdLower('ffff0000'), 0x0000);
  assert.strictEqual(getTaskIdLower('0000ffff'), 0xffff);
});

// ============================================================================
// Seed Recovery Tests
// ============================================================================

test('recoverSeed: XOR of generated task IDs returns original seed', () => {
  const seed = 0x12345678;
  const taskIds = generateTaskIds(seed, 10);

  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seed);
});

test('recoverSeed: order-independent (shuffled task IDs)', () => {
  const seed = 0xabcdef12;
  const taskIds = generateTaskIds(seed, 20);

  // Shuffle task IDs deterministically
  const shuffled = new SimplePRNG(seed + 1).shuffle([...taskIds]);

  const recoveredSeed = recoverSeed(shuffled);
  assert.strictEqual(recoveredSeed, seed);
});

test('recoverSeed: throws on invalid task ID format', () => {
  assert.throws(() => recoverSeed(['invalid']), /Invalid task ID format/);
  assert.throws(() => recoverSeed(['1234567']), /Invalid task ID format/); // Too short
  assert.throws(() => recoverSeed(['123456789']), /Invalid task ID format/); // Too long
  assert.throws(() => recoverSeed(['gggggggg']), /Invalid task ID format/); // Invalid hex
});

test('recoverSeed: throws on empty task ID list', () => {
  assert.throws(() => recoverSeed([]), /Cannot recover seed from empty task ID list/);
});

test('verifySeed: returns true for correct seed', () => {
  const seed = 0x11223344;
  const taskIds = generateTaskIds(seed, 15);

  assert.strictEqual(verifySeed(taskIds, seed), true);
});

test('verifySeed: returns false for incorrect seed', () => {
  const seed = 0x11223344;
  const taskIds = generateTaskIds(seed, 15);

  assert.strictEqual(verifySeed(taskIds, 0x99999999), false);
});

// ============================================================================
// Task ID Generation Tests
// ============================================================================

test('generateTaskIds: without message encoding', () => {
  const seed = 0x12345678;
  const numTasks = 5;

  const taskIds = generateTaskIds(seed, numTasks);

  assert.strictEqual(taskIds.length, numTasks);
  assert.ok(taskIds.every((id) => /^[0-9a-f]{8}$/.test(id)));

  // Verify seed recovery
  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seed);
});

test('generateTaskIds: all task IDs are unique', () => {
  const seed = 0xaabbccdd;
  const numTasks = 100;

  const taskIds = generateTaskIds(seed, numTasks);

  const uniqueIds = new Set(taskIds);
  assert.strictEqual(uniqueIds.size, numTasks, 'All task IDs should be unique');
});

test('generateTaskIds: upper bits are unique (position identifiers)', () => {
  const seed = 0x12345678;
  const numTasks = 50;

  const taskIds = generateTaskIds(seed, numTasks);

  const upperBits = taskIds.map(getTaskIdUpper);
  const uniqueUppers = new Set(upperBits);

  assert.strictEqual(uniqueUppers.size, numTasks, 'All upper bits should be unique');
});

test('generateTaskIds: deterministic (same seed produces same IDs)', () => {
  const seed = 0x99887766;
  const numTasks = 20;

  const taskIds1 = generateTaskIds(seed, numTasks);
  const taskIds2 = generateTaskIds(seed, numTasks);

  assert.deepStrictEqual(taskIds1, taskIds2);
});

test('generateTaskIds: throws if numTasks < 1', () => {
  assert.throws(() => generateTaskIds(0x12345678, 0), /Must generate at least 1 task ID/);
  assert.throws(() => generateTaskIds(0x12345678, -1), /Must generate at least 1 task ID/);
});

test('generateTaskIds: throws if numTasks > 65536', () => {
  assert.throws(
    () => generateTaskIds(0x12345678, 65537),
    /Cannot generate more than 65536 tasks/
  );
});

// ============================================================================
// Message Encoding Tests
// ============================================================================

test('generateTaskIds: with message encoding (4 bytes)', () => {
  const seed = 0xaabbccdd;
  const message = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  const numTasks = 5;

  const taskIds = generateTaskIds(seed, numTasks, message);

  assert.strictEqual(taskIds.length, numTasks);

  // Verify seed recovery
  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seed);

  // Verify message decoding
  const decoded = decodeTaskIds(taskIds, message.length);
  assert.deepStrictEqual(decoded.message, message);
});

test('generateTaskIds: message capacity is (numTasks - 1) * 2 bytes', () => {
  const seed = 0x12345678;

  // 10 tasks → max 18 bytes (9 * 2)
  const maxMessage = new Uint8Array(18).fill(0xaa);
  assert.doesNotThrow(() => generateTaskIds(seed, 10, maxMessage));

  // 19 bytes should fail
  const tooLarge = new Uint8Array(19).fill(0xaa);
  assert.throws(() => generateTaskIds(seed, 10, tooLarge), /Message too large/);
});

test('generateTaskIds: encodes partial message (odd byte count)', () => {
  const seed = 0x11223344;
  const message = new Uint8Array([0xaa, 0xbb, 0xcc]); // 3 bytes
  const numTasks = 5;

  const taskIds = generateTaskIds(seed, numTasks, message);
  const decoded = decodeTaskIds(taskIds, message.length);

  assert.deepStrictEqual(decoded.message, message);
});

test('generateTaskIds: empty message is allowed', () => {
  const seed = 0x12345678;
  const emptyMessage = new Uint8Array(0);
  const numTasks = 5;

  const taskIds = generateTaskIds(seed, numTasks, emptyMessage);

  assert.strictEqual(taskIds.length, numTasks);

  // Should decode to no message (undefined when messageLength = 0)
  const decoded = decodeTaskIds(taskIds, 0);
  assert.strictEqual(decoded.message, undefined);
});

// ============================================================================
// decodeTaskIds Tests (Primary Decoding Function)
// ============================================================================

test('decodeTaskIds: recovers seed from task IDs', () => {
  const seed = 0x12345678;
  const taskIds = generateTaskIds(seed, 10);

  const decoded = decodeTaskIds(taskIds);

  assert.strictEqual(decoded.seed, seed);
  assert.strictEqual(decoded.orderedTaskIds.length, 10);
  assert.strictEqual(decoded.message, undefined);
});

test('decodeTaskIds: returns task IDs in generation order', () => {
  const seed = 0xaabbccdd;
  const taskIds = generateTaskIds(seed, 20);

  // Shuffle task IDs deterministically
  const shuffled = new SimplePRNG(seed + 1).shuffle([...taskIds]);

  const decoded = decodeTaskIds(shuffled);

  // Ordered task IDs should match original generation order
  assert.deepStrictEqual(decoded.orderedTaskIds, taskIds);
});

test('decodeTaskIds: recovers encoded message', () => {
  const seed = 0xfeedbeef;
  const message = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
  const numTasks = 10;

  const taskIds = generateTaskIds(seed, numTasks, message);

  // Shuffle to test order independence (deterministically)
  const shuffled = new SimplePRNG(seed + 1).shuffle([...taskIds]);

  const decoded = decodeTaskIds(shuffled, message.length);

  assert.strictEqual(decoded.seed, seed);
  assert.strictEqual(decoded.orderedTaskIds.length, numTasks);
  assert.deepStrictEqual(decoded.message, message);
  // Ordered task IDs should match original generation order
  assert.deepStrictEqual(decoded.orderedTaskIds, taskIds);
});

test('decodeTaskIds: without messageLength returns no message', () => {
  const seed = 0x11223344;
  const message = new Uint8Array([0xaa, 0xbb, 0xcc]);
  const taskIds = generateTaskIds(seed, 5, message);

  const decoded = decodeTaskIds(taskIds);

  assert.strictEqual(decoded.seed, seed);
  assert.strictEqual(decoded.orderedTaskIds.length, 5);
  assert.strictEqual(decoded.message, undefined);
});

test('decodeTaskIds: messageLength 0 returns no message', () => {
  const seed = 0x99887766;
  const taskIds = generateTaskIds(seed, 5);

  const decoded = decodeTaskIds(taskIds, 0);

  assert.strictEqual(decoded.seed, seed);
  assert.strictEqual(decoded.message, undefined);
});

test('decodeTaskIds: throws if task not found at expected position', () => {
  const seed = 0x12345678;
  const message = new Uint8Array([0xaa, 0xbb]);
  const taskIds = generateTaskIds(seed, 10, message);

  // Remove a task ID to break the sequence
  taskIds.splice(2, 1);

  assert.throws(() => decodeTaskIds(taskIds, message.length), /Decode failed/);
});

test('decodeTaskIds: throws on invalid task IDs', () => {
  const seed = 0x12345678;
  const taskIds = generateTaskIds(seed, 5);

  // Create a corrupted duplicate by copying the first task ID
  const duplicateTaskIds = [...taskIds, taskIds[0]];

  assert.throws(
    () => decodeTaskIds(duplicateTaskIds),
    /Decode failed: no task found with upper bits/
  );
});


// ============================================================================
// Edge Cases & Stress Tests
// ============================================================================

test('edge case: single task (no message encoding)', () => {
  const seed = 0x12345678;
  const taskIds = generateTaskIds(seed, 1);

  assert.strictEqual(taskIds.length, 1);

  // Seed recovery should still work
  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seed);
});

test('edge case: two tasks (can encode 2 bytes max)', () => {
  const seed = 0xaabbccdd;
  const message = new Uint8Array([0xaa, 0xbb]);
  const taskIds = generateTaskIds(seed, 2, message);

  const decoded = decodeTaskIds(taskIds, message.length);
  assert.deepStrictEqual(decoded.message, message);

  // 3 bytes should fail
  assert.throws(() => generateTaskIds(seed, 2, new Uint8Array(3)), /Message too large/);
});

test('stress test: large number of tasks', () => {
  const seed = 0x11111111;
  const numTasks = 500;

  const taskIds = generateTaskIds(seed, numTasks);

  assert.strictEqual(taskIds.length, numTasks);

  // All task IDs should be unique
  const uniqueIds = new Set(taskIds);
  assert.strictEqual(uniqueIds.size, numTasks);

  // Seed recovery should work
  const recovered = recoverSeed(taskIds);
  assert.strictEqual(recovered, seed);
});

test('stress test: maximum message size', () => {
  const seed = 0x99999999;
  const numTasks = 100;
  const maxBytes = (numTasks - 1) * 2; // 198 bytes

  const message = new Uint8Array(maxBytes);
  for (let i = 0; i < maxBytes; i++) {
    message[i] = i & 0xff; // Sequential pattern
  }

  const taskIds = generateTaskIds(seed, numTasks, message);
  const decoded = decodeTaskIds(taskIds, maxBytes);

  assert.deepStrictEqual(decoded.message, message);
});

test('end-to-end: generate → shuffle → recover seed', () => {
  const originalSeed = 0xfeedbeef;
  const numTasks = 100;

  // Generate task IDs
  const taskIds = generateTaskIds(originalSeed, numTasks);

  // Shuffle deterministically to simulate submission in arbitrary order
  const shuffled = new SimplePRNG(originalSeed + 1).shuffle([...taskIds]);

  // Recover seed from shuffled task IDs
  const recoveredSeed = recoverSeed(shuffled);
  assert.strictEqual(recoveredSeed, originalSeed);

  // Decode and verify order recovery
  const decoded = decodeTaskIds(shuffled);
  assert.strictEqual(decoded.seed, originalSeed);
  assert.deepStrictEqual(decoded.orderedTaskIds, taskIds);
});

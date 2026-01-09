/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Unit tests for RE-ARC codec utilities and deterministic seed recovery.
 * SRP/DRY check: Pass - Focused codec helper tests only.
 */

import { test } from 'vitest';
import { strict as assert } from 'node:assert';

import {
  recoverSeed,
  generateTaskIds,
  decodeTaskIds,
  deriveSeed,
  SimplePRNG,
  getTaskIdUpper,
  getTaskIdLower,
} from '../server/utils/reArcCodec.ts';

// Test pepper for deterministic test behavior
const TEST_PEPPER = 'test-pepper-for-codec-deterministic-tests-32-chars';

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
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const taskIds = generateTaskIds(seedId, internalSeed, 10);

  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seedId);
});

test('recoverSeed: order-independent (shuffled task IDs)', () => {
  const seedId = 0xabcdef12;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const taskIds = generateTaskIds(seedId, internalSeed, 20);

  // Shuffle task IDs deterministically
  const shuffled = new SimplePRNG(internalSeed + 1).shuffle([...taskIds]);

  const recoveredSeed = recoverSeed(shuffled);
  assert.strictEqual(recoveredSeed, seedId);
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

// ============================================================================
// Task ID Generation Tests
// ============================================================================

test('generateTaskIds: without message encoding', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const numTasks = 5;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks);

  assert.strictEqual(taskIds.length, numTasks);
  assert.ok(taskIds.every((id) => /^[0-9a-f]{8}$/.test(id)));

  // Verify seed recovery
  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seedId);
});

test('generateTaskIds: all task IDs are unique', () => {
  const seedId = 0xaabbccdd;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const numTasks = 100;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks);

  const uniqueIds = new Set(taskIds);
  assert.strictEqual(uniqueIds.size, numTasks, 'All task IDs should be unique');
});

test('generateTaskIds: upper bits are unique (position identifiers)', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const numTasks = 50;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks);

  const upperBits = taskIds.map(getTaskIdUpper);
  const uniqueUppers = new Set(upperBits);

  assert.strictEqual(uniqueUppers.size, numTasks, 'All upper bits should be unique');
});

test('generateTaskIds: deterministic (same seed produces same IDs)', () => {
  const seedId = 0x99887766;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const numTasks = 20;

  const taskIds1 = generateTaskIds(seedId, internalSeed, numTasks);
  const taskIds2 = generateTaskIds(seedId, internalSeed, numTasks);

  assert.deepStrictEqual(taskIds1, taskIds2);
});

test('generateTaskIds: throws if numTasks < 1', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  assert.throws(() => generateTaskIds(seedId, internalSeed, 0), /Must generate at least 1 task ID/);
  assert.throws(() => generateTaskIds(seedId, internalSeed, -1), /Must generate at least 1 task ID/);
});

test('generateTaskIds: throws if numTasks > 65536', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  assert.throws(
    () => generateTaskIds(seedId, internalSeed, 65537),
    /Cannot generate more than 65536 tasks/
  );
});

// ============================================================================
// Message Encoding Tests
// ============================================================================

test('generateTaskIds: with message encoding (4 bytes)', () => {
  const seedId = 0xaabbccdd;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const message = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  const numTasks = 5;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks, message);

  assert.strictEqual(taskIds.length, numTasks);

  // Verify seed recovery
  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seedId);

  // Verify message decoding
  const decoded = decodeTaskIds(taskIds, TEST_PEPPER, message.length);
  assert.deepStrictEqual(decoded.message, message);
});

test('generateTaskIds: message capacity is (numTasks - 1) * 2 bytes', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);

  // 10 tasks → max 18 bytes (9 * 2)
  const maxMessage = new Uint8Array(18).fill(0xaa);
  assert.doesNotThrow(() => generateTaskIds(seedId, internalSeed, 10, maxMessage));

  // 19 bytes should fail
  const tooLarge = new Uint8Array(19).fill(0xaa);
  assert.throws(() => generateTaskIds(seedId, internalSeed, 10, tooLarge), /Message too large/);
});

test('generateTaskIds: encodes partial message (odd byte count)', () => {
  const seedId = 0x11223344;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const message = new Uint8Array([0xaa, 0xbb, 0xcc]); // 3 bytes
  const numTasks = 5;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks, message);
  const decoded = decodeTaskIds(taskIds, TEST_PEPPER, message.length);

  assert.deepStrictEqual(decoded.message, message);
});

test('generateTaskIds: empty message is allowed', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const emptyMessage = new Uint8Array(0);
  const numTasks = 5;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks, emptyMessage);

  assert.strictEqual(taskIds.length, numTasks);

  // Should decode to no message (undefined when messageLength = 0)
  const decoded = decodeTaskIds(taskIds, TEST_PEPPER, 0);
  assert.strictEqual(decoded.message, undefined);
});

// ============================================================================
// decodeTaskIds Tests (Primary Decoding Function)
// ============================================================================

test('decodeTaskIds: recovers seed from task IDs', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const taskIds = generateTaskIds(seedId, internalSeed, 10);

  const decoded = decodeTaskIds(taskIds, TEST_PEPPER);

  assert.strictEqual(decoded.seedId, seedId);
  assert.strictEqual(decoded.internalSeed, internalSeed);
  assert.strictEqual(decoded.orderedTaskIds.length, 10);
  assert.strictEqual(decoded.message, undefined);
});

test('decodeTaskIds: returns task IDs in generation order', () => {
  const seedId = 0xaabbccdd;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const taskIds = generateTaskIds(seedId, internalSeed, 20);

  // Shuffle task IDs deterministically
  const shuffled = new SimplePRNG(internalSeed + 1).shuffle([...taskIds]);

  const decoded = decodeTaskIds(shuffled, TEST_PEPPER);

  // Ordered task IDs should match original generation order
  assert.deepStrictEqual(decoded.orderedTaskIds, taskIds);
});

test('decodeTaskIds: recovers encoded message', () => {
  const seedId = 0xfeedbeef;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const message = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
  const numTasks = 10;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks, message);

  // Shuffle to test order independence (deterministically)
  const shuffled = new SimplePRNG(internalSeed + 1).shuffle([...taskIds]);

  const decoded = decodeTaskIds(shuffled, TEST_PEPPER, message.length);

  assert.strictEqual(decoded.seedId, seedId);
  assert.strictEqual(decoded.internalSeed, internalSeed);
  assert.strictEqual(decoded.orderedTaskIds.length, numTasks);
  assert.deepStrictEqual(decoded.message, message);
  // Ordered task IDs should match original generation order
  assert.deepStrictEqual(decoded.orderedTaskIds, taskIds);
});

test('decodeTaskIds: without messageLength returns no message', () => {
  const seedId = 0x11223344;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const message = new Uint8Array([0xaa, 0xbb, 0xcc]);
  const taskIds = generateTaskIds(seedId, internalSeed, 5, message);

  const decoded = decodeTaskIds(taskIds, TEST_PEPPER);

  assert.strictEqual(decoded.seedId, seedId);
  assert.strictEqual(decoded.internalSeed, internalSeed);
  assert.strictEqual(decoded.orderedTaskIds.length, 5);
  assert.strictEqual(decoded.message, undefined);
});

test('decodeTaskIds: messageLength 0 returns no message', () => {
  const seedId = 0x99887766;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const taskIds = generateTaskIds(seedId, internalSeed, 5);

  const decoded = decodeTaskIds(taskIds, TEST_PEPPER, 0);

  assert.strictEqual(decoded.seedId, seedId);
  assert.strictEqual(decoded.internalSeed, internalSeed);
  assert.strictEqual(decoded.message, undefined);
});

test('decodeTaskIds: throws if task not found at expected position', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const message = new Uint8Array([0xaa, 0xbb]);
  const taskIds = generateTaskIds(seedId, internalSeed, 10, message);

  // Remove a task ID to break the sequence
  taskIds.splice(2, 1);

  assert.throws(() => decodeTaskIds(taskIds, TEST_PEPPER, message.length), /Decode failed/);
});

test('decodeTaskIds: throws on invalid task IDs', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const taskIds = generateTaskIds(seedId, internalSeed, 5);

  // Create a corrupted duplicate by copying the first task ID
  const duplicateTaskIds = [...taskIds, taskIds[0]];

  assert.throws(
    () => decodeTaskIds(duplicateTaskIds, TEST_PEPPER),
    /Decode failed: no task found with upper bits/
  );
});


// ============================================================================
// Edge Cases & Stress Tests
// ============================================================================

test('edge case: single task (no message encoding)', () => {
  const seedId = 0x12345678;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const taskIds = generateTaskIds(seedId, internalSeed, 1);

  assert.strictEqual(taskIds.length, 1);

  // Seed recovery should still work
  const recoveredSeed = recoverSeed(taskIds);
  assert.strictEqual(recoveredSeed, seedId);
});

test('edge case: two tasks (can encode 2 bytes max)', () => {
  const seedId = 0xaabbccdd;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const message = new Uint8Array([0xaa, 0xbb]);
  const taskIds = generateTaskIds(seedId, internalSeed, 2, message);

  const decoded = decodeTaskIds(taskIds, TEST_PEPPER, message.length);
  assert.deepStrictEqual(decoded.message, message);

  // 3 bytes should fail
  assert.throws(() => generateTaskIds(seedId, internalSeed, 2, new Uint8Array(3)), /Message too large/);
});

test('stress test: large number of tasks', () => {
  const seedId = 0x11111111;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const numTasks = 500;

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks);

  assert.strictEqual(taskIds.length, numTasks);

  // All task IDs should be unique
  const uniqueIds = new Set(taskIds);
  assert.strictEqual(uniqueIds.size, numTasks);

  // Seed recovery should work
  const recovered = recoverSeed(taskIds);
  assert.strictEqual(recovered, seedId);
});

test('stress test: maximum message size', () => {
  const seedId = 0x99999999;
  const internalSeed = deriveSeed(seedId, TEST_PEPPER);
  const numTasks = 100;
  const maxBytes = (numTasks - 1) * 2; // 198 bytes

  const message = new Uint8Array(maxBytes);
  for (let i = 0; i < maxBytes; i++) {
    message[i] = i & 0xff; // Sequential pattern
  }

  const taskIds = generateTaskIds(seedId, internalSeed, numTasks, message);
  const decoded = decodeTaskIds(taskIds, TEST_PEPPER, maxBytes);

  assert.deepStrictEqual(decoded.message, message);
});

test('end-to-end: generate → shuffle → recover seed', () => {
  const originalSeedId = 0xfeedbeef;
  const internalSeed = deriveSeed(originalSeedId, TEST_PEPPER);
  const numTasks = 100;

  // Generate task IDs
  const taskIds = generateTaskIds(originalSeedId, internalSeed, numTasks);

  // Shuffle deterministically to simulate submission in arbitrary order
  const shuffled = new SimplePRNG(internalSeed + 1).shuffle([...taskIds]);

  // Recover seed from shuffled task IDs
  const recoveredSeed = recoverSeed(shuffled);
  assert.strictEqual(recoveredSeed, originalSeedId);

  // Decode and verify order recovery
  const decoded = decodeTaskIds(shuffled, TEST_PEPPER);
  assert.strictEqual(decoded.seedId, originalSeedId);
  assert.strictEqual(decoded.internalSeed, internalSeed);
  assert.deepStrictEqual(decoded.orderedTaskIds, taskIds);
});

/**
 * RE-ARC Task ID Codec
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-26
 * PURPOSE: Codec for encoding/decoding task IDs with embedded evaluation data.
 *          Implements stateless evaluation for RE-ARC datasets using XOR-based seed recovery
 *          and steganographic message encoding.
 *
 *          Task IDs are 8 hex characters (32 bits):
 *          - Lower 16 bits: normal sequence from PRNG(seed), XOR to seed & 0xFFFF
 *          - Upper 16 bits: unique sequence from PRNG(seed), XOR to seed >>> 16
 *
 *          Seed recovery: XOR(all_task_ids) = seed (order-independent)
 *          Message encoding: XOR arbitrary bytes into lower 16 bits of tasks [0..n-2]
 *
 * SRP/DRY check: Pass - Single purpose: task ID encoding/decoding for RE-ARC evaluation
 */

import crypto from 'crypto';

/**
 * Derive internal seed from public seedId using HMAC-SHA256.
 * Prevents dataset regeneration and task ID prediction without server secret.
 *
 * @param seedId - Public seed identifier (typically Unix timestamp)
 * @param pepper - Server secret (RE_ARC_SEED_PEPPER)
 * @returns 32-bit unsigned integer for PRNG seeding
 */
export function deriveSeed(seedId: number, pepper: string): number {
  const hmac = crypto.createHmac('sha256', pepper)
    .update(seedId.toString())
    .digest();

  // Extract first 4 bytes as unsigned 32-bit integer
  return hmac.readUInt32BE(0);
}

/**
 * Result of decoding task IDs.
 * Contains all information needed for evaluation.
 */
export interface DecodedTaskIds {
  /** Recovered public seedId from XOR of all task IDs */
  seedId: number;
  /** Derived internal seed (from seedId + pepper) */
  internalSeed: number;
  /** Task IDs sorted in generation order (position 0, 1, 2, ...) */
  orderedTaskIds: string[];
  /** Decoded message bytes (if messageLength was provided) */
  message?: Uint8Array;
}

/**
 * Simple pseudo-random number generator (PRNG) using linear congruential generator.
 * Matches Python's approach for deterministic generation.
 *
 * LCG parameters: a = 1103515245, c = 12345, m = 2^31
 */
export class SimplePRNG {
  private state: number;

  constructor(seed: number) {
    // Ensure seed is unsigned 32-bit
    this.state = seed >>> 0;
  }

  /**
   * Generate next random 32-bit unsigned integer.
   */
  next(): number {
    // LCG formula: state = (a * state + c) mod m
    const a = 1103515245;
    const c = 12345;
    const m = 0x80000000; // 2^31

    this.state = ((a * this.state + c) % m) >>> 0;
    return this.state;
  }

  /**
   * Generate next random 16-bit unsigned integer.
   * Uses upper 16 bits for better statistical properties (lower bits of LCG have poor randomness).
   */
  next16(): number {
    return (this.next() >>> 16) & 0xffff;
  }

  /**
   * Deterministic shuffle using Fisher-Yates algorithm.
   * Modifies array in-place.
   *
   * @param array - Array to shuffle (modified in-place)
   * @returns The shuffled array (same reference)
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.next() % (i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

/**
 * Extract the upper 16 bits from a task ID.
 */
export function getTaskIdUpper(taskId: string): number {
  const taskIdNum = parseInt(taskId, 16);
  return (taskIdNum >>> 16) & 0xffff;
}

/**
 * Extract the lower 16 bits from a task ID.
 */
export function getTaskIdLower(taskId: string): number {
  const taskIdNum = parseInt(taskId, 16);
  return taskIdNum & 0xffff;
}

/**
 * Recover the original seed from a set of task IDs using XOR.
 * The seed can be recovered by XORing all task IDs together (order-independent).
 *
 * @param taskIds - Array of 8-character hex task IDs
 * @returns The recovered seed as a 32-bit unsigned integer
 * @throws Error if task IDs are invalid format
 */
export function recoverSeed(taskIds: string[]): number {
  if (taskIds.length === 0) {
    throw new Error('Cannot recover seed from empty task ID list');
  }

  let seed = 0;
  for (const taskId of taskIds) {
    if (!/^[0-9a-f]{8}$/i.test(taskId)) {
      throw new Error(`Invalid task ID format: ${taskId} (expected 8 hex characters)`);
    }
    const taskIdNum = parseInt(taskId, 16);
    seed ^= taskIdNum;
  }

  // Ensure result is unsigned 32-bit
  return seed >>> 0;
}

/**
 * Generate a normal sequence where XOR(all values) = targetXor.
 * Generates (count - 1) random values, then calculates the last value.
 *
 * @param rng - PRNG instance
 * @param count - Number of values to generate
 * @param targetXor - Target XOR value
 * @returns Array of count 16-bit values
 */
function generateNormalSequence(rng: SimplePRNG, count: number, targetXor: number): number[] {
  const sequence: number[] = [];
  let xorAccumulator = 0;

  // Generate (count - 1) random values
  for (let i = 0; i < count - 1; i++) {
    const value = rng.next16();
    sequence.push(value);
    xorAccumulator ^= value;
  }

  // Calculate last value to satisfy XOR constraint
  const lastValue = (targetXor ^ xorAccumulator) & 0xffff;
  sequence.push(lastValue);

  return sequence;
}

/**
 * Generate a unique sequence where XOR(all values) = targetXor.
 * All values must be unique. Generates (count - 1) unique random values,
 * then calculates the last value. If last value collides, regenerates (count - 2)
 * until a valid sequence is found.
 *
 * @param rng - PRNG instance
 * @param count - Number of values to generate
 * @param targetXor - Target XOR value
 * @returns Array of count unique 16-bit values
 * @throws Error if cannot generate unique sequence
 */
function generateUniqueSequence(rng: SimplePRNG, count: number, targetXor: number): number[] {
  // Edge case: single value
  if (count === 1) {
    return [targetXor];
  }

  const MAX_ATTEMPTS = 10000;
  const sequence: number[] = [];
  const usedValues = new Set<number>();

  // Generate (count - 2) unique values (guaranteed unique)
  for (let i = 0; i < count - 2; i++) {
    let value: number;
    let attempts = 0;

    do {
      value = rng.next16();
      attempts++;

      if (attempts > MAX_ATTEMPTS) {
        throw new Error(
          `Failed to generate unique value at position ${i} after ${MAX_ATTEMPTS} attempts`
        );
      }
    } while (usedValues.has(value));

    sequence.push(value);
    usedValues.add(value);
  }

  // Generate (count - 1)th value and calculate last value until both are unique
  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    // Generate (count - 1)th value
    const secondLast = rng.next16();

    if (usedValues.has(secondLast)) {
      continue; // Try again
    }

    // Calculate last value from XOR constraint
    let xorAccumulator = 0;
    for (const value of sequence) {
      xorAccumulator ^= value;
    }
    xorAccumulator ^= secondLast;
    const lastValue = (targetXor ^ xorAccumulator) & 0xffff;

    // Check if last value is unique
    if (!usedValues.has(lastValue) && lastValue !== secondLast) {
      sequence.push(secondLast);
      sequence.push(lastValue);
      return sequence;
    }
  }

  throw new Error(`Failed to generate unique sequence after ${MAX_ATTEMPTS} attempts`);
}

/**
 * Generate task IDs with separated public ID and PRNG seed.
 *
 * Algorithm:
 * 1. Use internalSeed to seed PRNG for generating random sequences
 * 2. Generate sequences that XOR to seedId (public, recoverable)
 * 3. Optionally XOR message bytes into lower bits of tasks [0..n-2]
 * 4. Combine into 32-bit task IDs
 *
 * Message capacity: (numTasks - 1) × 2 bytes
 * (Task n-1 cannot encode because its lower bits are determined by XOR constraint)
 *
 * @param seedId - Public identifier (XOR-encoded, recoverable)
 * @param internalSeed - Server-secret seed for PRNG (prevents prediction)
 * @param numTasks - Number of task IDs to generate
 * @param messageBytes - Optional message to encode
 * @returns Array of 8-character hex task IDs
 * @throws Error if message is too large or generation fails
 */
export function generateTaskIds(
  seedId: number,
  internalSeed: number,
  numTasks: number,
  messageBytes?: Uint8Array
): string[] {
  if (numTasks < 1) {
    throw new Error('Must generate at least 1 task ID');
  }

  if (numTasks > 65536) {
    throw new Error('Cannot generate more than 65536 tasks (16-bit upper limit)');
  }

  // Calculate maximum message size: (numTasks - 1) * 2 bytes
  // (Last task's lower bits are determined by XOR constraint)
  const maxMessageBytes = Math.max(0, (numTasks - 1) * 2);
  if (messageBytes && messageBytes.length > maxMessageBytes) {
    throw new Error(
      `Message too large: ${messageBytes.length} bytes exceeds maximum ${maxMessageBytes} bytes for ${numTasks} tasks`
    );
  }

  // Use internalSeed for PRNG (unpredictable without server secret)
  const rng = new SimplePRNG(internalSeed);

  // Step 1: Generate lower bits with message encoding
  // XOR target is seedId (public, recoverable)
  const lowerTargetXor = seedId & 0xffff;
  const lowerBits: number[] = [];
  let xorAccumulator = 0;

  // Generate (numTasks - 1) lower bits with optional message encoding
  for (let i = 0; i < numTasks - 1; i++) {
    let value = rng.next16();

    // XOR message bytes into value if encoding
    if (messageBytes) {
      const msgIdx = i * 2;
      if (msgIdx < messageBytes.length) {
        // Pack 2 bytes into 16 bits
        let msgValue = messageBytes[msgIdx] << 8;
        if (msgIdx + 1 < messageBytes.length) {
          msgValue |= messageBytes[msgIdx + 1];
        }
        value ^= msgValue;
      }
    }

    lowerBits.push(value);
    xorAccumulator ^= value;
  }

  // Calculate last lower bit to satisfy XOR constraint
  const lastLower = (lowerTargetXor ^ xorAccumulator) & 0xffff;
  lowerBits.push(lastLower);

  // Step 2: Generate unique sequence (upper 16 bits)
  // XOR target is seedId (public, recoverable)
  const upperTargetXor = seedId >>> 16;
  const upperBits = generateUniqueSequence(rng, numTasks, upperTargetXor);

  // Step 4: Combine into task IDs
  const taskIds: string[] = [];
  for (let i = 0; i < numTasks; i++) {
    const taskIdNum = ((upperBits[i] << 16) | lowerBits[i]) >>> 0;
    taskIds.push(taskIdNum.toString(16).padStart(8, '0'));
  }

  return taskIds;
}

/**
 * Decode task IDs to recover seedId, derive internalSeed, and restore order.
 * This is the primary decoding function that returns all evaluation data.
 *
 * Algorithm:
 * 1. Recover seedId via XOR of all task IDs
 * 2. Derive internalSeed from seedId + pepper
 * 3. Regenerate PRNG sequences using internalSeed
 * 4. Map task IDs to generation positions using upper bits
 * 5. Optionally decode message from lower bits
 *
 * @param taskIds - Array of task IDs (in any order)
 * @param pepper - Server secret for deriving internalSeed
 * @param messageLength - Optional message length to decode
 * @returns Object with seedId, internalSeed, ordered task IDs, optional message
 * @throws Error if task IDs are invalid or message decoding fails
 */
export function decodeTaskIds(taskIds: string[], pepper: string, messageLength?: number): DecodedTaskIds {
  // Step 1: Recover public seedId via XOR
  const seedId = recoverSeed(taskIds);

  // Step 2: Derive internalSeed from seedId + pepper
  const internalSeed = deriveSeed(seedId, pepper);

  // Step 3: Regenerate sequences using internalSeed for PRNG
  const rng = new SimplePRNG(internalSeed);

  // XOR targets are seedId (public, recoverable)
  const lowerTargetXor = seedId & 0xffff;
  const lowerBits = generateNormalSequence(rng, taskIds.length, lowerTargetXor);

  const upperTargetXor = seedId >>> 16;
  const upperBits = generateUniqueSequence(rng, taskIds.length, upperTargetXor);

  // Step 4: Build map of upper bits → task ID
  const taskMap = new Map<number, string>();
  for (const taskId of taskIds) {
    const upper = getTaskIdUpper(taskId);
    taskMap.set(upper, taskId);
  }

  // Step 5: Sort task IDs by generation order
  const orderedTaskIds: string[] = [];
  for (let i = 0; i < upperBits.length; i++) {
    const expectedUpper = upperBits[i];
    const taskId = taskMap.get(expectedUpper);

    if (!taskId) {
      throw new Error(
        `Decode failed: no task found with upper bits 0x${expectedUpper.toString(16).padStart(4, '0')} at position ${i}`
      );
    }

    orderedTaskIds.push(taskId);
  }

  // Step 6: Optionally decode message
  let message: Uint8Array | undefined;
  if (messageLength !== undefined && messageLength > 0) {
    message = new Uint8Array(messageLength);
    let byteIndex = 0;
    const maxEncodingTasks = Math.min(taskIds.length - 1, Math.ceil(messageLength / 2));

    for (let i = 0; i < maxEncodingTasks && byteIndex < messageLength; i++) {
      // Extract lower bits from task
      const encodedLower = getTaskIdLower(orderedTaskIds[i]);

      // XOR back with original lower bits to recover message
      const decodedValue = encodedLower ^ lowerBits[i];

      // Extract 2 bytes
      if (byteIndex < messageLength) {
        message[byteIndex++] = (decodedValue >>> 8) & 0xff;
      }
      if (byteIndex < messageLength) {
        message[byteIndex++] = decodedValue & 0xff;
      }
    }

    if (byteIndex < messageLength) {
      throw new Error(
        `Message decode incomplete: recovered ${byteIndex} bytes, expected ${messageLength} bytes`
      );
    }
  }

  return { seedId, internalSeed, orderedTaskIds, message };
}

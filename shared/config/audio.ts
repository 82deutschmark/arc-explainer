/**
 * Author: gpt-5-codex
 * Date: 2025-11-02T00:00:00Z
 * PURPOSE: Shared helpers for resolving Saturn audio narration feature flags so
 * both backend (Node) and frontend (Vite) can detect whether ElevenLabs text-to-speech
 * is available without duplicating environment variable parsing logic.
 * SRP/DRY check: Pass — consolidates audio configuration resolution.
 */

export interface SaturnAudioConfig {
  enabled: boolean;
  defaultEnabled: boolean;
  backendAdvertises: boolean;
  frontendAdvertises: boolean;
}

const BACKEND_KEY = 'SATURN_AUDIO_ENABLED';
const FRONTEND_KEY = 'VITE_SATURN_AUDIO_ENABLED';

const TRUE_LITERALS = new Set(['true', '1', 'yes', 'y', 'on']);
const FALSE_LITERALS = new Set(['false', '0', 'no', 'n', 'off']);

function parseBoolean(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (TRUE_LITERALS.has(trimmed)) {
      return true;
    }
    if (FALSE_LITERALS.has(trimmed)) {
      return false;
    }
  }
  return undefined;
}

function readProcessEnv(): Record<string, string | boolean | undefined> | undefined {
  try {
    return typeof process !== 'undefined' ? (process.env as Record<string, string | boolean | undefined>) : undefined;
  } catch {
    return undefined;
  }
}

function readImportMetaEnv(): Record<string, string | boolean | undefined> | undefined {
  try {
    const meta = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta) : undefined;
    if (!meta?.env) {
      return undefined;
    }
    return meta.env as Record<string, string | boolean | undefined>;
  } catch {
    return undefined;
  }
}

export function resolveSaturnAudioConfig(): SaturnAudioConfig {
  const processEnv = readProcessEnv();
  const importMetaEnv = readImportMetaEnv();
  const defaultEnabled = false;

  const backendAdvertises = parseBoolean(processEnv?.[BACKEND_KEY]);
  const frontendAdvertises =
    parseBoolean(processEnv?.[FRONTEND_KEY]) ?? parseBoolean(importMetaEnv?.[FRONTEND_KEY]) ?? backendAdvertises;

  const enabled = backendAdvertises ?? frontendAdvertises ?? defaultEnabled;

  return {
    enabled,
    defaultEnabled,
    backendAdvertises: backendAdvertises ?? defaultEnabled,
    frontendAdvertises: frontendAdvertises ?? defaultEnabled,
  };
}

export function isSaturnAudioEnabled(): boolean {
  return resolveSaturnAudioConfig().enabled;
}

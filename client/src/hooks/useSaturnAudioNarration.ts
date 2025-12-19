/**
 * Author: gpt-5-codex
 * Date: 2025-11-02T00:00:00Z
 * PURPOSE: React hook that converts Saturn reasoning deltas into ElevenLabs audio narration
 * by proxying through the backend. Manages buffering, playback queueing, volume control,
 * and graceful fallbacks when audio is unavailable.
 * SRP/DRY check: Pass — isolates narration concerns away from SaturnVisualSolver.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveSaturnAudioConfig } from '@shared/config/audio';

interface NarrationStatus {
  enabled: boolean;
  available: boolean;
  status: 'idle' | 'buffering' | 'playing' | 'error';
  error?: string | null;
  volume: number;
}

const audioConfig = resolveSaturnAudioConfig();

const STATUS_IDLE: NarrationStatus['status'] = 'idle';

export interface UseSaturnAudioNarration {
  enabled: boolean;
  available: boolean;
  status: NarrationStatus['status'];
  error: string | null;
  volume: number;
  toggleEnabled: () => void;
  setEnabled: (value: boolean) => void;
  setVolume: (value: number) => void;
  enqueueReasoning: (delta: string) => void;
  flush: () => void;
  reset: () => void;
}

const AUDIO_ENDPOINT = '/api/audio/narrate';
const STATUS_ENDPOINT = '/api/audio/status';

export function useSaturnAudioNarration(): UseSaturnAudioNarration {
  const [enabled, setEnabled] = useState<boolean>(audioConfig.enabled);
  const [available, setAvailable] = useState<boolean>(audioConfig.enabled);
  const [status, setStatus] = useState<NarrationStatus['status']>(STATUS_IDLE);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(0.8);

  const volumeRef = useRef(volume);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const bufferRef = useRef<string>('');
  const flushTimeoutRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const destroyedRef = useRef(false);

  const clearFlushTimeout = useCallback(() => {
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, []);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    clearFlushTimeout();
  }, [clearFlushTimeout]);

  const stopPlayback = useCallback(() => {
    const audio = currentAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore best-effort cleanup errors
      }
      currentAudioRef.current = null;
    }
    queueRef.current = Promise.resolve();
    setStatus(STATUS_IDLE);
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        const response = await fetch(STATUS_ENDPOINT, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Status request failed (${response.status})`);
        }
        const json = await response.json();
        const isEnabled = Boolean(json?.data?.enabled);
        if (!cancelled) {
          setAvailable(isEnabled);
          if (!isEnabled) {
            setEnabled(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAvailable(false);
          setEnabled(false);
          setError(err instanceof Error ? err.message : 'Audio status unavailable');
        }
      }
    }
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    destroyedRef.current = true;
    clearFlushTimeout();
    stopPlayback();
  }, [clearFlushTimeout, stopPlayback]);

  const playAudio = useCallback(async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        if (destroyedRef.current) {
          URL.revokeObjectURL(url);
          return resolve();
        }
        const audio = new Audio(url);
        audio.volume = volumeRef.current;
        audio.onended = () => {
          audio.src = '';
          URL.revokeObjectURL(url);
          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }
          resolve();
        };
        audio.onerror = () => {
          audio.src = '';
          URL.revokeObjectURL(url);
          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }
          reject(new Error('Audio playback error'));
        };
        const playPromise = audio.play();
        currentAudioRef.current = audio;
        if (playPromise) {
          playPromise.catch((err) => {
            audio.src = '';
            URL.revokeObjectURL(url);
            if (currentAudioRef.current === audio) {
              currentAudioRef.current = null;
            }
            reject(err instanceof Error ? err : new Error('Audio play failed'));
          });
        }
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const requestAudio = useCallback(async (text: string) => {
    setStatus('buffering');
    setError(null);

    const response = await fetch(AUDIO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '') || `Narration failed (${response.status})`;
      throw new Error(message);
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: response.headers.get('Content-Type') || 'audio/mpeg' });

    setStatus('playing');
    await playAudio(blob);
  }, [playAudio]);

  const enqueuePlayback = useCallback(
    (text: string) => {
      if (!text.trim()) {
        return;
      }
      const tail = queueRef.current
        .catch(() => undefined)
        .then(() => requestAudio(text))
        .catch((err) => {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Narration failed');
        });
      const finalPromise = tail.finally(() => {
        if (queueRef.current === finalPromise) {
          setStatus(STATUS_IDLE);
        }
      });
      queueRef.current = finalPromise;
    },
    [requestAudio],
  );

  const flushBuffer = useCallback(() => {
    clearFlushTimeout();
    const payload = bufferRef.current.trim();
    bufferRef.current = '';
    if (!payload) {
      return;
    }
    enqueuePlayback(payload);
  }, [clearFlushTimeout, enqueuePlayback]);

  const enqueueReasoning = useCallback(
    (delta: string) => {
      if (!enabled || !available) {
        return;
      }
      bufferRef.current += delta;
      clearFlushTimeout();
      flushTimeoutRef.current = window.setTimeout(() => {
        flushTimeoutRef.current = null;
        flushBuffer();
      }, 400);
    },
    [available, clearFlushTimeout, enabled, flushBuffer],
  );

  const reset = useCallback(() => {
    resetBuffer();
    stopPlayback();
    setError(null);
  }, [resetBuffer, stopPlayback]);

  const setEnabledSafe = useCallback(
    (value: boolean) => {
      if (!available) {
        setEnabled(false);
        return;
      }
      setEnabled(value);
      if (!value) {
        reset();
      }
    },
    [available, reset],
  );

  const toggleEnabled = useCallback(() => {
    setEnabledSafe(!enabled);
  }, [enabled, setEnabledSafe]);

  useEffect(() => {
    if (!enabled) {
      resetBuffer();
    }
  }, [enabled, resetBuffer]);

  return useMemo(
    () => ({
      enabled,
      available,
      status,
      error,
      volume,
      toggleEnabled,
      setEnabled: setEnabledSafe,
      setVolume,
      enqueueReasoning,
      flush: flushBuffer,
      reset,
    }),
    [available, enabled, error, flushBuffer, enqueueReasoning, reset, setEnabledSafe, status, toggleEnabled, volume],
  );
}

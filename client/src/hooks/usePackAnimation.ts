/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: Animation phase state machine for card pack opening sequence.
 * Manages timing transitions: idle → pack → opening → scattering → settling → complete
 * SRP/DRY check: Pass - Single responsibility for animation phase timing and transitions.
 */

import { useState, useEffect, useCallback } from 'react';

export type AnimationPhase = 'idle' | 'pack' | 'opening' | 'scattering' | 'settling' | 'complete';

interface UsePackAnimationReturn {
  phase: AnimationPhase;
  handleOpen: () => void;
  onComplete: () => void;
}

export function usePackAnimation(): UsePackAnimationReturn {
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [autoOpenTimer, setAutoOpenTimer] = useState<NodeJS.Timeout | null>(null);

  // Move to pack phase on mount
  useEffect(() => {
    setPhase('pack');
  }, []);

  // Auto-open after 2 seconds
  useEffect(() => {
    if (phase === 'pack') {
      const timer = setTimeout(() => {
        setPhase('opening');
      }, 2000);
      setAutoOpenTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleOpen = useCallback(() => {
    if (phase === 'pack') {
      // Clear auto-open timer if user clicks before timeout
      if (autoOpenTimer) {
        clearTimeout(autoOpenTimer);
      }
      setPhase('opening');
    }
  }, [phase, autoOpenTimer]);

  const onComplete = useCallback(() => {
    setPhase('complete');
  }, []);

  // Automatic phase progression after timing
  useEffect(() => {
    if (phase === 'opening') {
      const timer = setTimeout(() => setPhase('scattering'), 300);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'scattering') {
      const timer = setTimeout(() => setPhase('settling'), 500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'settling') {
      const timer = setTimeout(() => onComplete(), 800);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  return { phase, handleOpen, onComplete };
}

/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: localStorage hook for tracking first-time visitors to Hall of Fame.
 * Manages visit state and provides methods to check and reset visit status.
 * SRP/DRY check: Pass - Single responsibility for localStorage visit tracking.
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'arc-hall-of-fame-visited';

export function useFirstVisit() {
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    const visited = localStorage.getItem(STORAGE_KEY);
    setIsFirstVisit(visited === null);
  }, []);

  const markVisited = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsFirstVisit(false);
  };

  const resetVisit = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsFirstVisit(true);
  };

  // Expose reset function globally for dev testing
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__resetHallOfFameVisit = resetVisit;
    }
  }, []);

  return { isFirstVisit, markVisited, resetVisit };
}

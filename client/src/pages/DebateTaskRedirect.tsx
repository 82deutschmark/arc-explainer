/**
 * Author: Cascade (OpenAI ChatGPT)
 * Date: 2026-01-16
 * PURPOSE: Client-side bridge that preserves backwards-compatible /debate/:taskId URLs
 *           by redirecting them to the canonical Puzzle Examiner page while keeping
 *           any existing query parameters for downstream components.
 * SRP/DRY check: Pass — Only handles debate route migration logic.
 */

import { useMemo } from 'react';
import { useLocation, useParams } from 'wouter';
import Redirect from '@/components/Redirect';

export default function DebateTaskRedirect() {
  const params = useParams<{ taskId?: string }>();
  const [location] = useLocation();

  const destination = useMemo(() => {
    const rawTaskId = params?.taskId?.trim();
    const searchIndex = location.indexOf('?');
    const query = searchIndex >= 0 ? location.slice(searchIndex) : '';

    if (!rawTaskId) {
      return `/puzzle${query}`;
    }

    return `/puzzle/${rawTaskId}${query}`;
  }, [location, params?.taskId]);

  return <Redirect to={destination} />;
}

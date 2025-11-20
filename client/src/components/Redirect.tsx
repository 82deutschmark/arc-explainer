/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-01-19
 * PURPOSE: Simple redirect component that navigates to a new path
 * SRP/DRY check: Pass - Single responsibility for client-side redirects
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface RedirectProps {
  to: string;
}

export default function Redirect({ to }: RedirectProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);

  return null;
}

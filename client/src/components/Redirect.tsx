/**
 * Author: Codex
 * Date: 2026-10-08
 * PURPOSE: Redirect within the SPA or load a standalone server document
 * SRP/DRY check: Pass - Single responsibility for client-side redirects
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface RedirectProps {
  to: string;
  fullPage?: boolean;
}

export default function Redirect({ to, fullPage = false }: RedirectProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (fullPage) window.location.replace(to);
    else setLocation(to);
  }, [to, fullPage, setLocation]);

  return null;
}

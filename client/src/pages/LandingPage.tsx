/**
 * Author: Cascade
 * Date: 2026-01-07T03:10:00Z
 * PURPOSE: Minimal landing page requested by the project owner—only surfaces the VisitorCounter
 *          so visitors immediately see real traffic data while links live elsewhere.
 * SRP/DRY check: Pass — Verified VisitorCounter already encapsulates styling/logic; page simply hosts it.
 */
import React from 'react';
import { VisitorCounter } from '@/components/VisitorCounter';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <VisitorCounter page="landing" />
    </main>
  );
}

/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Give visitors a recovery action if an on-demand page chunk fails to load,
 *          including when a deployment replaces files while an older tab is open.
 * SRP/DRY check: Pass — one boundary around routing, independent of feature screens.
 */
import { Component, type ReactNode } from 'react';
export default class RouteLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">This page couldn’t load</h1>
      <p>Please reload to try again.</p>
      <button className="rounded border px-4 py-2" onClick={() => window.location.reload()}>Reload page</button>
      <a href="/home" className="ml-4 underline">Resource hub</a>
    </main>;
  }
}

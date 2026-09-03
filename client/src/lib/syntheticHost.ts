/**
 * Author: Claude Opus 5
 * Date: 2026-09-03
 * PURPOSE: One place that answers "is this host the synthetic-programme front door?".
 * App.tsx uses it to decide what `/` renders; AppHeader uses it to point the brand mark at
 * the landing page rather than at whatever `/` happens to mean on the current host. Both
 * had to agree and previously only App.tsx knew, so the brand silently became a second
 * link to the gallery on arc.markbarney.net.
 * SRP/DRY check: Pass - single exported fact, replaces a constant that lived in App.tsx.
 */

/** Hosts that lead with the synthetic-programme landing rather than the task grid. */
export const SYNTHETIC_HOSTS = new Set(["arc3.markbarney.net", "arc3.localhost"]);

export function isSyntheticHost(): boolean {
  if (typeof window === "undefined") return false;
  return (
    SYNTHETIC_HOSTS.has(window.location.hostname.toLowerCase()) ||
    new URLSearchParams(window.location.search).has("synthetic")
  );
}

/**
 * Where the brand mark goes. On the synthetic host that is `/` (the landing page itself);
 * everywhere else `/` redirects to the gallery, so the mark must name the landing route
 * explicitly or it duplicates the nav's "Browse".
 */
export function brandHomeHref(): string {
  return isSyntheticHost() ? "/" : "/synthetic";
}

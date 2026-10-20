/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: /team/login, the sign-in for the team-only pages (first one: the ARC-AGI-2 runs
 *          record). One button: sign in with Google, as on the AutoResearchArena. The server
 *          lets in Google accounts on the team list and sends the browser on to ?next= (team
 *          pages only) or the runs list. When it sends someone back here, ?error= says why, in
 *          plain words. Unlisted and noindex: nothing on the public site links here.
 *          (The first version, earlier the same day, used a shared passphrase.)
 * SRP/DRY check: Pass - sign-in page only; the Google round trip is server/routes/teamAuth.ts,
 *          the session check server/middleware/teamSession.ts. shadcn Button.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/hooks/usePageMeta';
import { googleSignInUrl, useTeamSession } from '@/components/teamRuns/teamRunsApi';

const ERRORS: Record<string, string> = {
  not_on_team: "That Google account isn't on the team list. Ask the Boss to add it, or pick another account.",
  unverified: "Google hasn't verified that account's email address, so it can't be used here.",
  google_declined: 'Google sign-in was cancelled.',
  expired: 'That sign-in took too long or came from another tab. Try again.',
  google_failed: "Google sign-in didn't go through. Try again.",
  not_configured: "Team sign-in isn't switched on yet on this site.",
};

/** Only ever go on to another team page. The server checks this too. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  return /^\/team\/[A-Za-z0-9/_-]*$/.test(next) ? next : '/team/arc2-runs';
}

export default function TeamLogin() {
  usePageMeta({ title: 'Team sign-in', description: 'Sign in to the ARC Mutants team pages.', noindex: true });
  const [, navigate] = useLocation();
  const session = useTeamSession();
  const error = new URLSearchParams(window.location.search).get('error');

  useEffect(() => {
    if (session.data?.signedIn) navigate(nextPath(), { replace: true });
  }, [session.data?.signedIn, navigate]);

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Team sign-in</h1>
      <p className="text-sm text-muted-foreground mb-6">
        For the ARC Mutants team. Sign in with the Google account the team knows you by.
      </p>
      {error && <p className="text-sm text-destructive mb-4">{ERRORS[error] ?? ERRORS.google_failed}</p>}
      {session.data && !session.data.configured ? (
        <p className="text-sm">{ERRORS.not_configured}</p>
      ) : (
        <Button asChild>
          <a href={googleSignInUrl(nextPath())}>Sign in with Google</a>
        </Button>
      )}
    </div>
  );
}

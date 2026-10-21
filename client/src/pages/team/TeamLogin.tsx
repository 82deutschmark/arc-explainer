/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: /team/login, the sign-in for the team-only pages (first one: the ARC-AGI-2 runs
 *          record). One button: sign in with Google, as on the AutoResearchArena. The server
 *          lets in Google accounts on the team list and sends the browser on to ?next= (team
 *          pages only) or the runs list. When it sends someone back here, ?error= says why, in
 *          plain words. Unlisted and noindex: nothing on the public site links here.
 *          (The first version, earlier the same day, used a shared passphrase.)
 *          Styled as the runs screen (components/teamRuns/terminal.tsx).
 *          2026-10-21 (Claude Opus 5.5): ?next= may carry dots and a plain query, so a link to
 *          one output of an eval run (/team/arc2-evals/<key>?o=<output>) survives sign-in;
 *          same pattern as the server's safeNext.
 * SRP/DRY check: Pass - sign-in page only; the Google round trip is server/routes/teamAuth.ts,
 *          the session check server/middleware/teamSession.ts.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Screen, T } from '@/components/teamRuns/terminal';
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

/** Only ever go on to another team page (no "."/".." or empty segments). The server checks this too. */
const TEAM_PAGE = /^\/team(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/?(?:\?[A-Za-z0-9=&_.-]*)?$/;
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  return TEAM_PAGE.test(next) ? next : '/team/arc2-runs';
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
    <Screen>
      <div className="max-w-[520px] mx-auto mt-16 p-3" style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
        <div className="mb-2 pb-1 font-bold" style={{ color: T.amber, borderBottom: `1px solid ${T.amber}` }}>ARC MUTANTS · TEAM SIGN-IN</div>
        <p className="mb-3" style={{ color: T.dim }}>Sign in with the Google account the team knows you by.</p>
        {error && <p className="mb-3" style={{ color: T.down }}>{ERRORS[error] ?? ERRORS.google_failed}</p>}
        {session.data && !session.data.configured ? (
          <p>{ERRORS.not_configured}</p>
        ) : (
          <a href={googleSignInUrl(nextPath())} className="inline-block px-3 py-1 font-bold" style={{ background: T.amber, color: T.bg }}>
            SIGN IN WITH GOOGLE ▸
          </a>
        )}
      </div>
    </Screen>
  );
}

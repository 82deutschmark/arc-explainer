/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: /team/login, the sign-in for the team-only pages (first one: the ARC-AGI-2 runs
 *          record). One field, the shared team passphrase; on success the server sets a
 *          sixty-day cookie and this page goes on to ?next= (team pages only) or the runs
 *          list. Unlisted and noindex: nothing on the public site links here.
 * SRP/DRY check: Pass - sign-in form only; the calls live in components/teamRuns/teamRunsApi.ts,
 *          the check in server/middleware/teamSession.ts. shadcn Input/Button/Label.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useSignIn, useTeamSession } from '@/components/teamRuns/teamRunsApi';

/** Only ever go on to another team page, so the login can't be used to bounce people elsewhere. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  return /^\/team\/[A-Za-z0-9/_-]*$/.test(next) ? next : '/team/arc2-runs';
}

export default function TeamLogin() {
  usePageMeta({ title: 'Team sign-in', description: 'Sign in to the ARC Mutants team pages.', noindex: true });
  const [, navigate] = useLocation();
  const session = useTeamSession();
  const signIn = useSignIn();
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    if (session.data?.signedIn) navigate(nextPath(), { replace: true });
  }, [session.data?.signedIn, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phrase.trim()) signIn.mutate(phrase, { onSuccess: () => navigate(nextPath(), { replace: true }) });
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Team sign-in</h1>
      <p className="text-sm text-muted-foreground mb-6">
        For the ARC Mutants team. Use the passphrase the Boss gave you; it keeps you signed in on
        this browser for two months.
      </p>
      {session.data && !session.data.configured ? (
        <p className="text-sm">Team sign-in isn't switched on yet on this site.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-passphrase">Team passphrase</Label>
            <Input id="team-passphrase" type="password" autoComplete="current-password" autoFocus
                   value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          </div>
          {signIn.error && <p className="text-sm text-destructive">{signIn.error.message}</p>}
          <Button type="submit" disabled={signIn.isPending || !phrase.trim()}>
            {signIn.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}
    </div>
  );
}

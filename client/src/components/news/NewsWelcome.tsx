/**
 * Author: Claude Sonnet 5.5
 * Date: 2026-10-10
 * PURPOSE: One-time welcome pop-up for brand-new visitors to any ARC Daily page, written for people
 *          who were sent here by a contestant and have never seen a Kaggle leaderboard: what the
 *          paper is, why the person who sent them is a big deal here, how to read it, and who to
 *          tell when it is wrong. It is a plain overlay inside the paper's own wrapper (not a
 *          portal) so it inherits the newsprint tokens. "Seen" is remembered in localStorage as a
 *          per-viewer convenience only; every read and write is guarded, and without storage the
 *          pop-up simply shows once per page load.
 * SRP/DRY check: Pass — checked NewsDesk and components/ui: no first-visit pattern exists; contact
 *          links are passed in from NewsDesk rather than duplicated.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';

const SEEN_KEY = 'arc-daily-welcome-seen';

function alreadySeen(): boolean {
  try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

function markSeen() {
  try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked: show again next visit */ }
}

interface NewsWelcomeProps {
  peoplePath: string;
  xUrl: string;
  discordUrl: string;
}

export function NewsWelcome({ peoplePath, xUrl, discordUrl }: NewsWelcomeProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!alreadySeen()) setOpen(true); }, []);
  useEffect(() => { if (open) button.current?.focus(); }, [open]);

  const close = () => { markSeen(); setOpen(false); };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="news-welcome-backdrop" onClick={close}>
      <div className="news-welcome" role="dialog" aria-modal="true" aria-labelledby="news-welcome-title" onClick={event => event.stopPropagation()}>
        <div className="news-kicker">Welcome to the sports desk</div>
        <h2 id="news-welcome-title">You've got a seat at the big game.</h2>
        <p>The ARC Daily Digest covers ARC Prize 2026: the contest to build AI that can solve puzzles it has never seen, played out on Kaggle's leaderboards.</p>
        <p><strong>If someone sent you here, they're a big deal.</strong> In this corner of data science the people on the board are the pro athletes: ranked, followed and studied, and the best of them get an illustrated card in our Hall of Fame. Find them under <Link href={peoplePath} onClick={close}>People</Link>.</p>
        <p><strong>How to read it.</strong> The stories are written by AI from saved evidence and checked against it. Standings are provisional until the private leaderboard decides the results.</p>
        <p><strong>Spot a mistake?</strong> Corrections, retractions or complaints go to Boss on <a href={xUrl} target="_blank" rel="noopener noreferrer">X</a> or in the <a href={discordUrl} target="_blank" rel="noopener noreferrer">ARC Discord</a>.</p>
        <button ref={button} type="button" className="news-welcome-go" onClick={close}>Take me to the paper</button>
      </div>
    </div>
  );
}

/**
 * Author: Claude Sonnet 5.5
 * Date: 2026-10-10
 * PURPOSE: One-time "are you a normie?" pop-up for brand-new visitors to any ARC Daily page. It shows
 *          a handful of machine-learning terms and asks whether they mean anything. Fluent readers
 *          go straight to the paper; anyone who calls it gobbledygook gets the only thing they need
 *          to know (whoever sent them here is a baller, a pro athlete of this world) plus where to
 *          send corrections. It is a plain overlay inside the paper's own wrapper (not a
 *          portal) so it inherits the newsprint tokens. "Seen" is remembered in localStorage as a
 *          per-viewer convenience only; every read and write is guarded, and without storage the
 *          pop-up simply shows once per page load.
 *          10-Oct-2026: reworked from a plain welcome into the normie check, per the Boss.
 * SRP/DRY check: Pass — checked NewsDesk and components/ui: no first-visit pattern exists; contact
 *          links are passed in from NewsDesk rather than duplicated.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';

const SEEN_KEY = 'arc-daily-welcome-seen';

/** Real machine-learning vocabulary; fluent readers recognise it at a glance. */
const JARGON = ['gradient descent', 'overfitting', 'test-time compute', 'few-shot prompting', 'loss function', 'held-out test set'];

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
  const [normie, setNormie] = useState(false);
  const focusTarget = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!alreadySeen()) setOpen(true); }, []);
  useEffect(() => { if (open) focusTarget.current?.focus(); }, [open, normie]);

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
        {!normie ? <>
          <div className="news-kicker">Quick check at the door</div>
          <h2 id="news-welcome-title">Are you a normie?</h2>
          <p>Do these mean anything to you, or is it all gobbledygook?</p>
          <ul className="news-welcome-jargon">{JARGON.map(term => <li key={term}>{term}</li>)}</ul>
          <div className="news-welcome-actions">
            <button ref={focusTarget} type="button" className="news-welcome-go" onClick={close}>Yep, that's my language</button>
            <button type="button" className="news-welcome-alt" onClick={() => setNormie(true)}>Pure gobbledygook</button>
          </div>
        </> : <>
          <div className="news-kicker">Normie confirmed</div>
          <h2 id="news-welcome-title">All you need to know:</h2>
          <p><strong>Whoever sent you here is a baller. A shot caller.</strong> If you had their number, you'd call. In this corner of data science the people on the board are the pro athletes, and this page is the sports section. The good ones even get a trading card in our Hall of Fame.</p>
          <p>The rest is a lot of very hard math. Go find them under <Link href={peoplePath} onClick={close}>People</Link> and be impressed.</p>
          <p className="news-welcome-fine">The stories are written by AI from saved evidence, and standings are provisional. Spot a mistake? Corrections, retractions or complaints go to Boss on <a href={xUrl} target="_blank" rel="noopener noreferrer">X</a> or in the <a href={discordUrl} target="_blank" rel="noopener noreferrer">ARC Discord</a>.</p>
          <div className="news-welcome-actions">
            <button ref={focusTarget} type="button" className="news-welcome-go" onClick={close}>Got it, show me the paper</button>
          </div>
        </>}
      </div>
    </div>
  );
}

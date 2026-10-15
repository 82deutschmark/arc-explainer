/**
 * Author: Claude Sonnet 5.5; Claude Opus 5.5 Low
 * Date: 2026-10-10; 2026-10-15 (book ad, then links to Chollet's paper and ARC Prize)
 * PURPOSE: One-time pop-up for brand-new visitors to any ARC Daily page. Since 15-Oct-2026 it is a
 *          joke "sponsored" interstitial: a parody ad for François Chollet's Deep Learning with
 *          Python ("Master the AI before it masters you"), art supplied by the Boss and stored at
 *          client/public/ads/deep-learning-with-python.jpg. It replaces the earlier "are you a
 *          normie?" check, per the Boss. Both buttons just close it; the fine print says it is a
 *          parody, not a real Manning or ARC Prize ad. It is a plain overlay inside the paper's own
 *          wrapper (not a portal) so it inherits the newsprint tokens. "Seen" is remembered in
 *          localStorage as a per-viewer convenience only; the key changed with the ad so readers who
 *          dismissed the normie check see it once. Every read and write is guarded, and without
 *          storage the pop-up simply shows once per page load.
 * SRP/DRY check: Pass — checked NewsDesk and components/ui: no first-visit pattern exists; the
 *          ad art sits beside the other sponsor art in client/public/ads (SponsorPlacement).
 */
import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'arc-daily-book-ad-seen';

function alreadySeen(): boolean {
  try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

function markSeen() {
  try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked: show again next visit */ }
}

export function NewsWelcome() {
  const [open, setOpen] = useState(false);
  const focusTarget = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!alreadySeen()) setOpen(true); }, []);
  useEffect(() => { if (open) focusTarget.current?.focus(); }, [open]);

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
      <div className="news-welcome news-book-ad" role="dialog" aria-modal="true" aria-labelledby="news-welcome-title" onClick={event => event.stopPropagation()}>
        <div className="news-book-ad-bar">
          <span>Advertisement</span>
          <button type="button" className="news-book-ad-x" aria-label="Close the ad" onClick={close}>×</button>
        </div>
        <h2 id="news-welcome-title" className="sr-only">Master the AI before it masters you: Deep Learning with Python, by François Chollet</h2>
        <img src="/ads/deep-learning-with-python.jpg" width={848} height={1264}
          alt="Parody book cover: Deep Learning with Python by François Chollet. A cyberpunk Chollet reaches out among glowing ARC puzzle grids under the line 'Master the AI before it masters you.'" />
        <div className="news-welcome-actions">
          <button ref={focusTarget} type="button" className="news-welcome-go" onClick={close}>Your only hope — read the paper</button>
          <button type="button" className="news-welcome-alt" onClick={close}>No thanks, let the AI master me</button>
        </div>
        <p className="news-welcome-fine">Parody ad. Not from Manning, ARC Prize or Mr Chollet, though the book is real and worth it. The idea behind ARC is in his paper <a href="https://arxiv.org/abs/1911.01547" target="_blank" rel="noopener noreferrer">On the Measure of Intelligence</a>, and the contest lives at <a href="https://arcprize.org" target="_blank" rel="noopener noreferrer">ARC Prize</a>.</p>
      </div>
    </div>
  );
}

/**
 * Author: Claude Sonnet 5.5; Claude Opus 5.5 Low; Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 2026-10-10; 2026-10-15 (book ad, then links to Chollet's paper and ARC Prize)
 * 14-Nov-2026 (Claude Opus 5.5): opens only on the /news front page, never over a story, wire, card, profile
 *          or other deep link; "seen" is also kept in a module variable so blocked storage cannot bring it
 *          back on every in-app navigation; Tab stays inside the dialog while it is open and focus returns
 *          to where it was when it closes.
 * PURPOSE: One-time pop-up for brand-new visitors to the ARC Daily front page. Since 15-Oct-2026 it is a
 *          joke "sponsored" interstitial: a parody ad for François Chollet's Deep Learning with
 *          Python ("Master the AI before it masters you"), art supplied by the Boss and stored at
 *          client/public/ads/deep-learning-with-python.jpg. It replaces the earlier "are you a
 *          normie?" check, per the Boss. Both buttons just close it; the fine print says it is a
 *          parody, not a real Manning or ARC Prize ad. It is a plain overlay inside the paper's own
 *          wrapper (not a portal) so it inherits the newsprint tokens. "Seen" is remembered in
 *          localStorage as a per-viewer convenience only; the key changed with the ad so readers who
 *          dismissed the normie check see it once. Every read and write is guarded, and without
 *          storage the pop-up shows at most once per page load.
 * SRP/DRY check: Pass — checked NewsDesk and components/ui: no first-visit pattern exists; the
 *          ad art sits beside the other sponsor art in client/public/ads (SponsorPlacement).
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation } from 'wouter';

const SEEN_KEY = 'arc-daily-book-ad-seen';
/** The only page the ad may open on; deep links go straight to what the reader asked for. */
const FRONT_PAGE = '/news';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Survives in-app navigation even when localStorage is blocked; resets only on a full page load. */
let seenThisLoad = false;

function alreadySeen(): boolean {
  if (seenThisLoad) return true;
  try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

function markSeen() {
  seenThisLoad = true;
  try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked: the module flag still covers this page load */ }
}

export function NewsWelcome() {
  const [location] = useLocation();
  const onFrontPage = location.replace(/\/+$/, '') === FRONT_PAGE;
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!onFrontPage || alreadySeen()) return;
    // Shown once per load at most, whatever the reader does next.
    seenThisLoad = true;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, [onFrontPage]);
  useEffect(() => { if (open) focusTarget.current?.focus(); }, [open]);
  // Leaving the front page (back button, a link in the fine print) takes the ad with it.
  useEffect(() => { if (!onFrontPage) setOpen(false); }, [onFrontPage]);

  const close = () => {
    markSeen();
    setOpen(false);
    returnFocus.current?.focus?.();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /** Keep Tab and Shift+Tab cycling inside the dialog while it is open. */
  const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.current.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !dialog.current.contains(active))) { event.preventDefault(); first.focus(); }
  };

  if (!open || !onFrontPage) return null;
  return (
    <div className="news-welcome-backdrop" onClick={close}>
      <div ref={dialog} className="news-welcome news-book-ad" role="dialog" aria-modal="true" aria-labelledby="news-welcome-title" onClick={event => event.stopPropagation()} onKeyDown={trapTab}>
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

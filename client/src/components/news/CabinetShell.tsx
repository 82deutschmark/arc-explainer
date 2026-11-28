/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Sonnet 5.5; Claude Opus 5.5 Medium
 * Date: 27-November-2026 (Claude Opus 5.5 Medium); 02-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): the countdown names the contest it counts to (Generalist Gaming now, via
 *          theClose/closeCountdown), and the footer's ARC Discord link gives way to the ARC Prize 2026 archive.
 * PURPOSE: The Card Cabinet's page frame. The Boss wants the cards to start at the top of the page, so this
 *          replaces the broadsheet masthead (nameplate, edition line, advertisement row) with one slim bar:
 *          the paper's name, its section links, the countdown to the close and the same disclosed VoynichLabs
 *          unit. The dark theme lives on .arc-daily.is-cabinet in newsCards.css.
 *          Card proofs use a compact navigation bar so both complete faces fit on screen.
 * SRP/DRY check: Pass — links come from NewsNav and the sponsor unit from SponsorPlacement; the only new thing
 *          is the arrangement.
 */
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { NEWS_NAME, NEWS_BRAND } from '@shared/news';
import { NewsNav, closeCountdown, theClose } from './NewsDesk';
import { ARC_2026_ARCHIVE } from '@shared/newsSeasons';
import { MastheadAd } from './SponsorPlacement';
import { NewsWelcome } from './NewsWelcome';
import './news.css';
import './newsCards.css';

export function CabinetShell({ children, cardProof = false }: { children: ReactNode; cardProof?: boolean }) {
  const close = theClose();
  return <div className={`arc-daily is-cabinet${cardProof ? ' is-card-proof' : ''}`}>
    <header className="cb-bar">
      <Link href="/news" className="cb-brand">{NEWS_BRAND.logo && <img src={NEWS_BRAND.logo} alt="" width="40" style={{ height: 'auto' }} />} {NEWS_NAME}</Link>
      <NewsNav className="cb-nav" />
      {!cardProof && close && <span className="cb-close">{closeCountdown(close)}</span>}
      {!cardProof && <MastheadAd />}
    </header>
    {children}
    <NewsWelcome />
    <footer className="cb-foot">
      <span>{NEWS_NAME} · {NEWS_BRAND.goose ? 'Kaggleverse cards' : 'ARC Prize Cards'}</span>
      <span>Standings move until a competition closes; final results come from the private leaderboard.</span>
      <Link href={ARC_2026_ARCHIVE.path}>{ARC_2026_ARCHIVE.heading} →</Link>
      <Link href="/news">Front page →</Link>
    </footer>
  </div>;
}

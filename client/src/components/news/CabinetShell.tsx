/**
 * Author: Claude Sonnet 5.5
 * Date: 2026-10-30
 * PURPOSE: The Card Cabinet's page frame. The Boss wants the cards to start at the top of the page, so this
 *          replaces the broadsheet masthead (nameplate, edition line, advertisement row) with one slim bar:
 *          the paper's name, its section links, the countdown to the close and the same disclosed VoynichLabs
 *          unit. The dark theme lives on .arc-daily.is-cabinet in newsCards.css.
 * SRP/DRY check: Pass — links come from NewsNav and the sponsor unit from SponsorPlacement; the only new thing
 *          is the arrangement.
 */
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { NEWS_NAME } from '@shared/news';
import { NewsNav, theClose, ARC_DISCORD_URL } from './NewsDesk';
import { MastheadAd } from './SponsorPlacement';
import { NewsWelcome } from './NewsWelcome';
import './news.css';
import './newsCards.css';

export function CabinetShell({ children }: { children: ReactNode }) {
  const close = theClose();
  return <div className="arc-daily is-cabinet">
    <header className="cb-bar">
      <Link href="/news" className="cb-brand">{NEWS_NAME}</Link>
      <NewsNav className="cb-nav" />
      {close && <span className="cb-close">{close.days} {close.days === 1 ? 'day' : 'days'} to the {close.date} close</span>}
      <MastheadAd />
    </header>
    {children}
    <NewsWelcome />
    <footer className="cb-foot">
      <span>{NEWS_NAME} · Card Cabinet</span>
      <span>Standings move until a competition closes; final results come from the private leaderboard.</span>
      <a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">ARC Discord ↗</a>
      <Link href="/news">The Digest →</Link>
    </footer>
  </div>;
}

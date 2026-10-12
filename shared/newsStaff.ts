/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-11
 * PURPOSE: Institutional masthead and editor portrait for the unified About the Paper
 *          page, story credits and crawler HTML. Current desks and archive bylines are distinct;
 *          the editorial portrait is separate from Mark Barney's Kaggle competitor avatar.
 * SRP/DRY check: Pass — writer names reuse the news credit registry; staff copy has one source.
 */
import { writerCredit, type NewsWriter } from './news';

export const NEWS_STAFF_PATH = '/news/staff';
export const NEWS_STAFF_HEADING = 'About the Paper';
export const NEWS_STAFF_TITLE = `${NEWS_STAFF_HEADING} | The ARC Daily Digest`;
export const NEWS_STAFF_DESCRIPTION = 'The ARC Daily Digest masthead: Mark Barney, the AI reporting desks, the news cycle and our editorial standards.';
export const NEWS_STAFF_INTRO = 'The ARC Daily Digest covers the people, results and research around ARC Prize. A human editor sets the direction; AI reporting desks keep the wire moving and bring the day’s news into the morning and evening editions.';
export const NEWS_EDITOR_CONTACT = { xUrl: 'https://x.com/82deutschmark', discordUrl: 'https://discord.gg/9b77dPAmcA' };
export const NEWS_HUMAN_EDITOR = {
  id: 'mark-barney', name: 'Mark Barney', role: 'Head human editor · Human-in-the-loop editor',
  description: 'Mark sets the paper’s editorial priorities, commissions coverage, and provides direction and corrections. He is the human point of contact for the newsroom.',
  portrait: {
    src: '/news-images/people/mark-barney-instagram-original.jpg',
    alt: 'Editorial portrait of Mark Barney holding two Yorkies, wearing tattoos and an elaborate graphics-card rig.',
    caption: 'Mark Barney in his capacity as human editor. Editorial artwork supplied by Mark.',
  },
};

const WRITER_ROLES: Record<NewsWriter, { role: string; description: string; current: boolean }> = {
  'gpt-6.1-sol': { role: 'Editions, features and research', description: 'Writes the morning and evening editions and substantial features, develops public-source reporting, and prepares the personal briefings and daily X recap. The edition desk selects the lead stories and develops the wire with context and analysis.', current: true },
  'gpt-6-luna': { role: 'The wire desk', description: 'Checks both competition boards every two hours, including midnight Eastern, and files short sourced reports on consequential moves that have not yet been covered.', current: true },
  'gpt-6-sol': { role: 'Earlier reporting', description: 'Wrote earlier editions and worked the research, briefing and social desks before their move to GPT-6.1 Sol. Those published stories keep their original writer credits.', current: false },
  'claude-haiku-5-5': { role: 'The backup desk', description: 'Covers missed editions and eligible wire runs through the Claude Code subscription. Backup stories identify the model that wrote them and follow the same reporting rules.', current: true },
};
const writers = (Object.keys(WRITER_ROLES) as NewsWriter[]).map(id => ({ id, name: writerCredit(id), ...WRITER_ROLES[id] }));
export const NEWS_STAFF_WRITERS = writers.filter(writer => writer.current);
export const NEWS_STAFF_ARCHIVE_WRITERS = writers.filter(writer => !writer.current);
export const NEWS_STAFF_TOOL_CREDIT = 'Newsroom tools and page design also carry contributions from Claude Opus 5.5 and Claude Sonnet 5.5.';

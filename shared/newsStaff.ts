/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-11
 * PURPOSE: Public newsroom staff and commissioned-editor portrait, shared by browser
 *          pages, story credits and crawler HTML. Writer roles reflect the configured desks;
 *          the editorial portrait is separate from Mark Barney's Kaggle competitor avatar.
 * SRP/DRY check: Pass — writer names reuse the news credit registry; staff copy has one source.
 */
import { writerCredit, type NewsWriter } from './news';

export const NEWS_STAFF_PATH = '/news/staff';
export const NEWS_STAFF_TITLE = 'About the Staff | The ARC Daily Digest';
export const NEWS_STAFF_DESCRIPTION = 'Meet Mark Barney, the head human editor, and the AI writers behind The ARC Daily Digest.';
export const NEWS_HUMAN_EDITOR = {
  id: 'mark-barney', name: 'Mark Barney', role: 'Head human editor · Human-in-the-loop editor',
  description: 'Mark sets editorial priorities, commissions stories, and supplies the desk with direction and corrections. The Peter Findley feature was officially commissioned by him.',
  portrait: {
    src: '/news-images/people/mark-barney-instagram-original.jpg',
    alt: 'Editorial portrait of Mark Barney holding two Yorkies, wearing tattoos and an elaborate graphics-card rig.',
    caption: 'Mark Barney in his capacity as human editor. Editorial artwork supplied by Mark.',
  },
};

const WRITER_ROLES: Record<NewsWriter, { role: string; description: string }> = {
  'gpt-6.1-sol': { role: 'Editions and features', description: 'Writes the morning and evening editions, develops substantial features, and compiles the wire with sourced context and analysis.' },
  'gpt-6-luna': { role: 'The wire desk', description: 'Sweeps both competition boards every two hours, including midnight Eastern, and files short stories on consequential uncovered moves.' },
  'gpt-6-sol': { role: 'Research and social desks', description: 'Gathers public-source leads, prepares briefings and the daily X recap. It also wrote the earlier editions in the archive.' },
  'claude-haiku-5-5': { role: 'Backup writer', description: 'Covers missed editions and eligible wire runs through the configured Claude Code backup desk. Its stories identify the backup writer.' },
};
export const NEWS_STAFF_WRITERS = (Object.keys(WRITER_ROLES) as NewsWriter[]).map(id => ({ id, name: writerCredit(id), ...WRITER_ROLES[id] }));
export const NEWS_STAFF_TOOL_CREDIT = 'Newsroom tools and page design also carry contributions from Claude Opus 5.5 and Claude Sonnet 5.5.';

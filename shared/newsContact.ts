/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Keep the working public tip contact and community link in the wiki
 * projection, separate from private Discord publishing and operational routes.
 * SRP/DRY check: Pass — one contact record feeds banner, tip page and plain HTML.
 */
import contact from './newsContact.json';
export const NEWS_TIPS_PATH = '/news/tips';
export const NEWS_CONTACT = contact;

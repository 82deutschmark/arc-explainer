/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Add the current approved catalog to the existing HTML/sitemap delivery.
 * SRP/DRY check: Pass — uses the same manifest as the player, never a second approval list.
 */
import { Arc3TrainableCatalog, trainablePlayId } from '../arc3Mirror/Arc3TrainableCatalog';
import { approvedPlayMeta } from '../../../shared/arc3PlayMeta';
import { completeMeta, escapeHtml as esc, SITE_ORIGIN } from '../../../shared/seo';
import { resolvePageMeta } from './pageContent';

export async function resolvePublicPageMeta(route: string): Promise<ReturnType<typeof resolvePageMeta>> {
  const existing = resolvePageMeta(route);
  const play = route.match(/^\/arc3\/play\/([A-Za-z0-9_.-]{1,64})$/);
  if (route !== '/arc3/gallery' && !play) return existing;
  const { versions } = await Arc3TrainableCatalog.manifest();
  if (play) {
    const v = versions.find(v => trainablePlayId(v) === play[1]);
    // Legacy bookmarks remain playable but are not promoted as currently approved games.
    if (!v) return existing;
    const tags = approvedPlayMeta(play[1], v.finalLabel || v.gameId);
    tags.bodyHtml = `<main><h1>Play ${esc(v.finalLabel || v.gameId)}</h1><p>${esc(tags.description)}</p><img src="${esc(tags.image!)}" alt="${esc(tags.imageAlt!)}" width="256" height="256" style="image-rendering:pixelated"/><p>The interactive player loads in this page. Use its controls to explore the board and discover the goal.</p><p><a href="/arc3/gallery">Browse all approved games</a> · <a href="/arc3">About ARC-AGI-3 and ARCEngine</a></p></main>`;
    return { status: 200, tags: completeMeta(tags) };
  }
  const tags = { ...existing.tags };
  tags.bodyHtml = `<main><h1>Play ARC-AGI-3 games</h1><p>Original reasoning games selected through human review. Pick a board and discover its rules as you play. No login required.</p><p><a href="/play">Play a game</a> · <a href="/arc3">How ARC-AGI-3 and ARCEngine work</a></p><p>${versions.length} games available.</p><ul>${versions.map(v => {
    const id = trainablePlayId(v), label = v.finalLabel || v.gameId;
    return `<li><a href="/arc3/play/${id}"><img src="/api/arc3-mirror/games/${id}/thumbnail?size=256" alt="${esc(label)} opening board" width="128" height="128" loading="lazy"/>Play ${esc(label)}</a></li>`;
  }).join('')}</ul></main>`;
  if (versions[0]) tags.image = approvedPlayMeta(trainablePlayId(versions[0]), versions[0].finalLabel || versions[0].gameId).image;
  return { status: 200, tags: completeMeta(tags) };
}
export async function trainableSitemapUrls(): Promise<string[]> {
  return (await Arc3TrainableCatalog.manifest()).versions.map(v => `${SITE_ORIGIN}/arc3/play/${trainablePlayId(v)}`);
}

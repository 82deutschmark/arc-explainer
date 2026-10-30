/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Render artwork-led landscape previews for shared player and team card URLs.
 *          Complete team scenes stay uncropped; player links use that player's own image
 *          and sourced career highlight. Collectible front/back exports remain separate.
 * SRP/DRY check: Pass — reuses guarded artwork reads, committed fonts, public card data
 *          and shared preview wording/versioning; no remote reads or replacement artwork.
 */
import satori from 'satori';
import sharp from 'sharp';
import { COLLECTION_SHARE_WIDTH, COLLECTION_SHARE_HEIGHT, collectionShareVersion, type CollectionCard } from '../../../shared/newsCollection';
import { competitionName } from '../../../shared/news';
import { loadCollectionCardFonts, readCollectionArtwork } from './newsCollectionImage';

type PreviewNode = { type: string; props: Record<string, unknown> };
type Style = Record<string, string | number>;
const PAPER = '#f7f0df';
const INK = '#211d17';
const OXBLOOD = '#8d1c12';
const GOLD = '#9a7210';
const SERIF = 'IBM Plex Serif';
const SANS = 'IBM Plex Sans Condensed';
const CJK = 'Noto Sans JP';
const box = (style: Style, ...children: (PreviewNode | string | null)[]): PreviewNode => ({
  type: 'div', props: { style: { display: 'flex', ...style }, children: children.filter(child => child !== null) },
});
const label = (text: string, style: Style = {}) => box({ fontFamily: `${SANS}, ${CJK}`, fontWeight: 700, fontSize: 18, letterSpacing: 1, ...style }, text);

function artworkNode(card: CollectionCard, artwork: Buffer | null, width: number, height: number): PreviewNode {
  return artwork ? { type: 'img', props: { src: `data:image/png;base64,${artwork.toString('base64')}`, width, height } }
    : box({ width, height, alignItems: 'center', justifyContent: 'center', color: OXBLOOD, background: '#e9ddc4', fontFamily: `${SERIF}, ${CJK}`, fontSize: 110, fontWeight: 700 },
      card.name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toLocaleUpperCase());
}

/** The node used by the actual PNG renderer, so tests can inspect unaltered names and career copy. */
export function buildCollectionShareNode(card: CollectionCard, artwork: Buffer | null): PreviewNode {
  const contests = [...new Set(card.entries.map(entry => competitionName(entry.competition)))].join(' · ');
  if (card.kind === 'team') return box({ width: COLLECTION_SHARE_WIDTH, height: COLLECTION_SHARE_HEIGHT, padding: 24, background: PAPER, color: INK, flexDirection: 'column' },
    box({ justifyContent: 'space-between', height: 24, flexShrink: 0 }, label('THE ARC DAILY DIGEST', { color: OXBLOOD }), label(`${card.number} · TEAM CARD · ${card.season}`, { fontSize: 16, color: '#6b604e' })),
    box({ width: 1152, height: 448, flexShrink: 0, marginTop: 8, border: `1px solid ${GOLD}`, alignItems: 'center', justifyContent: 'center' }, artworkNode(card, artwork, 1150, 446)),
    box({ width: 1152, height: 94, flexShrink: 0, padding: '9px 18px', marginTop: 8, background: OXBLOOD, color: '#fff3d5', flexDirection: 'column', justifyContent: 'center' },
      box({ fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700, fontSize: Array.from(card.name).length > 36 ? 35 : 45, lineHeight: 1.08 }, card.name),
      label(`${contests ? `${contests} · ` : ''}Meet the players. Explore the team’s record.`, { marginTop: 5, fontSize: 17, letterSpacing: .3, color: '#f1d6a9' })));

  const teams = [...new Set(card.teamHistory.filter(team => team.status === 'current').map(team => team.teamName))];
  const career = card.highlights[0]?.text ?? card.description;
  return box({ width: COLLECTION_SHARE_WIDTH, height: COLLECTION_SHARE_HEIGHT, padding: 28, background: PAPER, color: INK, flexDirection: 'column' },
    box({ justifyContent: 'space-between', height: 28 }, label('THE ARC DAILY DIGEST', { color: OXBLOOD }), label(`${card.number} · PLAYER CARD · ${card.season}`, { color: '#6b604e', fontSize: 16 })),
    box({ marginTop: 14, gap: 28, alignItems: 'center', flexGrow: 1 },
      box({ width: 510, height: 510, border: `1px solid ${GOLD}`, alignItems: 'center', justifyContent: 'center', background: '#e9ddc4' }, artworkNode(card, artwork, 508, 508)),
      box({ width: 606, height: 510, flexDirection: 'column', justifyContent: 'center' },
        label('THE PLAYER', { color: OXBLOOD, fontSize: 17 }),
        box({ marginTop: 10, fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700, fontSize: Array.from(card.name).length > 28 ? 46 : 61, lineHeight: 1.02 }, card.name),
        ...(teams.length ? [box({ marginTop: 20, flexDirection: 'column', gap: 7 }, ...teams.slice(0, 2).map(team => box({ fontFamily: `${SANS}, ${CJK}`, fontWeight: 700, fontSize: 27, color: OXBLOOD }, team)))] : []),
        career ? box({ display: 'block', marginTop: 24, paddingTop: 18, borderTop: `2px solid ${GOLD}`, fontFamily: `${SERIF}, ${CJK}`, fontWeight: 400, fontSize: 25, lineHeight: 1.35, lineClamp: 4, overflow: 'hidden' }, career) : null,
        label('Kaggle history · Teams · Career record', { marginTop: 22, color: '#6b604e', fontSize: 18, letterSpacing: .1 }))));
}

const previews = new Map<string, Buffer>();
export async function buildCollectionShareImage(card: CollectionCard): Promise<Buffer> {
  const version = collectionShareVersion(card);
  const cached = previews.get(version);
  if (cached) return cached;
  const dimensions = card.kind === 'team' ? { width: 1150, height: 446 } : { width: 508, height: 508 };
  const artwork = card.art ? await readCollectionArtwork(card.art.src, dimensions) : null;
  const svg = await satori(buildCollectionShareNode(card, artwork) as Parameters<typeof satori>[0], {
    width: COLLECTION_SHARE_WIDTH, height: COLLECTION_SHARE_HEIGHT, fonts: loadCollectionCardFonts(),
  });
  const png = await sharp(Buffer.from(svg)).flatten({ background: PAPER }).png({ compressionLevel: 9 }).toBuffer();
  if (previews.size >= 8) previews.delete(previews.keys().next().value!);
  previews.set(version, png);
  return png;
}

/**
 * Author: Claude Sonnet 5.5 Low (replaces GPT-6 / Codex's preview of 29-Oct-2026)
 * Date: 30-Oct-2026
 * PURPOSE: The 1200 x 630 link preview (og:image / twitter:image) for a shared card URL, in the same Topps look as the
 *          card. Left: the real front render, scaled (never re-drawn). Right: a grey-cardboard, two-ink panel with the
 *          series wordmark and card number, the name in Alfa Slab One, the tier line ("KAGGLE GRANDMASTER"), the lead
 *          contest's rank and score, medal coins (or the sponsor's organisation and bio), the single AS OF date and the
 *          site's host. All wording comes from the enriched card; the same forbidden-word lint as the card faces applies.
 * SRP/DRY check: Pass. Composes cardFace/ pieces (model, fonts, name fitting, front render); no art reading, no data rules.
 *
 * CHANGELOG
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Low): redesigned in the Topps look; takes the collection; node builder is async.
 * 30-Oct-2026 v3 (Claude Sonnet 5.5 Medium, review fixes): a long handle is printed as just the @handle (never cut off with an
 *          ellipsis); the member-medal box says how many members it covers when not all are counted; the preview cache
 *          holds a whole crawl and shares one in-flight render per address; "shares the card with" is not printed beside PICTURED WITH.
 */
import satori from 'satori';
import sharp from 'sharp';
import { COLLECTION_SHARE_WIDTH, COLLECTION_SHARE_HEIGHT, collectionLeadEntry, collectionShareVersion, type CollectionCard, type NewsCollection } from '../../../shared/newsCollection';
import { cardFaceModel, renderCardFace } from './cardFace';
import { FONT, ff, box, loadFonts, fitNameLines, MEDAL, type Node, type Style, type Kid } from './cardFace/kit';
import { viewModel, type VM } from './cardFace/model';

const STOCK = '#c9c5b8';
const PAPER_LIGHT = '#efe9d8';
const INK = '#15161d';
const W = COLLECTION_SHARE_WIDTH, H = COLLECTION_SHARE_HEIGHT;
const PAD = 12;
const CARD_H = H - PAD * 2, CARD_W = Math.round(CARD_H * 750 / 1050);
const PANEL_X = PAD + CARD_W + PAD;                  // the cardboard panel starts here
const PANEL_W = W - PANEL_X;
const INNER_W = PANEL_W - 2 * 22;                    // text column inside the panel

const text = (value: string, style: Style = {}): Node => box({ whiteSpace: 'nowrap', ...style }, value);
const clip = (style: Style): Style => ({ overflow: 'hidden', textOverflow: 'ellipsis', ...style });

/** One stat box: a dark label strip over a big value. */
function stat(label: string, value: string, vm: VM, grow: number, size: number): Node {
  return box({ flexDirection: 'column', flexGrow: grow, flexBasis: 0, border: `3px solid ${INK}`, background: PAPER_LIGHT },
    box({ background: vm.T.deep, color: '#ffffff', justifyContent: 'center', padding: '3px 0', fontFamily: ff(FONT.bebas), fontSize: 26, letterSpacing: 2 }, label),
    box({ flexGrow: 1, alignItems: 'center', justifyContent: 'center', color: INK, fontFamily: ff(FONT.slab), fontSize: size, lineHeight: 1 }, value));
}
/** Medal coins for a competitor, or the roster's summed medals on a team card (labelled as such). */
function coins(vm: VM, grow: number): Node | null {
  const m = vm.medals ?? vm.rosterMedals?.totals;
  if (!m || m.gold + m.silver + m.bronze === 0) return null;
  const coin = (n: number, colour: string) => box({ width: 62, height: 62, borderRadius: 31, background: colour, border: `3px solid ${INK}`, alignItems: 'center', justifyContent: 'center', color: INK, fontFamily: ff(FONT.slab), fontSize: 28 }, String(n));
  return box({ flexDirection: 'column', flexGrow: grow, flexBasis: 0, border: `3px solid ${INK}`, background: PAPER_LIGHT },
    box({ background: vm.T.deep, color: '#ffffff', justifyContent: 'center', padding: '3px 0', fontFamily: ff(FONT.bebas), fontSize: 26, letterSpacing: 2 }, vm.medals ? 'MEDALS' : vm.rosterMedals && vm.rosterMedals.known < vm.rosterMedals.of ? `${vm.rosterMedals.known} OF ${vm.rosterMedals.of} MEMBERS` : 'MEMBER MEDALS'),
    box({ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }, coin(m.gold, MEDAL.gold), coin(m.silver, MEDAL.silver), coin(m.bronze, MEDAL.bronze)));
}

/** The node the PNG is drawn from (exported so a test can lint the wording). `front` is the card's front PNG, or null. */
export async function buildCollectionShareNode(card: CollectionCard, collection: NewsCollection, front: Buffer | null): Promise<Node> {
  const { model, names } = cardFaceModel(card, collection);
  const vm = viewModel(model, { namesById: names });
  const lead = collectionLeadEntry(card);
  const contest = lead ? vm.contests[card.entries.indexOf(lead)] ?? vm.contests[0] : vm.contests[0];
  const ink1 = vm.T.deep;
  const band = vm.tierLine ?? (vm.family === 'team' ? [vm.typeLabel, vm.sizeLabel].filter(Boolean).join(' · ') : vm.typeLabel);
  // The platform suffix only when the whole line fits; a long handle is just the @handle.
  const handleText = vm.handleLine && vm.handleLine.length <= 18 ? vm.handleLine : vm.handle;
  const asOf = vm.stamp ? `${vm.stamp.word} · AS OF ${vm.stamp.date}` : null;
  let host = '';
  try { host = new URL(model.urlAbsolute).host; } catch { host = ''; }

  const nameFit = await fitNameLines(vm.name, FONT.slab, 400, INNER_W, 190, { max: 92, min: 44, twoLineMax: 74, twoLineMin: 40 }, 1.02);

  const stats: Node[] = [];
  if (contest?.rank) stats.push(stat('RANK', contest.rank, vm, 1.5, contest.rank.length > 6 ? 76 : 100));
  if (contest?.score) stats.push(stat('SCORE', contest.score, vm, 1, 56));
  const medals = coins(vm, 1.1);
  if (medals) stats.push(medals);
  const body: Kid[] = [];
  if (contest && stats.length) {
    body.push(box({ justifyContent: 'space-between', alignItems: 'center', fontFamily: ff(FONT.bebas), fontSize: 30, letterSpacing: 1, color: INK },
      text(contest.tag, clip({ maxWidth: contest.entryLine ? INNER_W * 0.62 : INNER_W })),
      contest.entryLine ? text(contest.entryLine.toUpperCase(), clip({ color: ink1, maxWidth: INNER_W * 0.36 })) : null));
    body.push(box({ flexGrow: 1, gap: 10, marginTop: 6 }, ...stats));
  } else {
    // A sponsor or a card with no standings yet: who they are, in the card's own words.
    const lines: Kid[] = [];
    if (vm.organisation) lines.push(box({ fontFamily: ff(FONT.bebas), fontSize: 36, color: ink1, letterSpacing: 1 }, vm.organisation.toUpperCase()));
    // A fact that mostly repeats the bio is not printed twice (the same rule the reverse follows).
    const bioWords = new Set((vm.bio ?? '').toLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? []);
    const facts = vm.facts.filter(f => !(vm.sharedWith.length && /^shares the .* card with\b/i.test(f))).filter(f => { const w = f.toLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? []; return w.length > 0 && w.filter(x => bioWords.has(x)).length / w.length < 0.6; }).slice(0, 2);
    if (vm.bio) lines.push(box({ display: 'block', marginTop: 6, fontFamily: ff(FONT.cond), fontWeight: 500, fontSize: facts.length ? 29 : 34, lineHeight: 1.28, color: INK, lineClamp: facts.length ? 4 : 7, overflow: 'hidden' }, vm.bio));
    // The card's dated facts and who it is pictured with fill the rest of the panel; each is a short ruled line.
    for (const fact of facts) lines.push(box({ display: 'block', marginTop: 8, paddingTop: 7, borderTop: `2px solid ${INK}`, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: 25, lineHeight: 1.25, color: ink1, lineClamp: 2, overflow: 'hidden' }, fact));
    if (vm.sharedWith.length) lines.push(box({ marginTop: 8, paddingTop: 7, borderTop: `2px solid ${INK}`, fontFamily: ff(FONT.bebas), fontSize: 30, letterSpacing: 1, color: INK }, `PICTURED WITH ${vm.sharedWith.join(' AND ').toUpperCase()}`));
    if (medals) lines.push(box({ height: 130, marginTop: 10 }, medals));
    body.push(box({ flexDirection: 'column', flexGrow: 1, border: `3px solid ${INK}`, background: PAPER_LIGHT, padding: '12px 16px' }, ...lines));
  }

  const picture: Node = front
    ? { type: 'img', props: { src: `data:image/png;base64,${front.toString('base64')}`, width: CARD_W, height: CARD_H } }
    : box({ width: CARD_W, height: CARD_H, background: vm.T.main });
  return box({ width: W, height: H, background: '#f7f0df', position: 'relative' },
    box({ position: 'absolute', left: PAD, top: PAD, width: CARD_W, height: CARD_H, overflow: 'hidden' }, picture),
    box({ position: 'absolute', left: PANEL_X, top: 0, width: PANEL_W, height: H, background: STOCK, borderLeft: `4px solid ${INK}`, flexDirection: 'column', padding: '18px 22px 16px', color: INK },
      // Wordmark strip: series and season from the set registry, then the card number.
      box({ justifyContent: 'space-between', alignItems: 'center', height: 42, flexShrink: 0 },
        text(`${vm.wordmark} ${vm.season}`.trim().toUpperCase(), clip({ fontFamily: ff(FONT.bebas), fontSize: 36, letterSpacing: 2, color: ink1, maxWidth: INNER_W * 0.7 })),
        vm.number ? box({ border: `3px solid ${INK}`, background: PAPER_LIGHT, padding: '2px 12px', fontFamily: ff(FONT.slab), fontSize: 26 }, vm.number) : null),
      box({ flexDirection: 'column', marginTop: 8, flexShrink: 0 },
        ...nameFit.lines.map(line => text(line, { fontFamily: ff(FONT.slab), fontSize: nameFit.size, lineHeight: 1.02, color: INK }))),
      box({ marginTop: 10, flexShrink: 0, background: vm.T.main, color: vm.T.ink, border: `3px solid ${INK}`, padding: '2px 16px', alignItems: 'center', justifyContent: 'space-between', height: 58, fontFamily: ff(FONT.bebas), fontSize: 42, letterSpacing: 3 },
        text(band, clip({ maxWidth: INNER_W * 0.62 })), handleText ? text(handleText.toUpperCase(), clip({ fontSize: 24, letterSpacing: 1, maxWidth: INNER_W * 0.34 })) : null),
      box({ flexDirection: 'column', flexGrow: 1, marginTop: 12 }, ...body),
      box({ justifyContent: 'space-between', alignItems: 'center', height: 34, flexShrink: 0, marginTop: 10, borderTop: `2px solid ${INK}`, paddingTop: 6, fontFamily: ff(FONT.bebas), fontSize: 28, letterSpacing: 2, color: ink1 },
        text(asOf ?? (vm.publisher ?? '').toUpperCase()), text(host.toUpperCase(), { color: INK }))));
}

// Finished previews by content version (the version includes RENDER_VERSION, so a new design never serves an old image).
// The map holds promises, so two requests for one address share a single render; it keeps a whole crawl's worth.
const previews = new Map<string, Promise<Buffer>>();
const PREVIEW_LIMIT = 120;
async function drawShareImage(card: CollectionCard, collection: NewsCollection): Promise<Buffer> {
  // The real front, scaled; its rounded corners are flattened onto the preview's own page colour.
  const front = await sharp(await renderCardFace(card, collection, 'front', { flatten: '#f7f0df' })).resize(CARD_W, CARD_H, { kernel: 'lanczos3' }).png().toBuffer();
  const svg = await satori(await buildCollectionShareNode(card, collection, front) as Parameters<typeof satori>[0], { width: W, height: H, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).flatten({ background: '#f7f0df' }).png({ compressionLevel: 9 }).toBuffer();
}
export function buildCollectionShareImage(card: CollectionCard, collection: NewsCollection): Promise<Buffer> {
  const version = collectionShareVersion(card);
  let hit = previews.get(version);
  if (hit) return hit;
  hit = drawShareImage(card, collection);
  previews.set(version, hit);
  hit.catch(() => previews.delete(version));          // a failed render is never remembered
  while (previews.size > PREVIEW_LIMIT) previews.delete(previews.keys().next().value!);
  return hit;
}

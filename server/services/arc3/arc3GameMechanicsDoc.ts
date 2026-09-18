/*
 * Author: Claude Opus 5
 * Date: 2026-09-12
 * PURPOSE: Renders the whole official ARC-AGI-3 game set as ONE plain-Markdown document,
 *          served at /arc3/games.md (and /arc3/games.txt) as the single link to hand an
 *          agent or a person who wants the mechanics without digging.
 *
 *          WHY THIS EXISTS. Every one of these write-ups was produced by reading the
 *          game's obfuscated Python in external/ARCEngine and tracing its step() and win
 *          conditions by hand, then adversarially re-checking the result (see
 *          docs/2026-09-11-arc3-public-set-additional-games-study.md and the corrections
 *          in c78606ea). That work is already published as HTML at /arc3/games/:id, but an
 *          agent asking "what are the rules of sc25" has to find 25 separate pages and
 *          parse React output to get at it -- so in practice the next agent re-reads the
 *          Python and repeats the same mistakes. One flat document, one URL, no JavaScript.
 *
 *          NOT A SPOILER LEAK. These 25 are the official ARC-AGI-3 public demo set,
 *          documented by ARC Prize and already linked in full from /arc3, which carries
 *          its own play-first warning. This is a second format for content that is
 *          already public, and it is deliberately NOT the unlisted /arc3/mechanics answer
 *          key for the 50 synthetic tasks -- that one stays disallowed in robots.txt
 *          because the blind play surface needs those met cold.
 *
 *          SINGLE SOURCE OF TRUTH. Everything here is read from the shared/arc3Games
 *          registry, the same objects the spoiler pages render. There is no second copy
 *          of any mechanic text to drift, and a correction to a game file shows up in
 *          this document on the next request.
 *
 *          2026-09-16 (Claude Opus 5): each game now also carries its "Every mechanic" bullets
 *          (grouped by the level that introduces them), "Notes from play" (what a human saw,
 *          did, expected), and action counts (ARC baseline and Boss's recent runs).
 *          2026-09-18 (Claude Opus 5): SITE_ORIGIN exported for arc3GameDataset.ts.
 * SRP/DRY check: Pass -- document generation only. Data lives in shared/arc3Games, HTTP
 *          serving lives in server/routes.ts, and the HTML rendering of the same objects
 *          stays in client/src/pages/Arc3GameSpoiler.tsx.
 */

import { arcPrizeLeaderboardUrl, getAllGames, type Arc3GameMetadata, type ActionMapping } from '../../../shared/arc3Games';
import { getOwnerGameRating, OWNER_PLAYER } from '../../../shared/arc3Games/humanDifficulty';

/** Public origin used for the absolute links in the document (and in the game dataset). */
export const SITE_ORIGIN = 'https://arc.markbarney.net';

/**
 * as66 is kept in the registry for its historical preview-era content but was withdrawn
 * from the public demo set (confirmed against three dated sources -- see as66.ts). The
 * document is a reference for "the official set as it stands", so it is listed under its
 * own heading rather than mixed in with the 25 live games.
 */
const WITHDRAWN_IDS = new Set(['as66']);

function formatActions(mappings: ActionMapping[]): string {
  if (mappings.length === 0) return '_No action mapping recorded for this game._\n';
  const rows = mappings.map((m) => {
    const common = m.commonName ? ` (${m.commonName})` : '';
    const notes = m.notes ? ` — ${m.notes}` : '';
    return `- \`${m.action}\`${common}: ${m.description}${notes}`;
  });
  return `${rows.join('\n')}\n`;
}

function formatGame(game: Arc3GameMetadata): string {
  const name = game.informalName ? `${game.informalName} (\`${game.gameId}\`)` : `\`${game.gameId}\``;
  const parts: string[] = [`## ${name}\n`];

  const facts: string[] = [
    `- **Game ID:** \`${game.gameId}\``,
    `- **Set:** ${game.category === 'preview' ? 'preview (public from the start)' : 'evaluation'}`,
  ];
  if (typeof game.levelCount === 'number') facts.push(`- **Levels:** ${game.levelCount}`);
  if (typeof game.winScore === 'number') facts.push(`- **Win score:** ${game.winScore}`);
  if (typeof game.maxActions === 'number') facts.push(`- **Max actions:** ${game.maxActions}`);
  if (game.tags.length > 0) facts.push(`- **Tags:** ${game.tags.join(', ')}`);
  facts.push(`- **Write-up:** ${SITE_ORIGIN}/arc3/games/${game.gameId}`);
  // How humans actually do on this exact task, from ARC Prize. Worth having in the machine
  // -readable copy too: an agent reasoning about difficulty should read the real numbers
  // rather than our `difficulty` field, which is 'unknown' for most of the set.
  facts.push(`- **Official human leaderboard:** ${arcPrizeLeaderboardUrl(game.gameId)}`);
  // Actions to win, from the committed scorecard snapshot (runs since 18 Jun 2026 on the live
  // build). The top-10 fewest is live-only, so it stays on the web page and leaderboard link.
  const owner = getOwnerGameRating(game.gameId);
  if (owner.baseline) {
    const summary = owner.summary;
    const ownerText = !summary
      ? 'not played since 18 Jun 2026'
      : summary.bestWin
        ? `best recent win ${summary.bestWin.actions} actions (${summary.recentRuns} recent run${summary.recentRuns === 1 ? '' : 's'})`
        : `not won yet, ${summary.actionsSpent} actions over ${summary.recentRuns} run${summary.recentRuns === 1 ? '' : 's'}`;
    facts.push(
      `- **Actions to win:** ARC baseline ${owner.baseline.baselineTotal} (per level ${owner.baseline.baselineActions.join(', ')}); ${OWNER_PLAYER}: ${ownerText}`,
    );
  }
  parts.push(`${facts.join('\n')}\n`);

  parts.push(`**Objective.** ${game.description}\n`);

  if (game.mechanicsExplanation) {
    parts.push(`### Mechanics\n\n${game.mechanicsExplanation.trim()}\n`);
  }

  if (game.mechanicsBreakdown && game.mechanicsBreakdown.length > 0) {
    const byLevel = new Map<number, string[]>();
    for (const point of game.mechanicsBreakdown) {
      const level = point.introducedOnLevel ?? 1;
      const source = point.source ? ` _(${point.source})_` : '';
      byLevel.set(level, [...(byLevel.get(level) ?? []), `- ${point.text}${source}`]);
    }
    const sections = [...byLevel.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, lines]) => `**${level === 1 ? 'From level 1' : `New on level ${level}`}**\n\n${lines.join('\n')}`);
    parts.push(`### Every mechanic\n\n${sections.join('\n\n')}\n`);
  }

  if (game.playerObservations && game.playerObservations.length > 0) {
    const notes = [...game.playerObservations]
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      .map((note) => {
        const where = typeof note.level === 'number' ? `, level ${note.level}` : '';
        const lines = [`- **${note.player}, ${note.date}${where}**`, `  - Saw: ${note.saw}`];
        if (note.did) lines.push(`  - Did: ${note.did}`);
        if (note.expected) lines.push(`  - Expected: ${note.expected}`);
        lines.push(`  - What happened: ${note.happened}`);
        if (note.inCode) lines.push(`  - In the code: ${note.inCode}`);
        return lines.join('\n');
      });
    parts.push(`### Notes from play\n\n${notes.join('\n')}\n`);
  }

  parts.push(`### Controls\n\n${formatActions(game.actionMappings)}`);

  if (game.levelScreenshots && game.levelScreenshots.length > 0) {
    const shots = [...game.levelScreenshots]
      .sort((a, b) => a.level - b.level)
      .map((s) => {
        const caption = s.caption ? ` — ${s.caption}` : '';
        return `- Level ${s.level}: ${SITE_ORIGIN}${s.imageUrl}${caption}`;
      });
    parts.push(
      `### Level screenshots\n\nUnless a caption says otherwise, the opening frame of each level, rendered ` +
        `from the game's own source — the same pixels the game shows on entering that level, with ` +
        `nothing moved yet. Captioned entries may instead be captures of real play.\n\n${shots.join('\n')}\n`,
    );
  }

  if (game.hints.length > 0) {
    const hints = game.hints.map((h) => `- **${h.title}** (spoiler level ${h.spoilerLevel}): ${h.content}`);
    parts.push(`### Hints\n\n${hints.join('\n')}\n`);
  }

  if (game.resources.length > 0) {
    const resources = game.resources.map((r) => {
      const desc = r.description ? ` — ${r.description}` : '';
      return `- [${r.type}] ${r.title}: ${r.url}${desc}`;
    });
    parts.push(`### Resources\n\n${resources.join('\n')}\n`);
  }

  if (game.notes) {
    parts.push(`### Provenance and caveats\n\n${game.notes}\n`);
  }

  return parts.join('\n');
}

/**
 * Build the complete Markdown reference. Pure: same registry in, same document out.
 */
export function buildArc3GameMechanicsDoc(): string {
  const all = getAllGames() as Arc3GameMetadata[];
  const live = all.filter((g) => !WITHDRAWN_IDS.has(g.gameId));
  const withdrawn = all.filter((g) => WITHDRAWN_IDS.has(g.gameId));

  const header = `# ARC-AGI-3 Official Game Mechanics — Complete Reference

Every game in the official ARC-AGI-3 public demo set (${live.length} games), with its full
mechanics, its per-action control mapping, and the opening frame of every level.

**Read this instead of reverse-engineering the source.** Each write-up below was produced by
reading that game's obfuscated Python in ARCEngine and tracing its \`step()\` and win
conditions by hand, then adversarially re-checking the claims against the source a second
time. Two rounds of that checking found 57 real errors across 22 games — almost all of the
same shape: level-1 behaviour described as if it held for the whole game, mechanics that do
not exist in the code at all, and unmentioned move/click/energy budgets that lose the level
outright. If you are about to derive these rules yourself, you are about to make those
mistakes again.

**What is asserted here is what the code does.** Where a claim was only verified for some
levels, the game's "Provenance and caveats" section says so. Informal names are flavour
titles, not literal per-level mechanic claims — do not reason from the name.

- Canonical HTML index: ${SITE_ORIGIN}/arc3/games
- This document: ${SITE_ORIGIN}/arc3/games.md
- Per-game pages: ${SITE_ORIGIN}/arc3/games/<gameId>
- Background and the technical report: ${SITE_ORIGIN}/arc3
- Official site: https://three.arcprize.org

**Spoiler warning for humans.** Reading this tells you the answers. If you intend to play
these games yourself, or to contribute to a human baseline, play first.

---

## Index

${live.map((g) => `- [${g.informalName || g.gameId}](#${(g.informalName || g.gameId).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${g.gameId}) — \`${g.gameId}\` — ${g.description}`).join('\n')}

---

`;

  const body = live.map(formatGame).join('\n---\n\n');

  const tail =
    withdrawn.length > 0
      ? `\n---\n\n# Withdrawn from the public demo set\n\nKept here as historical preview-era content. ` +
        `Not part of the current official set.\n\n${withdrawn.map(formatGame).join('\n---\n\n')}`
      : '';

  return `${header}${body}${tail}`;
}

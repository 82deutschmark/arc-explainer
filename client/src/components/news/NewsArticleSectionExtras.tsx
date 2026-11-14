/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 03-November-2026
 * 14-Nov-2026 (Claude Opus 5.5): the standings caption prints a readable UTC date and time (newsDate), not raw ISO.
 * PURPOSE: Render an article section's illustration and dated accessible standings on
 * both the front page and the permanent story, using the shared newspaper styles.
 * SRP/DRY check: Pass — both article views use this same presentation component.
 */
import { newsDate, type NewsSection } from '@shared/news';
import React from 'react';

export function NewsArticleSectionExtras({ section }: { section: NewsSection }) {
  return <>
    {section.image && <figure className="news-edition-art" style={section.image.layout === 'inset' ? { maxWidth: 480, marginInline: 'auto' } : undefined}>
      <a href={section.image.src}><img src={section.image.src} alt={section.image.alt} loading="lazy" /></a>
      <figcaption>{section.image.caption}</figcaption>
    </figure>}
    {section.standings && <div className="news-boxscore-wrap" tabIndex={0} role="region" aria-label={`${section.standings.caption}, scrollable standings`}>
      <table className="news-boxscore">
        <caption>{section.standings.caption} · <time dateTime={section.standings.observedAt}>{newsDate(section.standings.observedAt, true)}</time> · provisional</caption>
        <thead><tr><th scope="col">Place</th><th scope="col">Team</th><th scope="col">Score</th></tr></thead>
        <tbody>{section.standings.rows.map(row => <tr key={row.teamId}>
          <td className="pl">#{row.rank}</td><td><strong className="news-team-name">{row.name}</strong></td><td className="sc">{String(row.score)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </>;
}

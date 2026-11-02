/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Render shared semantic figure runs without changing source records.
 * SRP/DRY check: Pass — classification is shared with initial server HTML.
 */
import { Fragment } from 'react';
import { figureRuns, figureClass, statScores, type FigureSpan } from '@shared/newsFigures';
import { competitionName, type NewsStat, type NewsCompetition } from '@shared/news';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
export function SportsText({ text, stats = [], figures = [] }: { text: string; stats?: NewsStat[]; figures?: FigureSpan[] }) {
  return <>{figureRuns(text, statScores(stats), figures).map((run, index) => run.kind
    ? <span key={index} className={figureClass(run.kind)}>{run.text}</span>
    : <Fragment key={index}>{run.text}</Fragment>)}</>;
}
export function NumberKey({ stats, competition }: { stats: NewsStat[]; competition?: NewsCompetition }) {
  if (!stats.length) return null;
  const example = stats[0], direction = competition ? KAGGLE_COMPETITIONS[competition]?.scoreDirection : null;
  return <p className="news-number-key"><span>Place <b className="pl">#{example.rank.toLocaleString('en-US')}</b></span><span>Score <b className="sc">{String(example.score)}</b></span><span className="sd">Difference: ± score points</span><span>{competition && `${competitionName(competition)} · `}{direction ? `${direction === 'higher' ? 'Higher' : 'Lower'} scores are better · ` : ''}Dated public board</span></p>;
}

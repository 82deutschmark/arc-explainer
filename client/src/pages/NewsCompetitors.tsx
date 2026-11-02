/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6 Sol / Codex; GPT-6 Astra Extra high
 * Date: 02-November-2026
 * PURPOSE: Searchable ARC Daily competitor profile, keeping records separate by
 *          competition and searching only observed names, IDs, aliases and members.
 *          09-Oct-2026 (Claude Opus 5.5): cards show the faces of verified people on each team.
 * SRP/DRY check: Pass — uses the same typed archive and profile cards as the newspaper.
 */
import { useState } from 'react';
import { NEWS_NAME, competitionName, type NewsCompetition } from '@shared/news';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, NotebookEntry, useNews, useNewsCardImage } from '@/components/news/NewsDesk';

export default function NewsCompetitors() {
  const query = useNews();
  const [search, setSearch] = useState('');
  const [competition, setCompetition] = useState<NewsCompetition | 'all'>('all');
  usePageMeta({ title: `Competitor profiles | ${NEWS_NAME}`, description: 'Sourced competition-specific team records, observed aliases and memberships, and working links to Kaggle.', canonicalPath: '/news/competitors', image: useNewsCardImage() });
  const needle = search.trim().toLocaleLowerCase();
  const competitors = [...(query.data?.competitors ?? [])].filter(record => (competition === 'all' || record.competition === competition) && [record.name, record.teamId, ...record.aliases, ...record.members].join(' ').toLocaleLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name) || a.competition.localeCompare(b.competition));
  return <NewsPaper>
    <header className="news-directory-header"><div className="news-kicker">The people behind the standings</div><h1>Competitor profiles</h1><p>Meet the teams, follow their progress, and follow source-linked stories across Kaggle competitions.</p></header>
    <div className="news-filter"><label htmlFor="news-competitor-search">Find a team</label><Input id="news-competitor-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, alias, member or team ID" /><div role="group" aria-label="Filter by competition">{['all', ...new Set((query.data?.competitors ?? []).map(row => row.competition))].map(key => <Button key={key} variant="ghost" aria-pressed={competition === key} onClick={() => setCompetition(key)}>{key === 'all' ? 'All competitions' : competitionName(key)}</Button>)}</div></div>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && <><p className="news-muted" role="status" style={{ marginTop: 15 }}>{competitors.length} {competitors.length === 1 ? 'profile' : 'profiles'}</p><div className="news-directory-grid">{competitors.map(competitor => <NotebookEntry key={competitor.id} competitor={competitor} people={query.data.people} />)}</div>{!competitors.length && <p className="news-status">{query.data.competitors.length ? 'No teams match these filters.' : 'No competitor profiles have been published yet.'}</p>}</>}
  </NewsPaper>;
}

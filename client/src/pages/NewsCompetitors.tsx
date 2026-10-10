/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Searchable ARC Daily competitor notebook, keeping records separate by
 *          competition and searching only observed names, IDs, aliases and members.
 *          09-Oct-2026 (Claude Opus 5.5): cards show the faces of verified people on each team.
 * SRP/DRY check: Pass — uses the same typed archive and notebook cards as the newspaper.
 */
import { useState } from 'react';
import type { NewsCompetition } from '@shared/news';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, NotebookEntry, useNews, useNewsCardImage } from '@/components/news/NewsDesk';

export default function NewsCompetitors() {
  const query = useNews();
  const [search, setSearch] = useState('');
  const [competition, setCompetition] = useState<NewsCompetition | 'all'>('all');
  usePageMeta({ title: 'Competitor notebook | The ARC Daily Digest', description: 'Sourced ARC-AGI-2 and ARC-AGI-3 competitor records, observed team aliases and members, and links to competition reporting.', canonicalPath: '/news/competitors', image: useNewsCardImage() });
  const needle = search.trim().toLocaleLowerCase();
  const competitors = [...(query.data?.competitors ?? [])].filter(record => (competition === 'all' || record.competition === competition) && [record.name, record.teamId, ...record.aliases, ...record.members].join(' ').toLocaleLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name) || a.competition.localeCompare(b.competition));
  return <NewsPaper>
    <header className="news-directory-header"><div className="news-kicker">The people behind the standings</div><h1>The competitor notebook</h1><p>Names to follow, facts we can source, and the record of the race. Each notebook belongs to one team in one competition; a matching name alone does not establish a shared identity.</p></header>
    <div className="news-filter"><label htmlFor="news-competitor-search">Find a team</label><Input id="news-competitor-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, alias, member or team ID" /><div role="group" aria-label="Filter by competition">{(['all', 'arc-3', 'arc-2'] as const).map(key => <Button key={key} variant="ghost" aria-pressed={competition === key} onClick={() => setCompetition(key)}>{key === 'all' ? 'Both competitions' : key === 'arc-3' ? 'ARC-3' : 'ARC-2'}</Button>)}</div></div>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && <><p className="news-muted" role="status" style={{ marginTop: 15 }}>{competitors.length} {competitors.length === 1 ? 'notebook' : 'notebooks'}</p><div className="news-directory-grid">{competitors.map(competitor => <NotebookEntry key={competitor.id} competitor={competitor} people={query.data.people} />)}</div>{!competitors.length && <p className="news-status">{query.data.competitors.length ? 'No teams match these filters.' : 'No competitor notebooks have been published yet.'}</p>}</>}
  </NewsPaper>;
}

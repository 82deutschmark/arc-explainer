/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-22
 * PURPOSE: Unlisted summit field notes: people, their work, natural questions and MLST
 *          connections. Loads runtime content through a share link or team authentication. Personal
 *          bookmarks, met flags and notes stay on this browser, scoped to its reader link or signed-in user.
 * SRP/DRY check: Pass - shared document contract; existing query/auth and UI primitives.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Check, ExternalLink, LockKeyhole, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { call, useSignInRedirect, useTeamSession } from '@/components/teamRuns/teamRunsApi';
import { usePageMeta } from '@/hooks/usePageMeta';
import { selectSummitPeople, type SummitGuide as Guide, type SummitPerson, type SummitSelection } from '@shared/summitGuide';
import './SummitGuide.css';

type Personal = { saved: string[]; met: string[]; notes: Record<string, string> };
const emptyPersonal = (): Personal => ({ saved: [], met: [], notes: {} });
function readPersonal(key: string): Personal {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || !Array.isArray(value.saved) || !Array.isArray(value.met) || typeof value.notes !== 'object' || !value.notes) return emptyPersonal();
    const notes: Record<string, string> = {};
    for (const [id, note] of Object.entries(value.notes)) if (typeof note === 'string') notes[id] = note;
    return { saved: value.saved.filter((id: unknown) => typeof id === 'string'), met: value.met.filter((id: unknown) => typeof id === 'string'), notes };
  } catch { return emptyPersonal(); }
}

function SourceLinks({ sources }: { sources: { label: string; url: string }[] }) {
  return <div className="summit-sources">{sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={12} aria-hidden="true" /></a>)}</div>;
}

function Notebook({ guide, userKey }: { guide: Guide; userKey: string }) {
  const storageKey = 'arc-summit-2026:' + userKey;
  const [personal, setPersonal] = useState<Personal>(() => readPersonal(storageKey));
  const [storageError, setStorageError] = useState(false);
  const [tab, setTab] = useState<'people' | 'mlst' | 'work'>('people');
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState<SummitSelection['audience']>('all');
  const [view, setView] = useState<SummitSelection['view']>(() => window.location.hash ? 'all' : 'new');
  const [topic, setTopic] = useState('');
  const [selected, setSelected] = useState(() => window.location.hash.slice(1));
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(personal)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [personal, storageKey]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLElement && event.target.isContentEditable)) {
        event.preventDefault(); setTab('people'); requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const people = useMemo(() => selectSummitPeople(guide.people, { search, audience, topic, view, saved: personal.saved, met: personal.met }), [guide, search, audience, topic, view, personal.saved, personal.met]);
  const person = people.find(item => item.id === selected) ?? people[0];
  const topics = [...new Set(guide.people.flatMap(item => item.topics))].sort();
  function choose(item: SummitPerson, scroll = true) {
    setSelected(item.id);
    window.history.replaceState(null, '', '#' + item.id);
    if (scroll && window.matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function openPerson(id: string) {
    setSearch(''); setAudience('all'); setView('all'); setTopic(''); setTab('people');
    const found = guide.people.find(item => item.id === id);
    if (found) choose(found, false);
  }
  function toggle(field: 'saved' | 'met', id: string) {
    setPersonal(previous => ({ ...previous, [field]: previous[field].includes(id) ? previous[field].filter(value => value !== id) : [...previous[field], id] }));
  }
  return <main className="summit-guide">
    <header className="summit-heading">
      <div className="summit-kicker"><LockKeyhole size={13} aria-hidden="true" /> SHARE-ONLY NOTEBOOK <span>23 OCT 2026 / CAMBRIDGE</span></div>
      <h1>{guide.title}</h1>
      <p>{guide.intro}</p>
      <div className="summit-event"><a href={guide.event.url} target="_blank" rel="noopener noreferrer">{guide.event.location} ↗</a><span>{guide.event.time}</span><span>Research checked {new Date(guide.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}</span></div>
    </header>
    <nav className="summit-tabs" aria-label="Guide sections">
      {([['people', 'People to meet'], ['mlst', 'The MLST connections'], ['work', 'Talking about our work']] as const).map(([id, label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}
    </nav>
    {storageError && <p role="status" className="summit-alert">This browser could not save your notes. Keep this tab open or copy them before leaving.</p>}
    {tab === 'people' && <>
      <div className="summit-controls">
        <label className="summit-search"><Search size={16} aria-hidden="true" /><Input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} aria-label="Search people, work and interests" placeholder="Name, paper, interest…" /><kbd>/</kbd></label>
        <div className="summit-lenses" role="group" aria-label="Connections for">{(['all', 'mark', 'son'] as const).map(value => <button key={value} aria-pressed={audience === value} onClick={() => setAudience(value)}>{value === 'all' ? 'Both of us' : value === 'mark' ? 'For Mark' : 'For Son'}</button>)}</div>
      </div>
      <div className="summit-filter-row">
        <label>Show <select aria-label="Show people" value={view} onChange={event => setView(event.target.value as SummitSelection['view'])}><option value="new">New connections</option><option value="all">Everyone in this guide</option><option value="saved">Saved</option><option value="mlst">Verified MLST guests</option><option value="met">People I met</option></select></label>
        <label>Interest <select aria-label="Filter by interest" value={topic} onChange={event => setTopic(event.target.value)}><option value="">All interests</option>{topics.map(value => <option key={value}>{value}</option>)}</select></label>
        <span aria-live="polite">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
      </div>
      <div className="summit-directory">
        <aside className="summit-list" aria-label="Attendees">
          {people.map(item => <button key={item.id} onClick={() => choose(item)} aria-pressed={person?.id === item.id} className="summit-person-row"><span className="summit-initials" aria-hidden="true">{item.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span><span><strong>{item.name}</strong><small>{item.role}</small></span><span className="summit-row-flags">{personal.saved.includes(item.id) && <Bookmark size={13} aria-label="Saved" />}{personal.met.includes(item.id) && <Check size={13} aria-label="Met" />}</span></button>)}
          {!people.length && <div className="summit-empty"><p>No people match these filters.</p><Button variant="outline" onClick={() => { setSearch(''); setAudience('all'); setView('all'); setTopic(''); }}>Show everyone</Button></div>}
        </aside>
        {person && <article ref={detailRef} className="summit-person-detail" aria-label={person.name}>
          <div className="summit-detail-top"><span>{person.attendance === 'speaker' ? 'ANNOUNCED SPEAKER' : 'ON THE REGISTERED GUEST LIST'}{person.familiar ? ' · ALREADY KNOW' : ''}</span><div><Button variant="ghost" size="sm" aria-pressed={personal.saved.includes(person.id)} onClick={() => toggle('saved', person.id)}><Bookmark size={15} />{personal.saved.includes(person.id) ? 'Saved' : 'Save'}</Button><Button variant="ghost" size="sm" aria-pressed={personal.met.includes(person.id)} onClick={() => toggle('met', person.id)}><Check size={15} />{personal.met.includes(person.id) ? 'Met' : 'Mark as met'}</Button></div></div>
          <h2>{person.name}</h2><p className="summit-role">{person.role}</p>
          <div className="summit-topics">{person.topics.map(value => <button key={value} onClick={() => setTopic(value)}>{value}</button>)}</div>
          <section><h3>Their work, in plain English</h3><p>{person.work}</p></section>
          <section className="summit-connection"><h3>A connection you can make</h3>{audience !== 'son' && <p><b>Mark</b>{person.connection.mark}</p>}{audience !== 'mark' && <p><b>Son</b>{person.connection.son}</p>}</section>
          <section className="summit-question"><h3>A good first question</h3><p>“{person.question}”</p><small>If they seem interested: {person.followUp}</small></section>
          {person.mlst && <section className="summit-mlst-note"><h3>{person.mlst.kind === 'appearance' ? 'Verified MLST appearance' : 'A shared topic with MLST'}</h3><p>{person.mlst.note}</p>{person.mlst.link && <SourceLinks sources={[person.mlst.link]} />}</section>}
          <section><h3>Read / verify</h3><SourceLinks sources={person.sources} /></section>
          <section className="summit-personal"><label htmlFor="summit-note">Something to remember</label><textarea id="summit-note" value={personal.notes[person.id] ?? ''} maxLength={5000} onChange={event => setPersonal(previous => ({ ...previous, notes: { ...previous.notes, [person.id]: event.target.value } }))} placeholder="What interested them? What did we promise to send?" /><small>Notes, saves and met marks stay in this browser. They do not sync to the other person’s device.</small></section>
        </article>}
      </div>
      <p className="summit-footnote">Registration is not a guarantee of attendance. This guide highlights selected people from the 127 registrations. Familiar people are kept out of “New connections.”</p>
    </>}
    {tab === 'mlst' && <div className="summit-reading"><h2>Start with the ideas</h2><p>{guide.mlst.intro}</p><SourceLinks sources={guide.mlst.sources} /><div className="summit-theme-grid">{guide.mlst.themes.map(theme => <section key={theme.title}><h3>{theme.title}</h3><p>{theme.explanation}</p><div className="summit-theme-people">{theme.people.map(id => <button key={id} onClick={() => openPerson(id)}>{guide.people.find(item => item.id === id)?.name} →</button>)}</div></section>)}</div><p className="summit-footnote">“Verified MLST appearance” links to an identified episode or show entry. “Shared topic” means a research connection; it does not claim the person appeared on the show. Some publisher links require membership.</p></div>}
    {tab === 'work' && <div className="summit-reading"><h2>A natural introduction</h2><blockquote>{guide.ourWork.introduction}</blockquote><div className="summit-work-points">{guide.ourWork.points.map(point => <section key={point.title}><h3>{point.title}</h3><p>{point.explanation}</p></section>)}</div><h2>Useful words, ordinary meanings</h2><dl className="summit-terms">{guide.ourWork.terms.map(item => <div key={item.term}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl><SourceLinks sources={guide.ourWork.sources} /></div>}
    <footer className="summit-reminder">Ask about the part they care about. Let them finish. A specific follow-up beats another question from a list.</footer>
  </main>;
}

function TeamSummitGuide() {
  usePageMeta({ title: 'Boston field notes | ARC Explainer', description: 'Private team conversation guide.', canonicalPath: '/team/summit-2026', noindex: true });
  const session = useTeamSession();
  const result = useQuery({ queryKey: ['private-summit-guide'], queryFn: () => call<Guide>('/api/team/summit-2026'), enabled: !!session.data?.signedIn, retry: false, staleTime: 60_000, gcTime: 0 });
  useSignInRedirect(result.error);
  if (session.isLoading) return <div className="summit-guide" role="status">Opening your notebook…</div>;
  if (!session.data?.signedIn) return <main className="summit-guide summit-sign-in"><LockKeyhole size={24} /><h1>Boston field notes</h1><p>This notebook is for the team.</p><a href="/team/login?next=%2Fteam%2Fsummit-2026">Sign in with your team Google account →</a>{session.error && <p role="alert">{session.error.message}</p>}</main>;
  if (result.error) return <div className="summit-guide" role="alert"><p>{result.error.message}</p><Button onClick={() => result.refetch()}>Try again</Button></div>;
  if (!result.data) return <div className="summit-guide" role="status">Loading the conversation guide…</div>;
  return <Notebook key={session.data.email ?? 'team'} guide={result.data} userKey={session.data.email ?? 'team'} />;
}

function SharedSummitGuide({ shareKey }: { shareKey?: string }) {
  usePageMeta({ title: 'Boston field notes | ARC Explainer', description: 'Summit conversation notebook.', canonicalPath: shareKey ? '/summit/' + shareKey : '/notes1023', noindex: true });
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  const result = useQuery({ queryKey: ['shared-summit-guide', shareKey], queryFn: () => call<Guide>(shareKey ? '/api/team/shared/summit-2026/' + encodeURIComponent(shareKey) : '/api/team/notes1023'), retry: false, staleTime: 60_000, gcTime: 0 });
  if (result.error) return <div className="summit-guide" role="alert"><h1>Boston field notes</h1><p>This share link could not be opened. Check that you have the complete link.</p><Button onClick={() => result.refetch()}>Try again</Button></div>;
  if (!result.data) return <div className="summit-guide" role="status">Loading the conversation guide…</div>;
  return <Notebook key={shareKey} guide={result.data} userKey={shareKey ?? 'notes1023'} />;
}
export default function SummitGuide() {
  const [plain] = useRoute('/notes1023');
  const [shared, params] = useRoute('/summit/:shareKey');
  if (plain) return <SharedSummitGuide />;
  return shared && params ? <SharedSummitGuide shareKey={params.shareKey} /> : <TeamSummitGuide />;
}

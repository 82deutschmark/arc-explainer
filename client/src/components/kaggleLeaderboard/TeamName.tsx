/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: Team and member names that link to Kaggle. Kaggle has no public page per team,
 *          so a team name opens its first listed member's profile (the hover title says
 *          whose), and the members list links every member to their own profile. Used by
 *          every section that shows a name.
 * SRP/DRY check: Pass - the only place Kaggle profile links are built.
 */

import { membersOf, profileUrl } from './boardData';
import type { KaggleBoardRow } from '@shared/types';

const LINK = 'hover:underline underline-offset-2 decoration-muted-foreground/60';

export function TeamName({ row, name, className = '' }: { row: KaggleBoardRow | undefined; name?: string; className?: string }) {
  const label = name ?? row?.[2] ?? '';
  const members = membersOf(row);
  if (!members.length) return <span className={className}>{label}</span>;
  return (
    <a
      href={profileUrl(members[0])}
      target="_blank"
      rel="noreferrer"
      title={members.length === 1 ? `Kaggle profile: ${members[0]}` : `Kaggle profile of ${members[0]} (team of ${members.length})`}
      className={`${LINK} ${className}`}
    >
      {label}
    </a>
  );
}

export function MemberLinks({ row }: { row: KaggleBoardRow }) {
  const members = membersOf(row);
  return (
    <>
      {members.map((m, i) => (
        <span key={m}>
          {i > 0 && ', '}
          <a href={profileUrl(m)} target="_blank" rel="noreferrer" className={LINK}>{m}</a>
        </span>
      ))}
    </>
  );
}

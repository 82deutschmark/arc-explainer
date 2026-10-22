/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: The body of a speed / kernel / profile run's page (the runs API, Son's ask, 21-Oct-2026):
 *          the run's question and verdict, then its arms side by side, one column per arm.
 *          - Arms: each arm's name, status (failed and skipped arms show their reason), what
 *            differs in its config and env (chips), then every metric any arm reports as a row,
 *            the best arm per ranked row in green and each other arm's ratio to the baseline arm
 *            (the run's `baseline`, else the first arm that ran) beside its value.
 *          - Profile: GPU time per decode step, the span and GPU busy, then each kernel family,
 *            largest first in the baseline arm, laid out the same way.
 *          - Notes (markdown) and each arm's details and links, details folded away.
 *          Rendered by pages/team/Arc2Eval.tsx below the run header when the run is not an
 *          accuracy run.
 * SRP/DRY check: Pass - presentation only. Figures in armStats.ts, chips in Chips.tsx; palette,
 *          Pane and NoteMarkdown are the runs record's (teamRuns/terminal.tsx, NoteMarkdown.tsx).
 */

import type { ReactNode } from 'react';
import { NoteMarkdown } from '@/components/teamRuns/NoteMarkdown';
import { Pane, T } from '@/components/teamRuns/terminal';
import { Chips } from './Chips';
import { armRan, baselineIndex, metricRows, metricText, profileRows, ratio, rowDigits, type SideRow } from './armStats';
import type { EvalRunDocument, RunArm, RunLink } from './teamEvalsApi';

const hasEntries = (record: unknown) => typeof record === 'object' && record !== null && Object.keys(record).length > 0;

function StatusText({ arm }: { arm: RunArm }) {
  if (armRan(arm)) return <span style={{ color: T.up }}>OK</span>;
  return <span style={{ color: arm.status === 'failed' ? T.down : T.dim }}>{String(arm.status).toUpperCase()}</span>;
}

/** ×1.05 beside a value, green when it is the better direction, red when worse, plain when unranked. */
function Ratio({ value, better }: { value: number | null; better: SideRow['info']['better'] }) {
  if (value == null) return null;
  const good = better === 'higher' ? value > 1 : better === 'lower' ? value < 1 : null;
  const tone = good == null || Math.abs(value - 1) < 0.005 ? T.dim : good ? T.up : T.down;
  return <span className="ml-1 text-[11px]" style={{ color: tone }}>×{value.toFixed(2)}</span>;
}

/** Rows of numbers, one column per arm. */
function SideTable({ arms, rows, base, head }: { arms: RunArm[]; rows: SideRow[]; base: number; head?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular-nums" style={{ minWidth: 200 + arms.length * 150 }}>
        <thead style={{ color: T.amber }}>
          <tr className="text-left text-[11px]">
            <th className="px-2 py-[3px] font-normal" style={{ width: 200 }} />
            {arms.map((arm, i) => (
              <th key={arm.name} className="px-2 py-[3px] font-normal text-right align-bottom" style={{ minWidth: 150 }}>
                <div className="font-bold" style={{ color: armRan(arm) ? T.text : T.dim }}>{arm.name}{i === base ? <span style={{ color: T.dim }}> · base</span> : null}</div>
                {arm.label && <div style={{ color: T.dim }}>{arm.label}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {head}
          {rows.map((r) => ({ r, digits: rowDigits(r.values) })).map(({ r, digits }) => (
            <tr key={r.key} style={{ borderTop: `1px solid ${T.rule}` }}>
              <td className="px-2 py-[2px]" title={r.key}>
                {r.info.label}{r.info.unit && <span style={{ color: T.dim }}> {r.info.unit}</span>}
              </td>
              {r.values.map((value, i) => (
                <td key={arms[i].name} className="px-2 py-[2px] text-right whitespace-nowrap"
                    style={{ color: !armRan(arms[i]) ? T.dim : i === r.best ? T.up : T.text, fontWeight: i === r.best ? 700 : 400 }}>
                  {metricText(value, digits)}
                  {i !== base && armRan(arms[i]) && <Ratio value={ratio(value, r.values[base] ?? null)} better={r.info.better} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A row of per-arm chips (config, env) under the arm names. */
function ChipRow({ label, arms, pick }: { label: string; arms: RunArm[]; pick: (arm: RunArm) => Record<string, unknown> | null | undefined }) {
  return (
    <tr style={{ borderTop: `1px solid ${T.rule}` }}>
      <td className="px-2 py-1 align-top" style={{ color: T.amber }}>{label}</td>
      {arms.map((arm) => (
        <td key={arm.name} className="px-2 py-1 text-right align-top"><Chips record={pick(arm)} clip={32} /></td>
      ))}
    </tr>
  );
}

/** The publisher's links (http(s) or a site path), as [label] links. Also used by the run header. */
export function RunLinks({ links }: { links: RunLink[] | null | undefined }) {
  const usable = (links ?? []).filter((link) => typeof link?.url === 'string' && /^https?:\/\/|^\//.test(link.url));
  if (!usable.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-x-3">
      {usable.map((link, i) => (
        <a key={i} href={link.url} target={link.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer"
           className="hover:underline" style={{ color: T.link }}>[{link.label ?? link.url}]</a>
      ))}
    </span>
  );
}

export function ArmsView({ run }: { run: EvalRunDocument }) {
  const arms = Array.isArray(run.arms) ? run.arms : [];
  const base = baselineIndex(arms, run.baseline);
  const metrics = metricRows(arms, run.metricInfo);
  const profile = profileRows(arms, base);
  // Failed and skipped arms, and arms that ran but carry a note (e.g. benched, then their server died).
  const flagged = arms.filter((arm) => !armRan(arm) || arm.error);
  const withDetails = arms.filter((arm) => (arm.details !== undefined && arm.details !== null) || (arm.links ?? []).length > 0);

  const head = (
    <>
      <tr style={{ borderTop: `1px solid ${T.rule}` }}>
        <td className="px-2 py-[2px]" style={{ color: T.amber }}>STATUS</td>
        {arms.map((arm) => (
          <td key={arm.name} className="px-2 py-[2px] text-right" title={arm.error ?? undefined}><StatusText arm={arm} /></td>
        ))}
      </tr>
      {arms.some((arm) => hasEntries(arm.config)) && <ChipRow label="CONFIG" arms={arms} pick={(arm) => arm.config} />}
      {arms.some((arm) => hasEntries(arm.env)) && <ChipRow label="ENV" arms={arms} pick={(arm) => arm.env} />}
    </>
  );

  return (
    <>
      {(run.question || run.verdict) && (
        <div className="px-2 py-1 mb-2 grid gap-1" style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
          {run.question && <div><span style={{ color: T.amber }}>QUESTION </span>{run.question}</div>}
          {run.verdict && <div><span style={{ color: T.amber }}>VERDICT </span><span className="font-bold">{run.verdict}</span></div>}
        </div>
      )}

      <Pane title={`Arms · ${run.kind ?? ''}`} className="mb-2"
            right={`${arms.length} arm${arms.length === 1 ? '' : 's'}${base >= 0 ? ` · ratios against ${arms[base].name}` : ''}`}>
        {arms.length === 0
          ? <div className="px-2 py-1" style={{ color: T.dim }}>NO ARMS IN THIS RUN.</div>
          : <SideTable arms={arms} rows={metrics} base={base} head={head} />}
        {flagged.length > 0 && (
          <div className="px-2 py-1 text-[12px]" style={{ borderTop: `1px solid ${T.rule}` }}>
            {flagged.map((arm) => (
              <div key={arm.name}>
                <span style={{ color: arm.status === 'failed' ? T.down : armRan(arm) ? T.amber : T.dim }}>
                  {arm.name}{armRan(arm) ? '' : ` ${String(arm.status)}`}:{' '}
                </span>
                <span className="break-words">{arm.error ?? 'no reason given'}</span>
              </div>
            ))}
          </div>
        )}
      </Pane>

      {profile.length > 0 && (
        <Pane title="Profile" right="GPU time per decode step, by kernel family" className="mb-2">
          <SideTable arms={arms} rows={profile} base={base} />
        </Pane>
      )}

      {run.notes && (
        <Pane title="Notes" className="mb-2">
          <div className="px-2 py-1"><NoteMarkdown text={run.notes} /></div>
        </Pane>
      )}

      {withDetails.length > 0 && (
        <Pane title="Arm details" right="as the publisher sent them" className="mb-2">
          {withDetails.map((arm) => (
            <details key={arm.name} className="px-2 py-1" style={{ borderTop: `1px solid ${T.rule}` }}>
              <summary className="cursor-pointer">
                <span className="font-bold">{arm.name}</span> <RunLinks links={arm.links} />
              </summary>
              {arm.details != null && (
                <pre className="text-[11px] overflow-x-auto max-h-[480px]" style={{ color: T.dim }}>{JSON.stringify(arm.details, null, 1)}</pre>
              )}
            </details>
          ))}
        </Pane>
      )}
    </>
  );
}


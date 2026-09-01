/*
Author: Claude Opus 5
Date: 2026-09-01
PURPOSE: The feedback form on the play surface — six checkboxes and a scratchpad.

         WHAT IT IS FOR. Telemetry already records how far each player got. This records
         WHY they stopped, which is the part that decides whether a generated task gets
         kept, fixed or culled. Six boxes, chosen so each one implies a different action:

           solved_it           keep
           never_understood    ambiguous — that IS the task, unless everyone says it
           inputs_did_nothing  a bug signal, see below
           felt_broken         fix or cull
           felt_impossible     rebalance or cull
           enjoyed_it          keep, and look at what it did right

         `inputs_did_nothing` earns its place specially. It is the exact signature of the
         four separate faults that made every game unplayable on 31-Aug, all of which were
         found only because one person hit them by hand. Spread across many tasks at once
         it says the SITE is broken; concentrated on one it says the TASK is. That is a
         distinction nothing else on this page can make.

         NO MECHANIC LANGUAGE. Every label describes the player's experience, never the
         game's content, so reading the form cannot spoil the task it is attached to.

         The note is written by someone who has just worked the task out, so it is a
         spoiler by nature. It is submitted and never displayed — not here, not to another
         player, nowhere on the play surface. See Arc3FeedbackRepository.
         01-Sep: `onDone` is the form's exit and the caller chooses where it leads —
         closing the scratchpad mid-run, or the next task once the run is over. The panel
         does not know which, and `doneLabel` exists so the bypass button can say so.
SRP/DRY check: Pass — presentation and submit only. Storage is the repository's, the
         session identity is humanPlayTelemetry's, and the panel holds no game state.
*/

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { humanPlay } from '@/lib/humanPlayTelemetry';

const MAX_NOTE = 1000;

/** Must match FEEDBACK_FLAGS in server/repositories/Arc3FeedbackRepository.ts. */
const OPTIONS: { flag: string; label: string }[] = [
  { flag: 'solved_it', label: 'I worked out what to do' },
  { flag: 'never_understood', label: 'I never worked out what to do' },
  { flag: 'inputs_did_nothing', label: 'Nothing I pressed seemed to matter' },
  { flag: 'felt_broken', label: 'It felt broken' },
  { flag: 'felt_impossible', label: 'It felt unfair or impossible' },
  { flag: 'enjoyed_it', label: 'I enjoyed this one' },
];

const C = {
  text: '#E3E1DF',
  dim: '#A7A3A1',
  faint: '#6E6A68',
  border: '#3A3A3A',
  pink: '#E53AA3',
  green: '#4FCC30',
};

export function Arc3FeedbackPanel({
  gameId, reachedLevel, outcome, onDone, doneLabel, compact,
}: {
  gameId: string;
  reachedLevel: number | null;
  outcome: string | null;
  /** Where the form leads once it is done with — closing the scratchpad mid-run, or the
   *  next task when the run is over. The caller decides; the panel only calls it. */
  onDone?: () => void;
  /** What the bypass button says, because "Skip" means two different things depending on
   *  where onDone goes. */
  doneLabel?: string;
  compact?: boolean;
}) {
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const toggle = (flag: string) =>
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) next.delete(flag); else next.add(flag);
      return next;
    });

  const nothingSaid = flags.size === 0 && !note.trim();

  const submit = async () => {
    if (nothingSaid || sending) return;
    setSending(true);
    // Flush the action queue first so the session row exists before the feedback row
    // references it. Not required — the level and outcome are snapshotted onto the
    // feedback row precisely so it stands alone — but it keeps the two joinable.
    try { humanPlay.flush(false); } catch { /* no-op */ }
    try {
      await fetch('/api/arc3-play/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionGuid: humanPlay.currentSessionGuid(),
          gameId,
          flags: [...flags],
          note: note.slice(0, MAX_NOTE),
          reachedLevel,
          outcome,
        }),
      });
    } catch {
      // Deliberately not surfaced. The player has said their piece; an error box they
      // cannot act on turns a contribution into a chore.
    }
    setSending(false);
    setSent(true);
    setTimeout(() => onDone?.(), 900);
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-[12px]" style={{ color: C.green }}>
        <Check className="w-4 h-4" /> Thanks — that helps.
      </div>
    );
  }

  return (
    <div className={compact ? 'w-full' : 'w-full max-w-[500px] mx-auto'}>
      <p className="text-[11px] mb-2" style={{ color: C.dim }}>
        How was that one? Tick anything that applies.
      </p>

      <div className="grid gap-1 mb-3">
        {OPTIONS.map((o) => {
          const on = flags.has(o.flag);
          return (
            <button
              key={o.flag}
              type="button"
              onClick={() => toggle(o.flag)}
              className="flex items-center gap-2 text-left px-2 py-1.5 text-[11.5px] transition-colors"
              style={{
                border: `1px solid ${on ? C.pink : C.border}`,
                background: on ? 'rgba(229,58,163,.12)' : 'transparent',
                color: on ? C.text : C.dim,
              }}
            >
              <span
                className="w-[13px] h-[13px] shrink-0 flex items-center justify-center"
                style={{ border: `1px solid ${on ? C.pink : C.border}`, background: on ? C.pink : 'transparent' }}
              >
                {on && <Check className="w-[9px] h-[9px]" style={{ color: '#fff' }} />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
        placeholder="Anything else? What you tried, where you got stuck, what felt wrong…"
        rows={compact ? 3 : 4}
        className="w-full px-2 py-1.5 text-[11.5px] resize-y outline-none"
        style={{ background: 'rgba(0,0,0,.35)', border: `1px solid ${C.border}`, color: C.text }}
      />
      <div className="flex items-center justify-between mt-1 mb-3">
        <span className="text-[9.5px]" style={{ color: C.faint }}>
          Saved with your anonymous session. Please don’t include personal details.
        </span>
        <span className="text-[9.5px]" style={{ color: C.faint }}>{note.length}/{MAX_NOTE}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={nothingSaid || sending}
          className="px-4 h-8 text-[11.5px] flex items-center gap-1.5 disabled:opacity-35"
          style={{ background: C.pink, color: '#fff' }}
        >
          {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : 'Send feedback'}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="px-3 h-8 text-[11.5px]" style={{ color: C.faint }}>
            {doneLabel ?? 'Skip'}
          </button>
        )}
      </div>
    </div>
  );
}

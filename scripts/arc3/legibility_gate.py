"""
Author: Claude Opus 5 (Bubba sub-agent, label arc3-legibility-gate)
Date: 01-September-2026
PURPOSE: Static legibility gate for ARC-AGI-3 candidate games. Refuses a game whose only
way to die is pressing the commit button and whose win gate compares against a term the
renderer never draws -- the "commit-or-die with a hidden goal" class documented in
arc-explainer's docs/2026-09-01-arc3-junk-game-audit.md, which made 41 of 823 generated
games unwinnable by construction and put 23 of them in front of human reviewers.

The audit said 40 and 22. It undercounted by one: its Signal A counted the unguarded
lose() inside a `def fail(self): self.bad = True; self.lose()` wrapper as an environmental
death, so any game that wraps its death in a helper looked like it had a hazard. q718-v1
is commit-or-die with a hidden target vector and was queued at rank 157 because of it.
This gate classifies the wrapper's CALL SITES instead -- see the comment on that rule in
analyze() -- and its verdicts are otherwise identical to the audit's on all 823 sources.

THE RULE, stated once: every term a win or lose condition depends on must be reachable
from something the renderer draws. A goal the player cannot see is not a goal, and a game
whose only death is "you guessed the invisible sequence wrong" is not a puzzle.

WHY STATIC AND NOT A PROBE. The execution probe culls games random play can BEAT. This
class is defined by being unbeatable, so it scores ABOVE the median queued game on the
probe's own frames/responsive metrics -- five safe explorable actions produce plenty of
distinct frames -- and the probe's rank sort actively promotes it. No amount of random
play provides an upper bound on difficulty. This one reads the source instead, executes
nothing, and runs in milliseconds per game.

THIS FILE IS THE CANONICAL COPY. arc-explainer carries a byte-identical copy at
scripts/arc3/legibility_gate.py so its triage regeneration does not depend on this private
repo being cloned. The copy adds nothing, not even a provenance header, so drift is one
`shasum -a 256` on each side; scripts/arc3/README-legibility.md records the expected hash
and spells the check out. Change the rules here, then copy across.

SRP/DRY check: Pass -- detection only. It writes nothing, packages nothing and knows about
no specific game. make_submission.py owns refusal-at-publish; this owns the verdict. The
signal definitions are a port of the audit's analyze2.py (in arc-explainer's
docs/arc3-junk-audit-data/), diffed verdict-for-verdict against it on all 823 audited
sources with exactly one deliberate correction -- see selftest_legibility_gate.py.
"""

from __future__ import annotations

import ast
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field

# Level-table keys that name a hidden solution rather than a piece of visible state. A
# comparison against one of these is the idiom the audit found 31 times over.
SUSPICIOUS_KEYS = {
    'plan', 'solution', 'answer', 'code', 'seq', 'sequence', 'key', 'combo', 'password',
    'order', 'target', 'recipe', 'pattern', 'moves', 'steps', 'path', 'spell', 'chord',
    'word', 'phrase', 'secret', 'proof', 'witness', 'ritual', 'script', 'program', 'song',
    'melody', 'route', 'chain', 'formula',
}

# Accumulators that record what the player has already pressed. Comparing one of these to
# a literal is "you had to know the moves before you made them".
HISTORY_RE = re.compile(
    r'\b(history|log|trail|record|moves|inputs|actions_taken|taken|played|typed|entered'
    r'|buffer|stack|seq|sequence|pressed)\b'
)

# Attributes that are bookkeeping rather than game state; never treated as hidden.
NEVER_HIDDEN = {'value', 'id', 'level_index', 'action'}

ADVANCE_CALLS = {'next_level', 'win', 'advance_level', 'complete_level'}

COMMIT_ACTION = 6


@dataclass
class Verdict:
    """One game's verdict. `illegible` is the gate; everything else is the evidence."""
    game_id: str
    illegible: bool = False
    analyzable: bool = True
    skip_reason: str | None = None
    commit_only_death: bool = False          # signal A
    hidden_win_term: bool = False            # signal B (tight)
    commit_death_exists: bool = False        # signal C
    lose_site_kinds: dict = field(default_factory=dict)
    hidden_comparisons: list = field(default_factory=list)
    advance_guards: list = field(default_factory=list)

    def reason(self) -> str:
        if not self.illegible:
            return ''
        cmp_text = self.hidden_comparisons[0]['comparison'] if self.hidden_comparisons else '?'
        hidden = sorted(set(
            (self.hidden_comparisons[0]['hidden_attrs'] if self.hidden_comparisons else [])
            + (self.hidden_comparisons[0]['hidden_keys'] if self.hidden_comparisons else [])
        ))
        return (
            f"illegible: pressing the commit button is the only way to die "
            f"({self.lose_site_kinds.get('commit', 0)} commit-guarded lose() site(s), "
            f"0 environmental), and advancing requires {cmp_text!r} where "
            f"{', '.join(hidden) or 'the compared term'} is never read by any render method"
        )

    def as_dict(self) -> dict:
        d = {
            'gameId': self.game_id,
            'illegible': self.illegible,
            'analyzable': self.analyzable,
            'commitOnlyDeath': self.commit_only_death,
            'hiddenWinTerm': self.hidden_win_term,
            'commitDeathExists': self.commit_death_exists,
            'loseSiteKinds': self.lose_site_kinds,
            'hiddenComparisons': self.hidden_comparisons,
        }
        if self.skip_reason:
            d['skipReason'] = self.skip_reason
        if self.illegible:
            d['reason'] = self.reason()
        return d


def _call_name(node: ast.Call) -> str | None:
    func = node.func
    if isinstance(func, ast.Attribute):
        return func.attr
    if isinstance(func, ast.Name):
        return func.id
    return None


def _terms(node: ast.AST) -> tuple[set, set]:
    """(attribute names, string subscript keys) that appear anywhere under `node`."""
    attrs, keys = set(), set()
    for n in ast.walk(node):
        if isinstance(n, ast.Attribute):
            attrs.add(n.attr)
        elif isinstance(n, ast.Subscript):
            s = n.slice
            if isinstance(s, ast.Constant) and isinstance(s.value, str):
                keys.add(s.value)
    return attrs, keys


def _collect_calls(stmts, ctx, out) -> None:
    """Walk statements once, recording every call with the if/elif guard chain above it.

    ctx entries are ('pos', test, None) for a branch taken when `test` holds, and
    ('neg', None, [tests]) for the trailing else of a chain, carrying the tests it fell
    through. That distinction is what lets the trailing else of an action dispatch be
    treated as unreachable rather than as a real death path.
    """
    for st in stmts:
        if isinstance(st, ast.If):
            chain, cur = [], st
            while True:
                chain.append(cur.test)
                _collect_calls(cur.body, ctx + [('pos', cur.test, None)], out)
                if len(cur.orelse) == 1 and isinstance(cur.orelse[0], ast.If):
                    cur = cur.orelse[0]
                    continue
                if cur.orelse:
                    _collect_calls(cur.orelse, ctx + [('neg', None, list(chain))], out)
                break
        elif isinstance(st, (ast.For, ast.While, ast.With, ast.AsyncWith, ast.Try,
                             ast.AsyncFor)):
            for fld in ('body', 'orelse', 'finalbody', 'handlers'):
                block = getattr(st, fld, None) or []
                if fld == 'handlers':
                    for h in block:
                        _collect_calls(h.body, ctx, out)
                else:
                    _collect_calls(block, ctx, out)
            # The loop header itself (iterator, condition, context manager) can call too.
            for n in ast.iter_child_nodes(st):
                if isinstance(n, ast.expr):
                    for c in ast.walk(n):
                        if isinstance(c, ast.Call):
                            out.append((_call_name(c), list(ctx), c))
        else:
            for c in ast.walk(st):
                if isinstance(c, ast.Call):
                    out.append((_call_name(c), list(ctx), c))


def _lose_helpers(funcs: dict) -> set:
    """Functions that reach lose(), directly or through another such function.

    A fixpoint, because these games routinely wrap the call: `def die(self):
    self.bad=True; self.lose()`. Classifying only literal `lose()` call sites misses the
    death entirely and the game reads as having no deaths at all.
    """
    helpers: set = set()
    for _ in range(4):
        changed = False
        for name, fn in funcs.items():
            if name in helpers or name == 'lose':
                continue
            for c in ast.walk(fn):
                if (isinstance(c, ast.Call) and isinstance(c.func, ast.Attribute)
                        and (c.func.attr == 'lose' or c.func.attr in helpers)):
                    helpers.add(name)
                    changed = True
                    break
        if not changed:
            break
    return helpers


def _rendered_terms(funcs: dict) -> tuple[set, set]:
    """Everything any render/draw/paint/blit method reads. The legibility frontier."""
    attrs, keys = set(), set()
    for name, fn in funcs.items():
        if (name.startswith('render') or 'draw' in name or name.startswith('paint')
                or name.startswith('blit')):
            a, k = _terms(fn)
            attrs |= a
            keys |= k
    return attrs, keys


def _action_vars(step: ast.AST) -> set:
    """Locals bound to the incoming action id, e.g. `a = action.value`."""
    names = set()
    for n in ast.walk(step):
        if isinstance(n, ast.Assign) and isinstance(n.value, ast.Attribute):
            src = ast.unparse(n.value)
            if 'action' in src and ('.value' in src or src.endswith('.id')):
                for t in n.targets:
                    if isinstance(t, ast.Name):
                        names.add(t.id)
    return names


def _const_int(node: ast.AST):
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, int) else None


def _action_ids(test: ast.AST, action_vars: set) -> set:
    """Which action ids a guard pins down: `a == 6`, `a in (1, 2)`."""
    ids = set()
    for n in ast.walk(test):
        if not isinstance(n, ast.Compare):
            continue
        left = ast.unparse(n.left)
        if not (left in action_vars or ('action' in left and ('.value' in left or '.id' in left))):
            continue
        for op, comparator in zip(n.ops, n.comparators):
            if isinstance(op, ast.Eq):
                c = _const_int(comparator)
                if c is not None:
                    ids.add(c)
            elif isinstance(op, ast.In) and isinstance(comparator, (ast.Tuple, ast.List, ast.Set)):
                for elt in comparator.elts:
                    c = _const_int(elt)
                    if c is not None:
                        ids.add(c)
    return ids


def analyze(source: str, game_id: str) -> Verdict:
    """Verdict for one game's source. Parses only; never imports or executes the game."""
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return Verdict(game_id, analyzable=False, skip_reason=f'parse error: {exc}')

    funcs: dict = {}
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            funcs.setdefault(n.name, n)

    step = funcs.get('step')
    if step is None:
        # No step() means no action dispatch to reason about. Not a pass -- a skip, and
        # it is reported as one so a game cannot go unchecked by being shaped oddly.
        return Verdict(game_id, analyzable=False, skip_reason='no step() method')

    lose_helpers = _lose_helpers(funcs)
    lose_names = {'lose'} | lose_helpers
    render_attrs, render_keys = _rendered_terms(funcs)
    action_vars = _action_vars(step)

    calls = []
    for fn_name, fn in funcs.items():
        found: list = []
        _collect_calls(fn.body, [], found)
        for name, ctx, node in found:
            calls.append((fn_name, name, ctx, node))
    seen, unique = set(), []
    for fn_name, name, ctx, node in calls:
        key = (fn_name, name, node.lineno, node.col_offset)
        if key in seen:
            continue
        seen.add(key)
        unique.append((fn_name, name, ctx, node))
    called_names = {name for _, name, _, _ in unique}

    # ---- Signal A: is the commit button the only way to die? ----------------------
    lose_kinds: Counter = Counter()
    for fn_name, name, ctx, node in unique:
        if name not in lose_names:
            continue
        # Plumbing, not a death: an UNGUARDED lose() in the body of a helper that
        # something else calls -- `def fail(self): self.bad = True; self.lose()`. The
        # condition that kills the player lives at the call sites, which are classified
        # in their own right; counting the wrapper body too invents an unguarded
        # "environmental" death and clears Signal A for the whole game. That is a real
        # hole in the 01-Sep audit: q718-v1 is commit-or-die with a hidden target and the
        # audit passed it because its lose() sits inside fail(). A lose() that is GUARDED
        # inside the helper is a genuine condition and still counts, and one in a function
        # nothing calls (step, which the engine invokes) is not plumbing either.
        if name == 'lose' and not ctx and fn_name in lose_helpers and fn_name in called_names:
            continue
        commit = neutral = False
        for kind, test, chain in ctx:
            if kind == 'pos':
                if _action_ids(test, action_vars) == {COMMIT_ACTION}:
                    commit = True
            else:
                # The trailing else of an action dispatch chain. Dead code in practice --
                # these games declare their action set, so no other id ever arrives.
                if any(_action_ids(t, action_vars) for t in chain):
                    neutral = True
        lose_kinds['commit' if commit else ('dispatch_else' if neutral else 'environmental')] += 1

    commit_only_death = lose_kinds['commit'] > 0 and lose_kinds['environmental'] == 0

    # ---- Signal B: does advancing require a term the renderer never draws? --------
    guards = []
    for fn_name, name, ctx, node in unique:
        if name not in ADVANCE_CALLS:
            continue
        for kind, test, _chain in ctx:
            if kind == 'pos':
                guards.append(test)

    hidden_comparisons: list = []
    for test in guards:
        for n in ast.walk(test):
            if not isinstance(n, ast.Compare) or not any(isinstance(o, ast.Eq) for o in n.ops):
                continue
            attrs, keys = set(), set()
            for side in [n.left] + list(n.comparators):
                a, k = _terms(side)
                attrs |= a
                keys |= k
            hidden_attrs = {a for a in attrs if a not in render_attrs and a not in NEVER_HIDDEN}
            hidden_keys = {k for k in keys if k not in render_keys}
            if not (hidden_attrs or hidden_keys):
                continue
            # Tight: an EXACT-solution flavour, not merely an unrendered intermediate.
            # Without this narrowing the count over the audited catalog goes from 40 to
            # 522, because nearly every game compares against some internal it does not
            # draw. What makes this class junk is that the hidden term IS the answer.
            is_seq_literal = any(
                isinstance(s, (ast.Tuple, ast.List)) and len(s.elts) >= 2
                and all(isinstance(e, ast.Constant) for e in s.elts)
                for s in [n.left] + list(n.comparators)
            )
            named_solution = bool(hidden_keys & SUSPICIOUS_KEYS)
            accumulator = HISTORY_RE.search(ast.unparse(n)) is not None
            if not (is_seq_literal or named_solution or accumulator):
                continue
            why = [w for w, on in (('literal sequence', is_seq_literal),
                                   ('named solution key', named_solution),
                                   ('move-history accumulator', accumulator)) if on]
            hidden_comparisons.append({
                'comparison': ast.unparse(n)[:200],
                'hidden_attrs': sorted(hidden_attrs),
                'hidden_keys': sorted(hidden_keys),
                'why': why,
            })

    verdict = Verdict(
        game_id=game_id,
        commit_only_death=commit_only_death,
        hidden_win_term=bool(hidden_comparisons),
        commit_death_exists=lose_kinds['commit'] > 0,
        lose_site_kinds=dict(lose_kinds),
        hidden_comparisons=hidden_comparisons[:4],
        advance_guards=[ast.unparse(t)[:220] for t in guards][:4],
    )
    verdict.illegible = commit_only_death and verdict.hidden_win_term
    return verdict


def analyze_path(path: str) -> Verdict:
    import os
    with open(path, encoding='utf-8') as fh:
        return analyze(fh.read(), os.path.basename(path).removesuffix('.py'))


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith('--')]
    as_json = '--json' in argv
    if not args:
        print('usage: legibility_gate.py <game.py> [more.py ...] [--json]', file=sys.stderr)
        return 2

    verdicts = [analyze_path(p) for p in args]
    if as_json:
        print(json.dumps([v.as_dict() for v in verdicts], indent=1))
    else:
        for v in verdicts:
            if v.illegible:
                print(f'REFUSED {v.game_id}: {v.reason()}', file=sys.stderr)
            elif not v.analyzable:
                print(f'SKIPPED {v.game_id}: {v.skip_reason}', file=sys.stderr)
            else:
                print(f'ok {v.game_id}')
    return 1 if any(v.illegible for v in verdicts) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))

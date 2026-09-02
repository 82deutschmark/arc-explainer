"""
Author: Claude Opus 5
Date: 02-September-2026
PURPOSE: Remove every comment and every docstring from an authored ARC-AGI-3 task before
it is published into this repository. VENDORED, not invented -- this is a lift of
`strip_authoring_text` and its helper from the authoring repo's arc3games/make_submission.py,
which is the canonical copy and where any rule change must be made first.

WHY THIS EXISTS AT ALL. `GET /api/arc3-mirror/games/:gameId/source` is public and
unauthenticated, and the Pyodide worker fetches it into the player's own browser. The
authored modules carry a docstring naming the mechanic, the AI failure mode it targets and
often a level-by-level account of what each level teaches. Publishing that hands a player
the thing the experiment needs them to infer, and their run stops being a human baseline.

The authoring copy's own header records that stripping the module docstring alone was not
enough: packaged files still carried escalation notes and named their decoys in `#`
comments, which is the same leak in a different token type. Hence every comment and every
docstring, not just the top one.

WHY IT IS VENDORED RATHER THAN IMPORTED. Same reasoning as
scripts/arc3/legibility_gate.py, which is vendored from the same repo for the same reason:
a resync must not require a private repository to be checked out next to this one. Keep it
byte-identical to the region it was lifted from; the drift check is a read of both.

SRP/DRY check: Pass -- one function and its helper, no packaging, no gate. Refusal at
publish stays in the authoring repo's make_submission.py; the legibility verdict stays in
legibility_gate.py. This only removes prose.
"""

from __future__ import annotations

import ast
import io
import tokenize

def _docstring_spans(source: str):
    """Line spans of every module/class/function docstring, and the `pass` that has to
    replace one when it is the entire body."""
    spans = {}
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef,
                                 ast.AsyncFunctionDef)):
            continue
        body = getattr(node, "body", None)
        if not (body and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)):
            continue
        doc = body[0]
        # A def or class whose only statement is its docstring becomes a syntax error if
        # the docstring simply vanishes, so it needs a `pass` at the same indent.
        filler = None
        if len(body) == 1 and not isinstance(node, ast.Module):
            filler = " " * doc.col_offset + "pass"
        spans[doc.lineno] = (doc.end_lineno, filler)
    return spans


def strip_authoring_text(source: str) -> str:
    """Remove every comment and every docstring.

    The earlier version of this took out the module docstring alone, on the reasoning
    that function docstrings and `#` comments describe code to a reader of code rather
    than the puzzle to a player. In practice they did not: the packaged files carried
    level-by-level escalation notes, named the decoys, and in one case stated the cost
    rule the player is supposed to infer. /games/:gameId/source is public, so all of that
    was a solution guide shipped with the task. Authoring notes stay in the authored
    file, which is the point of packaging being a separate step; none of them ship.
    """
    spans = _docstring_spans(source)
    lines = source.splitlines(keepends=True)
    kept, i = [], 1
    while i <= len(lines):
        if i in spans:
            end, filler = spans[i]
            if filler is not None:
                kept.append(filler + "\n")
            i = end + 1
            continue
        kept.append(lines[i - 1])
        i += 1
    body = "".join(kept)

    # Comments need the tokenizer: a '#' inside a string literal is not a comment, and
    # these games draw boards out of '#' characters.
    out = body.splitlines(keepends=True)
    drop = set()
    for tok in tokenize.generate_tokens(io.StringIO(body).readline):
        if tok.type != tokenize.COMMENT:
            continue
        (row, col), (_, endcol) = tok.start, tok.end
        line = out[row - 1]
        if line.lstrip().startswith("#"):
            drop.add(row)                      # whole-line comment: take the line
        else:
            out[row - 1] = line[:col].rstrip() + "\n"    # trailing comment: take the tail
    out = [l for n, l in enumerate(out, 1) if n not in drop]

    text = "".join(out)
    while "\n\n\n\n" in text:
        text = text.replace("\n\n\n\n", "\n\n\n")
    return text.lstrip("\n")

"""
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: The prompt variants used by the ARC-3 hypothesis sweep, kept apart from the run
         mechanics so that a prompt is a versioned, hashable object rather than a string
         buried in a request builder. Every result row records the sha of the exact system
         and user text it was produced with, so a JSONL from either machine can be traced
         back to a variant here even after this file changes.

         Two variants ship deliberately:
           v1_original  - reproduces, byte for byte, the LM Studio prompt that produced the
                          01-Sep observations (one glossolalic answer and one excellent one
                          at the same sampler cell). It is the bridge between those hand runs
                          and anything measured by the harness.
           v2_five      - the experiment prompt. Asks for exactly five ranked, mutually
                          distinguishable hypotheses in a fixed shape so that labels can be
                          extracted and compared across runs without constraining prose.

         Deliberately NOT done here: JSON schema / structured-output enforcement. Output
         collapse is one of the dependent variables, and a schema-constrained decode cannot
         produce the failure mode we are trying to measure. The format is requested in words
         and its violation is data, not an error.
SRP/DRY check: Pass - prompt text only. No I/O, no request building, no sampler knowledge.
"""

from __future__ import annotations

import hashlib

# ---------------------------------------------------------------------------
# v1_original
#
# Copied exactly from ~/.lmstudio/conversations/1788300769005 and 1788301275738
# (perChatPredictionConfig.llm.prediction.systemPrompt), including its double spaces
# and trailing space. Do not tidy this string: its value is that it is unaltered.
# ---------------------------------------------------------------------------
_V1_SYSTEM = (
    "You are an expert in the ARC AGI prize and the ARC 3 Challenge.  "
    "Your task is to hypothesize about what the rules and mechanics of unknown games are. "
)

_V1_USER = (
    "This is a synthetic game my assistant made for ARC 3. "
    "I don't know the rules. Can you estimate what they are based on what you would do? "
)


# ---------------------------------------------------------------------------
# v2_five
#
# The system prompt is the Boss's, verbatim, and should stay that way. The model already knows
# ARC-AGI-3, so explaining the domain back to it is not context, it is steering: an earlier
# draft of this opened by stating that these are grid worlds where a player has a fixed set of
# discrete actions and learns by experimenting, and every one of those words is a claim the
# model would then be unlikely to contradict. "Discrete actions" alone pre-answers one of the
# more interesting things we might have watched it work out unaided. All of it was cut.
#
# The last line is doing real work rather than decorating: the point of sampling one frame many
# times is to see the range of readings a model will entertain, and an invitation to reach is
# the cheapest way to widen that range. Whether it actually widens it is measurable here - run
# the same cell with and without it and count distinct mechanics.
#
# Everything procedural now lives in the USER turn, so that the system prompt stays exactly as
# written and the two roles do not compete. Even there it is kept to one sentence: five, and a
# short name each. The parser in hypothesis_report.py was deliberately made permissive rather
# than the prompt made stricter, because a rigid output contract would suppress the glossolalic
# failure mode this experiment exists to measure. A malformed answer is data, not an error.
# ---------------------------------------------------------------------------
_V2_SYSTEM = (
    "You are an expert in the ARC AGI challenge in ARC 3 games. Your task is to hypothesize "
    "about game mechanics, rules, and what the actions do. Don't be afraid to think in freaky "
    "new directions!"
)

_V2_USER = (
    "Give five hypotheses about this game. Number them, and start each one with a short name "
    "for the mechanic you have in mind."
)


PROMPTS: dict[str, dict[str, str]] = {
    "v1_original": {"system": _V1_SYSTEM, "user": _V1_USER},
    "v2_five": {"system": _V2_SYSTEM, "user": _V2_USER},
}

DEFAULT_VARIANT = "v2_five"


def get(variant: str) -> dict[str, str]:
    """Return {'system','user'} for a named variant, or raise with the valid names."""
    if variant not in PROMPTS:
        raise KeyError(
            f"unknown prompt variant {variant!r}; known variants: {', '.join(sorted(PROMPTS))}"
        )
    return PROMPTS[variant]


def sha(text: str) -> str:
    """Short content hash recorded on every result row, so a row identifies its own prompt."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


if __name__ == "__main__":
    for name in sorted(PROMPTS):
        p = PROMPTS[name]
        print(f"{name}")
        print(f"  system {sha(p['system'])}  {len(p['system']):5d} chars")
        print(f"  user   {sha(p['user'])}  {len(p['user']):5d} chars")

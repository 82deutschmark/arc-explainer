# Author: GPT-6 / Codex
# Date: 2026-10-08
# PURPOSE: Competition identities, separate storage, and featured-team coverage for
# the scheduled leaderboard collector, including the continuing reporter watch list.
# SRP/DRY check: Pass — both collection jobs import this shared configuration.
"""Competition identities and separate local storage for the leaderboard jobs."""
import os
from pathlib import Path

ARC3 = "arc-prize-2026-arc-agi-3"
ARC2 = "arc-prize-2026-arc-agi-2"
COMP = os.environ.get("LEADERBOARD_COMPETITION", ARC3)
if COMP not in (ARC3, ARC2):
    raise ValueError(f"unsupported LEADERBOARD_COMPETITION: {COMP}")

ROOT = Path(os.environ.get("LEADERBOARD_DATA_DIR") or Path.home() / ".cache/arc3-leaderboard-data")
DATA = ROOT if COMP == ARC3 else ROOT / "arc-2"
OUR_TEAM_ID = "15605182" if COMP == ARC3 else "17023174"
PINNED_TEAM_IDS = [OUR_TEAM_ID] if COMP == ARC3 else [OUR_TEAM_ID, "15605185"]
FEATURED_TEAM_IDS = frozenset(
    {OUR_TEAM_ID, "15770880", "16032816", "15501006", "16371045", "16021367", "15508513"}
    if COMP == ARC3 else
    {OUR_TEAM_ID, "15605185", "15507730", "15486939", "15487968", "15486728", "15526034"}
)


def check_competition(latest):
    """Only pre-existing ARC3 snapshots may omit the competition identifier."""
    if latest is not None and latest.get("competition", ARC3) != COMP:
        raise ValueError(f"saved leaderboard belongs to another competition; refusing {COMP}")

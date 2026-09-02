/*
Author: Claude Opus 5
Date: 2026-09-02
PURPOSE: The shape of one row of server/data/arc3-games/mechanics.json -- the per-game
         mechanic digest produced by scripts/arc3/mechanic_digest.py and served at
         GET /api/arc3-mirror/mechanics. Shared so the guide page and the play page's
         post-feedback reveal read the same contract rather than each declaring their own.
SRP/DRY check: Pass -- types only. Field meanings are documented at the extractor, which
         is the thing that decides them; this mirrors its output.
*/

export interface Arc3MechanicEntry {
  gameId: string;
  className: string | null;
  /** What the frame advertises: the game's own declaration, or the engine default. */
  availableActions: number[];
  availableActionsSource: 'declared' | 'engine-default';
  /** The actions the source actually reads. Anything offered but not referenced is a move
   *  a player can spend and the game will not look at. */
  actionsReferenced: number[];
  /** 'xy-click' when a function testing ACTION6 also reads data.x/data.y; 'button' when it
   *  handles ACTION6 without coordinates; null when it never mentions ACTION6. */
  action6: 'xy-click' | 'button' | null;
  action6Advertised: boolean;
  action6Inert: boolean;
  actionLabels: Record<string, string>;
  geometry: Record<string, number>;
  levels: number | null;
  winLevels: number | null;
  callsLose: boolean;
  sourceLines: number;
  triage: { status: string | null; rank: number | null } | null;
  /** Human prose from mechanics-notes.json. Never machine-written. */
  mechanic: string | null;
  controls: string | null;
  goal: string | null;
}

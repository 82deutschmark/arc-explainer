# Contributed glow-up playability repair

## Outcome

The 44 published `sonpham-org` glow-up games (`g500`-`g543`) must expose the controls their Python implementations actually read, remain executable through the browser worker, and have enough post-play explanatory metadata for a reviewer to understand each task.

## Root cause

The games dispatch on a local numeric alias such as `aid = self.action.id.value` and pass `available_actions` positionally to `ARCBaseGame.__init__`. The mechanic digest only recognized enum references such as `GameAction.ACTION1` and keyword-form declarations. It therefore published an empty `actionsReferenced` list for every contributed game. The player treats that list as authoritative and disabled every control. The imported set also had no human mechanic, controls, or goal notes.

## Changes

1. Teach `mechanic_digest.py` to recognize positional `available_actions`, numeric action-id dispatch, and coordinate-bearing ACTION6 branches without weakening the existing enum analysis.
2. Add source-derived explanatory notes for every published contributed glow-up: the core mechanic, the physical controls, and the win condition.
3. Make the publication integrity check reject a contributed game with no recognized action or missing explanatory fields.
4. Regenerate `mechanics.json`, run the digest self-test and publication-integrity gate, then exercise representative button and board-click games through the same Pyodide worker path used by the browser.

## Acceptance checks

- Every `g500`-`g543` row has non-empty `actionsReferenced` and a declared action source.
- ACTION6 is classified as `xy-click` only when the implementation reads click coordinates; otherwise it remains a button.
- Every `g500`-`g543` row has non-empty mechanic, controls, and goal prose.
- A representative movement/button game and a representative board-click game change state after valid actions.
- Existing reviewed-game action classifications remain unchanged.
- All 44 contributed modules import under ARCEngine, expose 7-12 levels, accept every
  advertised action, and visibly respond to at least one opening action.

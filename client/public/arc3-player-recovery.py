"""Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Browser practice recovery for contributed games. Used verbatim by Pyodide and
native verification; keeps genuine game rules while making fatal attempts reversible.
SRP/DRY check: Pass — owns recovery/checkpoints only, not game transitions or rendering.
"""
import copy


class ContributedRecovery:
    def __init__(self, enabled, game, frame):
        self.enabled = bool(enabled)
        self.notice = None
        self.recoveries = 0
        self.checkpoint = None
        if self.enabled:
            self.capture(game, frame)

    @staticmethod
    def settled(frame):
        result = copy.deepcopy(frame)
        result.frame = result.frame[-1:]
        return result

    def capture(self, game, frame):
        self.checkpoint = (copy.deepcopy(game), self.settled(frame))

    def after_step(self, game, frame, undo_stack, action_id):
        self.notice = None
        if not self.enabled:
            return game, frame
        state = getattr(frame.state, 'name', str(frame.state))
        if state == 'GAME_OVER' and undo_stack:
            budget = getattr(game, 'budget_left', None)
            if isinstance(budget, (int, float)) and budget <= 0:
                reason = 'That move used the last available move before the goal was complete.'
            else:
                reason = 'The game rejected that attempt.'
            game, previous, _counter, _action = undo_stack.pop()
            self.recoveries += 1
            self.notice = reason + ' Your last move was restored. Try another move, Undo, or Retry level.'
            return game, self.settled(previous)
        previous_level = undo_stack[-1][0].level_index if undo_stack else game.level_index
        if action_id == 0 or (game.level_index != previous_level and state != 'WIN'):
            self.capture(game, frame)
            undo_stack.clear()
        return game, frame

    def retry(self, undo_stack):
        if not self.enabled or self.checkpoint is None:
            raise RuntimeError('This game has no contributed retry checkpoint')
        undo_stack.clear()
        self.notice = 'This level restarted. Your completed levels are saved.'
        self.recoveries += 1
        return copy.deepcopy(self.checkpoint)

    def after_undo(self):
        self.notice = None

    def feedback(self, game):
        if not self.enabled:
            return None
        budget = getattr(game, 'budget_left', None)
        maximum = getattr(game, 'budget_max', 0)
        remaining = (max(0, int(budget)) if isinstance(budget, (int, float))
                     and isinstance(maximum, (int, float)) and maximum > 0 else None)
        details = game.player_feedback() if callable(getattr(game, 'player_feedback', None)) else {}
        return {
            'unlimited_retries': True,
            'moves_remaining': remaining,
            'recoveries': self.recoveries,
            'notice': self.notice or details.get('notice'),
            'goal': details.get('goal'),
            'hint': details.get('hint'),
        }

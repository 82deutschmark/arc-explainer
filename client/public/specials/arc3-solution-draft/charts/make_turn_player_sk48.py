#!/usr/bin/env python3
"""Author: Claude Sonnet 5.5 Low
Date: 08-November-2026
PURPOSE: Build the second "one turn" figure of the Turducken special, on Skewer Kebabs (SK48), in Part 1 of
client/public/specials/2026-11-06-arc3-solution-draft.html (between the turn-player-sk48 markers). It is the same player as the
LS20 figure (make_turn_player.py, switched over with use()), fed by charts/turn-source-sk48.json (extract_turn_source_sk48.py).
The turn: the model decides the strip along the bottom of the screen is the picture of the goal, plans six moves and clears
level 1 on the sixth; the clearing move plays the game's own animation (the three blocks blink) and then level 2.
The verbatim rule applies exactly as for LS20: every line is an exact piece of the saved turn, and a trim is a visible "…".
Run: python3.14 make_turn_player_sk48.py   (needs Pillow and brotli like make_turn_player.py)
SRP/DRY check: Pass - only the SK48 turn's lines and settings live here; the player, styles and checks are make_turn_player.py's.
"""
import json
import make_turn_player as base

HERE = base.HERE
SRC = json.loads((HERE / 'turn-source-sk48.json').read_text())
T = SRC['text']
THINK = T['think'].split('\n')
RES = T['result'].split('\n')
CUT = base.CUT

BLOCKS = [
    ('system', 'SYSTEM PROMPT', 'harness: game rules · notes memory · one tool · own functions', [
        ('system', 'You are a coding agent solving a grid-based puzzle game.'),
        CUT,
        ('system', '- Your job is to solve the entire game by clearing every level, not just the current screen.'),
        CUT,
        ('system', 'NOTES FOR THE WHOLE GAME: in every python call, `notes` is one markdown text that persists for this game'),
        CUT,
        ('system', '- You have exactly one tool: `python`.'),
        CUT,
    ]),
    ('user', 'USER PROMPT', 'harness: own functions listed back · board image', [
        ('user', 'Your previous exchange this turn produced no tool call and executed no actions.'),
        CUT,
        ('user', 'Valid actions right now: UP, DOWN, LEFT, RIGHT, MOUSE, UNDO.'),
        CUT,
        ('user', T['user'].split('\n')[15]),
        CUT,
        ('user', 'Current grid image:'),
        ('user', ''),
        ('user', '[image attached]'),
    ]),
    ('think', 'THINKING', 'shortened', [
        ('think', THINK[5]),
        ('think', THINK[6]),
        ('think', THINK[7]),
        CUT,
        ('think', THINK[11]),
        CUT,
        ('think', THINK[13]),
    ]),
    ('call', 'TOOL CALL: python', 'harness: one action() batch', [('call', ln) for ln in T['call'].split('\n')], 'plan=bfs(s0,g2b)'),
    ('result', 'TOOL RESULT: python', 'one [action] line, six moves on the game', [
        ('result', RES[0]),
        ('step', list(range(6)), 'result', RES[1]),
        CUT,
    ]),
]

HL = ['That matches the HUD picture exactly', 'So the goal picture =', 'So the missing piece:', 'Risk: if wrong']
FIG = {'id': 'fig-turn-sk48', 'data': 'turn-player-sk48-data', 'glob': '__turnPlayerSk48', 'label': 'SK48',
       'start': '<!-- turn-player-sk48:start -->', 'end': '<!-- turn-player-sk48:end -->',
       'png_rel': 'arc3-solution-draft/charts/turn-board-cleared-sk48.png', 'png': HERE / 'turn-board-cleared-sk48.png',
       'still': HERE / 'turn-still-sk48.png',
       'alt': 'The recorded Skewer Kebabs board after the clearing move.',
       'title': 'Another turn, on Skewer Kebabs', 'sub': None,
       'nojs_cap': '<b>Level 1 cleared.</b> The recorded game board.',
       'next': lambda: SRC['next'], 'anim': lambda: SRC['anim'], 'hl': HL,
       'caps': {'capStart': '<b>Before the turn</b> · the board attached to the turn message (recorded frame)',
                'capStep': 'The recorded game after this move.',
                'capWait': 'The recorded game after this move.',
                'capEnd': '<b>The last move.</b> The level clears.',
                'capNext': '<b>Level 1 cleared.</b> Level 2 begins.'}}
base.use(SRC, BLOCKS, FIG)


def main():
    base.check_verbatim()
    base.write_board_png()
    page = base.PAGE.read_text()
    page = base.splice(page, FIG['start'], FIG['end'], base.figure_html())
    base.PAGE.write_text(page)
    print('wrote', base.PAGE)
    if '--still' in __import__('sys').argv:
        base.take_still()


if __name__ == '__main__':
    main()

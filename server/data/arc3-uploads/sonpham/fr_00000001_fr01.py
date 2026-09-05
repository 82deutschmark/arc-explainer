import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

GW, GH = 64, 64
HUD_H = 4
FLOOR_H = 3
PLAY_TOP = HUD_H
PLAY_BOT = GH - FLOOR_H

# ARC-3 color palette
C_BLACK, C_DKBLUE, C_GREEN, C_DKGRAY = 5, 4, 14, 3
C_YELLOW, C_GRAY, C_PINK, C_ORANGE = 11, 2, 6, 12
C_AZURE, C_BLUE, C_MAROON, C_BRYELLOW = 10, 9, 13, 11
C_RED, C_TEAL, C_LIME, C_WHITE = 8, 15, 14, 0

PLAYER_C = C_LIME
PLAYER_GROWN_C = C_GREEN
TIER_COLORS = {1: C_YELLOW, 2: C_ORANGE, 3: C_PINK, 4: C_RED, 5: C_MAROON}

# Fish pixel art facing right. 0=body, 1=eye, -1=transparent
FISH_R = {
    1: [[-1, 0, 1],
        [0, 0, -1]],
    2: [[-1, 0, 0, 1],
        [0, 0, 0, 0],
        [-1, 0, 0, -1]],
    3: [[-1, -1, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0],
        [-1, -1, 0, 0, 0, -1]],
    4: [[-1, -1, -1, 0, 0, 0, 0, 1],
        [-1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, -1],
        [-1, -1, -1, 0, 0, 0, -1, -1]],
    5: [[-1, -1, -1, -1, 0, 0, 0, 0, 0, 1],
        [-1, -1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, -1],
        [-1, -1, 0, 0, 0, 0, 0, 0, 0, 0],
        [-1, -1, -1, -1, 0, 0, 0, 0, 0, -1]],
}
FISH_L = {s: [list(reversed(r)) for r in shape] for s, shape in FISH_R.items()}
FISH_W = {s: len(FISH_R[s][0]) for s in FISH_R}
FISH_H = {s: len(FISH_R[s]) for s in FISH_R}

CHASE_RANGE = 15
PLAYER_SPEED = 2

# Decorations
SEAWEED = [(5, 3), (14, 5), (27, 4), (40, 6), (53, 3), (61, 5)]
GLOW_SPOTS = [(8, 12), (22, 38), (41, 18), (53, 45), (15, 52),
              (35, 8), (48, 30), (60, 55), (27, 25), (7, 40)]
BUBBLE_BASES = [(12, 50), (28, 45), (42, 52), (56, 48)]

# ---------------------------------------------------------------------------
# Level data — all positions hardcoded, fully deterministic
# Fish tuples: (start_x, start_y, size, dx, dy)
# ---------------------------------------------------------------------------
LEVEL_DATA = [
    {
        'name': 'Shallow Waters',
        'bg': C_AZURE, 'floor': C_YELLOW,
        'player_pos': (5, 30), 'player_size': 1,
        'grow_after': 4, 'grow_to': 2, 'eat_target': 7, 'lives': 3,
        'fish': [
            (50, 8, 1, -1, 0), (10, 14, 1, 1, 0), (55, 22, 1, -1, 0),
            (5, 38, 1, 1, 0), (45, 44, 1, -1, 0), (15, 50, 1, 1, 0),
            (60, 28, 1, -1, 0), (25, 55, 1, 1, 0),
            (32, 30, 2, -1, 0),
        ],
    },
    {
        'name': 'Coral Reef',
        'bg': C_BLUE, 'floor': C_ORANGE,
        'player_pos': (5, 30), 'player_size': 2,
        'grow_after': 4, 'grow_to': 3, 'eat_target': 8, 'lives': 3,
        'fish': [
            (55, 10, 1, -1, 0), (10, 20, 1, 1, 0), (48, 36, 1, -1, 0),
            (20, 46, 1, 1, 0), (60, 54, 1, -1, 0),
            (40, 16, 2, -1, 0), (5, 26, 2, 1, 0),
            (50, 42, 2, -1, 0), (15, 52, 2, 1, 0),
            (30, 22, 3, -1, 1), (52, 44, 3, 1, -1),
        ],
    },
    {
        'name': 'Open Ocean',
        'bg': C_DKBLUE, 'floor': C_DKGRAY,
        'player_pos': (5, 30), 'player_size': 3,
        'grow_after': 5, 'grow_to': 4, 'eat_target': 9, 'lives': 3,
        'fish': [
            (50, 8, 1, -1, 0), (10, 28, 1, 1, 0), (55, 50, 1, -1, 0),
            (40, 14, 2, 1, 0), (5, 38, 2, -1, 0), (48, 54, 2, 1, 0),
            (22, 12, 3, -1, 1), (45, 24, 3, 1, -1),
            (10, 42, 3, -1, 0), (55, 48, 3, 1, 0),
            (30, 18, 4, -1, 1), (50, 40, 4, 1, -1),
        ],
    },
    {
        'name': 'The Deep',
        'bg': C_BLACK, 'floor': C_DKGRAY,
        'player_pos': (5, 30), 'player_size': 4,
        'grow_after': 5, 'grow_to': 5, 'eat_target': 10, 'lives': 3,
        'fish': [
            (55, 10, 1, -1, 0), (15, 32, 1, 1, 0), (45, 52, 1, -1, 0),
            (10, 16, 2, 1, 0), (50, 36, 2, -1, 0), (20, 54, 2, 1, 0),
            (40, 12, 3, -1, 1), (5, 40, 3, 1, 0), (55, 50, 3, -1, -1),
            (30, 22, 4, 1, -1), (48, 46, 4, -1, 1), (10, 54, 4, 1, 0),
            (32, 30, 5, -1, 1),
        ],
    },
    {
        'name': 'Apex Predator',
        'bg': C_DKBLUE, 'floor': C_TEAL,
        'player_pos': (5, 30), 'player_size': 5,
        'grow_after': None, 'grow_to': None, 'eat_target': 10, 'lives': 3,
        'fish': [
            (50, 8, 1, -1, 0), (15, 18, 1, 1, 0),
            (55, 26, 2, -1, 1), (10, 34, 2, 1, -1),
            (45, 42, 3, -1, 0), (20, 50, 3, 1, 1),
            (50, 14, 4, -1, -1), (5, 38, 4, 1, 1),
            (40, 54, 4, -1, 0), (25, 22, 4, 1, -1),
        ],
    },
]

levels = [
    Level(sprites=[], grid_size=(GW, GH), name=d['name'], data=d)
    for d in LEVEL_DATA
]


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

class OceanDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def _draw_fish(self, frame, x, y, size, facing_right, color):
        shape = FISH_R[size] if facing_right else FISH_L[size]
        ix, iy = int(x), int(y)
        for ri, row in enumerate(shape):
            for ci, px in enumerate(row):
                if px == -1:
                    continue
                sx, sy = ix + ci, iy + ri
                if 0 <= sx < GW and 0 <= sy < GH:
                    frame[sy, sx] = color if px == 0 else C_WHITE

    def render_interface(self, frame):
        g = self.game

        # Ocean
        frame[:, :] = g.bg_color

        # Bioluminescence for dark levels
        if g.bg_color == C_BLACK:
            for gx, gy in GLOW_SPOTS:
                if PLAY_TOP <= gy < PLAY_BOT:
                    frame[gy, gx] = C_TEAL

        # Ocean floor
        frame[PLAY_BOT:, :] = g.floor_color
        for i in range(0, GW, 8):
            c = C_BRYELLOW if g.floor_color == C_YELLOW else C_GRAY
            frame[PLAY_BOT, i:min(i + 4, GW)] = c

        # Seaweed
        for sx, sh in SEAWEED:
            for sy in range(PLAY_BOT - sh, PLAY_BOT):
                if 0 <= sx < GW and 0 <= sy < GH:
                    frame[sy, sx] = C_GREEN
            leaf_y = PLAY_BOT - sh + 1
            if 0 <= sx + 1 < GW and PLAY_TOP <= leaf_y < GH:
                frame[leaf_y, sx + 1] = C_GREEN

        # Bubbles (deterministic: rise based on step counter)
        for bx, by in BUBBLE_BASES:
            bubble_y = by - (g.step_count // 3) % (PLAY_BOT - PLAY_TOP)
            if bubble_y < PLAY_TOP:
                bubble_y += (PLAY_BOT - PLAY_TOP)
            if 0 <= bx < GW and PLAY_TOP <= bubble_y < PLAY_BOT:
                frame[bubble_y, bx] = C_WHITE

        # Enemy fish
        for f in g.fish:
            if not f['alive']:
                continue
            self._draw_fish(frame, f['x'], f['y'], f['size'],
                            f['facing'], TIER_COLORS[f['size']])

        # Player (blink during invincibility)
        if not (g.invincible > 0 and g.step_count % 4 < 2):
            pc = PLAYER_GROWN_C if g.has_grown else PLAYER_C
            self._draw_fish(frame, g.px, g.py, g.player_size,
                            g.player_facing, pc)

        # HUD bar
        frame[0:HUD_H, :] = C_BLACK

        # Lives (red squares)
        for i in range(g.lives):
            x0 = 2 + i * 4
            frame[1:3, x0:x0 + 2] = C_RED

        # Eat progress bar
        bar_x, bar_w = 20, 32
        frame[1:3, bar_x:bar_x + bar_w] = C_DKGRAY
        if g.eat_target > 0:
            filled = min(bar_w, int(g.eaten * bar_w / g.eat_target))
            if filled > 0:
                frame[1:3, bar_x:bar_x + filled] = C_LIME

        # Size indicator (dots top-right)
        for i in range(g.player_size):
            frame[1:3, 60 - i * 2] = C_BRYELLOW

        return frame


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

class Fr01(ARCBaseGame):
    def __init__(self):
        self.display = OceanDisplay(self)

        self.px = 5.0
        self.py = 30.0
        self.player_size = 1
        self.player_facing = True
        self.has_grown = False
        self.fish = []
        self.lives = 3
        self.eaten = 0
        self.eat_target = 7
        self.grow_after = 4
        self.grow_to = 2
        self.invincible = 0
        self.step_count = 0
        self.bg_color = C_AZURE
        self.floor_color = C_YELLOW

        super().__init__(
            'fr', levels,
            Camera(0, 0, GW, GH, C_BLACK, C_BLACK, [self.display]),
            False, len(levels), [1, 2, 3, 4],
        )

    def on_set_level(self, level):
        d = LEVEL_DATA[self.level_index]
        self.px, self.py = float(d['player_pos'][0]), float(d['player_pos'][1])
        self.player_size = d['player_size']
        self.player_facing = True
        self.has_grown = False
        self.lives = d['lives']
        self.eaten = 0
        self.eat_target = d['eat_target']
        self.grow_after = d['grow_after']
        self.grow_to = d['grow_to']
        self.invincible = 0
        self.step_count = 0
        self.bg_color = d['bg']
        self.floor_color = d['floor']
        self.fish = []
        for fx, fy, fs, fdx, fdy in d['fish']:
            self.fish.append({
                'x': float(fx), 'y': float(fy), 'size': fs,
                'dx': fdx, 'dy': fdy, 'alive': True,
                'facing': fdx >= 0,
            })

    # -- helpers --

    def _overlaps(self, x1, y1, s1, x2, y2, s2):
        w1, h1 = FISH_W[s1], FISH_H[s1]
        w2, h2 = FISH_W[s2], FISH_H[s2]
        return (x1 < x2 + w2 and x1 + w1 > x2 and
                y1 < y2 + h2 and y1 + h1 > y2)

    def _move_fish(self):
        pw, ph = FISH_W[self.player_size], FISH_H[self.player_size]
        pcx, pcy = self.px + pw / 2, self.py + ph / 2

        for f in self.fish:
            if not f['alive']:
                continue
            fw, fh = FISH_W[f['size']], FISH_H[f['size']]
            fcx, fcy = f['x'] + fw / 2, f['y'] + fh / 2

            mdx, mdy = f['dx'], f['dy']
            chasing = False

            # Chase: bigger fish pursue player when close
            if f['size'] > self.player_size:
                dist = abs(pcx - fcx) + abs(pcy - fcy)
                if dist < CHASE_RANGE:
                    chasing = True
                    mdx = (1 if pcx > fcx else -1) if abs(pcx - fcx) > 0.5 else 0
                    mdy = (1 if pcy > fcy else -1) if abs(pcy - fcy) > 0.5 else 0

            f['x'] += mdx
            f['y'] += mdy

            if mdx > 0:
                f['facing'] = True
            elif mdx < 0:
                f['facing'] = False

            # Horizontal wrap
            if f['x'] < -fw:
                f['x'] = float(GW)
            elif f['x'] > GW:
                f['x'] = float(-fw)

            # Vertical bounce (only update stored dy when patrolling)
            if f['y'] < PLAY_TOP:
                f['y'] = float(PLAY_TOP)
                if not chasing and f['dy'] != 0:
                    f['dy'] = abs(f['dy'])
            elif f['y'] + fh > PLAY_BOT:
                f['y'] = float(PLAY_BOT - fh)
                if not chasing and f['dy'] != 0:
                    f['dy'] = -abs(f['dy'])

    # -- main loop --

    def step(self):
        aid = self.action.id.value
        self.step_count += 1

        # 1. Move player
        dx, dy = 0, 0
        if aid == 1:
            dy = -PLAYER_SPEED
        elif aid == 2:
            dy = PLAYER_SPEED
        elif aid == 3:
            dx = -PLAYER_SPEED
            self.player_facing = False
        elif aid == 4:
            dx = PLAYER_SPEED
            self.player_facing = True

        pw, ph = FISH_W[self.player_size], FISH_H[self.player_size]
        self.px = max(0.0, min(float(GW - pw), self.px + dx))
        self.py = max(float(PLAY_TOP), min(float(PLAY_BOT - ph), self.py + dy))

        # 2. Eat edible fish (before enemies move — player advantage)
        for f in self.fish:
            if not f['alive'] or f['size'] > self.player_size:
                continue
            if self._overlaps(self.px, self.py, self.player_size,
                              f['x'], f['y'], f['size']):
                f['alive'] = False
                self.eaten += 1
                # Growth check
                if (self.grow_after is not None and self.grow_to is not None
                        and not self.has_grown and self.eaten >= self.grow_after):
                    self.player_size = self.grow_to
                    self.has_grown = True
                    pw, ph = FISH_W[self.player_size], FISH_H[self.player_size]
                    self.px = max(0.0, min(float(GW - pw), self.px))
                    self.py = max(float(PLAY_TOP), min(float(PLAY_BOT - ph), self.py))
                # Win check
                if self.eaten >= self.eat_target:
                    self.next_level()
                    self.complete_action()
                    return

        # 3. Move enemy fish
        self._move_fish()

        # 4. Invincibility countdown
        if self.invincible > 0:
            self.invincible -= 1

        # 5. Predator collision (after fish move)
        if self.invincible == 0:
            for f in self.fish:
                if not f['alive'] or f['size'] <= self.player_size:
                    continue
                if self._overlaps(self.px, self.py, self.player_size,
                                  f['x'], f['y'], f['size']):
                    self.lives -= 1
                    self.invincible = 12
                    if self.lives <= 0:
                        self.lose()
                        self.complete_action()
                        return
                    break

        self.complete_action()

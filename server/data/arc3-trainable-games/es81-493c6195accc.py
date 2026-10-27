"""es81: a wordless current-routing puzzle."""
import copy
import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay


U, R, D, L = 1, 2, 4, 8
DIRS = ((0, -1, U, D), (1, 0, R, L), (0, 1, D, U), (-1, 0, L, R))


def rect(frame, x, y, w, h, color):
    frame[max(0, y):min(64, y + h), max(0, x):min(64, x + w)] = color


def border(frame, x, y, w, h, color):
    rect(frame, x, y, w, 1, color)
    rect(frame, x, y + h - 1, w, 1, color)
    rect(frame, x, y, 1, h, color)
    rect(frame, x + w - 1, y, 1, h, color)


def rotate(mask, turns=1):
    for _ in range(turns % 4):
        mask = ((mask & U) << 1) | ((mask & R) << 1) | ((mask & D) << 1) | ((mask & L) >> 3)
    return mask


def snake(width, rows):
    path = []
    for y in range(rows):
        xs = range(width) if y % 2 == 0 else range(width - 1, -1, -1)
        path.extend((x, y) for x in xs)
    if rows % 2 == 0:
        # End on the right edge without changing the connected route.
        path.extend((x, rows) for x in range(width))
    return path


def make_specs():
    return [
        dict(w=4, h=2, path=[(0,0),(1,0),(1,1),(2,1),(3,1)],
             corrections=[0,1,1,0,0], pairs=[], locks=[], anchors=[]),
        dict(w=5, h=3, path=snake(5,3),
             corrections=[0,1,2,1,1,0,1,0,1,0,0,0,0,0,0], pairs=[], locks=[], anchors=[7]),
        dict(w=5, h=3, path=snake(5,3),
             corrections=[0,2,1,2,1,1,2,1,1,2,1,1,1,1,0], pairs=[(2,8)], locks=[], anchors=[]),
        dict(w=6, h=3, path=snake(6,3),
             corrections=[0,1,2,1,2,1,1,2,1,0,1,1,2,1,2,1,1,0], pairs=[(3,13),(6,16)], locks=[], anchors=[9]),
        dict(w=6, h=5, path=snake(6,4),
             corrections=[0,2,1,1,2,1,2,1,2,1,1,0,1,2,1,1,2,1,0,2,2,1,2,1,1,1,1,1,1,0],
             pairs=[(4,20)], locks=[8,22], anchors=[11,18]),
        dict(w=6, h=5, path=snake(6,4),
             corrections=[0,1,2,1,2,0,1,2,1,2,1,2,1,1,2,1,0,1,1,2,1,1,1,1,2,2,2,1,1,0],
             pairs=[(3,21),(7,25)], locks=[10,19], anchors=[5,16]),
        dict(w=7, h=5, path=snake(7,4),
             corrections=[0,2,1,2,1,2,0,1,2,1,2,1,2,1,1,2,1,0,1,2,1,1,2,1,2,1,2,1,1,2,1,2,1,2,0],
             pairs=[(3,24),(8,29),(13,32)], locks=[11,20,27], anchors=[6,17]),
        dict(w=7, h=5, path=snake(7,5),
             corrections=[0,2,1,2,0,2,1,1,2,1,2,1,2,1,0,2,1,2,1,2,1,1,2,1,0,1,2,1,1,2,1,2,1,2,0],
             pairs=[(2,23),(6,27),(10,31)], locks=[8,18,29], anchors=[4,14,24]),
    ]


class Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        return self.game.visible.copy()


class Es81(ARCBaseGame):
    def __init__(self, seed=0):
        self.specs = make_specs()
        self.visible = np.full((64, 64), 5, dtype=np.int8)
        self.pending = []
        self.pending_win = False
        super().__init__(
            game_id="es81",
            levels=[Level(grid_size=(64, 64), name=str(i + 1)) for i in range(len(self.specs))],
            camera=Camera(width=64, height=64, background=5, letter_box=5, interfaces=[Display(self)]),
            available_actions=[5, 6],
            seed=seed,
        )

    def on_set_level(self, level):
        self.spec = copy.deepcopy(self.specs[self.level_index])
        self.cell = 8
        self.ox = (64 - self.spec["w"] * self.cell) // 2
        self.oy = (52 - self.spec["h"] * self.cell) // 2 + 1
        self.opened = not bool(self.spec["locks"])
        self.flash = None
        self.masks = {}
        self.target = {}
        self.groups = {}
        self.index_at = {p: i for i, p in enumerate(self.spec["path"])}
        for i, p in enumerate(self.spec["path"]):
            mask = 0
            if i == 0:
                mask |= L
            else:
                px, py = self.spec["path"][i - 1]
                x, y = p
                mask |= R if px > x else L if px < x else D if py > y else U
            if i == len(self.spec["path"]) - 1:
                mask |= R
            else:
                nx, ny = self.spec["path"][i + 1]
                x, y = p
                mask |= R if nx > x else L if nx < x else D if ny > y else U
            self.target[p] = mask
            self.masks[p] = rotate(mask, -self.spec["corrections"][i])
            self.groups[i] = [i]
        for a, b in self.spec["pairs"]:
            self.groups[a] = [a, b]
            self.groups[b] = [a, b]
        self.pending = []
        self.pending_win = False
        self.visible = self.draw()

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def reachable(self):
        start = self.spec["path"][0]
        reached = {start}
        frontier = [start]
        distance = {start: 0}
        while frontier:
            p = frontier.pop(0)
            x, y = p
            i = self.index_at[p]
            if i in self.spec["locks"] and not self.opened:
                continue
            for dx, dy, bit, opposite in DIRS:
                q = (x + dx, y + dy)
                if self.masks[p] & bit and q in self.masks and self.masks[q] & opposite:
                    qi = self.index_at[q]
                    if qi in self.spec["locks"] and not self.opened:
                        continue
                    if q not in reached:
                        reached.add(q)
                        distance[q] = distance[p] + 1
                        frontier.append(q)
        return reached, distance

    def solved(self):
        reached, _ = self.reachable()
        end = self.spec["path"][-1]
        return end in reached and bool(self.masks[end] & R)

    def tile_center(self, p):
        return self.ox + p[0] * self.cell + 4, self.oy + p[1] * self.cell + 4

    def key_box(self):
        return (27, 54, 10, 8)

    def draw_pipe(self, frame, p, mask, color):
        cx, cy = self.tile_center(p)
        rect(frame, cx - 1, cy - 1, 3, 3, color)
        if mask & U: rect(frame, cx - 1, cy - 4, 3, 4, color)
        if mask & R: rect(frame, cx, cy - 1, 5, 3, color)
        if mask & D: rect(frame, cx - 1, cy, 3, 5, color)
        if mask & L: rect(frame, cx - 4, cy - 1, 5, 3, color)

    def draw(self, pulse=None, highlight=None, win_border=False):
        f = np.full((64, 64), 5, dtype=np.int8)
        border(f, 1, 1, 62, 51, 3)
        reached, distances = self.reachable()
        for i, p in enumerate(self.spec["path"]):
            x = self.ox + p[0] * self.cell
            y = self.oy + p[1] * self.cell
            border(f, x, y, 8, 8, 3)
            color = 1
            if p in reached: color = 10
            if pulse is not None and distances.get(p, 99) <= pulse: color = 11
            if i in self.spec["locks"] and not self.opened: color = 8
            self.draw_pipe(f, p, self.masks[p], color)
            if i in self.spec["anchors"]:
                rect(f, x + 1, y + 1, 2, 2, 12); rect(f, x + 5, y + 5, 2, 2, 12)
            group = self.groups.get(i, [i])
            if len(group) > 1:
                dot = (12, 15, 9)[self.spec["pairs"].index(tuple(group)) % 3]
                rect(f, x + 1, y + 5, 2, 2, dot)
            if highlight is not None and i in highlight:
                border(f, x + 1, y + 1, 6, 6, 14)
        # Source and receiver use different shape, position, and colour.
        sy = self.tile_center(self.spec["path"][0])[1]
        ey = self.tile_center(self.spec["path"][-1])[1]
        rect(f, self.ox - 5, sy - 3, 5, 7, 10)
        rect(f, self.ox + self.spec["w"] * 8, ey - 4, 5, 9, 11)
        rect(f, self.ox + self.spec["w"] * 8 + 1, ey - 2, 2, 5, 5)
        if self.spec["locks"]:
            kx, ky, kw, kh = self.key_box()
            border(f, kx, ky, kw, kh, 10 if self.opened else 8)
            rect(f, kx + 4, ky + 1, 2, 6, 10 if self.opened else 8)
            rect(f, kx + 2, ky + 3, 6, 2, 10 if self.opened else 8)
        # The pulse control is a large, non-textual diamond.
        for dy, width in ((0,2),(1,4),(2,6),(3,8),(4,6),(5,4),(6,2)):
            rect(f, 53 + (8 - width)//2, 55 + dy, width, 1, 11)
        if win_border: border(f, 2, 2, 60, 49, 14)
        return f

    def locate(self, x, y):
        gx, gy = (x - self.ox) // self.cell, (y - self.oy) // self.cell
        p = (gx, gy)
        return self.index_at.get(p)

    def queue_click(self, x, y):
        old = self.draw()
        if self.spec["locks"] and self.key_box()[0] <= x < 37 and 54 <= y < 62:
            self.opened = True
            new = self.draw()
            mid = old.copy(); border(mid, 25, 52, 14, 12, 10)
            self.pending.extend([mid, new])
            return
        i = self.locate(x, y)
        if i is None or i in self.spec["anchors"]:
            mid = old.copy(); border(mid, max(1,x-3), max(1,y-3), 7, 7, 8)
            self.pending.extend([mid, old])
            return
        group = self.groups.get(i, [i])
        for j in group:
            p = self.spec["path"][j]
            self.masks[p] = rotate(self.masks[p])
        new = self.draw()
        marked = old.copy()
        for j in group:
            p = self.spec["path"][j]; tx = self.ox + p[0]*8; ty = self.oy + p[1]*8
            border(marked, tx+1, ty+1, 6, 6, 14)
        self.pending.extend([marked, self.draw(highlight=set(group)), new])

    def queue_pulse(self):
        won = self.solved()
        reached, distances = self.reachable()
        far = max(distances.values()) if distances else 0
        for tick in range(6):
            threshold = int(far * (tick + 1) / 6)
            self.pending.append(self.draw(pulse=threshold))
        if won:
            self.pending.extend([self.draw(win_border=True), self.draw(), self.draw(win_border=True)])
            self.pending_win = True
        else:
            self.pending.extend([self.draw(), self.draw()])

    def step(self):
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if self.pending:
            self.visible = self.pending.pop(0)
            if self.pending:
                return
            if self.pending_win:
                self.pending_win = False
                self.next_level()
            self.complete_action()
            return
        if self.action.id == GameAction.ACTION5:
            self.queue_pulse()
        elif self.action.id == GameAction.ACTION6:
            data = self.action.data or {}
            self.queue_click(int(data.get("x", 0)), int(data.get("y", 0)))
        if not self.pending:
            self.pending.append(self.draw())

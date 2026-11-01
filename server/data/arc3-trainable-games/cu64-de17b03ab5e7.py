"""cu64: belts of cups pour bricks into a basin; fill the empty sockets exactly.

Each lane is a belt of cups above a shared basin. Clicking a cup cycles it through zero, one and
two bricks (a cup joined to another by a rod loads both). Space pours: every belt carries its
bricks right by its own hidden distance, then they drop into the basin column below. The basin
keeps what lands. A column that rises above its sockets spills and the whole basin drains.
Some lane heads are levers that switch the belt between two hidden distances; purple lanes
carry scoops that take a brick back out and cannot dig below the floor.

One column grid runs through the whole machine. A cup, the belt under it and the basin column below
it share the same pixel columns: a black post stands on every seam above the belt, a black divider on
the same seam below it, and the basin walls rise to the last belt, so each column is one channel from
cup to floor. The head, the belt's end and the basin's side walls are flush with each other.

Under each belt is a ruler with a tick on every seam. After a pour that carried bricks on a belt, the
ruler fills as far as that belt slid, growing in step with the brick, and it stays filled: a
measurement you made, kept where you can read it against the columns. A lever belt keeps one reading
for each position of its knob. The ruler never shows a distance nobody has measured.
"""

import copy
import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay, Sprite


# One meaning per palette index.
FIELD, WALL, SOCKET, BRICK, POUR, SCOOP, ROD, SPILL, RULER = 9, 5, 0, 11, 12, 15, 14, 8, 10


# Lanes top to bottom: s = +1 pour lane, -1 scoop lane; d = hidden travel (two values = a lever,
# the first one is where its knob starts). n cups per lane; chains join two cups of one lane;
# T = bricks wanted in each basin column.
LEVELS = [
    {"lanes": [{"s": 1, "d": [1]}], "n": 4, "chains": [],
     "T": [0, 1, 0, 2, 0]},
    {"lanes": [{"s": 1, "d": [2, 4]}], "n": 5, "chains": [],
     "T": [0, 0, 0, 2, 0, 0, 0, 3, 2]},
    {"lanes": [{"s": 1, "d": [2]}, {"s": 1, "d": [1, 4]}], "n": 5, "chains": [],
     "T": [0, 2, 0, 3, 0, 3, 1, 0, 2]},
    {"lanes": [{"s": 1, "d": [1]}, {"s": 1, "d": [3]}], "n": 6, "chains": [(0, 1, 5)],
     "T": [0, 1, 0, 2, 2, 2, 4, 0, 2]},
    {"lanes": [{"s": 1, "d": [2, 4]}, {"s": 1, "d": [1]}], "n": 5, "chains": [(0, 2, 4)],
     "T": [0, 0, 3, 3, 4, 2, 4, 0, 2]},
    {"lanes": [{"s": 1, "d": [1]}, {"s": -1, "d": [2]}], "n": 6, "chains": [(0, 2, 4)],
     "T": [0, 2, 3, 4, 4, 0, 2, 0]},
    {"lanes": [{"s": -1, "d": [2]}, {"s": 1, "d": [2]}, {"s": 1, "d": [4, 1]}], "n": 5,
     "chains": [(2, 0, 3)],
     "T": [0, 4, 2, 2, 1, 4, 2, 2, 2]},
    {"lanes": [{"s": 1, "d": [1, 4]}, {"s": -1, "d": [3]}, {"s": 1, "d": [2]}], "n": 5,
     "chains": [(0, 0, 3), (1, 0, 2)],
     "T": [0, 1, 4, 4, 1, 4, 3, 3, 4]},
]


def rect(frame, x, y, w, h, colour):
    """Fill a rectangle, clipped to the screen."""
    if w <= 0 or h <= 0:
        return
    frame[max(0, y):max(0, min(64, y + h)), max(0, x):max(0, min(64, x + w))] = colour


def outline(frame, x, y, w, h, colour):
    rect(frame, x, y, w, 1, colour)
    rect(frame, x, y + h - 1, w, 1, colour)
    rect(frame, x, y, 1, h, colour)
    rect(frame, x + w - 1, y, 1, h, colour)


def dot(frame, x, y, colour):
    if 0 <= x < 64 and 0 <= y < 64:
        frame[y, x] = colour


def wheel(frame, x, y, size, colour, hub, spin=0):
    """A round drive wheel: a solid disc with a hub marker in the housing's colour. The marker steps round
    the centre one place a frame while its belt runs, so a turning wheel shows which belts are working."""
    centre = (size - 1) / 2
    for i in range(size):
        for j in range(size):
            if ((i - centre) ** 2 + (j - centre) ** 2) ** 0.5 <= size / 2 - 0.25:
                dot(frame, x + j, y + i, colour)
    k = (size - 2) // 2
    step = spin % 4
    dot(frame, x + k + (1 if step in (1, 2) else 0), y + k + (1 if step in (2, 3) else 0), hub)


# Belt thickness options, thickest first: (belt body rows, ruler rows).
BELTS = ((2, 2), (2, 1), (1, 2), (1, 1))


def layout(lane_count, columns, tallest):
    """One grid for the whole machine. The biggest column pitch that fits; bricks are pitch-1
    wide with a one pixel seam; the machine is centred on the screen.

    Across: head, one pixel of belt frame (the left post), then every column, then the right wall.
    Down, per lane: one blank row, two bricks of cup, belt body, ruler, one row for the rod. Under the
    last lane one brick of air, then the basin, whose walls rise exactly as high as the tallest column.
    """
    for pitch in range(12, 4, -1):
        head = max(4, pitch - 2)
        width = head + 1 + columns * pitch + 1
        if width > 62:
            continue
        found = None
        for limit in (60, 62):
            for bh in range(min(6, pitch), 2, -1):
                for body, ruler in BELTS:
                    lane_h = 2 * bh + body + ruler + 1
                    # The gap above the rim is where an overfilled column shows its spilled brick.
                    height = lane_count * lane_h + bh + tallest * bh + 2
                    if height <= limit:
                        found = (bh, body, ruler, lane_h, height)
                        break
                if found:
                    break
            if found:
                break
        if found:
            bh, body, ruler, lane_h, height = found
            x0 = (64 - width) // 2
            y0 = (64 - height) // 2
            top = y0 + lane_count * lane_h + bh
            return {"p": pitch, "bh": bh, "body": body, "ruler": ruler, "bt": body + ruler, "head": head,
                    "lane_h": lane_h, "x0": x0, "y0": y0, "cx0": x0 + head + 1, "W": width, "H": height,
                    "basin_top": top, "floor": top + tallest * bh}
    raise ValueError("level does not fit the screen")


def level_geometry(spec):
    return layout(len(spec["lanes"]), len(spec["T"]), max(spec["T"]))


def cup_rect(geo, lane, cup):
    """Click rectangle of a cup: the inside of its bin, exactly the pixels a brick of that column covers.
    The posts, the belt and the ruler are not part of it."""
    x = geo["cx0"] + cup * geo["p"]
    y = geo["y0"] + lane * geo["lane_h"] + 1
    return x, y, geo["p"] - 1, 2 * geo["bh"] - 1


def head_rect(geo, lane):
    x = geo["x0"]
    y = geo["y0"] + lane * geo["lane_h"] + 1
    return x, y, geo["head"], 2 * geo["bh"] - 1 + geo["bt"]


def rect_centre(r):
    x, y, w, h = r
    return x + w // 2, y + h // 2


class PixelDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        return self.game.visible.copy()


class Cu64(ARCBaseGame):
    def __init__(self, seed=0):
        self.visible = np.full((64, 64), FIELD, dtype=np.int8)
        self.pending = []
        self.outcome = False
        levels = []
        for index, spec in enumerate(LEVELS):
            geo = level_geometry(spec)
            sprites = []
            for lane, info in enumerate(spec["lanes"]):
                colour = POUR if info["s"] > 0 else SCOOP
                hx, hy, hw, hh = head_rect(geo, lane)
                lever = len(info["d"]) == 2
                sprites.append(Sprite([[colour] * hw for _ in range(hh)], name=f"head_{lane}", x=hx, y=hy,
                                      tags=["lever", "sys_click"] if lever else ["motor"]))
                for cup in range(spec["n"]):
                    cx, cy, cw, ch = cup_rect(geo, lane, cup)
                    sprites.append(Sprite([[colour] * cw for _ in range(ch)], name=f"cup_{lane}_{cup}",
                                          x=cx, y=cy, tags=["cup", "sys_click"]))
            basin_w = len(spec["T"]) * geo["p"]
            sprites.append(Sprite([[SOCKET] * basin_w for _ in range(max(1, max(spec["T"])))], name="basin",
                                  x=geo["cx0"], y=geo["basin_top"], tags=["basin"]))
            levels.append(Level(sprites=sprites, grid_size=(64, 64), name=str(index + 1)))
        super().__init__(game_id="cu64", levels=levels,
                         camera=Camera(width=64, height=64, background=FIELD, letter_box=FIELD,
                                       interfaces=[PixelDisplay(self)]),
                         available_actions=[5, 6], seed=seed)

    # ── state ────────────────────────────────────────────────────────────────

    def on_set_level(self, level):
        self.spec = copy.deepcopy(LEVELS[self.level_index])
        self.geo = level_geometry(self.spec)
        lanes = len(self.spec["lanes"])
        self.columns = len(self.spec["T"])
        self.basin = [0] * self.columns
        self.loads = [[0] * self.spec["n"] for _ in range(lanes)]
        self.gears = [0] * lanes
        # What the player has measured: how far each belt slid, one reading per knob position.
        self.reach = [[None, None] for _ in range(lanes)]
        self.partner = {}
        for lane, a, b in self.spec["chains"]:
            self.partner[(lane, a)] = b
            self.partner[(lane, b)] = a
        self.pending = []
        self.outcome = False
        self.visible = self.draw()

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def delay(self, lane):
        return self.spec["lanes"][lane]["d"][self.gears[lane]]

    def is_lever(self, lane):
        return len(self.spec["lanes"][lane]["d"]) == 2

    def knob_up(self, lane):
        d = self.spec["lanes"][lane]["d"]
        return d[self.gears[lane]] == min(d)

    def measured(self, lane):
        """Columns the player has seen this belt slide with its knob where it is now (0 = not yet)."""
        return self.reach[lane][self.gears[lane]] or 0

    # ── the rule ─────────────────────────────────────────────────────────────

    def pour(self):
        """Decide the whole pour once. Returns what the frames need to show it."""
        T = self.spec["T"]
        before = list(self.basin)
        add = [0] * self.columns
        take = [0] * self.columns
        items = []  # (lane, cup, slot, column, sign)
        for lane, row in enumerate(self.loads):
            sign = self.spec["lanes"][lane]["s"]
            d = self.delay(lane)
            for cup, amount in enumerate(row):
                for slot in range(amount):
                    items.append((lane, cup, slot, cup + d, sign))
                if sign > 0:
                    add[cup + d] += amount
                else:
                    take[cup + d] += amount
        raw = [before[c] + add[c] - take[c] for c in range(self.columns)]
        spill = [c for c in range(self.columns) if raw[c] > T[c]]
        if spill:
            after = [0] * self.columns
        else:
            after = [max(0, v) for v in raw]
        puffs = [c for c in range(self.columns) if not spill and raw[c] < 0]
        self.basin = after
        self.loads = [[0] * self.spec["n"] for _ in self.loads]
        won = not spill and after == list(T)
        return {"before": before, "add": add, "take": take, "raw": raw, "spill": spill, "after": after,
                "puffs": puffs, "items": items, "won": won}

    # ── drawing ──────────────────────────────────────────────────────────────

    def lane_top(self, lane):
        return self.geo["y0"] + lane * self.geo["lane_h"]

    def col_x(self, column):
        return self.geo["cx0"] + column * self.geo["p"]

    def seam_x(self, column):
        """The one pixel column between a column and the next (column -1 is the left frame)."""
        return self.geo["cx0"] + column * self.geo["p"] + self.geo["p"] - 1

    def cup_slot_y(self, lane, slot):
        """Top row of brick slot 0 (lower) or 1 (upper) in a lane's cups."""
        return self.lane_top(lane) + 1 + (1 - slot) * self.geo["bh"]

    def basin_slot_y(self, j):
        """Top row of basin brick slot j (0 = on the floor)."""
        return self.geo["floor"] - (j + 1) * self.geo["bh"] + 1

    def brick(self, frame, x, y, colour, scoop=False):
        bw, bh = self.geo["p"] - 1, self.geo["bh"] - 1
        rect(frame, x, y, bw, bh, colour)
        if scoop:  # a bite out of the top edge
            rect(frame, x + bw // 2 - (1 if bw >= 7 else 0), y, 1 + (2 if bw >= 7 else 0), 1, FIELD)

    def draw_basin(self, frame, stacks, puffs, win_flash):
        g = self.geo
        p, bh = g["p"], g["bh"]
        floor = g["floor"]
        left = g["cx0"] - 2
        right = g["cx0"] + self.columns * p  # last pixel column of the basin
        rim = BRICK if win_flash else WALL
        last_rod = self.lane_top(len(self.spec["lanes"]) - 1) + 2 * bh + g["bt"]
        rect(frame, left, last_rod, 2, floor - last_rod + 2, rim)  # the walls rise to the last belt
        rect(frame, right - 1, last_rod, 2, floor - last_rod + 2, rim)
        rect(frame, left, floor, right - left + 1, 2, rim)
        dot(frame, left, floor + 1, FIELD)  # the bottom corners step in
        dot(frame, right, floor + 1, FIELD)
        # A divider on every seam, from the floor up. Under the last belt the same seams carry on up to
        # the belt, so a cup, the gap below it and its basin column sit inside one channel.
        for c in range(0, self.columns - 1):
            rect(frame, self.seam_x(c), last_rod, 1, floor - last_rod, WALL)
        for c in range(self.columns):
            for j in range(self.spec["T"][c]):
                self.brick(frame, self.col_x(c), self.basin_slot_y(j), SOCKET)
            for j, colour in enumerate(stacks[c]):
                if j > max(self.spec["T"]):
                    break
                self.brick(frame, self.col_x(c), self.basin_slot_y(j), colour)
        for c in puffs:
            outline(frame, self.col_x(c), self.basin_slot_y(0), p - 1, bh - 1, SCOOP)

    def draw_head(self, frame, lane, colour, knob_mid, spin=0):
        g = self.geo
        bh = g["bh"]
        hx, hy, hw, hh = head_rect(g, lane)
        if self.is_lever(lane):
            # A lever: a black slot with a knob in the belt's colour, up for the short travel.
            rect(frame, hx, hy, hw, hh, WALL)
            dot(frame, hx, hy, FIELD)  # the outer corners step in
            dot(frame, hx, hy + hh - 1, FIELD)
            kh = max(2, bh - 1)
            inner_top, inner_bottom = hy + 1, hy + hh - 1 - kh
            if knob_mid == lane:
                ky = (inner_top + inner_bottom) // 2
            else:
                ky = inner_top if self.knob_up(lane) else inner_bottom
            rect(frame, hx + 1, ky, hw - 2, kh, colour)
        else:
            # A motor: a housing the colour of its belt with the belt's drive wheel at the foot.
            rect(frame, hx, hy, hw, hh, colour)
            dot(frame, hx, hy, FIELD)  # the outer corners step in
            dot(frame, hx, hy + hh - 1, FIELD)
            size = min(hw, 6)
            wheel(frame, hx + (hw - size) // 2, hy + hh - size, size, WALL, colour, spin)

    def draw_lane(self, frame, lane, cups, knob_mid, nudge, lift, fill, spin=0):
        g = self.geo
        p, bh, body, ruler, bt = g["p"], g["bh"], g["body"], g["ruler"], g["bt"]
        info = self.spec["lanes"][lane]
        colour = POUR if info["s"] > 0 else SCOOP
        top = self.lane_top(lane)
        belt_y = top + 2 * bh
        xl = g["cx0"] - 1
        xr = g["cx0"] + self.columns * p
        self.draw_head(frame, lane, colour, knob_mid, spin)
        # The belt: body, then the ruler row with a tick on every seam.
        rect(frame, xl, belt_y, xr - xl + 1, body, colour)
        rect(frame, xl, belt_y + body, xr - xl + 1, ruler, WALL)
        for c in range(-1, self.columns):
            rect(frame, self.seam_x(c) + (1 if nudge else 0), belt_y + body, 1, ruler, RULER)
        if fill:
            rect(frame, g["cx0"], belt_y + body, fill * p - 1, ruler, RULER)
        dot(frame, xr, belt_y, FIELD)  # the far end steps in
        dot(frame, xr, belt_y + bt - 1, FIELD)
        # Cups: a black post on every seam, so each cup is a bin exactly as wide as a basin column.
        for c in range(-1, self.spec["n"]):
            rect(frame, self.seam_x(c), top + 1, 1, 2 * bh - 1, WALL)
        # Chains: a green rod under the belt, hung from the floor of each joined cup.
        for chain_lane, a, b in self.spec["chains"]:
            if chain_lane != lane:
                continue
            xa = self.col_x(a) + (p - 1) // 2
            xb = self.col_x(b) + (p - 1) // 2
            rect(frame, xa, belt_y + bt, xb - xa + 1, 1, ROD)
            rect(frame, xa, belt_y, 1, bt + 1, ROD)
            rect(frame, xb, belt_y, 1, bt + 1, ROD)
        if cups:
            for cup, amount in enumerate(self.loads[lane]):
                for slot in range(amount):
                    dy = 0
                    if lift is not None and (lane, cup) in lift[0] and slot == amount - 1:
                        dy = -(lift[1] if slot == 0 else 1)
                    self.brick(frame, self.col_x(cup), self.cup_slot_y(lane, slot) + dy,
                               BRICK if info["s"] > 0 else SCOOP, scoop=info["s"] < 0)

    def draw(self, cups=True, knob_mid=None, nudge=False, basin=None, movers=(), puffs=(), win_flash=False,
             tap=None, lift=None, fill=None, spin=None):
        frame = np.full((64, 64), FIELD, dtype=np.int8)
        stacks = basin if basin is not None else [[BRICK] * v for v in self.basin]
        self.draw_basin(frame, stacks, puffs, win_flash)
        for lane in range(len(self.spec["lanes"])):
            length = self.measured(lane) if fill is None else fill[lane]
            self.draw_lane(frame, lane, cups, knob_mid, nudge, lift, length, spin[lane] if spin else 0)
        for x, y, scoop in movers:
            self.brick(frame, x, y, SCOOP if scoop else BRICK, scoop=scoop)
        if tap is not None:
            tx, ty = tap
            for dx, dy in ((-1, 0), (0, 0), (1, 0), (0, -1), (0, 1)):
                x, y = tx + dx, ty + dy
                if 0 <= x < 64 and 0 <= y < 64:
                    frame[y, x] = WALL if frame[y, x] != WALL else SOCKET
        return frame

    # ── input ────────────────────────────────────────────────────────────────

    def hit(self, x, y):
        g = self.geo
        for lane in range(len(self.spec["lanes"])):
            hx, hy, hw, hh = head_rect(g, lane)
            if hx <= x < hx + hw and hy <= y < hy + hh:
                return ("head", lane)
            for cup in range(self.spec["n"]):
                cx, cy, cw, ch = cup_rect(g, lane, cup)
                if cx <= x < cx + cw and cy <= y < cy + ch:
                    return ("cup", lane, cup)
        return None

    def step(self):
        if self.action.id == GameAction.RESET:
            self.complete_action()
            return
        if self.pending:
            self.visible = self.pending.pop(0)
            if self.pending:
                return
            if self.outcome:
                self.outcome = False
                self.next_level()
            self.complete_action()
            return

        frames = []
        if self.action.id == GameAction.ACTION6:
            data = self.action.data or {}
            x, y = int(data.get("x", 0)), int(data.get("y", 0))
            target = self.hit(x, y)
            if target is not None and target[0] == "cup":
                _, lane, cup = target
                value = (self.loads[lane][cup] + 1) % 3
                touched = [(lane, cup)]
                self.loads[lane][cup] = value
                if (lane, cup) in self.partner:
                    other = self.partner[(lane, cup)]
                    self.loads[lane][other] = value
                    touched.append((lane, other))
                settled = self.draw()
                lift = max(1, self.geo["bh"] // 2)
                if value:
                    frames.append(self.draw(lift=(touched, lift)))
                else:
                    # Emptying: the cup's bricks lift out, then the cup is bare.
                    frame = settled.copy()
                    for l, c in touched:
                        sign = self.spec["lanes"][l]["s"]
                        for slot in range(2):
                            self.brick(frame, self.col_x(c), self.cup_slot_y(l, slot) - (lift if slot == 0 else 1),
                                       BRICK if sign > 0 else SCOOP, scoop=sign < 0)
                    frames.append(frame)
                frames.append(settled)
            elif target is not None and target[0] == "head" and self.is_lever(target[1]):
                lane = target[1]
                frames.append(self.draw(knob_mid=lane))
                self.gears[lane] ^= 1
                frames.append(self.draw())
            else:
                settled = self.draw()
                frames.append(self.draw(tap=(min(62, max(1, x)), min(62, max(1, y)))))
                frames.append(settled)
        elif self.action.id == GameAction.ACTION5:
            frames = self.pour_frames()
        else:
            frames = [self.draw()]
        self.pending = frames
        self.visible = self.pending.pop(0)
        if self.pending:
            return
        if self.outcome:
            self.outcome = False
            self.next_level()
        self.complete_action()

    def pour_frames(self):
        loads = [list(row) for row in self.loads]
        delays = [self.delay(lane) for lane in range(len(loads))]
        known = [self.measured(lane) for lane in range(len(loads))]
        result = self.pour()
        frames = []
        if not result["items"]:
            frames.append(self.draw(nudge=True))
            frames.append(self.draw())
            return frames
        # Every belt that carried a brick has now measured its slide for the knob position it is in.
        carried = {it[0] for it in result["items"]}
        for lane in carried:
            self.reach[lane][self.gears[lane]] = delays[lane]
        before = result["before"]
        # Each item's landing slot: arrivals stack on what is there, scoops above the bricks.
        landing = {}
        height = list(before)
        tallest = max(self.spec["T"])
        ordered = sorted(result["items"], key=lambda it: (it[4] < 0, -it[0], it[1], it[2]))
        for item in ordered:
            c = item[3]
            landing[item] = min(height[c], tallest)
            height[c] += 1
        start_y = {it: self.cup_slot_y(it[0], it[2]) for it in result["items"]}
        land_y = {it: self.basin_slot_y(landing[it]) for it in result["items"]}

        def basin_stacks(values):
            return [[BRICK] * max(0, v) for v in values]

        held = basin_stacks(before)
        slide = max(delays[it[0]] for it in result["items"])
        for f in range(1, slide + 1):
            movers = [(self.col_x(it[1] + min(f, delays[it[0]])), start_y[it], it[4] < 0) for it in result["items"]]
            # The ruler grows with the brick: it shows how far this belt has slid so far.
            fill = [max(known[l], min(f, delays[l])) if l in carried else known[l] for l in range(len(loads))]
            spin = [f if l in carried else 0 for l in range(len(loads))]
            frames.append(self.draw(cups=False, basin=held, movers=movers, fill=fill, spin=spin))
        frames.append(frames[-1])  # a beat above the stopping column before the drop: where it stopped is the delay
        # Half way down, each column's arrivals fall as one group (no piece passes through another).
        shift = {}
        for it in ordered:
            shift.setdefault(it[3], (land_y[it] - start_y[it]) // 2)
        half = [(self.col_x(it[3]), land_y[it] - shift[it[3]], it[4] < 0) for it in result["items"]]
        frames.append(self.draw(cups=False, basin=held, movers=half))
        landed = [(self.col_x(it[3]), land_y[it], it[4] < 0) for it in result["items"]]
        frames.append(self.draw(cups=False, basin=held, movers=landed))
        if result["spill"]:
            T = self.spec["T"]
            stacks = [[BRICK if j < T[c] else SPILL for j in range(max(0, v))] for c, v in enumerate(result["raw"])]
            for _ in range(3):
                frames.append(self.draw(cups=False, basin=stacks))
            frames.append(self.draw())
        elif result["won"]:
            frames.append(self.draw(cups=False, win_flash=True))
            frames.append(self.draw())
            self.outcome = True
        else:
            if result["puffs"]:
                frames.append(self.draw(cups=False, puffs=result["puffs"]))
            frames.append(self.draw())
        return frames

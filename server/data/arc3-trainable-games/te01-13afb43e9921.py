# Author: GPT 6.1 Sol
# Date: 25-October-2026
# PURPOSE: Expand te01 to eight cable-routing stages with named readable sprites,
# safe level retries, and intact short movement using the original contact geometry.
# SRP/DRY check: Pass — reuses the parent cable/cover rules and shared sprite-book art.
"""te01: an eight-stage human-feedback revision of te01@6c224f109520."""
from functools import lru_cache
from collections import namedtuple
from itertools import combinations
from math import hypot, isfinite, cos, sin, pi

import numpy as np
from arcengine import ARCBaseGame, Camera, GameState, Level, Sprite


# --- shared art, inlined at packaging time ---
def pixel_art(rows: tuple, colours: dict) -> list[list[int]]:
    """Letters to colour indices; '.' is -1, so the ground shows through."""
    return [[-1 if ch == "." else colours[ch] for ch in row] for row in rows]


EPS = 1e-9
CELL, OX, OY = 6, 2, 2
WHITE, SILVER, GRAY, DARK, BLACK = 0, 1, 2, 4, 5
RED, BLUE, SKY, YELLOW, ORANGE, GREEN = 8, 9, 10, 11, 12, 14
DIRECTIONS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
BODY_RADIUS = .55
GUARD_HALF = .48
LEVELS = [{'name': 'te01-1',
  'size': (10, 9),
  'dock': (1, 4),
  'core': (7, 4),
  'obstacles': ((3.2, 3.6, 3.8, 5.3),),
  'cable': 7.8,
  'cutters': ()},
 {'name': 'te01-2',
  'size': (10, 9),
  'dock': (1, 7),
  'core': (9, 2),
  'obstacles': ((2.3, 5.3, 3.3, 9.0), (4.8, 5.5, 5.4, 7.4), (6.7, 2.3, 7.7, 4.7)),
  'cable': 14.0,
  'cutters': ()},
 {'name': 'te01-3',
  'size': (10, 9),
  'dock': (1, 7),
  'core': (9, 2),
  'obstacles': ((2.3, 5.3, 3.3, 9.0), (4.8, 5.5, 5.4, 7.4), (6.7, 2.3, 7.7, 4.7)),
  'cable': 14.0,
  'cutters': ((4.8, 3.5, 0.35),)},
 {'name': 'te01-4',
  'size': (10, 10),
  'dock': (1, 8),
  'core': (9, 2),
  'obstacles': ((2.3, 5.3, 3.3, 10.0), (4.8, 5.5, 5.4, 7.4), (6.7, 2.3, 7.7, 4.7)),
  'cable': 14.0,
  'cutters': ((4.8, 3.5, 0.35),)},
 {'name': 'te01-5',
  'size': (10, 9),
  'dock': (1, 7),
  'core': (9, 2),
  'obstacles': ((2.3, 5.3, 3.3, 9.0), (4.8, 5.5, 5.4, 7.4), (6.7, 2.3, 7.7, 4.7)),
  'cable': 14.0,
  'cutters': ((4.8, 3.5, 0.35), (6.0, 6.8, 0.25)),
  'guard_start': (7, 7),
  'guard_rail': ((6, 7), (7, 7)),
  'guard_target': 1},
 {'name': 'te01-6',
  'size': (10, 10),
  'dock': (1, 7),
  'core': (9, 2),
  'obstacles': ((2.3, 5.3, 3.3, 10.0), (4.8, 5.5, 5.4, 7.4), (6.7, 2.3, 7.7, 4.7)),
  'cable': 14.0,
  'cutters': ((4.8, 3.5, 0.35), (6.0, 6.8, 0.25)),
  'guard_start': (7, 8),
  'guard_rail': ((7, 8), (7, 7), (6, 7)),
  'guard_target': 1},
 {'name': 'te01-7',
  'size': (10, 10),
  'dock': (1, 8),
  'core': (9, 2),
  'obstacles': ((2.3, 4.3, 3.3, 10.0), (5.3, 0.0, 5.7, 5.7), (7.7, 4.3, 8.1, 10.0)),
  'cable': 30.0,
  'cutters': ((7.0, 6.0, 0.25),),
  'guard_start': (7, 7),
  'guard_rail': ((7, 6), (7, 7)),
  'guard_target': 0},
 {'name': 'te01-8',
  'size': (10, 10),
  'dock': (1, 8),
  'core': (9, 8),
  'obstacles': ((2.3, 2.3, 3.3, 10.0), (5.3, 0.0, 5.7, 6.7), (7.7, 2.3, 8.1, 10.0)),
  'cable': 42.0,
  'cutters': ((7.0, 7.0, 0.25),),
  'guard_start': (7, 8),
  'guard_rail': ((7, 7), (7, 8)),
  'guard_target': 0}]
State = namedtuple("State", "rover path carrying done dead pulse feedback focus facing guard latched")


def cross(first, second, third):
    return ((second[0]-first[0])*(third[1]-first[1])
            -(second[1]-first[1])*(third[0]-first[0]))


def canonical(points):
    result = []
    for point in points:
        point = tuple(round(value, 9) for value in point)
        if not result or point != result[-1]:
            result.append(point)
    return tuple(result)


def cable_length(path):
    return sum(hypot(second[0]-first[0], second[1]-first[1])
               for first, second in zip(path, path[1:]))


def segment_clear(first, second, obstacles):
    """Clip against each open rectangle interior; boundary contact is allowed."""
    for left, top, right, bottom in obstacles:
        low_time, high_time = 0.0, 1.0
        for origin, delta, low, high in ((first[0], second[0]-first[0], left, right),
                                       (first[1], second[1]-first[1], top, bottom)):
            if abs(delta) < EPS:
                if not low+EPS < origin < high-EPS:
                    low_time, high_time = 1.0, 0.0
                    break
            else:
                entry, leave = sorted(((low+EPS-origin)/delta, (high-EPS-origin)/delta))
                low_time, high_time = max(low_time, entry), min(high_time, leave)
        if low_time < high_time-EPS:
            return False
    return True


def clip_triangle(polygon, triangle):
    """Convex polygon clipping; all accepted points stay inside the old bend."""
    orientation = 1 if cross(*triangle) > 0 else -1
    for first, second in zip(triangle, triangle[1:]+triangle[:1]):
        if not polygon:
            break
        clipped, previous = [], polygon[-1]
        old_side = orientation*cross(first, second, previous)
        for current in polygon:
            new_side = orientation*cross(first, second, current)
            if (old_side >= -EPS) != (new_side >= -EPS):
                fraction = old_side/(old_side-new_side)
                clipped.append((previous[0]+(current[0]-previous[0])*fraction,
                                previous[1]+(current[1]-previous[1])*fraction))
            if new_side >= -EPS:
                clipped.append(current)
            previous, old_side = current, new_side
        polygon = clipped
    return canonical(polygon)


def hull(points):
    ordered = sorted(set(points))
    if len(ordered) < 3:
        return tuple(ordered)
    chains = []
    for ordering in (ordered, list(reversed(ordered))):
        chain = []
        for point in ordering:
            while len(chain) > 1 and cross(chain[-2], chain[-1], point) <= EPS:
                chain.pop()
            chain.append(point)
        chains.append(chain[:-1])
    return tuple(chains[0]+chains[1])


def shorten_bend(first, middle, last, obstacles):
    if abs(cross(first, middle, last)) <= EPS:
        return canonical((first, last))
    triangle, points = (first, middle, last), [first, last]
    for left, top, right, bottom in obstacles:
        polygon = clip_triangle(((left, top), (right, top), (right, bottom), (left, bottom)), triangle)
        area = sum(a[0]*b[1]-a[1]*b[0] for a, b in zip(polygon, polygon[1:]+polygon[:1]))
        if abs(area) > EPS:
            points.extend(polygon)
    boundary = hull(points)
    if len(boundary) <= 2:
        return canonical((first, last))
    start, finish = boundary.index(first), boundary.index(last)
    choices = []
    for direction in (1, -1):
        chain, index = [first], start
        while index != finish:
            index = (index+direction) % len(boundary)
            chain.append(boundary[index])
        choices.append(tuple(chain))
    # The outer hull chain keeps the solids on the same side as the old bend.
    return max(choices, key=lambda chain: sum(abs(cross(first, last, point)) for point in chain))


@lru_cache(maxsize=50000)
def tighten(path, obstacles):
    path = canonical(path)
    while True:
        changed = False
        for index in range(1, len(path)-1):
            old = path[index-1:index+2]
            replacement = shorten_bend(*old, obstacles)
            if replacement == old:
                continue
            old_length, new_length = cable_length(old), cable_length(replacement)
            if new_length > old_length+1e-7:
                raise ValueError("Cable tightening increased the local path length")
            if new_length < old_length-EPS or len(replacement) < len(old):
                path = canonical(path[:index-1]+replacement+path[index+2:])
                changed = True
                break
        if not changed:
            return path


def closest_point(point, first, last):
    dx, dy = last[0]-first[0], last[1]-first[1]
    length_squared = dx*dx+dy*dy
    fraction = 0 if length_squared < EPS else max(0, min(1,
        ((point[0]-first[0])*dx+(point[1]-first[1])*dy)/length_squared))
    return first[0]+fraction*dx, first[1]+fraction*dy


def disc_segment(center, radius, first, last):
    point = closest_point(center, first, last)
    return hypot(center[0]-point[0], center[1]-point[1]) <= radius+EPS


def disc_triangle(center, radius, first, middle, last):
    area = cross(first, middle, last)
    if abs(area) > EPS:
        orientation = 1 if area > 0 else -1
        if all(orientation*cross(start, end, center) >= -EPS
               for start, end in ((first, middle), (middle, last), (last, first))):
            return True
    return any(disc_segment(center, radius, start, end)
               for start, end in ((first, middle), (middle, last), (last, first)))


def position_at(first, last, fraction):
    return (first[0]+(last[0]-first[0])*fraction,
            first[1]+(last[1]-first[1])*fraction)


@lru_cache(maxsize=40000)
def sweep_intervals(path, destination, obstacles):
    """Partition at exact changes of the taut cable's fixed final support.

    For rectangles, a support can change only when the moving endpoint aligns
    with two dock/corner supports. Extra collinearity events are harmless. Between
    events the stationary prefix and one endpoint triangle cover the full sweep,
    including reversal and paths whose full winding overlaps itself.
    """
    supports = {path[0]}
    for left, top, right, bottom in obstacles:
        supports.update(((left, top), (right, top), (right, bottom), (left, bottom)))
    times, start = {0., 1.}, path[-1]
    for first, last in combinations(sorted(supports), 2):
        before, after = cross(first, last, start), cross(first, last, destination)
        if abs(after-before) > EPS:
            time = -before/(after-before)
            if EPS < time < 1-EPS:
                times.add(round(time, 12))
    times, intervals = sorted(times), []
    for low, high in zip(times, times[1:]):
        middle = position_at(start, destination, (low+high)/2)
        taut = tighten(path+(middle,), obstacles)
        prefix = taut[:-1] if len(taut) > 1 else taut
        intervals.append((low, high, prefix))
    return tuple(intervals)


@lru_cache(maxsize=50000)
def cable_sweep_hit(path, destination, obstacles, cutters):
    """Return first (fraction, exact cable contact, cutter index), or None."""
    start = path[-1]
    for low, high, prefix in sweep_intervals(path, destination, obstacles):
        first, last = position_at(start, destination, low), position_at(start, destination, high)
        hits = []
        for number, (cx, cy, radius) in enumerate(cutters):
            center = (cx, cy)
            static_hit = any(disc_segment(center, radius, a, b) for a, b in zip(prefix, prefix[1:]))
            if not static_hit and not disc_triangle(center, radius, prefix[-1], first, last):
                continue
            earliest = low
            if not static_hit and not disc_segment(center, radius, prefix[-1], first):
                left, right = low, high
                for _ in range(36):
                    middle = (left+right)/2
                    point = position_at(start, destination, middle)
                    if disc_triangle(center, radius, prefix[-1], first, point):
                        right = middle
                    else:
                        left = middle
                earliest = right
            contact_path = prefix+(position_at(start, destination, earliest),)
            contact = min((closest_point(center, a, b) for a, b in zip(contact_path, contact_path[1:])),
                          key=lambda point: hypot(cx-point[0], cy-point[1]))
            hits.append((earliest, contact, number))
        if hits:
            return min(hits, key=lambda hit: (hit[0], hit[2]))
    return None


def initial(level):
    return State(level["dock"], (level["dock"],), False, False, False, 0,
                 "ready", level["dock"], (0, -1),level.get("guard_start"),False)


def body_blocker(level, state, destination):
    width, height = level["size"]
    if not (BODY_RADIUS <= destination[0] <= width-BODY_RADIUS
            and BODY_RADIUS <= destination[1] <= height-BODY_RADIUS):
        return destination
    for left, top, right, bottom in level["obstacles"]:
        expanded = ((left-BODY_RADIUS, top-BODY_RADIUS, right+BODY_RADIUS, bottom+BODY_RADIUS),)
        if not segment_clear(state.rover, destination, expanded):
            return (max(left, min(right, destination[0])), max(top, min(bottom, destination[1])))
    return None


def body_cutter_hit(level, start, destination):
    hits = []
    for number, (cx, cy, radius) in enumerate(level["cutters"]):
        if not disc_segment((cx, cy), radius+BODY_RADIUS, start, destination):
            continue
        low, high = 0., 1.
        for _ in range(36):
            middle = (low+high)/2
            if disc_segment((cx, cy), radius+BODY_RADIUS, start, position_at(start, destination, middle)):
                high = middle
            else:
                low = middle
        hits.append((high, (cx, cy), number))
    return min(hits, default=None)


def plan_step(level,state,direction):
    destination=(state.rover[0]+direction[0],state.rover[1]+direction[1])
    guard=state.guard
    if guard is not None and not state.latched and destination==guard:
        next_guard=(guard[0]+direction[0],guard[1]+direction[1])
        rail=level["guard_rail"]
        connected=any((guard==first and next_guard==last) or (guard==last and next_guard==first)
                      for first,last in zip(rail,rail[1:]))
        if not connected or body_blocker(level,state._replace(rover=guard),next_guard) is not None:
            return None,guard,"guard-stop"
        guard=next_guard
    blocker=body_blocker(level,state,destination)
    if blocker is not None:
        return None,blocker,"bumper"
    return destination,guard,None


def exposed_intervals(cutter,guard_start,guard_end):
    """Exact fractions during which a translating square hood exposes the disc."""
    if guard_start is None:
        return ((0.,1.),)
    margin=GUARD_HALF-cutter[2]
    if margin<0:
        return ((0.,1.),)
    low,high=0.,1.
    for dimension in (0,1):
        offset=guard_start[dimension]-cutter[dimension]
        delta=guard_end[dimension]-guard_start[dimension]
        if abs(delta)<EPS:
            if abs(offset)>margin+EPS:
                return ((0.,1.),)
        else:
            first,last=sorted(((-margin-offset)/delta,(margin-offset)/delta))
            low,high=max(low,first),min(high,last)
    if low>high+EPS:
        return ((0.,1.),)
    intervals=[]
    if low>EPS:intervals.append((0.,min(1.,low)))
    if high<1-EPS:intervals.append((max(0.,high),1.))
    return tuple(intervals)


def motion_contact(level,state,destination,guard_destination,body_only=False):
    """First actual exposed-blade contact; hood motion never grants early safety."""
    contacts=[]
    for number,cutter in enumerate(level["cutters"]):
        for low,high in exposed_intervals(cutter,state.guard,guard_destination):
            start=position_at(state.rover,destination,low)
            finish=position_at(state.rover,destination,high)
            one=dict(cutters=(cutter,))
            body=body_cutter_hit(one,start,finish)
            possibilities=[(body,"blade")]
            if not body_only:
                path=tighten(state.path+(start,),level["obstacles"])
                possibilities.append((cable_sweep_hit(path,finish,level["obstacles"],(cutter,)),"cut"))
            for contact,kind in possibilities:
                if contact is None:continue
                fraction=low+(high-low)*contact[0]
                # At the closing boundary the entire blade is already enclosed.
                if high<1-EPS and fraction>=high-EPS:continue
                contacts.append((fraction,contact[1],number,kind))
    return min(contacts,key=lambda item:(item[0],item[3],item[2]),default=None)


def move(level, state, direction):
    destination,guard,refusal=plan_step(level,state,direction)
    if refusal is not None:
        return state._replace(feedback=refusal,focus=guard,facing=direction)
    path = tighten(state.path+(destination,), level["obstacles"])
    if cable_length(path) > level["cable"]+EPS:
        return state._replace(feedback="taut", focus=path[-2] if len(path)>1 else state.rover, facing=direction)
    contact=motion_contact(level,state,destination,guard)
    if contact is not None:
        fraction,focus,number,kind=contact
        stopped = position_at(state.rover, destination, fraction)
        path = tighten(state.path+(stopped,), level["obstacles"])
        stopped_guard=position_at(state.guard,guard,fraction) if guard is not None else None
        return state._replace(rover=stopped,path=path,guard=stopped_guard,dead=True,feedback=kind,focus=focus,facing=direction)
    latched=state.latched or (guard is not None and not exposed_intervals(
        level["cutters"][level["guard_target"]],guard,guard))
    feedback="latch" if latched and not state.latched else "push" if guard!=state.guard else "move"
    return state._replace(rover=destination,path=path,guard=guard,latched=latched,feedback=feedback,focus=destination,
                          facing=direction, done=state.carrying and destination == level["dock"])


def reel_direction(level, state):
    if len(state.path) < 2:
        return None
    target, length = state.path[-2], cable_length(state.path)
    choices = []
    for action, direction in DIRECTIONS.items():
        toward = ((target[0]-state.rover[0])*direction[0]+(target[1]-state.rover[1])*direction[1])
        destination,guard,refusal=plan_step(level,state,direction)
        if toward <= EPS or refusal is not None:
            continue
        path = tighten(state.path+(destination,), level["obstacles"])
        if cable_length(path) < length-EPS:
            choices.append((cable_length(path), action, direction))
    if choices:
        return min(choices, key=lambda option: (option[0], option[1]))[2]
    return None


def reel(level, state):
    direction = reel_direction(level, state)
    if direction is not None:
        selected = move(level, state, direction)
        return selected if selected.dead else selected._replace(feedback="reel")
    target = state.path[-2] if len(state.path)>1 else level["dock"]
    return state._replace(feedback="reel-stop", focus=target)


def transition(level, state, action, point=None):
    if state.done or state.dead:
        return state
    state = state._replace(pulse=1-state.pulse)
    if action in DIRECTIONS:
        return move(level, state, DIRECTIONS[action])
    if action == 5:
        return reel(level, state)
    if action == 6:
        core = level["core"]
        if point is None or hypot(point[0]-core[0], point[1]-core[1]) > .7:
            return state._replace(feedback="miss", focus=state.rover if point is None else point)
        if state.carrying:
            return state._replace(feedback="loaded", focus=state.rover)
        if (hypot(state.rover[0]-core[0], state.rover[1]-core[1]) > 1.05
                or not segment_clear(state.rover, core, level["obstacles"])):
            return state._replace(feedback="far", focus=core)
        return state._replace(carrying=True, feedback="pickup", focus=state.rover)
    return state._replace(feedback="refused", focus=state.rover)


def pixel(point):
    return OX+CELL*point[0], OY+CELL*point[1]


def rect(frame, left, top, width, height, color):
    x1, y1 = max(0, round(left)), max(0, round(top))
    x2, y2 = min(64, round(left+width)), min(64, round(top+height))
    if x1 < x2 and y1 < y2:
        frame[y1:y2, x1:x2] = color


def line(frame, first, second, color):
    count = max(1, round(hypot(second[0]-first[0], second[1]-first[1])*2))
    for fraction in np.linspace(0, 1, count+1):
        point = position_at(first, second, fraction)
        rect(frame, *point, 1, 1, color)


def disc(frame, center, radius, color):
    for dy in range(-int(radius)-1, int(radius)+2):
        for dx in range(-int(radius)-1, int(radius)+2):
            if hypot(dx, dy) <= radius:
                rect(frame, center[0]+dx, center[1]+dy, 1, 1, color)


def rover_art(facing, carrying, dead):
    art = np.array(pixel_art((
        '..WWW..',
        'KGGWG GK'.replace(' ', ''),
        'KGWWGGK',
        '.GWWGG.',
        'KGGGGGK',
        'KGGGGGK',
        '..KOK..',
    ), {'.': -1, 'W': WHITE, 'G': GREEN, 'K': BLACK, 'O': ORANGE}), dtype=np.int8)
    if carrying:
        art[4:6, 2:5] = BLUE
        art[4, 3] = SKY
    if dead:
        art[art == GREEN] = RED
        art[art == WHITE] = SILVER
    turns = {(0, -1): 0, (1, 0): -1, (0, 1): 2, (-1, 0): 1}[facing]
    return np.rot90(art, turns).copy()


def core_art():
    return pixel_art((
        '...W...',
        '..BSB..',
        '.BBSSB.',
        '.BSSSB.',
        '.BSSBB.',
        '..BBB..',
        '...B...',
    ), {'.': -1, 'W': WHITE, 'B': BLUE, 'S': SKY})


def dock_art(done=False):
    return pixel_art((
        '.WW...WW.',
        'WBK...KBW',
        'WBK...KBW',
        'WBK...KBW',
        'WBK...KBW',
        'WBKKKKKBW',
        '.BBBBBBB.',
        '..BBGBB..',
        '...BBB...',
    ), {'.': -1, 'W': WHITE, 'B': BLUE, 'K': BLACK, 'G': GREEN if done else SKY})


def hood_art(latched=False):
    return pixel_art((
        '.WWWWW.',
        'WSSSSSW',
        'KSKSKSK',
        'KSKSKSK',
        'KSSSSSK',
        'KGGGGGK' if latched else 'KOOOOOK',
        '.K...K.',
    ), {'.': -1, 'W': WHITE, 'S': SILVER, 'K': BLACK, 'O': ORANGE, 'G': GREEN})


def blade_art(radius):
    size = max(5, 2 * round(radius * CELL) + 3)
    if size % 2 == 0:
        size += 1
    mid = size // 2
    art = np.full((size, size), -1, dtype=np.int8)
    for y in range(size):
        for x in range(size):
            distance = hypot(x - mid, y - mid)
            if distance <= mid:
                art[y, x] = WHITE if distance > mid - 1 else RED
    art[mid, mid] = BLACK
    return art


class Te01(ARCBaseGame):
    def __init__(self):
        self.lvl, self.st = LEVELS[0], initial(LEVELS[0])
        self.animation, self.history, self.objects = None, [], {}
        levels = [Level(sprites=[], grid_size=(64, 64), data={}, name=level['name']) for level in LEVELS]
        super().__init__('te01', levels, Camera(0, 0, 64, 64, BLACK, BLACK),
                         False, len(levels), [1, 2, 3, 4, 5, 6, 7])

    def put(self, name, pixels, x, y, layer, tags=()):
        art = np.asarray(pixels, dtype=np.int8)
        sprite = self.objects.get(name)
        if sprite is None:
            sprite = Sprite(art, name=name, x=round(x), y=round(y), layer=layer,
                            collidable=False, tags=list(tags))
            self.objects[name] = sprite
            self.current_level.add_sprite(sprite)
        else:
            sprite.pixels = art
            sprite.set_position(round(x), round(y))
        return sprite

    def centered(self, name, pixels, point, layer, tags=()):
        art = np.asarray(pixels, dtype=np.int8)
        x, y = pixel(point)
        return self.put(name, art, x - art.shape[1] // 2, y - art.shape[0] // 2, layer, tags)

    def on_set_level(self, level):
        self.lvl = LEVELS[self.level_index]
        self.st, self.animation, self.history, self.objects = initial(self.lvl), None, [], {}
        level.remove_all_sprites()
        width, height = self.lvl['size']
        self.put('workshop-floor', [[BLACK] * (width * CELL + 2)] * (height * CELL + 2),
                 OX - 1, OY - 1, -10, ('terrain',))
        # These marks are workshop seams, deliberately fainter than the live orange cable.
        seams = np.full((64, 64), -1, dtype=np.int8)
        for row in range(1, height):
            for column in range(1, width):
                x, y = pixel((column, row))
                rect(seams, x, y, 1, 1, DARK)
        self.put('floor-seams', seams, 0, 0, -9, ('scenery',))
        for number, (left, top, right, bottom) in enumerate(self.lvl['obstacles']):
            x, y = pixel((left, top))
            w, h = max(2, round((right - left) * CELL)), max(2, round((bottom - top) * CELL))
            art = np.full((h, w), 15, dtype=np.int8)
            art[0, :] = SKY
            art[-1, :] = DARK
            art[:, 0] = WHITE
            art[:, -1] = DARK
            if h > 5 and w > 4:
                for row in range(3, h - 1, 4):
                    art[row, 1:-1] = BLACK
            self.put(f'post-{number}', art, x, y, 1, ('post', 'solid'))
        if self.st.guard is not None:
            rail = np.full((64, 64), -1, dtype=np.int8)
            points = list(map(pixel, self.lvl['guard_rail']))
            for first, last in zip(points, points[1:]):
                for offset in (-3, 3):
                    dx, dy = (0, offset) if first[1] == last[1] else (offset, 0)
                    line(rail, (first[0] + dx, first[1] + dy), (last[0] + dx, last[1] + dy), ORANGE)
            self.put('cover-rail', rail, 0, 0, 2, ('rail',))
        for number, (cx, cy, radius) in enumerate(self.lvl['cutters']):
            self.centered(f'blade-{number}', blade_art(radius), (cx, cy), 3, ('blade', 'hazard'))
        self.sync()

    def sync(self):
        state, level = self.st, self.lvl
        animation = self.animation
        before = animation['before'] if animation else state
        fraction = min(1., animation['index'] / 3) if animation else 1.
        rover = position_at(before.rover, state.rover, fraction)
        guard = position_at(before.guard, state.guard, fraction) if state.guard is not None else None
        path = tighten(before.path + (rover,), level['obstacles']) if animation else state.path
        self.centered('dock', dock_art(state.done), level['dock'], 4, ('dock', 'goal'))
        # The cable is one named flexible object. Its transparent pixel mask comes from the
        # same exact path the movement rules use, rather than a second drawing approximation.
        wire = np.full((64, 64), -1, dtype=np.int8)
        for first, second in zip(path, path[1:]):
            line(wire, pixel(first), pixel(second), ORANGE)
        self.put('cable', wire, 0, 0, 5, ('cable',))
        dock_x, dock_y = pixel(level['dock'])
        spool_position = (dock_x, dock_y + 8) if dock_x < 12 else (dock_x - 8, dock_y)
        spool = np.full((9, 9), -1, dtype=np.int8)
        disc(spool, (4, 4), 4, DARK)
        disc(spool, (4, 4), 3, GRAY)
        remaining = max(0, level['cable'] - cable_length(path)) / level['cable']
        for n in range(round(32 * remaining)):
            angle, radius = (n % 16) * pi / 8, 3 if n < 16 else 1.6
            rect(spool, 4 + radius * cos(angle), 4 + radius * sin(angle), 1, 1, ORANGE)
        spool[4, 4] = WHITE
        self.put('cable-spool', spool, spool_position[0] - 4, spool_position[1] - 4, 6, ('cable-budget',))
        if guard is not None:
            self.centered('rolling-cover', hood_art(state.latched and fraction >= 1), guard, 7, ('cover',))
        pickup = animation is not None and state.feedback == 'pickup'
        core_position = position_at(level['core'], rover, fraction) if pickup else level['core']
        core_sprite = self.centered('core', core_art(), core_position, 8, ('core', 'sys_click'))
        core_sprite.set_visible(not state.carrying or pickup)
        self.centered('rover', rover_art(state.facing, state.carrying and not pickup, state.dead), rover, 9, ('player',))
        cue = np.full((9, 9), -1, dtype=np.int8)
        if state.dead:
            for dx, dy in ((-3, 0), (3, 0), (0, -3), (0, 3)):
                cue[4 + dy, 4 + dx] = RED
        elif state.feedback not in ('ready', 'move', 'reel', 'pickup', 'push', 'latch'):
            radius = 2 + state.pulse
            colour = YELLOW if state.feedback == 'undo' else RED
            cue[4 - radius, 4 - radius:5 + radius] = colour
            cue[4 + radius, 4 - radius:5 + radius] = colour
        self.centered('contact-feedback', cue, state.focus, 10, ('feedback',))

    def handle_reset(self):
        if self._state in (GameState.NOT_PLAYED, GameState.WIN):
            self.full_reset()
        else:
            self.level_reset()

    def finish_action(self):
        self.animation = None
        self.sync()
        if self.st.dead:
            self.lose()
        elif self.st.done:
            self.next_level()
        self.complete_action()

    def step(self):
        if self.action.id.value == 0:
            self.sync()
            self.complete_action()
            return
        if self.animation is not None:
            self.animation['index'] += 1
            if self.animation['index'] >= 3:
                self.finish_action()
            else:
                self.sync()
            return
        before, action = self.st, self.action.id.value
        if action == 7:
            if self.history:
                self.st = self.history.pop()._replace(feedback='undo', pulse=1 - before.pulse)
                self.st = self.st._replace(focus=self.st.rover)
            else:
                self.st = before._replace(feedback='undo-empty', focus=before.rover, pulse=1 - before.pulse)
        else:
            point = None
            if action == 6:
                data = self.action.data or {}
                x, y = data.get('x'), data.get('y')
                if all(isinstance(value, (int, float)) and isfinite(value) for value in (x, y)) and 0 <= x < 64 and 0 <= y < 64:
                    point = ((x - OX) / CELL, (y - OY) / CELL)
            self.history.append(before)
            self.st = transition(self.lvl, before, action, point)
        if self.st.rover != before.rover or self.st.feedback == 'pickup':
            self.animation = {'before': before, 'index': 1}
            self.sync()
            return
        self.finish_action()

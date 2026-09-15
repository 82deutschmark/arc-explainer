# ARC-AGI-3 candidate task g171.

from collections import deque

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    RenderableUserDisplay,
    Sprite,
)


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def outline(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for x in range(max(0, x0), min(w, x1)):
        if 0 <= y0 < h:
            frame[y0, x] = colour
        if 0 <= y1 - 1 < h:
            frame[y1 - 1, x] = colour
    for y in range(max(0, y0), min(h, y1)):
        if 0 <= x0 < w:
            frame[y, x0] = colour
        if 0 <= x1 - 1 < w:
            frame[y, x1 - 1] = colour
    return frame

def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0


WALL = 1
FLOOR = 4
WATER = 10
SOURCE = WATER
BASIN = 12
DAM = 15
CURSOR = 8
GAUGE_ON = WATER
GAUGE_OFF = FLOOR

GAUGE_X = 2
GAUGE_FOOT = (16 - 2) * 4 + 2
GAUGE_PITCH = 2
DAM_TOP = 18
DAM_GAP = 12
DAM_RISE = 2
SPLASH_FRAMES = 2
SETTLE_FRAMES = 6

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"tank": 13, "dams": 1, "rows": [
        "################",
        "######S#########",
        "######.#########",
        "#..............#",
        "#.....########.#",
        "#.....########.#",
        "#.....########B#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 27, "dams": 2, "rows": [
        "################",
        "#S##############",
        "#.##############",
        "#..............#",
        "###.###.###.##.#",
        "##...#...#...#.#",
        "##...#...#...#B#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 17, "dams": 2, "rows": [
        "################",
        "#######S########",
        "#######.########",
        "#B............B#",
        "####.#####.#####",
        "###...###...####",
        "###...###...####",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 20, "dams": 2, "rows": [
        "################",
        "#S##############",
        "#.##############",
        "#..............#",
        "###.#####.####.#",
        "##...###...###.#",
        "##...###...###B#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 10, "dams": 2, "rows": [
        "################",
        "#######S########",
        "#######.########",
        "#..............#",
        "#.....#.#......#",
        "#.....#.#......#",
        "#.....#.#......#",
        "#######.########",
        "#######.########",
        "#######B########",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 15, "dams": 3, "rows": [
        "################",
        "#######S########",
        "#######.########",
        "#B............B#",
        "###.###.###.####",
        "##...#...#...###",
        "##...#...#...###",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4


def find_char(rows, ch):
    for y, row in enumerate(rows):
        x = row.find(ch)
        if x >= 0:
            return x, y
    return None


def find_all(rows, ch):
    return frozenset((x, y) for y, row in enumerate(rows)
                     for x, c in enumerate(row) if c == ch)


def open_cell(rows, dams, x, y):
    return (0 <= x < N and 0 <= y < N
            and rows[y][x] != "#" and (x, y) not in dams)


def flood_from(rows, dams, tank):
    src = find_char(rows, "S")
    flooded = {src}
    while True:
        ring = set()
        for (x, y) in flooded:
            for dx, dy in DIRS:
                n = (x + dx, y + dy)
                if n not in flooded and open_cell(rows, dams, *n):
                    ring.add(n)
        if not ring or len(ring) > tank:
            return flooded, tank
        flooded |= ring
        tank -= len(ring)


def wins(rows, dams, tank):
    flooded, _ = flood_from(rows, dams, tank)
    return find_all(rows, "B") <= flooded


def placeable(rows):
    return [(x, y) for y in range(N) for x in range(N)
            if rows[y][x] == "."]


def pixel_distances(cells, source):
    allowed={(x*CELL+i,y*CELL+j) for x,y in cells for i in range(CELL) for j in range(CELL)}
    seeds={(source[0]*CELL+i,source[1]*CELL+j) for i in range(CELL) for j in range(CELL)}
    dist={p:0 for p in seeds if p in allowed}
    queue=deque(dist)
    while queue:
        x,y=queue.popleft()
        for dx,dy in DIRS:
            n=(x+dx,y+dy)
            if n in allowed and n not in dist:
                dist[n]=dist[(x,y)]+1
                queue.append(n)
    return dist

def mixture(spec, dams):
    amounts=[0,0]
    for channel in spec['channels']:
        if tuple(channel['valve']) not in dams:
            amounts[channel['water']]+=channel['volume']
    return tuple(amounts)

def make_mixer(volumes, targets, initial, allowance):
    rows=[list('#'*N) for _ in range(N)]
    channels=[]
    for water,side in enumerate(volumes):
        for i,volume in enumerate(side):
            y=2+3*i
            start=1 if water==0 else 14
            collector=7 if water==0 else 8
            step=1 if water==0 else -1
            path=[(x,y) for x in range(start,collector+step,step)]
            path += [(collector,yy) for yy in range(y+1,11)]
            valve=(4 if water==0 else 11,y)
            for x,yy in path:rows[yy][x]='.'
            rows[y][start]='A' if water==0 else 'R'
            channels.append(dict(water=water,volume=volume,path=path,valve=valve))
    rows[10][7]=rows[10][8]='B'
    rows[12][1]='S'
    return dict(rows=[''.join(r) for r in rows],tank=sum(sum(v) for v in volumes),dams=allowance,
                channels=channels,targets=targets,initial=[channels[i]['valve'] for i in initial])

LEVELS_SPEC.extend([
    make_mixer(((1,1),(1,1)), ((1,1),), (0,1), 2),
    make_mixer(((1,2,3),(1,2,3)), ((3,2),), (0,1,2), 3),
    make_mixer(((1,2),(1,2)), ((2,1),(1,2)), (0,1), 2),
])

def build_levels():
    return [Level(sprites=[],grid_size=(64,64)) for _ in LEVELS_SPEC]

class Overlay(RenderableUserDisplay):
    def __init__(self, game):
        super().__init__()
        self.game=game

    def render_interface(self, frame):
        g=self.game
        frame[:]=5
        for y,row in enumerate(g.rows[:12]):
            for x,c in enumerate(row):
                ox,oy=x*CELL,y*CELL
                if c=='#':
                    frame[oy:oy+CELL,ox:ox+CELL]=3
                    if y and g.rows[y-1][x]!='#':frame[oy,ox:ox+CELL]=1
                    if x and row[x-1]!='#':frame[oy:oy+CELL,ox]=1
                else:
                    frame[oy:oy+CELL,ox:ox+CELL]=4
                if c=='B':
                    frame[oy:oy+CELL,ox:ox+CELL]=12
                    frame[oy+1:oy+3,ox+1:ox+3]=5
                elif c in 'SAR':
                    colour=10 if c!='R' else 6
                    frame[oy:oy+CELL,ox:ox+CELL]=colour
                    frame[oy+1,ox+1]=0
        for (x,y),distance in g.pixels.items():
            if distance<=g.flow_time and y<48:
                frame[y,x]=10 if (x+y+g.flow_time)%7 else 0
        if g.mixing:
            for i,channel in enumerate(g.spec['channels']):
                colour=10 if channel['water']==0 else 6
                sx,sy=channel['path'][0]
                for k in range(channel['volume']):
                    frame[sy*CELL+1+k,sx*CELL+1:sx*CELL+3]=0
                vx,vy=channel['valve']
                frame[vy*CELL,vx*CELL:vx*CELL+CELL]=1
                frame[vy*CELL+3,vx*CELL:vx*CELL+CELL]=1
                if g.pouring and tuple(channel['valve']) not in g.dams:
                    for j,(x,y) in enumerate(channel['path']):
                        for k in range(CELL):
                            if j*CELL+k<=g.flow_time:
                                frame[y*CELL+1:y*CELL+3,x*CELL+k]=colour
                                if channel['water']==1 and (j*CELL+k)%2==0:
                                    frame[y*CELL+1,x*CELL+k]=0
                if g.pouring and tuple(channel['valve']) in g.dams:
                    for x,y in channel['path']:
                        if (x,y)==tuple(channel['valve']):break
                        frame[y*CELL+1:y*CELL+3,x*CELL+1:x*CELL+3]=colour
            frame[48:52,4:8]=10
            frame[49:51,5:7]=0
            for water,target in enumerate(g.spec['targets'][g.stage]):
                colour=10 if water==0 else 6
                ox=13+water*24
                frame[51:63,ox:ox+20]=1
                frame[52:62,ox+1:ox+19]=5
                arrived=g.arrived[water]
                for k in range(target):
                    x=ox+2+k*3
                    frame[52:62,x:x+2]=colour if k<arrived else 3
                    frame[52+(k%2):62:3,x]=colour
                if arrived>target:frame[51,ox:ox+20]=8
            for stage in range(len(g.spec['targets'])):
                frame[59:62,4+stage*3:6+stage*3]=14 if stage<g.stage else 1
        else:
            frame[53:62,7:57]=1
            frame[54:61,8:56]=5
            length=round(46*g.units/max(1,g.spec['tank']))
            frame[55:60,9:9+length]=10
            for k in range(0,46,4):frame[59:61,9+k]=0
        for x,y in g.dams:
            frame[y*CELL:y*CELL+CELL,x*CELL:x*CELL+CELL]=15
            frame[y*CELL+1:y*CELL+3,x*CELL+1:x*CELL+3]=1
        for i in range(g.spec['dams']):
            frame[48:51,48+i*4:51+i*4]=15 if i<g.spec['dams']-len(g.dams) else 3
        if not g.pouring:
            cx,cy=g.cursor
            frame[cy*CELL,cx*CELL]=8
            frame[cy*CELL+3,cx*CELL+3]=8
        frame[0,:]=frame[:,0]=frame[:,-1]=1
        if g.settle and g.settle%2:
            frame[47,:]=14 if g.ok else 8
        return frame

class Ration(ARCBaseGame):
    def __init__(self):
        self.dams=set()
        self.flooded=set()
        self.front=set()
        self.pouring=False
        self.cursor=(0,0)
        self.units=0
        self.splash=0
        self.settle=0
        self.ok=False
        self.pixels={}
        self.flow_time=0
        self.arrived=(0,0)
        self.stage=0
        self._remaining=0
        self._final=set()
        camera=Camera(width=64,height=64,background=5,letter_box=5,interfaces=[Overlay(self)])
        super().__init__(game_id='g171',levels=build_levels(),camera=camera,available_actions=[1,2,3,4,5,6])
        self.on_set_level(self.current_level)

    @property
    def spec(self):return LEVELS_SPEC[self.level_index]
    @property
    def rows(self):return self.spec['rows']
    @property
    def mixing(self):return 'channels' in self.spec

    def on_set_level(self, level):
        self.dams={tuple(c) for c in self.spec.get('initial',())}
        self.flooded=set()
        self.front=set()
        self.pouring=False
        self.cursor=find_char(self.rows,'S')
        self.units=self.spec['tank']
        self.splash=self.settle=0
        self.ok=False
        self.pixels={}
        self.flow_time=0
        self.arrived=(0,0)
        self.stage=0
        self._remaining=self.units
        self._final=set()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)
    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def _pour(self):
        self.pouring=True
        self.flow_time=0
        self.arrived=(0,0)
        if not self.mixing:
            self._final,self._remaining=flood_from(self.rows,self.dams,self.spec['tank'])
            self.pixels=pixel_distances(self._final,find_char(self.rows,'S'))
            self.flooded={find_char(self.rows,'S')}

    def _toggle(self, cell):
        legal={tuple(c['valve']) for c in self.spec['channels']} if self.mixing else set(placeable(self.rows))
        if cell in self.dams:self.dams.remove(cell)
        elif cell in legal and len(self.dams)<self.spec['dams']:self.dams.add(cell)

    def step(self):
        if self.settle:
            self.settle-=1
            if self.settle:return
            if self.ok and self.mixing and self.stage+1<len(self.spec['targets']):
                self.stage+=1
                self.pouring=False
                self.flow_time=0
                self.arrived=(0,0)
                self.complete_action()
            else:
                if self.ok:self.next_level()
                else:self.level_reset()
                self.complete_action()
            return
        if self.pouring:
            self.flow_time+=2
            if self.mixing:
                arrived=[0,0]
                end=max(len(c['path'])*CELL for c in self.spec['channels'])
                for c in self.spec['channels']:
                    if tuple(c['valve']) not in self.dams and self.flow_time>=len(c['path'])*CELL:
                        arrived[c['water']]+=c['volume']
                self.arrived=tuple(arrived)
                if self.flow_time<end:return
                self.ok=self.arrived==tuple(self.spec['targets'][self.stage])
            else:
                self.flooded={c for c in self._final if all(self.pixels.get((c[0]*CELL+i,c[1]*CELL+j),10**9)<=self.flow_time for i in range(CELL) for j in range(CELL))}
                self.units=max(self._remaining,self.spec['tank']-len(self.flooded)+1)
                if self.flow_time<max(self.pixels.values(),default=0):return
                self.units=self._remaining
                self.ok=find_all(self.rows,'B')<=self.flooded
            self.settle=SETTLE_FRAMES
            return
        move={GameAction.ACTION1:(0,-1),GameAction.ACTION2:(0,1),GameAction.ACTION3:(-1,0),GameAction.ACTION4:(1,0)}.get(self.action.id)
        if move is not None:
            nx,ny=self.cursor[0]+move[0],self.cursor[1]+move[1]
            if 0<=nx<N and 0<=ny<N and self.rows[ny][nx]!='#':self.cursor=(nx,ny)
        elif self.action.id in (GameAction.ACTION5,GameAction.ACTION6):
            cell=self.cursor
            if self.action.id==GameAction.ACTION6:
                x,y=self.action.data.get('x',-1),self.action.data.get('y',-1)
                if not (0<=x<64 and 0<=y<64):
                    self.complete_action()
                    return
                cell=(x//CELL,y//CELL)
                self.cursor=cell
            if cell==find_char(self.rows,'S'):
                self._pour()
                return
            self._toggle(cell)
        self.complete_action()

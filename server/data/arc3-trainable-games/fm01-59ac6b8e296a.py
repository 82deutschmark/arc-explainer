# Author: GPT-6 Astra
# Date: 2026-10-21 02:15
# PURPOSE: Fitting Room material-conserving tailoring: straight cuts create two
# reusable cloth panels, rotations and placements cover two visible garments.
# SRP/DRY check: Pass — one geometry/transition implementation serves all callers.
from collections import namedtuple
from functools import lru_cache
from math import isfinite
import numpy as np
from arcengine import ARCBaseGame,Camera,GameState,Level,RenderableUserDisplay

State=namedtuple('State','shapes placements dyes selected done')


def normalize(shape):
    left=min(x for x,y in shape);top=min(y for x,y in shape)
    return tuple(sorted((x-left,y-top) for x,y in shape))


@lru_cache(maxsize=2048)
def rotate(shape):return normalize([(-y,x) for x,y in shape])


def connected(shape):
    remaining=set(shape);pending=[remaining.pop()]
    while pending:
        x,y=pending.pop()
        for neighbor in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if neighbor in remaining:remaining.remove(neighbor);pending.append(neighbor)
    return not remaining


@lru_cache(maxsize=2048)
def cut(shape,axis,line):
    first=tuple(cell for cell in shape if cell[axis]<line)
    second=tuple(cell for cell in shape if cell[axis]>=line)
    if not first or not second or not connected(first) or not connected(second):return None
    return normalize(first),normalize(second)


def initial(spec):
    shapes=tuple(normalize(shape) for shape in spec['panels'])
    return State(shapes,(None,)*len(shapes),tuple(range(len(shapes))),-1,False)


def occupied(shape,place):
    return occupied_cells(shape,place[1],place[2])


@lru_cache(maxsize=4096)
def occupied_cells(shape,left,top):
    return frozenset((x+left,y+top) for x,y in shape)


@lru_cache(maxsize=64)
def garment_cells(cells):return frozenset(cells)


def target_cells(spec,target):
    cells=spec['targets'][target]
    if not isinstance(cells,tuple) or not isinstance(cells[0],tuple):cells=tuple(map(tuple,cells))
    return garment_cells(cells)


def anchor(state):
    return shape_anchor(state.shapes[state.selected]) if state.selected>=0 else (0,0)


@lru_cache(maxsize=2048)
def shape_anchor(shape):return min(shape,key=lambda cell:(cell[1],cell[0]))


def rack(state):
    return loose_pieces(state.placements)


@lru_cache(maxsize=4096)
def loose_pieces(placements):return tuple(piece for piece,place in enumerate(placements) if place is None)


def transition(spec,state,operation):
    if state.done:return state
    kind,value=operation
    shapes,places,selected=list(state.shapes),list(state.placements),state.selected
    dyes=list(state.dyes)
    if kind=='select' and 0<=value<len(shapes):
        if places[value] is None or len(rack(state))<6:
            selected=-1 if selected==value else value;places[value]=None
    elif kind=='turn' and selected>=0:
        shapes[selected]=rotate(shapes[selected]);places[selected]=None
    elif kind=='cut' and selected>=0 and places[selected] is None and len(rack(state))<6:
        pieces=cut(shapes[selected],*value)
        if pieces:
            shapes[selected]=pieces[0];shapes.append(pieces[1]);places.append(None)
            dyes.append(dyes[selected])
    elif kind=='place' and selected>=0:
        target,left,top=value
        cells=occupied(shapes[selected],value)
        taken=set().union(*(occupied(shape,place) for index,(shape,place) in enumerate(zip(shapes,places))
                           if index!=selected and place is not None and place[0]==target))
        if cells<=target_cells(spec,target) and not cells&taken:
            places[selected]=tuple(value);selected=-1
    done=all(place is not None for place in places)
    if done:
        done=all(set().union(*(occupied(shape,place) for shape,place in zip(shapes,places)
                              if place[0]==target))==target_cells(spec,target)
                 for target,cells in enumerate(spec['targets']))
    return State(tuple(shapes),tuple(places),tuple(dyes),selected,done)


LEVELS=[{'name': 'Cut for both outfits', 'panels': [((0, 0), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2), (3, 0), (4, 0), (4, 1)), ((0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2)), ((0, 0), (0, 1), (0, 2), (0, 3), (1, 0), (1, 1))], 'targets': [((1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (1, 3), (2, 3)), ((0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (3, 2), (0, 3), (3, 3))], 'witness': [('select', 0), ('cut', (0, 4)), ('select', 1), ('cut', (1, 1)), ('place', (0, 1, 0)), ('select', 0), ('place', (0, 0, 1)), ('select', 2), ('place', (1, 0, 0)), ('select', 3), ('place', (1, 3, 2)), ('select', 4), ('place', (1, 2, 0))]}, {'name': 'Turn the borrowed offcut', 'panels': [((0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (1, 0), (1, 2), (1, 3), (2, 2), (2, 3)), ((0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2)), ((0, 0), (0, 1), (1, 0), (1, 1), (2, 1), (3, 1))], 'targets': [((1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (1, 3), (2, 3)), ((0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (3, 2), (0, 3), (3, 3))], 'witness': [('select', 0), ('turn', 0), ('cut', (0, 4)), ('select', 1), ('cut', (1, 1)), ('place', (0, 1, 0)), ('select', 0), ('place', (0, 0, 1)), ('select', 2), ('turn', 0), ('place', (1, 0, 0)), ('select', 3), ('place', (1, 3, 2)), ('select', 4), ('place', (1, 2, 0))]}, {'name': 'Tailor both outfits', 'panels': [((0, 1), (0, 2), (0, 3), (1, 0), (1, 1), (1, 2), (1, 3), (2, 0), (2, 1), (2, 2), (2, 3), (3, 2), (3, 3)), ((0, 1), (0, 2), (0, 3), (0, 4), (1, 2), (1, 3), (2, 2), (2, 3), (3, 0), (3, 1), (3, 2)), ((0, 0), (0, 1))], 'targets': (((1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (1, 3), (2, 3)), ((1, 0), (2, 0), (3, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (0, 3), (1, 3), (2, 3), (3, 3), (4, 3))), 'witness': [('select', 0), ('cut', (1, 1)), ('select', 1), ('turn', 0), ('cut', (1, 3)), ('place', (0, 0, 1)), ('select', 0), ('place', (0, 1, 0)), ('select', 2), ('place', (1, 0, 2)), ('select', 3), ('place', (1, 1, 1)), ('select', 4), ('place', (1, 1, 0))]}, {'name': 'Tailor both outfits', 'panels': [((0, 1), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2), (2, 3), (3, 0), (3, 1), (3, 2), (3, 3), (4, 1), (4, 3)), ((0, 2), (0, 3), (0, 4), (1, 1), (1, 2), (2, 1), (2, 2), (3, 0), (3, 1), (3, 2)), ((0, 2), (0, 3), (1, 0), (1, 1), (1, 2), (1, 3))], 'targets': (((1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 2), (2, 2), (3, 2), (1, 3), (2, 3), (3, 3)), ((1, 0), (2, 0), (3, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (0, 3), (1, 3), (2, 3), (3, 3), (4, 3))), 'witness': [('select', 0), ('cut', (1, 3)), ('select', 1), ('turn', 0), ('cut', (1, 1)), ('place', (0, 1, 3)), ('select', 0), ('place', (0, 0, 0)), ('select', 2), ('place', (1, 0, 0)), ('select', 3), ('place', (1, 2, 3)), ('select', 4), ('place', (1, 2, 0))]}, {'name': 'Tailor both outfits', 'panels': [((0, 1), (1, 0), (1, 1), (2, 1), (2, 2), (2, 3)), ((0, 4), (1, 1), (1, 4), (2, 0), (2, 1), (2, 2), (2, 3), (2, 4), (3, 0), (3, 1), (3, 2), (3, 3)), ((0, 0), (1, 0), (2, 0), (3, 0))], 'targets': (((1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (1, 3), (2, 3)), ((0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (3, 2), (0, 3), (3, 3))), 'witness': [('select', 0), ('cut', (1, 1)), ('select', 1), ('cut', (1, 4)), ('place', (0, 0, 0)), ('select', 0), ('place', (0, 3, 1)), ('select', 2), ('turn', 0), ('place', (1, 0, 0)), ('select', 3), ('place', (1, 1, 1)), ('select', 4), ('place', (1, 1, 0))]}, {'name': 'Tailor both outfits', 'panels': [((0, 1), (0, 2), (0, 3), (0, 4), (1, 1), (1, 2), (1, 3), (1, 4), (2, 2), (3, 0), (3, 1), (3, 2), (3, 3), (4, 0), (4, 1)), ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1), (3, 1)), ((0, 0), (0, 1), (1, 0), (1, 1), (1, 2))], 'targets': (((1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 2), (2, 2), (3, 2), (1, 3), (2, 3), (3, 3)), ((0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (3, 2), (0, 3), (3, 3))), 'witness': [('select', 0), ('cut', (0, 3)), ('select', 1), ('turn', 0), ('cut', (0, 2)), ('place', (0, 0, 0)), ('select', 0), ('place', (0, 2, 0)), ('select', 2), ('place', (1, 2, 0)), ('select', 3), ('place', (1, 0, 0)), ('select', 4), ('place', (1, 3, 3))]}, {'name': 'Tailor both outfits', 'panels': [((0, 1), (1, 0), (1, 1), (1, 2), (1, 3), (2, 3), (3, 3), (4, 3)), ((0, 1), (1, 0), (1, 1), (2, 1), (3, 1), (4, 0), (4, 1), (4, 2)), ((0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1), (3, 0), (3, 1), (4, 0), (4, 1))], 'targets': (((1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (1, 3), (2, 3)), ((1, 0), (2, 0), (3, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (0, 3), (1, 3), (2, 3), (3, 3), (4, 3))), 'witness': [('select', 0), ('cut', (0, 2)), ('select', 1), ('turn', 0), ('cut', (1, 4)), ('place', (0, 2, 0)), ('select', 0), ('place', (0, 0, 0)), ('select', 2), ('place', (1, 0, 2)), ('select', 3), ('place', (1, 1, 1)), ('select', 4), ('place', (1, 1, 0))]}, {'name': 'Tailor both outfits', 'panels': [((0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 1), (2, 2), (3, 1), (3, 2), (4, 1), (4, 2), (4, 3)), ((0, 1), (1, 0), (1, 1), (1, 2), (1, 3), (2, 2), (2, 3), (2, 4), (3, 3), (3, 4)), ((0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2))], 'targets': (((1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 2), (2, 2), (3, 2), (1, 3), (2, 3), (3, 3)), ((1, 0), (2, 0), (3, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (0, 3), (1, 3), (2, 3), (3, 3), (4, 3))), 'witness': [('select', 0), ('turn', 0), ('cut', (1, 4)), ('select', 1), ('cut', (0, 2)), ('place', (0, 0, 0)), ('select', 0), ('place', (0, 2, 0)), ('select', 2), ('place', (1, 0, 1)), ('select', 3), ('place', (1, 1, 0)), ('select', 4), ('place', (1, 3, 1))]}]


def hit(spec,state,x,y):
    if 1<=x<37 and 35<=y<63:
        index=int((y-35)//14)*3+int((x-1)//12)
        loose=rack(state)
        return ('select',loose[index]) if index<len(loose) else ('none',0)
    for target in range(2):
        left=2+32*target
        if left<=x<left+25 and 7<=y<32:
            cell=(int((x-left)//5),int((y-7)//5))
            if cell in target_cells(spec,target):
                for piece,place in enumerate(state.placements):
                    if place is not None and place[0]==target and cell in occupied(state.shapes[piece],place):
                        return ('select',piece)
                offset=anchor(state)
                return ('place',(target,cell[0]-offset[0],cell[1]-offset[1]))
    if state.selected>=0:
        shape=state.shapes[state.selected]
        width=max(x for x,y in shape)+1;height=max(y for x,y in shape)+1
        if 36<=y<=39:
            line=round((x-41)/4)
            if 0<line<width and abs(x-(41+4*line))<=1:return ('cut',(0,line))
        if 37<=x<=40:
            line=round((y-41)/4)
            if 0<line<height and abs(y-(41+4*line))<=1:return ('cut',(1,line))
    return ('none',0)


def click_for(spec,state,operation):
    kind,value=operation
    if kind=='turn':return 5
    if kind=='undo':return 7
    if kind=='select':
        if state.placements[value] is None:
            slot=rack(state).index(value)
            return [6,7+12*(slot%3),42+14*(slot//3)]
        target,left,top=state.placements[value]
        ax,ay=shape_anchor(state.shapes[value])
        return [6,4+32*target+5*(left+ax),9+5*(top+ay)]
    if kind=='place':
        offset=anchor(state)
        return [6,4+32*value[0]+5*(value[1]+offset[0]),9+5*(value[2]+offset[1])]
    axis,line=value
    return [6,41+4*line,37] if axis==0 else [6,38,41+4*line]


def border(frame,x,y,width,height,color):
    frame[y:y+height,x]=frame[y:y+height,x+width-1]=color
    frame[y,x:x+width]=frame[y+height-1,x:x+width]=color


class FittingDisplay(RenderableUserDisplay):
    def __init__(self,game):self.game=game

    def render_interface(self,frame):
        game,spec,state=self.game,self.game.spec,self.game.st
        frame[:,:]=2
        colors=(15,13,14,12,10,11)
        for target,cells in enumerate(spec['targets']):
            left=2+32*target
            frame[0:33,left-1:left+26]=1
            # Mannequin head and feet distinguish the fitting stands from boards.
            frame[1:5,left+9:left+14]=0
            frame[4:7,left+10:left+13]=0
            for x,y in cells:border(frame,left+5*x,7+5*y,5,5,9)
        for piece,(shape,place) in enumerate(zip(state.shapes,state.placements)):
            if place is not None:
                target,left,top=place
                for x,y in shape:
                    xx,yy=2+32*target+5*(x+left),7+5*(y+top)
                    frame[yy+1:yy+5,xx+1:xx+5]=colors[state.dyes[piece]]
                    frame[yy+2,xx+2]=0
        # Placing cloth frees its physical pocket; separated pieces have no total cap.
        loose=rack(state)
        for slot in range(6):
            left,top=1+12*(slot%3),35+14*(slot//3)
            frame[top:top+13,left:left+11]=4
            piece=loose[slot] if slot<len(loose) else -1
            border(frame,left,top,11,13,0 if piece>=0 and piece==state.selected else 3)
            if piece>=0:
                shade=colors[state.dyes[piece]]
                for x,y in state.shapes[piece]:
                    frame[top+2+y*2:top+4+y*2,left+1+x*2:left+3+x*2]=shade
        frame[40:63,40:63]=1
        if state.selected>=0:
            shape=state.shapes[state.selected]
            for x,y in shape:
                border(frame,41+4*x,41+4*y,4,4,3)
                frame[42+4*y:45+4*y,42+4*x:45+4*x]=colors[state.dyes[state.selected]]
            ax,ay=anchor(state);frame[42+4*ay,42+4*ax]=0
            width=max(x for x,y in shape)+1;height=max(y for x,y in shape)+1
            for line in range(1,width):
                x=41+4*line;frame[36:40,x-1:x+2]=0;frame[37,x]=3
            for line in range(1,height):
                y=41+4*line;frame[y-1:y+2,37:40]=0;frame[y,38]=3
        x,y=game.contact
        radius=2+game.pulse
        for dx,dy in ((-radius,-radius),(radius,-radius),(-radius,radius),(radius,radius)):
            frame[max(0,min(63,y+dy)),max(0,min(63,x+dx))]=8 if game.refused else 10
        return frame


class Fm01(ARCBaseGame):
    def __init__(self):
        self.spec,self.st=LEVELS[0],initial(LEVELS[0])
        self.history,self.contact,self.pulse,self.refused=[],(38,33),0,False
        self.display=FittingDisplay(self)
        levels=[Level(sprites=[],grid_size=(64,64),data={},name=spec['name']) for spec in LEVELS]
        super().__init__('fm01',levels,Camera(0,0,64,64,2,2,[self.display]),False,len(levels),[5,6,7])

    def on_set_level(self,level):
        self.spec,self.st=LEVELS[self.level_index],initial(LEVELS[self.level_index])
        self.history,self.contact,self.pulse,self.refused=[],(38,33),0,False

    def handle_reset(self):
        self.full_reset() if self._state in (GameState.NOT_PLAYED,GameState.WIN) else self.level_reset()

    def step(self):
        action=self.action.id.value
        if action==0:self.complete_action();return
        operation=('turn',0) if action==5 else ('undo',0) if action==7 else ('none',0)
        self.pulse=1-self.pulse
        if action==6:
            data=self.action.data or {};x,y=data.get('x',-100),data.get('y',-100)
            if isinstance(x,(int,float)) and isinstance(y,(int,float)) and isfinite(x) and isfinite(y):
                operation=hit(self.spec,self.st,x,y)
                self.contact=(max(0,min(63,int(x))),max(0,min(63,int(y))))
        else:self.contact=(51,33) if action==5 else (61,33)
        before=self.st
        if operation[0]=='undo':
            if self.history:self.st=self.history.pop()
        else:
            self.st=transition(self.spec,self.st,operation)
            if self.st!=before:self.history.append(before)
        self.refused=self.st==before
        if self.st.done:self.next_level()
        self.complete_action()

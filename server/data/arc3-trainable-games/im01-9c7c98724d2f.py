# Author: GPT-6 Astra
# Date: 2026-10-21 01:28
# PURPOSE: Impulse uses discrete equal-mass collisions in separated straight
# lanes, resolving every travel unit and bank before another command arrives.
# SRP/DRY check: Pass — existing collisions do not implement remaining-travel
# transfer; uses ARC3 sprites/display and an independently testable shot rule.
from collections import namedtuple
import numpy as np
from arcengine import ARCBaseGame,Camera,Level,RenderableUserDisplay,Sprite

LEVELS=[dict(name='Pass the motion',stops=12,positions=((0,3,6,9),(1,4,7,10),(0,2,5,8)),
             goals=(),felt=((),(),()),strength=5,
             shots=((0,1,6),(0,1,6),(0,-1,6),(1,1,6),(1,1,6),(1,-1,6),(2,1,6),(2,1,6))),
        dict(name='Bank and absorb',stops=12,positions=((0,3,6,9),(1,4,7,10),(0,2,5,8)),
             goals=(),felt=((6,),(7,),(5,)),strength=4,
             shots=((0,-1,8),(0,1,4),(0,-1,4),(1,-1,8),(1,1,4),(1,-1,4),(2,1,8),(2,1,4),(2,-1,4)))]
State=namedtuple('State','positions selected direction strength history pulse focus paths')
LANES=(10,26,42)
LEVELS.extend([
 dict(name='Alternating trains',stops=12,positions=((0,3,6,9),(1,4,7,10),(0,2,5,8)),
      goals=(),felt=((6,),(4,),(5,)),strength=4,cues=(0,3,0),
      shots=((0,-1,8),(0,1,4),(0,-1,4),(1,1,8),(1,-1,4),(1,1,4),(2,1,8),(2,1,4),(2,-1,4))),
 dict(name='Padded cushions',stops=12,positions=((0,3,6,9),(1,4,7,10),(0,2,5,8)),
      goals=(),felt=((),(),()),strength=6,pads=((1,),(1,),(1,)),
      shots=((0,1,8),(0,1,8),(0,-1,6),(1,1,8),(1,1,8),(1,-1,7),(2,1,8),(2,1,8),(2,-1,5))),
 dict(name='Soft banks and rough lanes',stops=12,positions=((0,3,6,9),(1,4,7,10),(0,2,5,8)),
      goals=(),felt=((6,),(7,),(5,)),strength=4,pads=((1,),(1,),(1,)),
      shots=((0,1,8),(0,1,8),(0,-1,4),(1,1,8),(1,1,8),(1,-1,5),(2,1,8),(2,1,8),(2,-1,4))),
 dict(name='Different banks',stops=12,positions=((0,3,6,9),(1,4,7,10),(0,2,5,8)),
      goals=(),felt=((6,),(4,),(5,)),strength=4,cues=(0,3,0),pads=((1,),(-1,),(1,)),
      shots=((0,1,8),(0,1,8),(0,-1,4),(1,-1,8),(1,-1,8),(1,1,5),(2,1,8),(2,1,8),(2,-1,4))),
 dict(name='Reading every contact',stops=12,positions=((0,3,6,9),(1,4,7,10),(0,2,5,8)),
      goals=(),felt=((5,8),(3,6),(4,7)),strength=4,cues=(0,3,0),pads=((1,),(-1,),(1,)),
      shots=((0,1,8),(0,1,8),(0,1,6),(0,-1,4),(1,-1,8),(1,-1,8),(1,-1,6),(1,1,5),
             (2,1,8),(2,1,8),(2,1,6),(2,-1,4))),
])


def cue(spec,lane):
    return spec.get('cues',(0,0,0))[lane]


def shot(spec,positions,lane,direction,strength):
    """One slot is one puck diameter; touching balls transfer without travel.

    Each unit moves a center by one diameter. A wall reverses direction without
    energy loss; entering felt spends two extra travel units. At most one ball
    moves at once, so neither glancing nor simultaneous contacts can occur.
    """
    rows=[list(row) for row in positions]
    moving=cue(spec,lane)
    remaining=strength
    frames=[]
    while remaining>0:
        candidate=rows[lane][moving]+direction
        if not 0<=candidate<spec['stops']:
            if direction in spec.get('pads',((),(),()))[lane]:
                break
            direction=-direction
            continue
        if candidate in rows[lane]:
            moving=rows[lane].index(candidate)
            continue
        rows[lane][moving]=candidate
        remaining-=1+2*(candidate in spec['felt'][lane])
        frames.append(tuple(tuple(row) for row in rows))
    return tuple(tuple(row) for row in rows),tuple(frames)


for _spec in LEVELS:
    _positions=_spec['positions']
    for _lane,_direction,_strength in _spec['shots']:
        _positions=shot(_spec,_positions,_lane,_direction,_strength)[0]
    _spec['goals']=_positions


def initial(spec):
    return State(tuple(tuple(row) for row in spec['positions']),0,None,spec['strength'],(),0,None,())


def transition(spec,state,action,point=None):
    state=state._replace(pulse=1-state.pulse,focus=point,paths=())
    if action==7 and state.history:
        positions,selected,direction,strength=state.history[-1]
        return state._replace(positions=positions,selected=selected,direction=direction,strength=strength,history=state.history[:-1])
    if action in (1,2):
        return state._replace(strength=max(1,min(8,state.strength+(1 if action==1 else -1))))
    if action==6 and point is not None:
        if point[1]>=51:
            return state._replace(direction=-1 if point[0]<32 else 1)
        lane=next((index for index,y in enumerate(LANES) if abs(point[1]-y)<=6),None)
        if lane is not None and abs(point[0]-(8+4*state.positions[lane][cue(spec,lane)]))<=4:
            return state._replace(selected=lane,direction=None)
        return state
    if action==5 and state.selected is not None and state.direction is not None:
        positions,frames=shot(spec,state.positions,state.selected,state.direction,state.strength)
        old=(state.positions,state.selected,state.direction,state.strength)
        return state._replace(positions=positions,history=state.history+(old,),paths=frames)
    return state


def objects(spec,state):
    sprites=[]
    for lane,y in enumerate(LANES):
        for person,(position,goal) in enumerate(zip(state.positions[lane],spec['goals'][lane])):
            color=(2,8,9,15)[person]
            pocket=np.full((9,7),-1,dtype=np.int8)
            pocket[0,:]=pocket[-1,:]=pocket[:,0]=pocket[:,-1]=color
            if person==1:
                pocket[0,3]=pocket[-1,3]=0
            elif person==2:
                pocket[0,2:5]=pocket[-1,2:5]=0
            elif person==3:
                pocket[0,1]=pocket[0,5]=pocket[-1,1]=pocket[-1,5]=0
            sprites.append(Sprite(pocket,name=f'lane-{lane}-pocket-{person}',x=5+goal*4,y=y-4,tags=['pocket',f'puck-{person}'],layer=0))
            puck=np.full((5,5),color,dtype=np.int8)
            if person==cue(spec,lane):
                puck[1:4,1:4]=0
            puck[0,0]=puck[0,4]=puck[4,0]=puck[4,4]=-1
            if person==1:
                puck[1:4,2]=0
            elif person==2:
                puck[2,1:4]=0
            elif person==3:
                puck[1,1]=puck[3,3]=0
            if person==cue(spec,lane):
                puck[2,2]=11 if state.selected==lane else 5
            sprites.append(Sprite(puck,name=f'lane-{lane}-puck-{person}',x=6+position*4,y=y-2,tags=['puck','cue' if person==cue(spec,lane) else 'target-puck'],layer=2))
        for pad in spec['felt'][lane]:
            felt=np.full((11,4),14,dtype=np.int8)
            felt[::2,::2]=4
            sprites.append(Sprite(felt,name=f'lane-{lane}-felt-{pad}',x=6+pad*4,y=y-5,tags=['felt'],layer=-1))
        for direction in spec.get('pads',((),(),()))[lane]:
            cushion=np.full((11,3),5,dtype=np.int8)
            cushion[::2,1]=11
            sprites.append(Sprite(cushion,name=f'lane-{lane}-padded-end-{direction}',x=2 if direction<0 else 56,y=y-5,tags=['absorbing-cushion'],layer=3))
    return sprites


class RinkDisplay(RenderableUserDisplay):
    def __init__(self,game):
        self.game=game

    def render_interface(self,frame):
        image=np.full((64,64),1,dtype=np.int8)
        state=self.game.rink
        spec=LEVELS[self.game.level_index]
        for lane,y in enumerate(LANES):
            image[y-6:y+7,3:58]=11 if state.selected==lane else 4
            image[y-5:y+6,5:56]=0
            for stop in range(spec['stops']):
                image[y+5,8+stop*4]=2
        for sprite in sorted(self.game.current_level.get_sprites(),key=lambda item:item.layer):
            pixels=sprite.render()
            for row,column in zip(*np.where(pixels>=0)):
                image[sprite.y+row,sprite.x+column]=pixels[row,column]
        for center,direction in ((14,-1),(49,1)):
            image[52:63,center-11:center+12]=11 if state.direction==direction else 3
            image[56:59,center-6:center+7]=0
            for offset in range(5):
                image[53+offset,center+direction*(2+offset)]=0
                image[61-offset,center+direction*(2+offset)]=0
        # The cue pullback is a physical gap before the selected puck.
        if state.selected is not None:
            y=LANES[state.selected]-5
            x=8+4*state.positions[state.selected][cue(spec,state.selected)]
            direction=state.direction or 1
            tip=max(1,min(62,x-direction*(2+state.strength)))
            tail=max(0,min(63,tip-direction*5))
            image[y,min(tip,tail):max(tip,tail)+1]=13
            image[y,tip]=5 if state.pulse else 8
            # The free-flight guide reflects at cushions but ignores other
            # pucks and felt. It displays launch strength, not a solved shot.
            position=state.positions[state.selected][cue(spec,state.selected)]*4
            heading=direction
            lane_y=LANES[state.selected]+3
            for distance in range(state.strength*4):
                if not 0<=position+heading<=(spec['stops']-1)*4:
                    heading=-heading
                position+=heading
                if distance%3==0:
                    image[lane_y,8+position]=11
            image[lane_y-1:lane_y+2,7+position:10+position]=13
        if state.focus is not None:
            x,y=state.focus
            for offset in (-3,3):
                if 0<=x+offset<64 and 0<=y+offset<64:
                    image[y+offset,x+offset]=8 if state.pulse else 13
        return image


class Im01(ARCBaseGame):
    def __init__(self):
        self.rink=initial(LEVELS[0])
        self.motion=[]
        self.final=None
        self.display=RinkDisplay(self)
        levels=[Level(sprites=[],grid_size=(64,64),data={'index':index},name=spec['name']) for index,spec in enumerate(LEVELS)]
        super().__init__('im01',levels,Camera(0,0,64,64,1,1,[self.display]),False,len(levels),[1,2,5,6,7])

    def on_set_level(self,level):
        self.rink=initial(LEVELS[level.get_data('index')])
        self.motion=[]
        self.final=None
        self.sync_objects(level)

    def sync_objects(self,level):
        level.remove_all_sprites()
        for sprite in objects(LEVELS[level.get_data('index')],self.rink):
            level.add_sprite(sprite)

    def step(self):
        if self.action.id.value==0:
            self.complete_action()
            return
        spec=LEVELS[self.level_index]
        if not self.motion:
            point=(self.action.data.get('x',-10),self.action.data.get('y',-10)) if self.action.id.value==6 else None
            self.final=transition(spec,self.rink,self.action.id.value,point)
            self.motion=list(self.final.paths)
        self.rink=self.final._replace(positions=self.motion.pop(0)) if self.motion else self.final
        self.sync_objects(self.current_level)
        if self.motion:
            return
        if self.rink.positions==tuple(spec['goals']):
            self.next_level()
        self.complete_action()

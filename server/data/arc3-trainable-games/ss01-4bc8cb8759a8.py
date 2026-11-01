# Author: GPT-6 Astra
# Date: 2026-10-21 01:10
# PURPOSE: Deterministic shared-supply fruit allocation puzzle; owns fixed orders, pure threading/undo rules and named fruit/stick sprites for the ARC runtime. Offline generation uses the same allocation rules.
# SRP/DRY check: Pass â€” one allocation transition governs runtime, dynamic-programming witnesses and random tests; uses standard ARC sprite/camera interfaces.

from math import isfinite
import numpy as np
from arcengine import ARCBaseGame, Camera, GameState, Level, RenderableUserDisplay, Sprite


def make_spec(name,orders,route):
    progress = [0]*len(orders)
    supply = []
    for stick in route:
        supply.append(orders[stick][progress[stick]])
        progress[stick] += 1
    if progress != [len(order) for order in orders]:
        raise ValueError("Incomplete fruit interleaving")
    return {"name":name,"orders":[list(order) for order in orders],
            "supply":supply,"witness":list(route)}


LEVELS = [
    make_spec("Six clear orders", [[0,kind] for kind in range(1,7)],
              [4,4,2,2,5,5,1,1,3,3,0,0]),
    make_spec("A longer common beginning", [[0,0,kind] for kind in range(1,6)],
              [3,3,3,1,1,1,4,4,4,0,0,0,2,2,2]),
    make_spec("Two kinds of opening", [[0,0,1],[0,0,2],[0,1,3],[1,0,2],[1,0,3]],
              [1,1,2,2,2,3,1,3,3,0,0,4,4,0,4]),
    make_spec("Five unfinished orders", [[0,1,2],[0,1,3],[0,2,1],[0,2,3],[0,3,1]],
              [1,1,0,0,0,2,2,1,2,4,4,3,3,3,4]),
    make_spec("Short orders close early", [[0,1],[0,2,1],[0,3],[1,2,0],[1,0,2],[0,2,3]],
              [1,1,3,4,1,2,2,5,0,0,5,5,4,3,3,4]),
    make_spec("A fruit returns", [[0,1,0],[0,2,0],[1,2,1],[2,1,2],[0,1,2]],
              [3,2,3,2,2,4,4,3,4,1,1,0,1,0,0]),
    make_spec("Reserve the last red fruit", [[0,1,3],[0,2,3],[1,0,2],[2,1,0],[1,2,0]],
              [1,1,3,2,3,0,1,0,2,3,2,0,4,4,4]),
    make_spec("Five unfinished tails", [[1,2,0],[1,3,0],[2,1,0],[2,3,0],[3,1,0]],
              [0,0,0,2,3,1,2,4,2,4,4,1,1,3,3]),
]


def initial(spec):
    return ()


def stacks(spec,state):
    result = [[] for _ in spec["orders"]]
    for index,stick in enumerate(state):
        result[stick].append(spec["supply"][index])
    return result


def solved(spec,state):
    return len(state)==len(spec["supply"]) and stacks(spec,state)==spec["orders"]


def transition(spec,state,operation):
    if operation == -1:
        return state[:-1]
    if operation not in range(len(spec["orders"])):
        return state
    if len(state)==len(spec["supply"]) or state.count(operation)>=len(spec["orders"][operation]):
        return state
    return state+(operation,)


def centers(spec):
    width=60//len(spec["orders"])
    return [6+index*width for index in range(len(spec["orders"]))]


def hit(spec,x,y):
    half_width=30//len(spec["orders"])
    if 0<=y<48:
        for stick,center in enumerate(centers(spec)):
            if center-half_width<=x<center+half_width:
                return stick
    return -2


def click_for(spec,operation):
    return [6,centers(spec)[operation],44]


def witness_actions(spec,route):
    actions=[];selected=0
    for stick in route:
        if stick!=selected:
            actions.append(click_for(spec,stick));selected=stick
        actions.append(5)
    return actions


def fruit_pixels(kind):
    pixels = np.full((5,7),-1,dtype=np.int8)
    if kind==0:
        pixels[1:4,0:7]=8
        pixels[0,1:6]=pixels[4,1:6]=8
        pixels[0,3]=14
        pixels[1:3,1]=0
    elif kind==1:
        pixels[:,:]=14
        pixels[0,:]=pixels[4,:]=4
        pixels[1:4,0]=pixels[1:4,6]=4
        pixels[2,2]=pixels[2,4]=0
    elif kind==2:
        pixels[0:2,3:5]=12
        pixels[2:4,1:7]=12
        pixels[4,2:6]=12
        pixels[0,3]=14
        pixels[3,2]=0
    elif kind==3:
        pixels[0:2,1:3]=pixels[0:2,4:6]=15
        pixels[2:4,0:2]=pixels[2:4,3:5]=pixels[3:5,2:4]=15
        pixels[0,3]=14
    elif kind==4:
        pixels[1:4,1:6]=11
        pixels[0,2:5]=pixels[4,2:5]=11
        pixels[2,0]=pixels[2,6]=11
        pixels[1,2]=0
    elif kind==5:
        pixels[0,1:6]=14
        pixels[1:3,0:7]=6
        pixels[3,1:6]=pixels[4,2:5]=6
        pixels[2,1]=pixels[2,4]=pixels[3,3]=0
    else:
        pixels[0,1:6]=pixels[4,1:6]=13
        pixels[1:4,:]=13
        pixels[1:4,2:5]=0
        pixels[2,3]=1
    return pixels


def queue_position(index):
    row,column = divmod(index,6)
    return (13+(column if row%2==0 else 5-column)*8,48+row*5)


class StandDisplay(RenderableUserDisplay):
    def __init__(self,game):
        self.game=game

    def render_interface(self,frame):
        game,spec,state = self.game,self.game.spec,self.game.st
        frame[:,:]=1
        frame[0:3,:]=12
        frame[3,::2]=13
        frame[47:64,:]=13
        frame[47:64,11:64]=4
        # A single winding supply tray keeps the complete future sequence visible.
        frame[50,12:63]=frame[55,12:63]=frame[60,12:63]=2
        frame[50:56,61:63]=2
        frame[55:61,12:14]=2
        frame[48:53,10:12]=0
        frame[49:62,1:10]=12
        frame[51:60,3:8]=13
        actual = stacks(spec,state)
        for stick,center in enumerate(centers(spec)):
            frame[4:22,center-5:center+5]=0
            frame[4:22,center-5]=frame[4:22,center+4]=2
            frame[43:47,center-5:center+6]=10 if stick==game.selected else 14 if actual[stick]==spec["orders"][stick] else 12
            frame[45:47,center-4:center+5]=13
        for sprite in game.objects:
            pixels=sprite.pixels
            height,width=pixels.shape
            region=frame[sprite.y:sprite.y+height,sprite.x:sprite.x+width]
            mask=pixels>=0
            region[mask]=pixels[mask]
        x,y=game.contact
        radius=2+game.pulse
        color=8 if game.refused else 9
        for dx,dy in ((-radius,-radius),(radius,-radius),(-radius,radius),(radius,radius)):
            frame[max(0,min(63,y+dy)),max(0,min(63,x+dx))]=color
        return frame


class Ss01(ARCBaseGame):
    def __init__(self):
        self.spec,self.st=LEVELS[0],()
        self.selected=0
        self.objects,self.animation=[],None
        self.pulse,self.contact,self.refused=0,(9,46),False
        self.display=StandDisplay(self)
        levels=[Level(sprites=[],grid_size=(64,64),data={},name=spec["name"]) for spec in LEVELS]
        super().__init__("ss01",levels,Camera(0,0,64,64,1,1,[self.display]),False,len(levels),[5,6,7])

    def on_set_level(self,level):
        self.spec,self.st=LEVELS[self.level_index],()
        self.selected=0
        self.animation=None
        self.pulse,self.contact,self.refused=0,(9,46),False
        self.sync_objects()

    def sync_objects(self):
        for sprite in list(self.current_level.get_sprites()):
            self.current_level.remove_sprite(sprite)
        self.objects=[]
        def add(name,pixels,x,y,tags):
            sprite=Sprite(pixels=pixels,name=name,x=x,y=y,tags=tags)
            self.objects.append(sprite)
            self.current_level.add_sprite(sprite)
        locations=centers(self.spec)
        for stick,center in enumerate(locations):
            add(f"skewer-{stick}",np.full((20,1),0,dtype=np.int8),center,24,["skewer"])
            for height,kind in enumerate(self.spec["orders"][stick]):
                add(f"order-{stick}-fruit-{height}",fruit_pixels(kind),center-3,15-height*5,["target",f"fruit-{kind}"])
        progress=[0]*len(locations)
        for index,kind in enumerate(self.spec["supply"]):
            if index<len(self.st):
                stick=self.st[index]
                x,y=locations[stick]-3,38-progress[stick]*5
                progress[stick]+=1
                tags=["threaded",f"skewer-{stick}",f"fruit-{kind}"]
            else:
                x,y=queue_position(index-len(self.st))
                tags=["supply",f"queue-{index-len(self.st)}",f"fruit-{kind}"]
            if self.animation and index==self.animation[0]:
                x,y=self.animation[1:]
            add(f"fruit-{index}",fruit_pixels(kind),x,y,tags)

    def handle_reset(self):
        self.full_reset() if self._state in (GameState.NOT_PLAYED,GameState.WIN) else self.level_reset()

    def finish_step(self):
        if solved(self.spec,self.st):
            self.next_level()
        self.complete_action()

    def step(self):
        if self.animation:
            self.animation=None
            self.sync_objects()
            self.finish_step()
            return
        if self.action.id.value==0:
            self.complete_action()
            return
        self.pulse=1-self.pulse
        data=self.action.data or {}
        x,y=data.get("x",-100),data.get("y",-100)
        button=self.action.id.value
        operation=self.selected if button==5 else -1 if button==7 else -2
        before_selection=self.selected
        if button==6 and isinstance(x,(int,float)) and isinstance(y,(int,float)) and isfinite(x) and isfinite(y):
            target=hit(self.spec,x,y)
            if target>=0:self.selected=target
            self.contact=(max(0,min(63,int(x))),max(0,min(63,int(y))))
        elif button in (5,7):self.contact=(centers(self.spec)[self.selected],44)
        before=self.st
        self.st=transition(self.spec,self.st,operation)
        self.refused=self.st==before and self.selected==before_selection
        if len(self.st)>len(before):
            center=centers(self.spec)[operation]
            destination_y=38-before.count(operation)*5
            self.animation=(len(before),(13+center-3)//2,(48+destination_y)//2)
        elif len(self.st)<len(before):
            stick=before[-1]
            center=centers(self.spec)[stick]
            source_y=38-self.st.count(stick)*5
            self.animation=(len(self.st),(13+center-3)//2,(48+source_y)//2)
        self.sync_objects()
        if self.animation:
            return
        self.finish_step()

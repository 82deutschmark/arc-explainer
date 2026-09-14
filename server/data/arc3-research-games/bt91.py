# ARC-AGI-3 candidate task bt91.
import copy
import math
import random
import numpy as np
from arcengine import ARCBaseGame, Camera, GameAction, Level, RenderableUserDisplay


def rect(f, x, y, w, h, c):
    f[max(0,y):min(64,y+h), max(0,x):min(64,x+w)] = c


def border(f, x, y, w, h, c):
    rect(f,x,y,w,1,c); rect(f,x,y+h-1,w,1,c)
    rect(f,x,y,1,h,c); rect(f,x+w-1,y,1,h,c)


def line(f, a, b, c, dotted=False):
    x,y=a; xx,yy=b
    n=max(abs(xx-x),abs(yy-y),1)
    for i in range(n+1):
        if not dotted or i%3!=2:
            rect(f,round(x+(xx-x)*i/n),round(y+(yy-y)*i/n),1,1,c)


def disc(f,x,y,r,c):
    for yy in range(-r,r+1):
        for xx in range(-r,r+1):
            if xx*xx+yy*yy<=r*r: rect(f,x+xx,y+yy,1,1,c)


def glyph(f,x,y,v,c=10,scale=1):
    patterns = (
        ('010','111','010'), ('101','010','101'), ('111','100','111'),
        ('110','011','110'), ('101','111','101'), ('010','101','010'),
        ('100','010','001'), ('111','010','010'),
    )
    for yy,row in enumerate(patterns[v%len(patterns)]):
        for xx,k in enumerate(row):
            if k=='1': rect(f,x+xx*scale,y+yy*scale,scale,scale,c)


def person(f,x,y,c=10,awake=True):
    disc(f,x,y-2,3,c); rect(f,x-3,y+2,7,4,c)
    rect(f,x-3,y+6,2,2,c); rect(f,x+2,y+6,2,2,c)
    rect(f,x-1,y-3,1,1,5); rect(f,x+2,y-3,1,1,5)
    if not awake: line(f,(x-3,y-4),(x+3,y),4)


def pips(f,x,y,n,total,c=11):
    for i in range(total):
        border(f,x+4*i,y,3,3,c if i<n else 3)
        if i<n: rect(f,x+4*i+1,y+1,1,1,c)


def arrow(f,x,y,c=14,d=0):
    for i in range(5):
        for j in range(-i//2,i//2+1):
            dx,dy=(i,j) if d==0 else ((-i,j) if d==2 else ((j,i) if d==1 else (j,-i)))
            rect(f,x+dx,y+dy,1,1,c)


def hit(x,y,b):
    a,c,w,h=b
    return a<=x<a+w and c<=y<c+h


def appearance(f,variant):
    if variant%2:
        permutation=np.array([0,1,2,3,4,5,9,10,14,12,7,6,15,13,8,11],dtype=np.int8)
        return permutation[f]
    return f


def token(f,x,y,c,variant=0):
    if variant//2:
        rect(f,x-2,y-2,5,5,c);rect(f,x-1,y-1,3,3,5);rect(f,x,y,1,1,c)
    else:
        disc(f,x,y,3,c);rect(f,x-1,y-1,2,2,0)


class Puzzle:
    background=5
    actions=(5,6)
    def __init__(self,level=0,seed=0,variant=0):
        self.level=level; self.seed=seed; self.variant=variant
        self.rng=random.Random(seed*1009+level*97)
        self.result=None; self.errors=0; self.moves=0; self.trace=[]
        self.focus=None; self.setup()

    def setup(self): raise NotImplementedError
    def click(self,x,y): pass
    def commit(self): pass
    def key(self,action): pass

    def act(self,action,x=0,y=0):
        if self.result: return
        self.trace=[]; self.moves+=1
        if action==6:
            if hit(x,y,(53,53,9,9)): self.commit()
            else: self.click(x,y)
        elif action==5: self.commit()
        elif action in (1,2,3,4):self.key(action)

    def reject(self):
        self.errors+=1
        if self.level>0 and self.errors>=3: self.result='lose'
        self.trace.append((57,57,8))

    def finish(self,condition):
        if condition: self.result='win'
        else: self.reject()

    def canvas(self):
        f=np.full((64,64),self.background,dtype=np.int8)
        border(f,1,1,62,50,3 if self.background==5 else 2)
        for i in range(5): disc(f,8+i*5,57,1,14 if i<self.level else 3)
        border(f,53,53,9,9,11); arrow(f,55,57,11)
        if self.errors: pips(f,34,56,3-self.errors,3,8)
        return f

    def draw(self): raise NotImplementedError

    def logical_state(self):
        ignored={'rng','variant','trace','background'}
        return {k:copy.deepcopy(v) for k,v in vars(self).items() if k not in ignored}


class PixelDisplay(RenderableUserDisplay):
    def __init__(self,game): self.game=game
    def render_interface(self,frame):
        return self.game.visible.copy()


class GameShell:
    model_type=None
    identifier=''
    def __init__(self,seed=0,variant=0):
        self.research_seed=seed; self.variant=variant
        self.pending=[]; self.outcome=None
        self.visible=np.full((64,64),5,dtype=np.int8)
        super().__init__(game_id=self.identifier,
            levels=[Level(grid_size=(64,64),name=str(i)) for i in range(5)],
            camera=Camera(width=64,height=64,background=5,letter_box=5,
                          interfaces=[PixelDisplay(self)]),
            available_actions=list(self.model_type.actions),seed=seed)

    def on_set_level(self,level):
        self.model=self.model_type(self.level_index,self.research_seed,self.variant)
        self.pending=[]; self.outcome=None; self.visible=self.model.draw()

    def full_reset(self):
        super().full_reset(); self.on_set_level(self.current_level)

    def level_reset(self):
        super().level_reset(); self.on_set_level(self.current_level)

    def step(self):
        if self.action.id==GameAction.RESET:
            self.complete_action();return
        if self.pending:
            self.visible=self.pending.pop(0)
            if self.pending: return
            outcome=self.outcome; self.outcome=None
            if outcome=='win': self.next_level()
            elif outcome=='lose': self.lose()
            self.complete_action(); return
        a=self.action.id.value
        data=self.action.data or {}
        x,y=int(data.get('x',57)),int(data.get('y',57))
        old=self.model.draw()
        self.model.act(a,x,y)
        new=self.model.draw()
        yy,xx=np.indices((64,64)); distance=np.abs(xx-x)+np.abs(yy-y)
        changed=old!=new; far=max(1,int(distance[changed].max())) if changed.any() else 1
        for tick in range(1,7):
            f=old.copy(); mask=changed & (distance<=far*tick/6); f[mask]=new[mask]
            self.pending.append(f)
        for px,py,c in self.model.trace:
            for radius in (1,3,5):
                f=new.copy(); border(f,px-radius,py-radius,2*radius+1,2*radius+1,c)
                self.pending.append(f)
        if self.model.result:
            c=14 if self.model.result=='win' else 8
            for inset in (1,3,5,3,1):
                f=new.copy(); border(f,inset,inset,64-2*inset,64-2*inset,c)
                self.pending.append(f)
        self.pending.append(new)
        self.outcome=self.model.result

class TurningChannels(Puzzle):
    DIR=((0,-1),(1,0),(0,1),(-1,0))
    PATHS=(
        ((0,1),(1,1),(2,1)),
        ((0,2),(1,2),(1,1),(2,1),(2,2),(3,2)),
        ((0,2),(1,2),(1,1),(1,0),(2,0),(3,0),(3,1),(3,2),(4,2)),
        ((0,3),(0,2),(1,2),(1,1),(2,1),(2,2),(3,2),(3,3),(4,3)),
        ((0,2),(0,1),(1,1),(1,0),(2,0),(2,1),(3,1),(3,2),(2,2),(2,3),(3,3),(4,3),(4,2)),
    )
    def setup(self):
        self.n=3 if self.level==0 else (4 if self.level==1 else 5)
        self.path=list(self.PATHS[self.level]);self.start=self.path[0];self.goal=self.path[-1]
        self.solution_masks={};self.masks={}
        for i,p in enumerate(self.path):
            before=self.path[i-1] if i else (p[0]-1,p[1])
            after=self.path[i+1] if i<len(self.path)-1 else (p[0]+1,p[1])
            dirs=[self.DIR.index((q[0]-p[0],q[1]-p[1])) for q in (before,after)]
            self.solution_masks[p]=sum(1<<d for d in dirs)
        for y in range(self.n):
            for x in range(self.n):
                p=(x,y);mask=self.solution_masks.get(p,self.rng.choice((5,3)))
                r=self.rng.randrange(4);self.masks[p]=((mask<<r)|(mask>>(4-r)))&15
        self.checkpoints=set(self.path[1:-1:2]);self.reached=set()

    def click(self,x,y):
        p=((x-8)//9,(y-5)//9)
        if p in self.masks and 8<=x<8+9*self.n and 5<=y<5+9*self.n:
            m=self.masks[p];self.masks[p]=((m<<1)|(m>>3))&15

    def flow(self):
        if not self.masks[self.start]&8:return set()
        found={self.start};queue=[self.start]
        for p in queue:
            for d,(dx,dy) in enumerate(self.DIR):
                q=(p[0]+dx,p[1]+dy)
                if self.masks[p]&(1<<d) and q in self.masks and self.masks[q]&(1<<((d+2)%4)) and q not in found:
                    found.add(q);queue.append(q)
        return found

    def commit(self):
        self.reached=self.flow()
        self.trace.extend((12+9*x,9+9*y,10) for x,y in sorted(self.reached))
        self.finish(self.goal in self.reached and self.masks[self.goal]&2 and self.checkpoints<=self.reached)

    def draw(self):
        f=self.canvas();skin=self.level%4 if self.variant is None else self.variant
        for (x,y),mask in self.masks.items():
            px=8+9*x;py=5+9*y;border(f,px,py,9,9,3)
            for d,(dx,dy) in enumerate(self.DIR):
                if mask&(1<<d):line(f,(px+4,py+4),(px+4+dx*4,py+4+dy*4),10 if (x,y) in self.reached else 1)
            if (x,y) in self.checkpoints:token(f,px+4,py+4,11,skin)
        arrow(f,2,9+9*self.start[1],10);border(f,8+9*self.n,6+9*self.goal[1],5,7,11)
        return appearance(f,skin)


class Bt91(GameShell,ARCBaseGame):
    identifier='bt91';model_type=TurningChannels
    def __init__(self,seed=0,variant=None):super().__init__(seed,variant)

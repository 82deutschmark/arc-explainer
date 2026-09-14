# ARC-AGI-3 candidate task ex92.
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

def normalized(shape):
    x=min(x for x,y in shape);y=min(y for x,y in shape)
    return tuple(sorted((a-x,b-y) for a,b in shape))


def rotated(shape):return normalized([(-y,x) for x,y in shape])


class ExactMosaic(Puzzle):
    def setup(self):
        self.n=3 if self.level<2 else (4 if self.level<4 else 5)
        path=[(x if y%2==0 else self.n-1-x,y) for y in range(self.n) for x in range(self.n)]
        count=3+self.level
        chunks=[path[i*len(path)//count:(i+1)*len(path)//count] for i in range(count)]
        self.witness=chunks;self.pieces=[normalized(c) for c in chunks]
        self.shapes=[]
        for p in self.pieces:
            for _ in range(self.rng.randrange(4)):p=rotated(p)
            self.shapes.append(p)
        self.placed={};self.selected=0

    def click(self,x,y):
        for i in range(len(self.pieces)):
            if hit(x,y,(4+12*(i%4),36+7*(i//4),11,7)):
                self.selected=i;self.placed.pop(i,None);return
        if hit(x,y,(51,36,10,12)):
            self.shapes[self.selected]=rotated(self.shapes[self.selected]);self.placed.pop(self.selected,None);return
        a,b=(x-5)//6,(y-4)//6
        if not (5<=x<5+6*self.n and 4<=y<4+6*self.n):return
        cells={(a+dx,b+dy) for dx,dy in self.shapes[self.selected]}
        occupied=set().union(*(v for i,v in self.placed.items() if i!=self.selected)) if self.placed else set()
        if any(not(0<=xx<self.n and 0<=yy<self.n) for xx,yy in cells) or cells&occupied:
            self.trace.append((x,y,8));return
        self.placed[self.selected]=cells

    def commit(self):
        cells=set().union(*self.placed.values()) if self.placed else set()
        self.finish(cells=={(x,y) for y in range(self.n) for x in range(self.n)} and len(self.placed)==len(self.pieces))

    def draw(self):
        f=self.canvas();skin=self.level%4 if self.variant is None else self.variant
        for y in range(self.n):
            for x in range(self.n):border(f,5+6*x,4+6*y,6,6,3)
        for i,cells in self.placed.items():
            for x,y in cells:
                px,py=5+6*x,4+6*y
                rect(f,px+1,py+1,5,5,10 if i==self.selected else 1)
                if skin//2:glyph(f,px+2,py+2,i,5)
                else:rect(f,px+2,py+2,1,1,11)
        for i,shape in enumerate(self.shapes):
            x=4+12*(i%4);y=36+7*(i//4)
            border(f,x,y,11,7,11 if i==self.selected else 3)
            for a,b in shape:rect(f,x+1+a*2,y+1+b,1,1,10 if i not in self.placed else 2)
        border(f,51,36,10,12,10);arrow(f,55,41,10,1)
        return appearance(f,skin)


class Ex92(GameShell,ARCBaseGame):
    identifier='ex92';model_type=ExactMosaic
    def __init__(self,seed=0,variant=None):super().__init__(seed,variant)

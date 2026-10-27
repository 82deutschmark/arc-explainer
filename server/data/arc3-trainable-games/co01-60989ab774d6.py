# Author: GPT 6.1 Sol
# Date: 25-October-2026
# PURPOSE: co01 keyboard selection and activation of simultaneous-majority meetings.
#   Preserve the reviewed eight-stage majority puzzle and animal membership portraits;
#   show a persistent full-table focus so no pixel-precise click is required.
# SRP/DRY check: Pass - reuse the parent's meeting rule and portrait art; one transition
#   owns navigation, activation and undo. Shared sprite_book pixel_art is inlined.
# Parent: co01@5755bc2298b1. Targeted feedback revision; no difficulty certification claimed.
from collections import namedtuple
import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay, Sprite

LEVELS=[dict(name='Preserve two camps',people=8,fixed=(0,1),
             meetings=((0,4,5),(0,5,6),(1,2,5,6,7),(1,4,6),(3,6,7)),start=178,target=90),
        dict(name='Even tables can tie',people=8,fixed=(0,1),
             meetings=((0,3,4,5),(1,2,3),(2,3,5),(2,5,7),(3,6,7)),start=226,target=142),
        dict(name='One immovable voice',people=8,fixed=(0,),meetings=((0,6,7),(1,3,7),(1,4,5),(2,3,4),(3,5,6)),
             start=90,target=56),
        dict(name='Avoid an even split',people=8,fixed=(0,),meetings=((0,1,4,6),(1,2,7),(2,3,6),(2,4,5),(3,4,7)),
             start=201,target=243),
        dict(name='Large-table rescue',people=8,fixed=(0,),meetings=((0,1,2,4,7),(0,1,5,6),(0,2,3,5,7),(0,6,7),(1,2,6)),
             start=69,target=111),
        dict(name='Rescue the swing voters',people=8,fixed=(0,),meetings=((0,2,4),(1,2,4),(2,3,6),(2,5,7),(4,6,7)),
             start=69,target=163),
        dict(name='Second meeting board',people=8,fixed=(0,),
             meetings=((0,1,2,7),(1,2,5,6),(1,3,5),(0,3,4,6,7),(1,4,7),(2,3,7),(3,5,7)),
             start=34,target=178),
        dict(name='Whole council',people=8,fixed=(0,),
             meetings=((0,2,4,5,6),(1,2,3,4,5),(2,3,7),(4,5,7),(0,6,7),(1,4,5,6,7),(2,6,7),(3,5,6)),
             start=205,target=231)]
FACES=(('.w...w.','.w...w.','.wwwww.','wwkwkww','.wwpww.','..www..','..w.w..'),
       ('o.....o','oo...oo','.ooooo.','.okoko.','.oowoo.','..owo..','..ooo..'),
       ('rr...rr','rrwwwrr','.rwwwr.','.wkwkw.','.wwkww.','..www..','..w.w..'),
       ('v.....v','.vvvvv.','.vwvwv.','.vkvkv.','.vvyvv.','..vvv..','..v.v..'),
       ('.g...g.','gwg.gwg','gkg.gkg','.ggggg.','.ggkgg.','..ggg..','.g...g.'),
       ('.ss.ss.','sssssss','.sssss.','.sksks.','.sswss.','..sks..','..sss..'),
       ('...yy..','..yyyy.','..ykyy.','..yyyyy','bbyyyy.','.byyy..','..k.k..'),
       ('kk...kk','.kwwwk.','wwkwkww','.wwwww.','.wwkww.','..www..','..k.k..'))
FACE_COLORS={'.':-1,'w':0,'k':5,'p':7,'o':12,'r':13,'v':15,'y':11,'g':14,'s':2,'b':9}

State = namedtuple('State', 'votes history active pulse focus pan changed')


def pixel_art(rows, colours):
    """Shared sprite_book stencil decoder, inlined for the single-file browser build."""
    return [[-1 if ch == '.' else colours[ch] for ch in row] for row in rows]


def meeting(votes, members, fixed):
    """All non-fixed members take the pre-meeting majority; an exact tie changes nothing."""
    ones = sum((votes >> person) & 1 for person in members)
    if ones * 2 == len(members):
        return votes
    opinion = ones * 2 > len(members)
    result = votes
    for person in members:
        if person not in fixed:
            result = (result | (1 << person)) if opinion else (result & ~(1 << person))
    return result


def initial(spec):
    return State(spec['start'], (), None, 0, 0, 0, 0)


def visible_meetings(spec, pan):
    count = len(spec['meetings'])
    if count <= 5:
        return list(range(count))
    start = 0 if pan == 0 else count - 4
    return list(range(start, start + 4))


def meeting_centers(spec, pan):
    return {index: (21, 7 + 12 * local)
            for local, index in enumerate(visible_meetings(spec, pan))}


def transition(spec, state, action):
    """Arrow keys select, Space convenes, X restores the last changed vote state.

    Up/Down move by one table. Left/Right move to the near/far board, preserving
    the row on a two-board level, or to the first/last table on a single board.
    Every selection is shown before a majority can change: navigation never votes.
    """
    state = state._replace(pulse=1 - state.pulse, changed=0)
    count = len(spec['meetings'])
    if action in (1, 2, 3, 4):
        focus = state.focus
        if action == 1:
            focus = max(0, focus - 1)
        elif action == 2:
            focus = min(count - 1, focus + 1)
        elif count <= 5:
            focus = 0 if action == 3 else count - 1
        else:
            visible = visible_meetings(spec, state.pan)
            local = visible.index(focus)
            focus = local if action == 3 else count - 4 + local
        pan = state.pan
        if count > 5:
            if action in (3, 4):
                pan = 0 if action == 3 else 1
            elif focus < count - 4:
                pan = 0
            elif focus > 3:
                pan = 1
        return state._replace(focus=focus, pan=pan, active=None)
    if action == 7:
        if not state.history:
            return state._replace(active=None)
        previous = state.history[-1]
        return state._replace(votes=previous, history=state.history[:-1],
                              active=None, changed=state.votes ^ previous)
    if action == 5:
        after = meeting(state.votes, spec['meetings'][state.focus], spec['fixed'])
        history = state.history + (state.votes,) if after != state.votes else state.history
        return state._replace(votes=after, active=state.focus, history=history,
                              changed=state.votes ^ after)
    return state


def portrait(person, opinion, fixed=False, changed=False):
    pixels = np.full((11, 9), -1, dtype=np.int8)
    pixels[:8, :] = 4
    pixels[:7, 1:8] = np.array(pixel_art(FACES[person], FACE_COLORS), dtype=np.int8)
    pixels[8:11, 1:8] = 12 if opinion else 9
    if opinion:
        pixels[9, 2:7] = 0
    else:
        pixels[8:11, 4] = 0
    if fixed:
        pixels[:8, 0] = pixels[:8, 8] = pixels[7, :] = 11
    if changed:
        pixels[8:11, 0] = pixels[8:11, 8] = pixels[7, 1:8] = 14
    return pixels


def objects(spec, state):
    sprites = []
    for local, table in enumerate(visible_meetings(spec, state.pan)):
        members = spec['meetings'][table]
        offset = (45 - len(members) * 9) // 2
        for seat, person in enumerate(members):
            sprites.append(Sprite(
                portrait(person, (state.votes >> person) & 1, person in spec['fixed'],
                         bool((state.changed >> person) & 1)),
                name=f'table-{table}-voter-{person}', x=offset + seat * 9, y=1 + local * 12,
                tags=['voter', f'person-{person}', f'meeting-{table}'], layer=2))
    for person in range(spec['people']):
        sprites.append(Sprite(
            portrait(person, (spec['target'] >> person) & 1, person in spec['fixed']),
            name=f'target-voter-{person}', x=46 + (person % 2) * 9, y=20 + (person // 2) * 11,
            tags=['target-flag', f'person-{person}'], layer=2))
    return sprites


class CouncilDisplay(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        image = np.full((64, 64), 5, dtype=np.int8)
        state = self.game.council
        spec = LEVELS[self.game.level_index]
        image[:, 45:64] = 0
        selected = set(spec['meetings'][state.focus])
        for index, (x, y) in meeting_centers(spec, state.pan).items():
            # The entire table is the target, not a tiny glyph or click marker.
            image[y-6:y+6, 0:44] = 11 if state.focus == index else 3
            image[y-5:y+5, 1:43] = 12 if state.active == index else 1
            if state.focus == index:
                image[y-4:y+4, 0] = image[y-4:y+4, 43] = 0 if state.pulse else 11
        # A matching pair of opinion pennants above the desired portraits makes
        # the right-hand group read as the arrangement to reproduce, without text.
        image[3:10, 48:54] = 9
        image[3:10, 56:62] = 12
        image[3:10, 50:52] = 0
        image[6:8, 57:61] = 0
        if len(spec['meetings']) > 5:
            # Two physical shelves show which board is open, without arrow icons.
            image[51:63, 3:21] = 11 if state.pan == 0 else 3
            image[51:63, 24:42] = 11 if state.pan == 1 else 3
            for slot in range(4):
                image[54+slot*2:55+slot*2, 6:18] = 5
                image[54+slot*2:55+slot*2, 27:39] = 5
        for sprite in self.game.current_level.get_sprites():
            pixels = sprite.render()
            for row, column in zip(*np.where(pixels >= 0)):
                image[sprite.y + row, sprite.x + column] = pixels[row, column]
        # Membership marks beside the target portraits follow selection; green
        # lower rims follow actual changed opinions in every repeated portrait.
        for person in selected:
            x, y = 46 + (person % 2) * 9, 20 + (person // 2) * 11
            image[y:y+2, x:x+2] = 11
        return image


class Co01(ARCBaseGame):
    def __init__(self):
        self.council = initial(LEVELS[0])
        self.display = CouncilDisplay(self)
        levels = [Level(sprites=[], grid_size=(64, 64), data={'index': index}, name='co01')
                  for index, spec in enumerate(LEVELS)]
        super().__init__('co01', levels, Camera(0, 0, 64, 64, 1, 1, [self.display]),
                         False, len(levels), [1, 2, 3, 4, 5, 7])

    def on_set_level(self, level):
        self.council = initial(LEVELS[level.get_data('index')])
        self.sync_objects(level)

    def sync_objects(self, level):
        level.remove_all_sprites()
        for sprite in objects(LEVELS[level.get_data('index')], self.council):
            level.add_sprite(sprite)

    def step(self):
        if self.action.id.value == 0:
            self.complete_action()
            return
        spec = LEVELS[self.level_index]
        self.council = transition(spec, self.council, self.action.id.value)
        self.sync_objects(self.current_level)
        if self.council.votes == spec['target']:
            self.next_level()
        self.complete_action()

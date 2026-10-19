/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: Single source of truth for the ARC-AGI-2 "hard set": the public-eval puzzles that no
 *          logged model attempt has solved, or that only one or two attempts have solved. Holds the
 *          solve-count threshold and bucket names the server endpoint and the /arc2/hard-set page
 *          share, plus the Boss-requested plain-language solve notes written by Dr. Fable 5.1 with the
 *          answers in hand. Each note says how sure it is: 'checked' means the rule was coded and
 *          reproduces every train and test pair; 'read' means worked out by eye from the answers;
 *          'partial' means the rule could not be pinned down even with the answers. The synthetic-data
 *          plan (docs/2026-10-19-arc2-hard-set-synthetic-data-plan.md) reads these notes, so keep the
 *          wording honest: nothing here is an answer key the models were denied.
 *          19-Oct-2026, Claude Opus 5.5 Medium: the spiral note is now 'checked' (a coded rule reproduces every
 *          pair; it adds the corner step the first note missed), repair-the-lines, marble corridors and jigsaw are
 *          'checked' (coded rules reproduce every pair; each note gained the detail the first one missed), and the leaky-boxes note is 'partial' (leaks
 *          bend where they meet, which the first note missed). Both found while building the generators.
 * SRP/DRY check: Pass — mirrors shared/featuredPuzzles.ts (standalone constants, no dependencies);
 *                the server computes membership from the database, this file only names the buckets.
 */

/** A puzzle belongs to the hard set when at most this many logged attempts solved it. */
export const ARC2_HARD_SET_MAX_SOLVES = 2;

export type Arc2HardSetBucket = 'never' | 'once' | 'twice';

export const ARC2_HARD_SET_BUCKET_LABELS: Record<Arc2HardSetBucket, string> = {
  never: 'Never solved',
  once: 'Solved once',
  twice: 'Solved twice',
};

/** Map a solved-attempt count onto a bucket, or null when the puzzle is outside the hard set. */
export function bucketForSolves(solved: number): Arc2HardSetBucket | null {
  if (!Number.isInteger(solved) || solved < 0) return null;
  if (solved === 0) return 'never';
  if (solved === 1) return 'once';
  if (solved <= ARC2_HARD_SET_MAX_SOLVES) return 'twice';
  return null;
}

export type Arc2HardSetNoteConfidence = 'checked' | 'read' | 'partial';

export interface Arc2HardSetNote {
  id: string;
  /** Plain nickname so humans can talk about the puzzle without the hex id. */
  nickname: string;
  confidence: Arc2HardSetNoteConfidence;
  /** Five to ten plain sentences a child could follow; no grid coordinates, no jargon. */
  bullets: string[];
  /** What the recorded model reasoning shows going wrong, when the records make it clear. */
  whereModelsBreak?: string;
}

export const ARC2_HARD_SET_CONFIDENCE_LABELS: Record<Arc2HardSetNoteConfidence, string> = {
  checked: 'Rule coded and reproduces every pair',
  read: 'Worked out by eye from the answers',
  partial: 'Could not pin down, even with the answers',
};

export const ARC2_HARD_SET_NOTES: Record<string, Arc2HardSetNote> = {
  '13e47133': {
    id: '13e47133',
    nickname: 'Onion rooms',
    confidence: 'checked',
    bullets: [
      'The thick lines cut the picture into rooms, like the walls of a house.',
      'Each room has one or two colored dots in it and is otherwise plain.',
      'Paint every room in rings, like an onion: an outside ring, then a ring inside that, and so on to the middle.',
      'The dots tell you the ring colors. A dot sitting right against the wall is the color of the outside ring. A dot one step in is the color of the next ring.',
      'If a ring has no dot of its own before you reach the deepest dot, that ring stays the plain color.',
      'When you run out of dot colors, start the list over from the first color and keep going inward.',
      'The walls themselves do not change.',
    ],
    whereModelsBreak:
      'The models find the rings and the dots. Then they decide the deepest dot color continues all the way to the middle, instead of starting the color list again. Gemini 3 Deep Think wrote exactly that rule down and acted on it.',
  },
  '269e22fb': {
    id: '269e22fb',
    nickname: 'Torn picture',
    confidence: 'checked',
    bullets: [
      'There is one secret big picture, twenty squares by twenty, drawn in two colors. It is the same picture in every example.',
      'Each input is a piece torn off that picture. You never see the whole thing in the input.',
      'Find where the piece belongs. The piece is never turned or flipped; the big picture is the thing that gets turned or flipped so the piece fits.',
      'Draw the whole big picture the way it must be turned so the piece sits in it exactly as given.',
      'Use the piece\'s two colors for the whole picture: the piece\'s main color is the picture\'s main color.',
    ],
    whereModelsBreak:
      'No model notices that every example draws the same picture. Each one looks for a rule inside a single example, such as tiling the piece or sliding it by half, and invents one. Gemini 3 Deep Think built a half-shift tiling rule from one example and applied it.',
  },
  '88e364bc': {
    id: '88e364bc',
    nickname: 'Marble maze',
    confidence: 'checked',
    bullets: [
      'Each big closed shape is a room, and the yellow squares inside it are marbles.',
      'In the corner of the picture, each room color has a little square sign with an arrow drawn in it. The arrow head is the red square; the other color is the tail.',
      'The sign says which way the marbles in that color\'s room roll: straight, or on a slant.',
      'Every marble rolls that way until it is stopped.',
      'A marble stops when the next square is a wall. On a slant it also stops when it would have to squeeze past the corner of a wall. It cannot slip through a corner gap.',
      'Everything else stays exactly where it was.',
    ],
    whereModelsBreak:
      'Claude Opus 4.8 and Gemini 3 Deep Think both found the arrow signs, both traced every marble, and both let one marble slip diagonally past a wall corner. That single marble made every answer wrong. The rule they wrote is right; the physics is what they missed.',
  },
  'abc82100': {
    id: 'abc82100',
    nickname: 'Color keys',
    confidence: 'partial',
    bullets: [
      'The picture has a few little keys: a short line or a cross of colors, often with a grey square in it.',
      'Each key says that one color becomes another color.',
      'The scattered dots of a color are repainted in the new color and spread out into a checkerboard spray around where they were.',
      'The keys themselves disappear.',
      'Honest note: I had the answer in front of me and could only get the repainting and the checkerboard look. I could not pin down how far each spray spreads or which way it goes. I would not trust my rule to make new puzzles of this one.',
    ],
    whereModelsBreak:
      'Gemini 3 Deep Think spent its whole answer arguing with itself about checkerboard parity, square by square, and never settled. The reasoning records are a loop of recounts.',
  },
  '8b7bacbf': {
    id: '8b7bacbf',
    nickname: 'Fill the chain',
    confidence: 'partial',
    bullets: [
      'Find the one-of-a-kind squares: a color that appears exactly once. Each is a paint marker.',
      'Each marker sits at the end of a long winding line.',
      'The line runs along and touches hollow shapes: diamonds and boxes. Shapes can also touch each other, making a chain.',
      'Every hollow shape linked to a marker\'s line, directly or through the chain, gets its inside filled with that marker\'s color.',
      'Shapes not linked to any marker stay hollow.',
      'Honest note: this rule fills the right shapes in four of the six pairs and is off by one shape in the other two, so what counts as linked when two shapes only touch at a corner is the part I am not sure of.',
    ],
    whereModelsBreak:
      'The models get the fill idea and then decide which shapes are linked by eye: Gemini 3 Deep Think split the test grid into a left half and a right half and gave each half a marker. The chain has to be traced; halves are a guess.',
  },
  'da515329': {
    id: 'da515329',
    nickname: 'Spiral',
    confidence: 'checked',
    bullets: [
      'The only thing in the picture is a small plus sign.',
      'Each of the four arms of the plus is the start of a line.',
      'All four lines turn the same way, like the hands of a clock, and wind outward until they run off the picture.',
      'Every time a line turns a corner, it takes a tiny step sideways, as long as the plus arm minus two, then carries on. When the plus arms are two long the step is zero; when they are one long there is no step at all.',
      'The lines never touch: there is always one empty square between them.',
      'The middle of the plus stays empty.',
    ],
    whereModelsBreak:
      'The models say "spiral" readily and then cannot draw one that long without drifting by a square somewhere. Part of that drift is the little sideways step at each corner: a plain square spiral is already wrong at the first corner, and one missed step shifts everything after it.',
  },
  '9bbf930d': {
    id: '9bbf930d',
    nickname: 'Marble corridors',
    confidence: 'checked',
    bullets: [
      'Colored bars stack top to bottom, with a plain corridor between every two bars.',
      'Each row starts with a marker at the far left, like a marble waiting at a gate.',
      'Look at the two bars on either side of a corridor. If they are the same color, that corridor\'s marble is released.',
      'A released marble rolls right along the corridor. When something blocks it, it turns to the one side that is open and keeps rolling.',
      'It stops at the edge of the picture, or where both sides or neither side are open.',
      'It also stops when it is blocked while rolling up or down inside a corridor whose marble was not released.',
      'Corridors between two different-colored bars keep their marble at the gate.',
    ],
    whereModelsBreak:
      'Claude Opus 4.8 solved it by writing the release rule and then tracing each marble\'s turns one square at a time. Other attempts state the same rule and lose a marble on a turn.',
  },
  'e12f9a14': {
    id: 'e12f9a14',
    nickname: 'Leaky boxes',
    confidence: 'partial',
    bullets: [
      'Each box has a colored middle and a dark frame around it.',
      'Somewhere the frame has a hole: a frame square that is missing.',
      'The middle color leaks out through the hole in a line toward the edge of the picture.',
      'A hole in the side of the frame leaks straight out. A hole at a corner leaks out on the diagonal.',
      'The hole square itself takes the middle color too.',
      'Honest note: the leaks do not always run straight to the edge. Where two leaks would run into each other they bend and travel side by side. I could not pin down exactly when and how they bend.',
    ],
  },
  '88bcf3b4': {
    id: '88bcf3b4',
    nickname: 'Swing the tail',
    confidence: 'partial',
    bullets: [
      'There is a straight stick with a crooked tail attached to one end, and somewhere else a little shape.',
      'The tail swings to the other end of the stick and points the opposite way.',
      'If the little shape is nearby, the tail wraps around it, hugging it with one square of air in between.',
      'The old tail is erased.',
      'Honest note: the swing to the other end is clear in every example. The exact bends of the new tail when there is nothing nearby to hug are the part I could not pin down.',
    ],
  },
  'd35bdbdc': {
    id: 'd35bdbdc',
    nickname: 'Boxes eat boxes',
    confidence: 'partial',
    bullets: [
      'Each little box has a frame color and a different middle color.',
      'A box\'s middle color is the name of another box: the one whose frame is that color.',
      'A box eats the box it names. It takes that box\'s middle color, and the eaten box disappears.',
      'A box that names a color no box has just disappears.',
      'The grey wire winding between the boxes seems to decide who eats whom when two boxes could eat each other.',
      'Honest note: ignoring the wire, this gets two of the three training examples right and the third wrong. I could not read what the wire says.',
    ],
  },
  '5545f144': {
    id: '5545f144',
    nickname: 'Dot panels',
    confidence: 'partial',
    bullets: [
      'Upright lines split the picture into equal panels, and each panel holds a scatter of dots.',
      'The answer is one panel wide and nearly empty: a single small shape made of a few dots.',
      'Honest note: I could not work out how that small shape is chosen. It is not where the panels overlap, and it is not any one panel. I would not trust myself to make new puzzles of this one.',
    ],
  },
  '7b80bb43': {
    id: '7b80bb43',
    nickname: 'Repair the lines',
    confidence: 'checked',
    bullets: [
      'Long straight lines run across the picture, and some have a chunk of three squares missing.',
      'A broken line gets fixed only when its broken-off piece is still hanging from it: two squares on a slant, starting at one end of the gap and leaning toward the gap.',
      'Fill that gap so the line is whole again.',
      'Sweep away every loose slanted piece, including ones hanging from a line that is not broken there.',
      'A gap with no piece hanging from it stays open, and so does a gap where two lines cross.',
      'A short stub poking out of a line is still part of a line when the same line carries on after a gap.',
    ],
  },
  'a32d8b75': {
    id: 'a32d8b75',
    nickname: 'Wallpaper stamps',
    confidence: 'partial',
    bullets: [
      'The strip on the left is a legend: a few small stamps, each in its own color, with a tiny key at the bottom.',
      'The big area on the right is split into large zones of flat color.',
      'Each zone gets covered with one of the stamps, repeated over and over like wallpaper.',
      'The little key says which stamp goes where and in which colors.',
      'The legend strip is cut off the answer.',
      'Honest note: which stamp goes in which zone, and how the pattern lines up, is the part I could not pin down.',
    ],
  },
  '21897d95': {
    id: '21897d95',
    nickname: 'Pass the color along',
    confidence: 'partial',
    bullets: [
      'The picture is a few big patches of color, with small arrow marks inside some of them.',
      'The whole picture is turned a quarter turn.',
      'Each patch takes a new color: the color of the patch its arrow points toward.',
      'Honest note: I got the turn and the hand-over idea but could not nail which way "toward" is once the picture has turned.',
    ],
  },
  'faa9f03d': {
    id: 'faa9f03d',
    nickname: 'Roads',
    confidence: 'partial',
    bullets: [
      'The colored lines are roads with ends and crossings.',
      'A red square marks a broken spot. The road grows to fix it and the red square disappears.',
      'Where two roads cross, the one that runs straight through is the one that keeps its color.',
      'Honest note: which road wins at a crossing is what I could not pin down.',
    ],
  },
  '195c6913': {
    id: '195c6913',
    nickname: 'Follow the trail',
    confidence: 'read',
    bullets: [
      'A short recipe sits in the top-left corner: a few colors in order.',
      'A big blob covers much of the picture, and a trail runs across the blob to a marker.',
      'Walk the trail from its start, painting as you go, repeating the recipe color by color.',
      'The recipe in the corner is cleared away.',
      'Honest note: where the trail starts and which way it turns at the edge of the blob is the part I am unsure of.',
    ],
  },
  '446ef5d2': {
    id: '446ef5d2',
    nickname: 'Jigsaw',
    confidence: 'checked',
    bullets: [
      'A framed picture was cut into rectangle pieces, and the pieces were scattered around.',
      'One piece has a little three-square corner mark next to it. That piece has not moved.',
      'Put the other pieces back around it so the frame color runs all the way around the outside.',
      'If the pieces fit together in more than one way, pick the way where the lines inside the picture carry on smoothly from piece to piece.',
      'Pieces that touch each other in the scattered picture are still separate rectangles.',
      'Draw the finished picture once and clear the scattered pieces away.',
    ],
  },
  '2b83f449': {
    id: '2b83f449',
    nickname: 'Strike through',
    confidence: 'partial',
    bullets: [
      'Rows alternate: a solid row with a green square at each end, then a row with little three-square bars.',
      'Each bar becomes grey-pink-grey, and the pink goes straight up and down through its middle square into the solid rows above and below.',
      'The green end-caps move: in the answer they appear only on certain rows.',
      'Honest note: which rows keep their green end-caps is the part I could not pin down.',
    ],
  },
};

export function getArc2HardSetNote(puzzleId: string): Arc2HardSetNote | undefined {
  return ARC2_HARD_SET_NOTES[puzzleId];
}

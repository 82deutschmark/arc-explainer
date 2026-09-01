/*
Author: Claude Opus 5
Date: 2026-09-01
PURPOSE: The ARC-AGI-3 handheld console shell, reproducing arcprize.org/tasks/<id>.
         A moulded body, an inset CRT screen with scanlines, a d-pad, and two columns
         of labelled controls (SPACEBAR / CLICK / UNDO, RESET / HELP / SELECT).

         THE BODY COLOUR IS DRAWN PER GAME (01-Sep). It was pink on every task, which
         made the device look like part of the page rather than a thing you were handed.
         Each game now gets one of nine colourways, none of which is an ARC-3 board
         colour -- see SHELLS for how far apart they are kept and why saturation rather
         than hue is what does the keeping.

         WHY IT IS A CONSOLE AND NOT A PAGE. The previous player rendered the board as a
         big canvas and told the player to "click the board to act". That is not what
         ACTION6 means. In q598-v1, ACTION6 is a submit -- you build a command with the
         arrows and ACTION6 declares you are done, so pressing it early calls lose().
         A player who clicks the board to see what happens is dead on move one, which is
         exactly what was reported. On arcprize.org, ACTION6 is a labelled CLICK button
         among other buttons: a control you press on purpose, never a canvas you poke.
         Reproducing the console reproduces that distinction, which is why this is a
         faithfulness exercise rather than decoration.

         The body is fixed-width and scales down on small screens, because the reported
         version was "slightly too large" -- an ARC console is a device on a page, not a
         full-bleed app.
SRP/DRY check: Pass -- presentation only. No game state, no execution, no telemetry;
         every control is a callback the play page supplies, and disabled state is
         computed there from available_actions.
*/

import React from 'react';

export interface ConsoleButton {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Dimmed to near-invisible rather than hidden: the official console keeps its
   *  full control layout on every task, so the panel does not reflow per game. */
  unavailable?: boolean;
  active?: boolean;
}

const SCREEN_BG = '#0B0B0B';

/** The six surfaces of a moulded shell, all derived from one hue. */
interface ShellColors {
  body: string;
  bodyDark: string;
  bodyLight: string;
  bezel: string;
  pill: string;
  pillDark: string;
}

/**
 * Hue and saturation of each colourway. The lightness/saturation offsets that turn a
 * pair into a shell are fixed (see `shellColors`), and were read back off the original
 * pink body so `rose` reproduces it to within a rounding step.
 *
 * WHY THESE HUES AND NOT ANY OTHERS. The shell must never be mistaken for a cell of the
 * board, so every entry is checked against all 16 ARC-3 colours in CIELab: the closest
 * approach any surface makes to any board colour is dE 15, and that is `rose`'s pill
 * against light pink, which is the pairing that has been on screen all along. What keeps
 * them apart is not hue but saturation -- board colours are vivid (S 90-100%), moulded
 * plastic is not -- so no colourway goes above S 52, and the pill step must not push a
 * warm hue back up toward orange.
 */
const SHELLS: ReadonlyArray<{ name: string; hue: number; sat: number }> = [
  { name: 'rose', hue: 328, sat: 52 },
  { name: 'teal', hue: 172, sat: 42 },
  { name: 'indigo', hue: 244, sat: 40 },
  { name: 'moss', hue: 78, sat: 34 },
  { name: 'clay', hue: 18, sat: 30 },
  { name: 'plum', hue: 296, sat: 32 },
  { name: 'sand', hue: 42, sat: 28 },
  { name: 'slate', hue: 218, sat: 30 },
  { name: 'seafoam', hue: 150, sat: 36 },
];

function shellColors(hue: number, sat: number): ShellColors {
  const tone = (dSat: number, light: number) =>
    `hsl(${hue} ${Math.max(0, sat + dSat)}% ${light}%)`;
  return {
    bodyLight: tone(9, 69),
    body: tone(0, 56),
    bodyDark: tone(-5, 44),
    bezel: tone(-2, 37),
    pill: tone(10, 60),
    pillDark: tone(-7, 45),
  };
}

/** The colourway the last console took, so two loads in a row never look the same. */
let lastShellIndex = -1;

function nextShell(): ShellColors {
  let index = Math.floor(Math.random() * SHELLS.length);
  if (index === lastShellIndex) index = (index + 1) % SHELLS.length;
  lastShellIndex = index;
  const shell = SHELLS[index] ?? SHELLS[0];
  return shellColors(shell.hue, shell.sat);
}

/** A d-pad key: dark round moulded button with a light glyph. */
function DPadKey({ button, glyph, className }: {
  button?: ConsoleButton;
  glyph: string;
  className?: string;
}) {
  const dead = !button || button.disabled || button.unavailable;
  return (
    <button
      type="button"
      onClick={() => button?.onPress()}
      disabled={dead}
      aria-label={button?.label ?? glyph}
      className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-[13px] transition-transform active:translate-y-[1px] ${className ?? ''}`}
      style={{
        background: 'linear-gradient(#3A3A3A, #1C1C1C)',
        boxShadow: dead ? 'none' : '0 2px 0 rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12)',
        color: dead ? 'rgba(255,255,255,.22)' : '#EDEDED',
        cursor: dead ? 'default' : 'pointer',
        opacity: button?.unavailable ? 0.35 : 1,
      }}
    >
      {glyph}
    </button>
  );
}

/** A labelled pill control: text on the left, moulded pill on the right. */
function PillRow({ button, tone, shell }: {
  button?: ConsoleButton;
  tone: 'dark' | 'shell';
  shell: ShellColors;
}) {
  const dead = !button || button.disabled || button.unavailable;
  return (
    <div className="flex items-center justify-end gap-2" style={{ opacity: button?.unavailable ? 0.4 : 1 }}>
      <span
        className="text-[9.5px] tracking-[0.5px] uppercase select-none"
        style={{ color: dead ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.92)' }}
      >
        {button?.label ?? ''}
      </span>
      <button
        type="button"
        onClick={() => button?.onPress()}
        disabled={dead}
        aria-label={button?.label}
        className="w-[42px] h-[17px] rounded-full transition-transform active:translate-y-[1px] shrink-0"
        style={{
          background: button?.active
            ? '#FFF'
            : tone === 'shell'
              ? `linear-gradient(${shell.pill}, ${shell.pillDark})`
              : 'linear-gradient(#3E3E3E, #232323)',
          boxShadow: dead ? 'none' : '0 2px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.15)',
          cursor: dead ? 'default' : 'pointer',
        }}
      />
    </div>
  );
}

export function Arc3Console({
  gameId,
  levelLabel,
  screen,
  up, down, left, right,
  spacebar, click, undo,
  reset, help, select,
}: {
  gameId: string;
  levelLabel: string;
  screen: React.ReactNode;
  up?: ConsoleButton; down?: ConsoleButton; left?: ConsoleButton; right?: ConsoleButton;
  spacebar?: ConsoleButton; click?: ConsoleButton; undo?: ConsoleButton;
  reset?: ConsoleButton; help?: ConsoleButton; select?: ConsoleButton;
}) {
  // One colourway per game loaded, held in a ref rather than derived each render: the
  // shell must not change colour underneath a player part way through a task, and it
  // must not change when the level readout does. Keyed on the game id because the play
  // route keeps this component mounted when "Next task" swaps the game.
  const held = React.useRef<{ gameId: string; colors: ShellColors } | null>(null);
  if (!held.current || held.current.gameId !== gameId) {
    held.current = { gameId, colors: nextShell() };
  }
  const shell = held.current.colors;

  return (
    <div
      className="w-full max-w-[500px] mx-auto rounded-[26px] p-[14px]"
      style={{
        background: `linear-gradient(160deg, ${shell.bodyLight} 0%, ${shell.body} 26%, ${shell.bodyDark} 100%)`,
        boxShadow: '0 18px 44px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.35)',
      }}
    >
      {/* Top row: task id, and the level readout — the only two things the official
          console puts above the screen, and neither names the game. */}
      <div className="flex items-center justify-between mb-[10px] px-[2px]">
        <span
          className="px-2.5 h-[22px] inline-flex items-center rounded-[6px] text-[11px]"
          style={{ background: 'rgba(0,0,0,.30)', color: '#FFF', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}
        >
          {gameId}
        </span>
        <span
          className="px-2.5 h-[22px] inline-flex items-center rounded-[6px] text-[10px] tracking-[0.5px] uppercase"
          style={{ background: 'rgba(0,0,0,.30)', color: '#FFF', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}
        >
          {levelLabel}
        </span>
      </div>

      {/* Screen bezel */}
      <div
        className="rounded-[14px] p-[9px]"
        style={{ background: shell.bezel, boxShadow: 'inset 0 2px 6px rgba(0,0,0,.5)' }}
      >
        <div
          className="relative rounded-[9px] overflow-hidden aspect-square"
          style={{ background: SCREEN_BG, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' }}
        >
          {screen}
          {/* CRT scanlines, as on the official task screen. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.16) 2px 4px)',
            }}
          />
        </div>
      </div>

      {/* Control deck */}
      <div className="flex items-center gap-4 mt-[14px] px-[6px] pb-[2px]">
        {/* D-pad */}
        <div className="grid grid-cols-3 grid-rows-3 gap-[3px] shrink-0">
          <span />
          <DPadKey button={up} glyph="▲" />
          <span />
          <DPadKey button={left} glyph="◀" />
          <span />
          <DPadKey button={right} glyph="▶" />
          <span />
          <DPadKey button={down} glyph="▼" />
          <span />
        </div>

        {/* Action pills */}
        <div className="flex flex-col gap-[7px] flex-1 min-w-0">
          <PillRow button={spacebar} tone="dark" shell={shell} />
          <PillRow button={click} tone="dark" shell={shell} />
          <PillRow button={undo} tone="dark" shell={shell} />
        </div>

        {/* System pills */}
        <div className="flex flex-col gap-[7px] shrink-0">
          <PillRow button={reset} tone="shell" shell={shell} />
          <PillRow button={help} tone="shell" shell={shell} />
          <PillRow button={select} tone="shell" shell={shell} />
        </div>
      </div>
    </div>
  );
}

/*
Author: Claude Opus 5
Date: 2026-08-31
PURPOSE: The ARC-AGI-3 handheld console shell, reproducing arcprize.org/tasks/<id>.
         A pink moulded body, an inset CRT screen with scanlines, a d-pad, and two
         columns of labelled controls (SPACEBAR / CLICK / UNDO, RESET / HELP / SELECT).

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

const PINK = {
  body: '#C95391',
  bodyDark: '#A63C74',
  bodyLight: '#E07FB4',
  bezel: '#8E2F62',
  pill: '#D95BA0',
  pillDark: '#A83F79',
};

const SCREEN_BG = '#0B0B0B';

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
function PillRow({ button, tone }: { button?: ConsoleButton; tone: 'dark' | 'pink' }) {
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
            : tone === 'pink'
              ? `linear-gradient(${PINK.pill}, ${PINK.pillDark})`
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
  return (
    <div
      className="w-full max-w-[500px] mx-auto rounded-[26px] p-[14px]"
      style={{
        background: `linear-gradient(160deg, ${PINK.bodyLight} 0%, ${PINK.body} 26%, ${PINK.bodyDark} 100%)`,
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
        style={{ background: PINK.bezel, boxShadow: 'inset 0 2px 6px rgba(0,0,0,.5)' }}
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
          <PillRow button={spacebar} tone="dark" />
          <PillRow button={click} tone="dark" />
          <PillRow button={undo} tone="dark" />
        </div>

        {/* System pills */}
        <div className="flex flex-col gap-[7px] shrink-0">
          <PillRow button={reset} tone="pink" />
          <PillRow button={help} tone="pink" />
          <PillRow button={select} tone="pink" />
        </div>
      </div>
    </div>
  );
}

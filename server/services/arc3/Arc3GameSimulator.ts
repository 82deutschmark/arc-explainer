/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: Deterministic mini-game simulator inspired by ARC-AGI-3 to power the playground agent workflow.
SRP/DRY check: Pass — encapsulates game state, rule processing, and snapshot recording separate from transport logic.
*/

import {
  ARC3_SIMPLE_ACTIONS,
  Arc3Action,
  Arc3FrameSnapshot,
  Arc3GameState,
  Arc3RunSummary,
  Arc3ScenarioDefinition,
  Arc3SimpleActionId,
} from './types';

interface Arc3InspectionPayload {
  state: Arc3GameState;
  score: number;
  stepsTaken: number;
  remainingSteps: number;
  simpleActionsAvailable: Arc3SimpleActionId[];
  coordinateGuesses: number;
  scenario: Pick<Arc3ScenarioDefinition, 'id' | 'name' | 'description' | 'legend'>;
  board: number[][];
  note?: string;
}

const MAX_STEPS = 24;

const DEFAULT_SCENARIOS: Arc3ScenarioDefinition[] = [
  {
    id: 'color-hunt-alpha',
    name: 'Color Hunt Alpha',
    description:
      'A shimmering lattice hides a single energized node. Use the scanners to isolate its row, column, and local neighborhood before committing to a coordinate action.',
    target: { x: 4, y: 4 },
    baseGrid: [
      [0, 0, 1, 1, 1, 0, 0, 0],
      [0, 1, 2, 2, 2, 1, 1, 0],
      [0, 1, 3, 3, 2, 1, 1, 0],
      [0, 1, 3, 4, 3, 1, 1, 0],
      [0, 1, 2, 3, 2, 1, 1, 0],
      [0, 1, 2, 2, 2, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    textHint:
      'The energized node sits where the warmest diagonal intersects the brightest column. Observe the gradient as you activate scanners.',
    legend: {
      0: 'Void',
      1: 'Low-energy lattice',
      2: 'Warm flux',
      3: 'Hot flux',
      4: 'Energized core candidate',
      5: 'Row scanner highlight',
      6: 'Column scanner highlight',
      7: 'Quadrant triangulation',
      8: 'Stabilized target',
      9: 'Spent probe',
    },
  },
  {
    id: 'color-hunt-beta',
    name: 'Color Hunt Beta',
    description:
      'A cooler lattice hides the node at the overlap of a vertical coolant vein and a diagonal charge line.',
    target: { x: 2, y: 5 },
    baseGrid: [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 1, 2, 2, 1, 0, 0, 0],
      [0, 1, 2, 3, 2, 1, 0, 0],
      [0, 0, 1, 2, 3, 2, 1, 0],
      [0, 0, 0, 1, 2, 2, 1, 0],
      [0, 1, 2, 2, 2, 1, 0, 0],
      [0, 1, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    textHint:
      'The coolant vein glows softly in one column. The energized node aligns with the only diagonal that brightens as it descends.',
    legend: {
      0: 'Void',
      1: 'Cool lattice',
      2: 'Warm resonance',
      3: 'Hot resonance',
      4: 'Core candidate',
      5: 'Row scanner highlight',
      6: 'Column scanner highlight',
      7: 'Quadrant triangulation',
      8: 'Stabilized target',
      9: 'Spent probe',
    },
  },
];

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

export class Arc3GameSimulator {
  private scenarioIndex = 0;
  private scenario: Arc3ScenarioDefinition;
  private board: number[][] = [];
  private state: Arc3GameState = 'NOT_STARTED';
  private score = 0;
  private steps = 0;
  private history: Arc3FrameSnapshot[] = [];
  private readonly maxSteps = MAX_STEPS;
  private readonly simpleActionsUsed = new Set<Arc3SimpleActionId>();
  private coordinateGuesses = 0;

  constructor(private readonly scenarioId?: string) {
    if (scenarioId) {
      const foundIndex = DEFAULT_SCENARIOS.findIndex((scenario) => scenario.id === scenarioId);
      if (foundIndex !== -1) {
        this.scenarioIndex = foundIndex;
      }
    }
    this.scenario = DEFAULT_SCENARIOS[this.scenarioIndex];
    this.reset();
  }

  reset(): Arc3FrameSnapshot {
    if (this.scenarioId === undefined) {
      this.scenarioIndex = (this.scenarioIndex + 1) % DEFAULT_SCENARIOS.length;
      this.scenario = DEFAULT_SCENARIOS[this.scenarioIndex];
    }
    this.board = cloneGrid(this.scenario.baseGrid);
    this.state = 'IN_PROGRESS';
    this.score = 0;
    this.steps = 0;
    this.history = [];
    this.simpleActionsUsed.clear();
    this.coordinateGuesses = 0;
    const snapshot = this.recordSnapshot('RESET', 'Simulation reset. Activate scanners to gather clues before taking ACTION6.');
    return snapshot;
  }

  inspect(note?: string): Arc3InspectionPayload {
    return {
      state: this.state,
      score: this.score,
      stepsTaken: this.steps,
      remainingSteps: Math.max(this.maxSteps - this.steps, 0),
      simpleActionsAvailable: ARC3_SIMPLE_ACTIONS.filter((id) => !this.simpleActionsUsed.has(id)),
      coordinateGuesses: this.coordinateGuesses,
      scenario: {
        id: this.scenario.id,
        name: this.scenario.name,
        description: this.scenario.description,
        legend: this.scenario.legend,
      },
      board: cloneGrid(this.board),
      note,
    };
  }

  applyAction(action: Arc3Action): Arc3FrameSnapshot {
    // Always allow reset, even after terminal states
    switch (action.kind) {
      case 'reset':
        return this.reset();
      default:
        break;
    }

    // For non-reset actions, block if the game already concluded
    if (this.state === 'GAME_OVER' || this.state === 'WIN') {
      return this.recordSnapshot(
        'NO_OP',
        'Game already concluded. Use reset to start a new attempt.',
      );
    }

    switch (action.kind) {
      case 'simple':
        return this.handleSimpleAction(action.id);
      case 'coordinate':
        return this.handleCoordinateAction(action.x, action.y);
      default:
        return this.recordSnapshot('NO_OP', 'Unknown action requested.');
    }
  }

  getHistory(): Arc3FrameSnapshot[] {
    return [...this.history];
  }

  getSummary(): Arc3RunSummary {
    return {
      state: this.state,
      score: this.score,
      stepsTaken: this.steps,
      simpleActionsUsed: Array.from(this.simpleActionsUsed.values()),
      coordinateGuesses: this.coordinateGuesses,
      scenarioId: this.scenario.id,
      scenarioName: this.scenario.name,
    };
  }

  private handleSimpleAction(id: Arc3SimpleActionId): Arc3FrameSnapshot {
    if (this.simpleActionsUsed.has(id)) {
      return this.recordSnapshot(id, `${id} already used in this run.`);
    }

    this.simpleActionsUsed.add(id);
    this.steps += 1;
    let narrative = '';

    switch (id) {
      case 'ACTION1': {
        this.board[this.scenario.target.y] = this.board[this.scenario.target.y].map(() => 5);
        narrative = 'Row scanner activated. The energized row glows amber.';
        break;
      }
      case 'ACTION2': {
        for (let y = 0; y < this.board.length; y += 1) {
          this.board[y][this.scenario.target.x] = 6;
        }
        narrative = 'Column scanner activated. The energized column emits teal light.';
        break;
      }
      case 'ACTION3': {
        const { x, y } = this.scenario.target;
        for (let yy = y - 1; yy <= y + 1; yy += 1) {
          if (yy < 0 || yy >= this.board.length) continue;
          for (let xx = x - 1; xx <= x + 1; xx += 1) {
            if (xx < 0 || xx >= this.board[yy].length) continue;
            if (!(yy === y && xx === x)) {
              this.board[yy][xx] = 7;
            }
          }
        }
        narrative = 'Triangulation pulse reveals a 3×3 halo around the energized node.';
        break;
      }
      case 'ACTION4': {
        const { x, y } = this.scenario.target;
        const value = this.board[y][x];
        this.board[y][x] = value === 8 ? 8 : 8;
        narrative = 'Stability probe peaks. The energized node emits a golden flare at its exact location.';
        break;
      }
      case 'ACTION5': {
        narrative = `Telemetry analysis: ${this.scenario.textHint}`;
        break;
      }
      default: {
        narrative = 'Scanner malfunctioned with an undefined pattern.';
      }
    }

    this.score = Math.max(this.score - 1, -10);
    this.enforceStepLimit();
    return this.recordSnapshot(id, narrative);
  }

  private handleCoordinateAction(x: number, y: number): Arc3FrameSnapshot {
    this.steps += 1;
    this.coordinateGuesses += 1;

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return this.recordSnapshot('ACTION6', 'Coordinate guess rejected: coordinates must be numeric within the grid.');
    }

    const maxY = this.board.length - 1;
    const maxX = this.board[0]?.length ? this.board[0].length - 1 : 0;
    const boundedX = Math.max(0, Math.min(maxX, Math.round(x)));
    const boundedY = Math.max(0, Math.min(maxY, Math.round(y)));

    if (boundedX === this.scenario.target.x && boundedY === this.scenario.target.y) {
      this.board[boundedY][boundedX] = 8;
      this.state = 'WIN';
      this.score += 12;
      return this.recordSnapshot('ACTION6', 'Direct hit! The energized node is stabilized. Mission complete.');
    }

    this.score = Math.max(this.score - 3, -15);
    this.board[boundedY][boundedX] = 9;
    this.enforceStepLimit();
    return this.recordSnapshot(
      'ACTION6',
      `Probe at (${boundedX}, ${boundedY}) dissipated without impact. Adjust strategy and try again.`,
    );
  }

  private enforceStepLimit(): void {
    if (this.steps >= this.maxSteps && this.state !== 'WIN') {
      this.state = 'GAME_OVER';
    }
  }

  private recordSnapshot(actionLabel: string, narrative: string): Arc3FrameSnapshot {
    const snapshot: Arc3FrameSnapshot = {
      step: this.history.length,
      state: this.state,
      score: this.score,
      board: cloneGrid(this.board),
      actionLabel,
      narrative,
      remainingSteps: Math.max(this.maxSteps - this.steps, 0),
    };
    this.history.push(snapshot);
    return snapshot;
  }
}

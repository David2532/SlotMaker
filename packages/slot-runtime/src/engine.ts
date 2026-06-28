import type { SlotProject } from "@slotmaker/config";
import { Rng } from "./rng.js";
import {
  buildWeightTable,
  drawSymbol,
  fillGrid,
  type Grid,
  type WeightedTable,
} from "./grid.js";
import {
  countKind,
  detectClusters,
  type ClusterWin,
} from "./clusters.js";

/** One cascade step. The full list drives the preview AND the animation timeline. */
export interface SpinStep {
  /** Grid state at the START of this step (before removals). */
  grid: Grid;
  wins: ClusterWin[];
  /** Cells removed at the end of this step (the winning cells). */
  removed: number[];
  /** Win contributed by this step, in bet multiples. */
  stepWin: number;
}

export interface GridPlay {
  steps: SpinStep[];
  win: number;
  scatterCount: number;
  coinCount: number;
  coinValue: number;
}

export interface RoundResult {
  /** Base-game cascade steps (what the preview renders for a single spin). */
  steps: SpinStep[];
  baseWin: number;
  freeSpinsWin: number;
  coinWin: number;
  freeSpinsTriggered: boolean;
  freeSpinsCount: number;
  /** Final round win in bet multiples, after the maxWin cap. */
  totalWin: number;
  capped: boolean;
}

/**
 * Play a single grid to completion: detect clusters, pay, remove winners, drop
 * the column above, refill the top, and repeat until no more wins (or the safety
 * cap is hit). Returns every intermediate step plus aggregate counts.
 */
export function playGrid(
  project: SlotProject,
  table: WeightedTable,
  rng: Rng,
  grid: Grid,
): GridPlay {
  const cascadesEnabled = project.features.cascades;
  const { columns, rows } = project.grid;
  const steps: SpinStep[] = [];
  let win = 0;

  // Scatter + coin counts come from the INITIAL settled grid only.
  const scatterCount = countKind(project, grid, "scatter");
  let coinCount = 0;
  let coinValue = 0;
  const coinDefs = new Map(
    project.symbols.filter((s) => s.kind === "coin").map((s) => [s.id, s.coinValue ?? 0]),
  );
  for (const cell of grid) {
    if (coinDefs.has(cell)) {
      coinCount++;
      coinValue += coinDefs.get(cell)!;
    }
  }

  let current = grid;
  let guard = 0;
  while (guard++ < 64) {
    const wins = project.features.clusterWins ? detectClusters(project, current) : [];
    const stepWin = wins.reduce((s, w) => s + w.win, 0);
    win += stepWin;

    if (wins.length === 0) {
      steps.push({ grid: current.slice(), wins, removed: [], stepWin: 0 });
      break;
    }

    const removed = new Set<number>();
    for (const w of wins) for (const p of w.positions) removed.add(p);
    steps.push({
      grid: current.slice(),
      wins,
      removed: [...removed].sort((a, b) => a - b),
      stepWin,
    });

    if (!cascadesEnabled) break;

    // Cascade: per column, keep survivors, drop them to the bottom, refill top.
    const next: Grid = current.slice();
    for (let col = 0; col < columns; col++) {
      const survivors: string[] = [];
      for (let row = rows - 1; row >= 0; row--) {
        const idx = row * columns + col;
        if (!removed.has(idx)) survivors.push(current[idx]!);
      }
      let writeRow = rows - 1;
      for (const sym of survivors) {
        next[writeRow * columns + col] = sym;
        writeRow--;
      }
      for (; writeRow >= 0; writeRow--) {
        next[writeRow * columns + col] = drawSymbol(table, rng);
      }
    }
    current = next;
  }

  return { steps, win, scatterCount, coinCount, coinValue };
}

/**
 * Play the free-spins feature in isolation (the awarded round). Used both by a
 * normal triggered round and by the Bonus Buy calculator, which needs the
 * feature's value without the base game.
 */
export function playFreeSpins(
  project: SlotProject,
  table: WeightedTable,
  rng: Rng,
): { win: number; coinWin: number } {
  const fs = project.math.freeSpins;
  let win = 0;
  let coinWin = 0;
  for (let i = 0; i < fs.spinsAwarded; i++) {
    const play = playGrid(project, table, rng, fillGrid(project, table, rng));
    win += play.win * fs.multiplier;
    if (project.features.coinCollector && play.coinCount >= project.math.coinCollectThreshold) {
      coinWin += play.coinValue;
    }
  }
  return { win, coinWin };
}

/**
 * Play a full round: one base spin (with cascades), then resolve features —
 * free spins (scatter trigger) and the coin collector. Applies the maxWin cap.
 *
 * Free spin retriggers are intentionally out of scope for Phase 1.
 */
export function spinRound(
  project: SlotProject,
  table: WeightedTable,
  rng: Rng,
): RoundResult {
  const base = playGrid(project, table, rng, fillGrid(project, table, rng));
  let baseWin = base.win;

  // Coin collector: collect when enough coins land on the base grid.
  let coinWin = 0;
  if (project.features.coinCollector && base.coinCount >= project.math.coinCollectThreshold) {
    coinWin = base.coinValue;
  }

  // Free spins: scatter trigger.
  let freeSpinsWin = 0;
  let freeSpinsTriggered = false;
  let freeSpinsCount = 0;
  const fs = project.math.freeSpins;
  if (project.features.freeSpins && base.scatterCount >= fs.triggerScatters) {
    freeSpinsTriggered = true;
    freeSpinsCount = fs.spinsAwarded;
    const feature = playFreeSpins(project, table, rng);
    freeSpinsWin += feature.win;
    coinWin += feature.coinWin;
  }

  const rawTotal = baseWin + freeSpinsWin + coinWin;
  const capped = rawTotal > project.math.maxWin;
  const totalWin = capped ? project.math.maxWin : rawTotal;

  return {
    steps: base.steps,
    baseWin,
    freeSpinsWin,
    coinWin,
    freeSpinsTriggered,
    freeSpinsCount,
    totalWin,
    capped,
  };
}

/**
 * High-level convenience: build the weight table and play one seeded round.
 * The editor's live preview calls this on every Spin click.
 */
export function spin(project: SlotProject, seed: number): RoundResult {
  const table = buildWeightTable(project);
  const rng = new Rng(seed);
  return spinRound(project, table, rng);
}

export { buildWeightTable };
export type { WeightedTable };

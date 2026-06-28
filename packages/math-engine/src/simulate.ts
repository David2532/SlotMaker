import type { SlotProject } from "@slotmaker/config";
import { Rng, buildWeightTable, spinRound } from "@slotmaker/slot-runtime";

export interface SimOptions {
  spins: number;
  seed?: number;
}

/** Win-size bucket edges (bet multiples). Index i covers [edge[i], edge[i+1]). */
const BUCKET_EDGES = [0, 0.01, 1, 5, 20, 100, 500];

export interface WinBucket {
  label: string;
  min: number;
  count: number;
}

export interface SimResult {
  spins: number;
  seed: number;
  rtp: number;
  hitFrequency: number;
  deadSpinRate: number;
  /** Wins in (0, 5]. */
  smallWinRate: number;
  /** Wins in (5, 20]. */
  mediumWinRate: number;
  /** Wins > 20. */
  bigWinRate: number;
  bonusFrequency: number;
  bonusTriggers: number;
  maxWin: number;
  avgWin: number;
  cappedRounds: number;
  /** Per-spin return standard deviation (drives the volatility analysis). */
  returnStdDev: number;
  /** Per-spin return skewness (positive = long upside tail). */
  returnSkew: number;
  /** Share of total returns coming from wins > 20x (big-win dependency). */
  bigWinRtpShare: number;
  contribution: {
    base: number;
    freeSpins: number;
    coin: number;
  };
  distribution: WinBucket[];
}

function emptyBuckets(): WinBucket[] {
  return BUCKET_EDGES.map((min, i) => {
    const next = BUCKET_EDGES[i + 1];
    return {
      min,
      label: min === 0 ? "0x" : next === undefined ? `${min}x+` : `${min}-${next}x`,
      count: 0,
    };
  });
}

function bucketIndex(win: number): number {
  if (win <= 0) return 0;
  let idx = 1;
  for (let i = 1; i < BUCKET_EDGES.length; i++) {
    if (win >= BUCKET_EDGES[i]!) idx = i;
  }
  return idx;
}

/**
 * Run a seeded Monte-Carlo simulation — the single source of truth for math.
 * Accumulates enough moments (sum, sum-of-squares) to derive variance/volatility
 * without storing every spin.
 */
export function simulate(project: SlotProject, opts: SimOptions): SimResult {
  const spins = Math.max(1, Math.floor(opts.spins));
  const seed = opts.seed ?? 0x510f;
  const table = buildWeightTable(project);
  const rng = new Rng(seed);

  let wagered = 0;
  let won = 0;
  let wonSq = 0;
  let wonCube = 0;
  let baseWon = 0;
  let fsWon = 0;
  let coinWon = 0;
  let bigWon = 0;
  let hits = 0;
  let small = 0;
  let medium = 0;
  let big = 0;
  let bonusTriggers = 0;
  let maxWin = 0;
  let cappedRounds = 0;
  const distribution = emptyBuckets();

  for (let i = 0; i < spins; i++) {
    wagered += 1;
    const r = spinRound(project, table, rng);
    const w = r.totalWin;
    won += w;
    wonSq += w * w;
    wonCube += w * w * w;
    baseWon += r.baseWin;
    fsWon += r.freeSpinsWin;
    coinWon += r.coinWin;
    if (w > 0) hits++;
    if (w > 0 && w <= 5) small++;
    else if (w > 5 && w <= 20) medium++;
    else if (w > 20) {
      big++;
      bigWon += w;
    }
    if (r.freeSpinsTriggered) bonusTriggers++;
    if (r.capped) cappedRounds++;
    if (w > maxWin) maxWin = w;
    distribution[bucketIndex(w)]!.count++;
  }

  const mean = won / spins;
  const variance = Math.max(0, wonSq / spins - mean * mean);
  const stdDev = Math.sqrt(variance);
  // Third central moment → skewness (m3 / σ³).
  const m3 = wonCube / spins - 3 * mean * (wonSq / spins) + 2 * mean ** 3;
  const skew = stdDev > 1e-9 ? m3 / stdDev ** 3 : 0;

  return {
    spins,
    seed,
    rtp: (won / wagered) * 100,
    hitFrequency: (hits / spins) * 100,
    deadSpinRate: ((spins - hits) / spins) * 100,
    smallWinRate: (small / spins) * 100,
    mediumWinRate: (medium / spins) * 100,
    bigWinRate: (big / spins) * 100,
    bonusFrequency: bonusTriggers > 0 ? spins / bonusTriggers : Infinity,
    bonusTriggers,
    maxWin,
    avgWin: mean,
    cappedRounds,
    returnStdDev: stdDev,
    returnSkew: skew,
    bigWinRtpShare: won > 0 ? bigWon / won : 0,
    contribution: {
      base: (baseWon / wagered) * 100,
      freeSpins: (fsWon / wagered) * 100,
      coin: (coinWon / wagered) * 100,
    },
    distribution,
  };
}

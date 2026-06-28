import type { SlotProject } from "@slotmaker/config";
import { Rng, buildWeightTable, spinRound } from "@slotmaker/slot-runtime";

export interface SimOptions {
  spins: number;
  /** Bet per spin in bet-multiple units. RTP is independent of this; kept = 1. */
  seed?: number;
}

/** Win-size buckets (in bet multiples) for the distribution histogram. */
const BUCKET_EDGES = [0, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];

export interface WinBucket {
  label: string;
  /** Inclusive lower bound in bet multiples. */
  min: number;
  count: number;
}

export interface SimResult {
  spins: number;
  seed: number;
  /** Realized return-to-player as a percentage (wins / wagered * 100). */
  rtp: number;
  /** Share of spins that returned > 0. */
  hitFrequency: number;
  /** Share of spins that returned exactly 0. */
  deadSpinRate: number;
  /** Average number of spins between free-spins triggers (1-in-N). */
  bonusFrequency: number;
  bonusTriggers: number;
  /** Largest single-round win observed, in bet multiples. */
  maxWin: number;
  avgWin: number;
  /** Times the maxWin cap was applied. */
  cappedRounds: number;
  /** RTP contribution split by source (sums ≈ total rtp). */
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
      label: next === undefined ? `${min}x+` : `${min}-${next}x`,
      count: 0,
    };
  });
}

function bucketIndex(win: number): number {
  let idx = 0;
  for (let i = 0; i < BUCKET_EDGES.length; i++) {
    if (win >= BUCKET_EDGES[i]!) idx = i;
  }
  return idx;
}

/**
 * Run a seeded Monte-Carlo simulation. This is the only source of truth for
 * math claims — "looks good" never decides RTP, the simulator does.
 */
export function simulate(project: SlotProject, opts: SimOptions): SimResult {
  const spins = Math.max(1, Math.floor(opts.spins));
  const seed = opts.seed ?? 0x510f;
  const table = buildWeightTable(project);
  const rng = new Rng(seed);

  let wagered = 0;
  let won = 0;
  let baseWon = 0;
  let fsWon = 0;
  let coinWon = 0;
  let hits = 0;
  let bonusTriggers = 0;
  let maxWin = 0;
  let cappedRounds = 0;
  const distribution = emptyBuckets();

  for (let i = 0; i < spins; i++) {
    wagered += 1;
    const r = spinRound(project, table, rng);
    won += r.totalWin;
    baseWon += r.baseWin;
    fsWon += r.freeSpinsWin;
    coinWon += r.coinWin;
    if (r.totalWin > 0) hits++;
    if (r.freeSpinsTriggered) bonusTriggers++;
    if (r.capped) cappedRounds++;
    if (r.totalWin > maxWin) maxWin = r.totalWin;
    distribution[bucketIndex(r.totalWin)]!.count++;
  }

  const rtp = (won / wagered) * 100;
  return {
    spins,
    seed,
    rtp,
    hitFrequency: (hits / spins) * 100,
    deadSpinRate: ((spins - hits) / spins) * 100,
    bonusFrequency: bonusTriggers > 0 ? spins / bonusTriggers : Infinity,
    bonusTriggers,
    maxWin,
    avgWin: won / spins,
    cappedRounds,
    contribution: {
      base: (baseWon / wagered) * 100,
      freeSpins: (fsWon / wagered) * 100,
      coin: (coinWon / wagered) * 100,
    },
    distribution,
  };
}

import type { SlotProject } from "@slotmaker/config";
import { simulate, type SimResult, type WinBucket } from "./simulate.js";

export interface Range {
  mean: number;
  min: number;
  max: number;
}

export interface MultiSeedResult {
  spinsPerSeed: number;
  seedCount: number;
  totalSpins: number;
  rtp: Range & { stdDev: number };
  /** Between-seed 95% confidence band for the mean RTP. */
  confidence: { low: number; high: number; level: number };
  hitFrequency: Range;
  bonusFrequency: Range;
  /** Per-seed results (full detail). */
  perSeed: SimResult[];
  /** Seed-averaged aggregate (distribution summed) for charts + downstream analysis. */
  aggregate: SimResult;
}

function stats(values: number[]): Range & { stdDev: number } {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { mean, min: Math.min(...values), max: Math.max(...values), stdDev: Math.sqrt(variance) };
}

function average(results: SimResult[]): SimResult {
  const n = results.length;
  const avg = (pick: (r: SimResult) => number) => results.reduce((a, r) => a + pick(r), 0) / n;
  const buckets: WinBucket[] = results[0]!.distribution.map((b, i) => ({
    label: b.label,
    min: b.min,
    count: results.reduce((a, r) => a + r.distribution[i]!.count, 0),
  }));
  return {
    spins: results.reduce((a, r) => a + r.spins, 0),
    seed: results[0]!.seed,
    rtp: avg((r) => r.rtp),
    hitFrequency: avg((r) => r.hitFrequency),
    deadSpinRate: avg((r) => r.deadSpinRate),
    smallWinRate: avg((r) => r.smallWinRate),
    mediumWinRate: avg((r) => r.mediumWinRate),
    bigWinRate: avg((r) => r.bigWinRate),
    bonusFrequency: avg((r) => (Number.isFinite(r.bonusFrequency) ? r.bonusFrequency : 0)),
    bonusTriggers: results.reduce((a, r) => a + r.bonusTriggers, 0),
    maxWin: Math.max(...results.map((r) => r.maxWin)),
    avgWin: avg((r) => r.avgWin),
    cappedRounds: results.reduce((a, r) => a + r.cappedRounds, 0),
    returnStdDev: avg((r) => r.returnStdDev),
    returnSkew: avg((r) => r.returnSkew),
    bigWinRtpShare: avg((r) => r.bigWinRtpShare),
    contribution: {
      base: avg((r) => r.contribution.base),
      freeSpins: avg((r) => r.contribution.freeSpins),
      coin: avg((r) => r.contribution.coin),
    },
    distribution: buckets,
  };
}

export interface MultiSeedOptions {
  spins: number;
  seeds: number;
  baseSeed?: number;
  /** Optional progress callback (0..1), called after each seed completes. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Run the same project across multiple seeds. A single RTP number is never
 * enough — this reports the spread and a confidence band so you know how much to
 * trust it.
 */
export function multiSeedSimulate(project: SlotProject, opts: MultiSeedOptions): MultiSeedResult {
  const seeds = Math.max(1, Math.floor(opts.seeds));
  const baseSeed = opts.baseSeed ?? 0x1234;
  const perSeed: SimResult[] = [];
  for (let k = 0; k < seeds; k++) {
    perSeed.push(simulate(project, { spins: opts.spins, seed: baseSeed + k * 0x9e37 }));
    opts.onProgress?.(k + 1, seeds);
  }

  const rtp = stats(perSeed.map((r) => r.rtp));
  const hf = stats(perSeed.map((r) => r.hitFrequency));
  const bf = stats(perSeed.map((r) => (Number.isFinite(r.bonusFrequency) ? r.bonusFrequency : 0)));
  const se = rtp.stdDev / Math.sqrt(seeds);

  return {
    spinsPerSeed: opts.spins,
    seedCount: seeds,
    totalSpins: opts.spins * seeds,
    rtp,
    confidence: { low: rtp.mean - 1.96 * se, high: rtp.mean + 1.96 * se, level: 0.95 },
    hitFrequency: { mean: hf.mean, min: hf.min, max: hf.max },
    bonusFrequency: { mean: bf.mean, min: bf.min, max: bf.max },
    perSeed,
    aggregate: average(perSeed),
  };
}

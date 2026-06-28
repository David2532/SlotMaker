import type { SlotProject } from "@slotmaker/config";
import type { MultiSeedResult } from "./multiseed.js";
import type { WinBucket } from "./simulate.js";
import { analyzeVolatility, type VolatilityReport } from "./volatility.js";
import { analyzeBonusBuy, type BonusBuyReport } from "./bonusbuy.js";
import { suggestBalance, type BalanceSuggestion } from "./balance.js";

/** Minimum total spins before an RTP claim is considered trustworthy. */
export const MIN_TRUSTWORTHY_SPINS = 100_000;

export interface MathReport {
  generatedAt?: string;
  config: { spinsPerSeed: number; seedCount: number; totalSpins: number };
  rtp: {
    target: number;
    observed: number;
    min: number;
    max: number;
    stdDev: number;
    confidenceLow: number;
    confidenceHigh: number;
    confidenceLevel: number;
  };
  sampleSize: number;
  seedCount: number;
  lowSample: boolean;
  hitFrequency: MultiSeedResult["hitFrequency"];
  bonusFrequency: MultiSeedResult["bonusFrequency"];
  maxWin: number;
  rates: { dead: number; small: number; medium: number; big: number };
  distribution: WinBucket[];
  contribution: { base: number; freeSpins: number; coin: number };
  volatility: VolatilityReport;
  bonusBuy: BonusBuyReport;
  warnings: string[];
  suggestions: BalanceSuggestion[];
}

export interface MathReportOptions {
  bonusBuyRounds?: number;
  now?: () => Date;
}

/** Assemble the full math report from a multi-seed run. */
export function buildMathReport(
  project: SlotProject,
  multi: MultiSeedResult,
  opts: MathReportOptions = {},
): MathReport {
  const agg = multi.aggregate;
  const volatility = analyzeVolatility(project, agg);
  const bonusBuy = analyzeBonusBuy(project, { rounds: opts.bonusBuyRounds ?? 20_000 });
  const suggestions = suggestBalance(project, agg, { volatility, bonusBuy });

  const warnings: string[] = [];
  if (multi.totalSpins < MIN_TRUSTWORTHY_SPINS) {
    warnings.push(`Sample size ${multi.totalSpins.toLocaleString()} is below ${MIN_TRUSTWORTHY_SPINS.toLocaleString()} — RTP is not yet trustworthy.`);
  }
  if (Math.abs(multi.rtp.mean - project.math.targetRtp) > 1) {
    warnings.push(`Observed RTP ${multi.rtp.mean.toFixed(2)}% is off target ${project.math.targetRtp}%.`);
  }
  if (agg.maxWin > project.math.maxWin + 1e-6) {
    warnings.push(`Observed win ${agg.maxWin.toFixed(0)}x exceeds the maxWin cap ${project.math.maxWin}x.`);
  }
  if (!volatility.matchesConfig) {
    warnings.push(`Measured volatility "${volatility.label}" conflicts with configured "${volatility.configured}".`);
  }
  warnings.push(...bonusBuy.warnings);

  return {
    generatedAt: (opts.now ?? (() => new Date()))().toISOString(),
    config: { spinsPerSeed: multi.spinsPerSeed, seedCount: multi.seedCount, totalSpins: multi.totalSpins },
    rtp: {
      target: project.math.targetRtp,
      observed: multi.rtp.mean,
      min: multi.rtp.min,
      max: multi.rtp.max,
      stdDev: multi.rtp.stdDev,
      confidenceLow: multi.confidence.low,
      confidenceHigh: multi.confidence.high,
      confidenceLevel: multi.confidence.level,
    },
    sampleSize: multi.totalSpins,
    seedCount: multi.seedCount,
    lowSample: multi.totalSpins < MIN_TRUSTWORTHY_SPINS,
    hitFrequency: multi.hitFrequency,
    bonusFrequency: multi.bonusFrequency,
    maxWin: agg.maxWin,
    rates: { dead: agg.deadSpinRate, small: agg.smallWinRate, medium: agg.mediumWinRate, big: agg.bigWinRate },
    distribution: agg.distribution,
    contribution: agg.contribution,
    volatility,
    bonusBuy,
    warnings,
    suggestions,
  };
}

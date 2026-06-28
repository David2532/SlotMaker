import type { SlotProject, Volatility } from "@slotmaker/config";
import type { SimResult } from "./simulate.js";

export interface VolatilityReport {
  /** Per-spin return standard deviation (bet multiples). */
  stdDev: number;
  /** Return skewness (positive = long upside tail). */
  skew: number;
  /** Share of RTP coming from wins > 20x (0..1). */
  bigWinDependency: number;
  /** Share of RTP coming from features (free spins + coin) (0..1). */
  featureDependency: number;
  /** Practical label derived from stdDev. */
  label: Volatility;
  /** Configured volatility, for comparison. */
  configured: Volatility;
  matchesConfig: boolean;
}

const ORDER: Volatility[] = ["low", "medium", "high", "extreme"];

/** Bucket per-spin return stdDev into a practical volatility label. */
export function labelFromStdDev(stdDev: number): Volatility {
  if (stdDev < 1.5) return "low";
  if (stdDev < 4) return "medium";
  if (stdDev < 8) return "high";
  return "extreme";
}

/**
 * Practical volatility analysis. "High volatility" should mean something
 * measurable — here it is the spread of per-spin returns plus how dependent the
 * RTP is on rare big wins and features.
 */
export function analyzeVolatility(project: SlotProject, agg: SimResult): VolatilityReport {
  const label = labelFromStdDev(agg.returnStdDev);
  const configured = project.math.volatility;
  return {
    stdDev: agg.returnStdDev,
    skew: agg.returnSkew,
    bigWinDependency: agg.bigWinRtpShare,
    featureDependency: agg.rtp > 0 ? (agg.contribution.freeSpins + agg.contribution.coin) / agg.rtp : 0,
    label,
    configured,
    matchesConfig: Math.abs(ORDER.indexOf(label) - ORDER.indexOf(configured)) <= 1,
  };
}

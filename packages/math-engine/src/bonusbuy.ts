import type { SlotProject } from "@slotmaker/config";
import { Rng, buildWeightTable, playFreeSpins } from "@slotmaker/slot-runtime";

export interface BonusBuyReport {
  /** Expected feature payout in bet multiples (Monte-Carlo). */
  expectedValue: number;
  /** Std dev of feature payout (volatility of the buy). */
  stdDev: number;
  /** Price that makes the buy's RTP equal the target RTP. */
  fairPrice: number;
  configuredPrice: number;
  /** RTP of buying the feature at the configured price (%). */
  buyRtp: number;
  /** House edge at the configured price (1 - EV/price). */
  houseEdge: number;
  rounds: number;
  warnings: string[];
}

export interface BonusBuyOptions {
  rounds?: number;
  seed?: number;
}

/**
 * Analyze bonus-buy pricing by simulating the feature in isolation. A buy that
 * returns more than its price is +EV for the player — the calculator flags it.
 */
export function analyzeBonusBuy(project: SlotProject, opts: BonusBuyOptions = {}): BonusBuyReport {
  const rounds = Math.max(1, Math.floor(opts.rounds ?? 50_000));
  const table = buildWeightTable(project);
  const rng = new Rng(opts.seed ?? 0xb0b);

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < rounds; i++) {
    const f = playFreeSpins(project, table, rng);
    const v = Math.min(f.win + f.coinWin, project.math.maxWin);
    sum += v;
    sumSq += v * v;
  }
  const expectedValue = sum / rounds;
  const variance = Math.max(0, sumSq / rounds - expectedValue ** 2);
  const targetFraction = project.math.targetRtp / 100;
  const fairPrice = targetFraction > 0 ? expectedValue / targetFraction : expectedValue;
  const configuredPrice = project.math.bonusBuyCost;
  const buyRtp = configuredPrice > 0 ? (expectedValue / configuredPrice) * 100 : Infinity;
  const houseEdge = configuredPrice > 0 ? (configuredPrice - expectedValue) / configuredPrice : -Infinity;

  const warnings: string[] = [];
  if (configuredPrice <= expectedValue) {
    warnings.push(`Buy price ${configuredPrice}x is below the expected value ${expectedValue.toFixed(1)}x — the buy is +EV for the player.`);
  } else if (buyRtp > project.math.targetRtp + 3) {
    warnings.push(`Buy RTP ${buyRtp.toFixed(2)}% is well above target ${project.math.targetRtp}% — buy price is too cheap.`);
  } else if (buyRtp < project.math.targetRtp - 5) {
    warnings.push(`Buy RTP ${buyRtp.toFixed(2)}% is well below target ${project.math.targetRtp}% — buy price is too expensive.`);
  }

  return {
    expectedValue,
    stdDev: Math.sqrt(variance),
    fairPrice,
    configuredPrice,
    buyRtp,
    houseEdge,
    rounds,
    warnings,
  };
}

import type { SlotProject } from "@slotmaker/config";
import type { SimResult } from "./simulate.js";
import type { VolatilityReport } from "./volatility.js";
import type { BonusBuyReport } from "./bonusbuy.js";

export interface BalanceSuggestion {
  severity: "info" | "warning";
  /** What to change. */
  action: string;
  /** Expected impact of the change. */
  impact: string;
}

export interface BalanceContext {
  volatility?: VolatilityReport;
  bonusBuy?: BonusBuyReport;
}

/**
 * Math Assistant: compare a simulation against targets and emit concrete, impact-
 * annotated suggestions. It NEVER edits the config — Auto Balance proposes, the
 * simulator decides.
 */
export function suggestBalance(
  project: SlotProject,
  sim: SimResult,
  ctx: BalanceContext = {},
): BalanceSuggestion[] {
  const out: BalanceSuggestion[] = [];
  const target = project.math.targetRtp;
  const drift = sim.rtp - target;

  if (Math.abs(drift) <= 0.5) {
    out.push({ severity: "info", action: `RTP ${sim.rtp.toFixed(2)}% is on target (${target}%).`, impact: "No RTP change needed." });
  } else if (drift > 0) {
    const pct = Math.min(40, (drift / Math.max(sim.rtp, 1)) * 100).toFixed(0);
    out.push({
      severity: "warning",
      action: `Reduce top-symbol pay multipliers by ~${pct}% (or lower their weights).`,
      impact: `Lowers RTP from ${sim.rtp.toFixed(2)}% toward ${target}%.`,
    });
  } else {
    const pct = Math.min(40, (-drift / Math.max(sim.rtp, 1)) * 100).toFixed(0);
    out.push({
      severity: "warning",
      action: `Raise top-symbol pays by ~${pct}% or increase feature frequency.`,
      impact: `Raises RTP from ${sim.rtp.toFixed(2)}% toward ${target}%.`,
    });
  }

  const hf = sim.hitFrequency;
  const hfTarget = project.math.hitFrequencyTarget;
  if (Math.abs(hf - hfTarget) > 5) {
    out.push({
      severity: "warning",
      action: hf < hfTarget ? "Increase low-symbol weights or lower minClusterSize." : "Decrease low-symbol weights.",
      impact: `Moves hit frequency ${hf.toFixed(1)}% toward target ${hfTarget}%.`,
    });
  }

  if (project.features.freeSpins && Number.isFinite(sim.bonusFrequency)) {
    const bf = sim.bonusFrequency;
    const bfTarget = project.math.bonusFrequencyTarget;
    if (bf > bfTarget * 1.4) {
      out.push({
        severity: "warning",
        action: "Raise scatter weight (or lower triggerScatters).",
        impact: `Makes bonus more frequent (1-in-${bf.toFixed(0)} → target 1-in-${bfTarget}); raises feature RTP share.`,
      });
    } else if (bf < bfTarget * 0.6) {
      out.push({
        severity: "warning",
        action: "Lower scatter weight (or raise triggerScatters).",
        impact: `Makes bonus rarer (1-in-${bf.toFixed(0)} → target 1-in-${bfTarget}); lowers feature RTP share.`,
      });
    }
  }

  if (project.features.coinCollector) {
    const coinShare = sim.rtp > 0 ? (sim.contribution.coin / sim.rtp) * 100 : 0;
    if (coinShare > 15) {
      out.push({
        severity: "warning",
        action: "Reduce coin symbol weight, coinValue, or raise coinCollectThreshold.",
        impact: `Coin feature contributes ${coinShare.toFixed(0)}% of RTP — high; trims it back.`,
      });
    }
  }

  if (sim.cappedRounds > 0) {
    out.push({
      severity: "info",
      action: `Max win cap ${project.math.maxWin}x is binding (hit ${sim.cappedRounds}x).`,
      impact: "Raising the cap increases tail volatility and RTP slightly.",
    });
  }

  if (ctx.volatility && !ctx.volatility.matchesConfig) {
    out.push({
      severity: "warning",
      action: `Measured volatility is "${ctx.volatility.label}" but config says "${ctx.volatility.configured}". Widen pay spread for more, flatten for less.`,
      impact: "Aligns the felt volatility with the configured label.",
    });
  }

  for (const w of ctx.bonusBuy?.warnings ?? []) {
    out.push({ severity: "warning", action: "Adjust bonusBuyCost.", impact: w });
  }

  return out;
}

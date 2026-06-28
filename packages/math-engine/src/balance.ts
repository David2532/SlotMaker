import type { SlotProject } from "@slotmaker/config";
import type { SimResult } from "./simulate.js";

export interface BalanceSuggestion {
  severity: "info" | "warning";
  message: string;
}

/**
 * Math Assistant: compare a simulation against the project's targets and emit
 * human-readable suggestions. It never edits the config — Auto Balance proposes,
 * the simulator decides.
 */
export function suggestBalance(project: SlotProject, sim: SimResult): BalanceSuggestion[] {
  const out: BalanceSuggestion[] = [];
  const target = project.math.targetRtp;
  const drift = sim.rtp - target;

  if (Math.abs(drift) <= 0.5) {
    out.push({ severity: "info", message: `RTP ${sim.rtp.toFixed(2)}% is on target (${target}%).` });
  } else if (drift > 0) {
    out.push({
      severity: "warning",
      message: `RTP ${sim.rtp.toFixed(2)}% is ${drift.toFixed(2)}% ABOVE target. Reduce high-symbol pays or lower their weights.`,
    });
  } else {
    out.push({
      severity: "warning",
      message: `RTP ${sim.rtp.toFixed(2)}% is ${Math.abs(drift).toFixed(2)}% BELOW target. Raise top-symbol pays or feature frequency.`,
    });
  }

  const hf = sim.hitFrequency;
  const hfTarget = project.math.hitFrequencyTarget;
  if (Math.abs(hf - hfTarget) > 5) {
    out.push({
      severity: "warning",
      message: `Hit frequency ${hf.toFixed(1)}% is far from target ${hfTarget}%. ${
        hf < hfTarget ? "Increase low-symbol weights or lower minClusterSize." : "Decrease low-symbol weights."
      }`,
    });
  }

  if (project.features.freeSpins && Number.isFinite(sim.bonusFrequency)) {
    const bf = sim.bonusFrequency;
    const bfTarget = project.math.bonusFrequencyTarget;
    if (bf < bfTarget * 0.6) {
      out.push({
        severity: "warning",
        message: `Bonus triggers 1-in-${bf.toFixed(0)} (target 1-in-${bfTarget}). Lower scatter weight or raise required scatters.`,
      });
    } else if (bf > bfTarget * 1.6) {
      out.push({
        severity: "warning",
        message: `Bonus triggers 1-in-${bf.toFixed(0)} (target 1-in-${bfTarget}) — too rare. Raise scatter weight.`,
      });
    }
  }

  if (sim.maxWin >= project.math.maxWin) {
    out.push({
      severity: "info",
      message: `Max win cap of ${project.math.maxWin}x was reached ${sim.cappedRounds} time(s).`,
    });
  }

  return out;
}

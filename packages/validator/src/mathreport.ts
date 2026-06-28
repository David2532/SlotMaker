import type { SlotProject } from "@slotmaker/config";
import type { MathReport } from "@slotmaker/math-engine";
import type { Issue } from "./checks.js";

/**
 * Validate a project against a measured math report. With no report, the slot's
 * math is unverified — that itself is a warning. "Looks good" never passes here.
 */
export function checkMathReport(project: SlotProject, report?: MathReport): Issue[] {
  if (!report) {
    return [{ category: "math", severity: "warning", message: "No math report — run a simulation to verify RTP before export.", autoFixable: false }];
  }
  const issues: Issue[] = [];
  const m = project.math;

  if (report.lowSample) {
    issues.push({ category: "math", severity: "warning", message: `Math sample size ${report.sampleSize.toLocaleString()} is too low to trust the RTP.`, autoFixable: false });
  }
  if (Math.abs(report.rtp.observed - m.targetRtp) > 1) {
    issues.push({ category: "math", severity: "warning", message: `Observed RTP ${report.rtp.observed.toFixed(2)}% is off target ${m.targetRtp}%.`, autoFixable: false });
  }
  if (project.features.freeSpins && report.bonusFrequency.mean > 0) {
    const bf = report.bonusFrequency.mean;
    if (bf < m.bonusFrequencyTarget * 0.5 || bf > m.bonusFrequencyTarget * 2) {
      issues.push({ category: "math", severity: "warning", message: `Bonus frequency 1-in-${bf.toFixed(0)} is unrealistic vs target 1-in-${m.bonusFrequencyTarget}.`, autoFixable: false });
    }
  }
  if (report.maxWin > m.maxWin + 1e-6) {
    issues.push({ category: "math", severity: "error", message: `Observed win ${report.maxWin.toFixed(0)}x exceeds the maxWin cap ${m.maxWin}x.`, autoFixable: false });
  }
  if (!report.volatility.matchesConfig) {
    issues.push({ category: "math", severity: "warning", message: `Measured volatility "${report.volatility.label}" conflicts with configured "${report.volatility.configured}".`, autoFixable: false });
  }
  for (const w of report.bonusBuy.warnings) {
    issues.push({ category: "math", severity: "warning", message: `Bonus buy: ${w}`, autoFixable: false });
  }

  return issues;
}

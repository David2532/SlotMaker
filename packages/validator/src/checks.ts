import type { AnimationEvent, SlotProject } from "@slotmaker/config";

export type Category = "assets" | "math" | "animation" | "sound" | "mobile" | "export";

export interface Issue {
  category: Category;
  severity: "error" | "warning" | "info";
  message: string;
  autoFixable: boolean;
}

/** Math facts the validator can't compute itself (come from the simulator). */
export interface MathStats {
  rtp: number;
  hitFrequency: number;
  maxWin: number;
}

/** Events the validator expects every "serious" slot to wire up. */
export const CORE_EVENTS: AnimationEvent[] = [
  "spin_start",
  "reel_drop",
  "reel_stop",
  "symbol_land",
  "win_detected",
  "cluster_remove",
  "cascade_drop",
  "scatter_land",
  "bonus_trigger",
  "coin_collect",
  "big_win_start",
];

export function checkAssets(project: SlotProject): Issue[] {
  const issues: Issue[] = [];
  if (!project.assets.background) {
    issues.push({ category: "assets", severity: "warning", message: "No background asset set.", autoFixable: false });
  }
  for (const s of project.symbols) {
    const a = project.assets.symbols[s.id];
    if (!a?.static && !s.label) {
      issues.push({
        category: "assets",
        severity: "warning",
        message: `Symbol "${s.id}" has neither a static asset nor a label — it will render blank.`,
        autoFixable: true,
      });
    }
  }
  return issues;
}

export function checkMath(project: SlotProject, stats?: MathStats): Issue[] {
  const issues: Issue[] = [];
  const paying = project.symbols.filter((s) => s.pays.length > 0);
  if (paying.length === 0) {
    issues.push({ category: "math", severity: "error", message: "No symbol defines any pay tiers.", autoFixable: false });
  }
  if (project.symbols.some((s) => s.weight <= 0)) {
    issues.push({ category: "math", severity: "warning", message: "Some symbols have zero weight and will never appear.", autoFixable: false });
  }
  if (project.features.freeSpins && !project.symbols.some((s) => s.kind === "scatter")) {
    issues.push({ category: "math", severity: "error", message: "Free spins enabled but no scatter symbol exists.", autoFixable: false });
  }
  if (project.features.coinCollector && !project.symbols.some((s) => s.kind === "coin")) {
    issues.push({ category: "math", severity: "error", message: "Coin collector enabled but no coin symbol exists.", autoFixable: false });
  }
  if (stats) {
    const drift = Math.abs(stats.rtp - project.math.targetRtp);
    if (drift > 1) {
      issues.push({
        category: "math",
        severity: "warning",
        message: `Measured RTP ${stats.rtp.toFixed(2)}% is off target ${project.math.targetRtp}% by ${drift.toFixed(2)}%.`,
        autoFixable: false,
      });
    }
    if (stats.maxWin > project.math.maxWin + 1e-6) {
      issues.push({ category: "math", severity: "error", message: `Observed win ${stats.maxWin.toFixed(0)}x exceeds maxWin cap ${project.math.maxWin}x.`, autoFixable: false });
    }
  }
  return issues;
}

export function checkAnimation(project: SlotProject): Issue[] {
  const bound = new Set(project.animations.map((a) => a.event));
  return CORE_EVENTS.filter((e) => !bound.has(e)).map((e) => ({
    category: "animation" as const,
    severity: "warning" as const,
    message: `No animation bound to "${e}".`,
    autoFixable: true,
  }));
}

export function checkSound(project: SlotProject): Issue[] {
  const bound = new Set(project.sounds.map((s) => s.event));
  return CORE_EVENTS.filter((e) => !bound.has(e)).map((e) => ({
    category: "sound" as const,
    severity: "warning" as const,
    message: `No sound bound to "${e}".`,
    autoFixable: true,
  }));
}

export function checkMobile(project: SlotProject): Issue[] {
  const issues: Issue[] = [];
  const px = project.grid.columns * project.grid.cellSize;
  if (px > 1200) {
    issues.push({ category: "mobile", severity: "warning", message: `Board width ${px}px may overflow small screens; consider a smaller cellSize.`, autoFixable: true });
  }
  return issues;
}

export function collectIssues(project: SlotProject, stats?: MathStats): Issue[] {
  return [
    ...checkAssets(project),
    ...checkMath(project, stats),
    ...checkAnimation(project),
    ...checkSound(project),
    ...checkMobile(project),
  ];
}

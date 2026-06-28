import { AnimationEvent as AnimationEventEnum, OPTIONAL_SYMBOL_STATES } from "@slotmaker/config";
import type { AnimationEvent, SlotProject } from "@slotmaker/config";

export type Category = "assets" | "symbols" | "math" | "animation" | "sound" | "mobile" | "export";

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

/** Critical events the validator expects every "serious" slot to wire up. */
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

/** Longest sane single animation; longer than this is almost certainly a typo. */
const MAX_ANIM_MS = 5000;

const VALID_EVENTS = new Set<string>(AnimationEventEnum.options);
const isPlaceholderFile = (f: string) => !f.includes("/") && !/^https?:/.test(f);

export function checkAssets(project: SlotProject): Issue[] {
  const issues: Issue[] = [];
  if (!project.assets.background) {
    issues.push({ category: "assets", severity: "warning", message: "No background asset set.", autoFixable: false });
  }
  return issues;
}

/**
 * Symbol state coverage. A symbol's static state is mandatory (it renders the
 * tile); the other four are optional polish. The label acts as a placeholder
 * static until a real asset is wired, so a labelled symbol is a warning, not an
 * error — keeping the reference project (no assets yet) exportable.
 */
export function checkSymbolStates(project: SlotProject): Issue[] {
  const issues: Issue[] = [];
  const statesOf = (id: string) =>
    project.symbols.find((s) => s.id === id)?.states ?? project.assets.symbols[id];

  let missingStaticNoLabel = 0;
  let placeholderStatic = 0;
  let missingOptional = 0;
  for (const s of project.symbols) {
    const st = statesOf(s.id);
    if (!st?.static) {
      if (s.label) placeholderStatic++;
      else missingStaticNoLabel++;
    }
    for (const opt of OPTIONAL_SYMBOL_STATES) {
      if (!st?.[opt]) missingOptional++;
    }
  }

  if (missingStaticNoLabel > 0) {
    issues.push({
      category: "symbols",
      severity: "warning",
      message: `${missingStaticNoLabel} symbol(s) are missing a static-state asset AND have no label — they render blank.`,
      autoFixable: true,
    });
  }
  if (placeholderStatic > 0) {
    issues.push({
      category: "symbols",
      severity: "info",
      message: `${placeholderStatic} symbol(s) use a label placeholder for their static state (no real asset yet).`,
      autoFixable: false,
    });
  }
  if (missingOptional > 0) {
    issues.push({
      category: "symbols",
      severity: "info",
      message: `${missingOptional} optional symbol state asset(s) (spin/land/win/disabled) are not set.`,
      autoFixable: false,
    });
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
  const issues: Issue[] = [];
  const bound = new Set(project.animations.map((a) => a.event));
  for (const e of CORE_EVENTS) {
    if (!bound.has(e)) {
      issues.push({ category: "animation", severity: "warning", message: `No animation bound to critical event "${e}".`, autoFixable: true });
    }
  }
  for (const a of project.animations) {
    if (a.durationMs <= 0) {
      issues.push({ category: "animation", severity: "warning", message: `Animation "${a.event}" has a non-positive duration (${a.durationMs}ms).`, autoFixable: false });
    } else if (a.durationMs > MAX_ANIM_MS) {
      issues.push({ category: "animation", severity: "warning", message: `Animation "${a.event}" duration ${a.durationMs}ms is implausibly long.`, autoFixable: false });
    }
    if (a.delayMs < 0) {
      issues.push({ category: "animation", severity: "warning", message: `Animation "${a.event}" has a negative delay.`, autoFixable: false });
    }
  }
  return issues;
}

export function checkSound(project: SlotProject): Issue[] {
  const issues: Issue[] = [];
  const bound = new Set(project.sounds.map((s) => s.event));
  for (const e of CORE_EVENTS) {
    if (!bound.has(e)) {
      issues.push({ category: "sound", severity: "warning", message: `Critical event "${e}" has no sound binding.`, autoFixable: true });
    }
  }
  for (const s of project.sounds) {
    if (!VALID_EVENTS.has(s.event)) {
      issues.push({ category: "sound", severity: "warning", message: `Sound bound to unknown event "${s.event}".`, autoFixable: false });
    }
    if (!s.file || !s.file.trim()) {
      issues.push({ category: "sound", severity: "error", message: `Sound for "${s.event}" has an empty file path.`, autoFixable: false });
    } else if (isPlaceholderFile(s.file)) {
      issues.push({ category: "sound", severity: "warning", message: `Sound for "${s.event}" is a placeholder ("${s.file}") — not wired to a real asset path.`, autoFixable: false });
    }
    if (s.volume < 0 || s.volume > 1) {
      issues.push({ category: "sound", severity: "warning", message: `Sound for "${s.event}" has volume ${s.volume} outside 0..1.`, autoFixable: true });
    }
    if (s.delayMs < 0) {
      issues.push({ category: "sound", severity: "warning", message: `Sound for "${s.event}" has a negative delay.`, autoFixable: true });
    }
  }
  return issues;
}

export function checkMobile(project: SlotProject): Issue[] {
  const issues: Issue[] = [];
  const px = project.grid.columns * project.grid.cellSize;
  if (px > 1200) {
    issues.push({ category: "mobile", severity: "warning", message: `Board width ${px}px may overflow small screens; consider a smaller cellSize.`, autoFixable: true });
  }
  return issues;
}

export function checkTemplateMechanics(project: SlotProject): Issue[] {
  const issues: Issue[] = [];
  for (const mechanic of project.templateMeta?.mechanicStatus ?? []) {
    if (mechanic.status === "implemented") continue;
    issues.push({
      category: "math",
      severity: mechanic.status === "planned" ? "warning" : "info",
      message: `${mechanic.featureId} is ${mechanic.status}: ${mechanic.note}`,
      autoFixable: false,
    });
  }
  return issues;
}

export function collectIssues(project: SlotProject, stats?: MathStats): Issue[] {
  return [
    ...checkAssets(project),
    ...checkSymbolStates(project),
    ...checkMath(project, stats),
    ...checkAnimation(project),
    ...checkSound(project),
    ...checkMobile(project),
    ...checkTemplateMechanics(project),
  ];
}

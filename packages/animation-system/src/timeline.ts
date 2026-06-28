import type { AnimationEvent, SlotProject } from "@slotmaker/config";
import type { RoundResult } from "@slotmaker/slot-runtime";
import { DEFAULT_EVENT_PRESET, presetDuration } from "./presets.js";

export interface TimelineEvent {
  id: string;
  event: AnimationEvent;
  /** Start time relative to spin start, in ms. */
  tStartMs: number;
  durationMs: number;
  preset: string;
  /** UI grouping row (e.g. "reel_drop_1", "win_detected"). */
  lane: string;
  column?: number;
  positions?: number[];
  label?: string;
}

export interface Timeline {
  events: TimelineEvent[];
  totalMs: number;
}

export interface TimelineOptions {
  /** Stagger between adjacent reel columns dropping in. */
  reelStaggerMs?: number;
  /** Total round win (bet multiples) at/above which a big-win sequence fires. */
  bigWinThreshold?: number;
}

interface ResolvedAnim {
  preset: string;
  delayMs: number;
  durationMs: number;
}

/** Resolve an event's preset + timing from the project binding, else defaults. */
function resolveAnim(project: SlotProject, event: AnimationEvent): ResolvedAnim {
  const binding = project.animations.find((a) => a.event === event);
  const preset = binding?.preset ?? DEFAULT_EVENT_PRESET[event];
  return {
    preset,
    delayMs: binding?.delayMs ?? 0,
    durationMs: binding?.durationMs ?? presetDuration(preset),
  };
}

function hasKind(project: SlotProject, grid: string[], kind: string): boolean {
  const ids = new Set(project.symbols.filter((s) => s.kind === kind).map((s) => s.id));
  return grid.some((c) => ids.has(c));
}

/**
 * Turn a played round into an ordered, timed animation timeline. The same step
 * sequence that feeds the live preview feeds this, so visuals and timeline can
 * never drift apart. Returns events sorted by start time.
 */
export function buildTimeline(
  project: SlotProject,
  round: RoundResult,
  opts: TimelineOptions = {},
): Timeline {
  const reelStagger = opts.reelStaggerMs ?? 90;
  const bigWinThreshold = opts.bigWinThreshold ?? 10;
  const { columns } = project.grid;
  const events: TimelineEvent[] = [];
  let id = 0;
  const push = (e: Omit<TimelineEvent, "id">) => events.push({ id: `e${id++}`, ...e });

  // 1. Spin start.
  const spin = resolveAnim(project, "spin_start");
  push({ event: "spin_start", tStartMs: spin.delayMs, durationMs: spin.durationMs, preset: spin.preset, lane: "spin_start" });

  // 2. Reel columns drop in, staggered, then land.
  const drop = resolveAnim(project, "reel_drop");
  const dropBase = spin.delayMs + spin.durationMs;
  let lastColEnd = dropBase;
  for (let c = 0; c < columns; c++) {
    const t = dropBase + drop.delayMs + c * reelStagger;
    push({ event: "reel_drop", tStartMs: t, durationMs: drop.durationMs, preset: drop.preset, lane: `reel_drop_${c + 1}`, column: c });
    lastColEnd = Math.max(lastColEnd, t + drop.durationMs);
  }
  const stop = resolveAnim(project, "reel_stop");
  push({ event: "reel_stop", tStartMs: lastColEnd, durationMs: stop.durationMs, preset: stop.preset, lane: "reel_stop" });

  const land = resolveAnim(project, "symbol_land");
  const landT = lastColEnd + stop.durationMs;
  push({ event: "symbol_land", tStartMs: landT, durationMs: land.durationMs, preset: land.preset, lane: "symbol_land" });

  // 3. Scatter tension on the base grid.
  const baseGrid = round.steps[0]?.grid ?? [];
  if (project.features.freeSpins && hasKind(project, baseGrid, "scatter")) {
    const sc = resolveAnim(project, "scatter_land");
    push({ event: "scatter_land", tStartMs: landT, durationMs: sc.durationMs, preset: sc.preset, lane: "scatter_land" });
  }

  // 4. Cascades: highlight → remove → drop, per winning step.
  let cursor = landT + land.durationMs;
  const win = resolveAnim(project, "win_detected");
  const hi = resolveAnim(project, "cluster_highlight");
  const rem = resolveAnim(project, "cluster_remove");
  const casc = resolveAnim(project, "cascade_drop");
  round.steps.forEach((step, i) => {
    if (step.wins.length === 0) return;
    const positions = step.removed;
    push({ event: "win_detected", tStartMs: cursor, durationMs: win.durationMs, preset: win.preset, lane: "win_detected", positions, label: `+${step.stepWin.toFixed(2)}x` });
    push({ event: "cluster_highlight", tStartMs: cursor, durationMs: hi.durationMs, preset: hi.preset, lane: "cluster_highlight", positions });
    cursor += Math.max(win.durationMs, hi.durationMs);
    push({ event: "cluster_remove", tStartMs: cursor, durationMs: rem.durationMs, preset: rem.preset, lane: "cluster_remove", positions });
    cursor += rem.durationMs;
    // Only emit a cascade_drop if there is a following step to drop into.
    if (i < round.steps.length - 1) {
      push({ event: "cascade_drop", tStartMs: cursor, durationMs: casc.durationMs, preset: casc.preset, lane: "cascade_drop" });
      cursor += casc.durationMs;
    }
  });

  // 5. Feature resolutions.
  if (round.coinWin > 0) {
    const coin = resolveAnim(project, "coin_collect");
    push({ event: "coin_collect", tStartMs: cursor, durationMs: coin.durationMs, preset: coin.preset, lane: "coin_collect", label: `+${round.coinWin.toFixed(2)}x` });
    cursor += coin.durationMs;
  }
  if (round.freeSpinsTriggered) {
    const bonus = resolveAnim(project, "bonus_trigger");
    push({ event: "bonus_trigger", tStartMs: cursor + bonus.delayMs, durationMs: bonus.durationMs, preset: bonus.preset, lane: "bonus_trigger", label: `${round.freeSpinsCount} FS` });
    cursor += bonus.delayMs + bonus.durationMs;
  }
  if (round.totalWin >= bigWinThreshold) {
    const big = resolveAnim(project, "big_win_start");
    push({ event: "big_win_start", tStartMs: cursor, durationMs: big.durationMs, preset: big.preset, lane: "big_win_start", label: `${round.totalWin.toFixed(0)}x` });
    cursor += big.durationMs;
  }

  events.sort((a, b) => a.tStartMs - b.tStartMs || a.id.localeCompare(b.id));
  const totalMs = events.reduce((m, e) => Math.max(m, e.tStartMs + e.durationMs), 0);
  return { events, totalMs };
}

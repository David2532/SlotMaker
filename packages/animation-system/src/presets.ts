import type { AnimationEvent } from "@slotmaker/config";

/**
 * Animation presets are reusable, theme-agnostic motion recipes. Phase 2 stores
 * timing + identity; the renderer maps a preset id to actual PixiJS motion.
 */
export interface AnimationPreset {
  id: string;
  defaultDurationMs: number;
  description: string;
}

export const PRESETS: Record<string, AnimationPreset> = {
  default: { id: "default", defaultDurationMs: 300, description: "Generic ease" },
  smooth_drop: { id: "smooth_drop", defaultDurationMs: 400, description: "Reel column drops in with ease-out" },
  land_bounce: { id: "land_bounce", defaultDurationMs: 160, description: "Short squash-and-stretch on landing" },
  cluster_glow: { id: "cluster_glow", defaultDurationMs: 300, description: "Winning cluster pulses/glows" },
  cascade_pop: { id: "cascade_pop", defaultDurationMs: 250, description: "Winning symbols pop and clear" },
  cascade_drop: { id: "cascade_drop", defaultDurationMs: 320, description: "Survivors fall, new symbols refill" },
  scatter_tension: { id: "scatter_tension", defaultDurationMs: 500, description: "Scatter pulse + slow-down tension" },
  stadium_hype: { id: "stadium_hype", defaultDurationMs: 600, description: "Big-win stadium crowd hype" },
  coin_roll: { id: "coin_roll", defaultDurationMs: 400, description: "Coins fly to the collector" },
};

/** Sensible default preset per event when the project has no explicit binding. */
export const DEFAULT_EVENT_PRESET: Record<AnimationEvent, string> = {
  spin_start: "default",
  reel_drop: "smooth_drop",
  reel_stop: "default",
  symbol_land: "land_bounce",
  win_detected: "cluster_glow",
  cluster_highlight: "cluster_glow",
  cluster_remove: "cascade_pop",
  cascade_drop: "cascade_drop",
  scatter_land: "scatter_tension",
  bonus_near_miss: "scatter_tension",
  bonus_trigger: "stadium_hype",
  coin_collect: "coin_roll",
  big_win_start: "stadium_hype",
  big_win_countup: "stadium_hype",
  big_win_end: "default",
};

export function presetDuration(preset: string): number {
  return PRESETS[preset]?.defaultDurationMs ?? PRESETS.default!.defaultDurationMs;
}

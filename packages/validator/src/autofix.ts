import type { SlotProject } from "@slotmaker/config";
import { CORE_EVENTS } from "./checks.js";

export interface AutoFixResult {
  project: SlotProject;
  applied: string[];
}

/** Default sound filename per event for the "Auto Sync Sounds" safe fix. */
const DEFAULT_SOUND: Record<string, string> = {
  spin_start: "spin_whoosh.wav",
  reel_drop: "reel_drop.wav",
  reel_stop: "reel_tick.wav",
  symbol_land: "soft_hit.wav",
  win_detected: "small_win.wav",
  cluster_remove: "pop_explosion.wav",
  cascade_drop: "drop.wav",
  scatter_land: "whistle_hit.wav",
  bonus_trigger: "stadium_roar.wav",
  coin_collect: "gold_coin.wav",
  big_win_start: "crowd_big_win.wav",
};

/**
 * Apply only SAFE, reversible fixes. Never touches math weights or pays — those
 * change RTP and must go through the simulator. Returns a new project; the input
 * is left untouched.
 */
export function autoFix(project: SlotProject): AutoFixResult {
  const applied: string[] = [];
  const next: SlotProject = structuredClone(project);

  // 1. Fill missing symbol labels from their names (so nothing renders blank).
  for (const s of next.symbols) {
    const a = next.assets.symbols[s.id];
    if (!a?.static && !s.label) {
      s.label = s.name.slice(0, 4).toUpperCase();
      applied.push(`Set placeholder label "${s.label}" for symbol "${s.id}".`);
    }
  }

  // 2. Bind a default sound to every unbound core event.
  const boundSounds = new Set(next.sounds.map((s) => s.event));
  for (const e of CORE_EVENTS) {
    if (!boundSounds.has(e) && DEFAULT_SOUND[e]) {
      next.sounds.push({ event: e, file: DEFAULT_SOUND[e]!, delayMs: 0, volume: 0.8 });
      applied.push(`Bound default sound "${DEFAULT_SOUND[e]}" to "${e}".`);
    }
  }

  // 3. Bind a default animation preset to every unbound core event.
  const boundAnims = new Set(next.animations.map((a) => a.event));
  for (const e of CORE_EVENTS) {
    if (!boundAnims.has(e)) {
      next.animations.push({ event: e, preset: "default", delayMs: 0, durationMs: 300 });
      applied.push(`Bound default animation preset to "${e}".`);
    }
  }

  // 4. Clamp out-of-range sound volumes / negative delays.
  for (const s of next.sounds) {
    if (s.volume < 0 || s.volume > 1) {
      const clamped = Math.max(0, Math.min(1, s.volume));
      applied.push(`Clamped volume for "${s.event}" to ${clamped}.`);
      s.volume = clamped;
    }
    if (s.delayMs < 0) {
      applied.push(`Reset negative delay for "${s.event}" to 0.`);
      s.delayMs = 0;
    }
  }

  // 5. Shrink an oversized board for mobile safety.
  if (next.grid.columns * next.grid.cellSize > 1200) {
    const fitted = Math.floor(1200 / next.grid.columns);
    next.grid.cellSize = fitted;
    applied.push(`Reduced cellSize to ${fitted}px so the board fits mobile width.`);
  }

  return { project: next, applied };
}

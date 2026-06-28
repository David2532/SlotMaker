import type { AnimationEvent, SymbolState } from "@slotmaker/config";

/**
 * Which render state a symbol should be in while a given animation event plays.
 * This lets the renderer (Phase 2B) swap per-state assets straight off the
 * timeline — the same timeline that drives the preview and the sound cues.
 */
const EVENT_STATE: Partial<Record<AnimationEvent, SymbolState>> = {
  reel_drop: "spin",
  reel_stop: "land",
  symbol_land: "land",
  win_detected: "win",
  cluster_highlight: "win",
  scatter_land: "win",
  cluster_remove: "disabled",
};

/** Returns the symbol state for an event, or "static" when none applies. */
export function eventToSymbolState(event: AnimationEvent): SymbolState {
  return EVENT_STATE[event] ?? "static";
}

import type { AnimationEvent, AssetSource, AssetStatus, SymbolState } from "@slotmaker/config";

export type AssetKind = "symbol" | "sound" | "background" | "frame";

/** The outcome of resolving one asset slot through the fallback chain. */
export interface ResolvedAsset {
  /** Unique slot key, e.g. "symbol:football:win" or "sound:bonus_trigger". */
  key: string;
  kind: AssetKind;
  status: AssetStatus;
  /** Absent only when status is "missing". */
  source?: AssetSource;
  /** Resolved file path or a `gen:` uri for generated assets. */
  uri?: string;
  /** Whether production export requires this slot to be a real asset. */
  critical: boolean;
  /** Set when a symbol state fell back to another state's asset. */
  fallbackFrom?: SymbolState;
  /** Symbol id / event the slot belongs to (for grouping in the UI). */
  ownerId?: string;
  state?: SymbolState;
  event?: AnimationEvent;
}

/** Sound events production treats as mandatory. */
export const CRITICAL_SOUND_EVENTS: AnimationEvent[] = [
  "spin_start",
  "win_detected",
  "scatter_land",
  "bonus_trigger",
  "coin_collect",
];

/** Context controlling resolution. Omit `devPack` to resolve as production would. */
export interface ResolveContext {
  /** Paths/uris known to be real & shippable. Empty in a fresh 2B project. */
  realAssets?: ReadonlySet<string>;
  /** Dev pack that procedurally generates preview assets (demo mode). */
  devPack?: DevPack;
}

/**
 * A dev pack procedurally provides preview/test assets so a project is usable
 * before real art/audio exists. It never claims to be real content.
 */
export interface DevPack {
  id: string;
  name: string;
  canSymbol(symbolId: string, state: SymbolState): boolean;
  symbolUri(symbolId: string, state: SymbolState): string;
  canSound(event: AnimationEvent): boolean;
  soundUri(event: AnimationEvent): string;
  canBackground(): boolean;
  backgroundUri(): string;
}

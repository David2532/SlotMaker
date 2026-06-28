import { z } from "zod";

/**
 * SLOT FACTORY — Project Config Schema (Source of Truth)
 *
 * Golden Rule: the editor and runtime share NO hidden state. Everything a slot
 * is — mechanic, skin, math, animation, sound — lives in this one config object.
 * The runtime only ever reads a validated `SlotProject`.
 */

export const SymbolKind = z.enum(["high", "low", "wild", "scatter", "coin"]);
export type SymbolKind = z.infer<typeof SymbolKind>;

export const Volatility = z.enum(["low", "medium", "high", "extreme"]);
export type Volatility = z.infer<typeof Volatility>;

/** A single cluster payout tier: land `minSize`+ of this symbol → pay `multiplier` x bet. */
export const PayTier = z.object({
  minSize: z.number().int().min(2),
  multiplier: z.number().min(0),
});
export type PayTier = z.infer<typeof PayTier>;

/** The five render states every symbol can express. */
export const SymbolState = z.enum(["static", "spin", "land", "win", "disabled"]);
export type SymbolState = z.infer<typeof SymbolState>;

export const ALL_SYMBOL_STATES: SymbolState[] = ["static", "spin", "land", "win", "disabled"];
export const OPTIONAL_SYMBOL_STATES: SymbolState[] = ["spin", "land", "win", "disabled"];

/**
 * How an asset slot resolved (Phase 2B asset system):
 * - real        a real, available production asset
 * - generated   a dev-pack asset produced procedurally (preview/testing only)
 * - placeholder referenced but neither real nor generatable — a generic stand-in
 * - missing     nothing resolves at all
 */
export const AssetStatus = z.enum(["real", "generated", "placeholder", "missing"]);
export type AssetStatus = z.infer<typeof AssetStatus>;

export const AssetSource = z.enum(["file", "generated", "placeholder"]);
export type AssetSource = z.infer<typeof AssetSource>;

/** Export/validation profile. Production blocks non-real critical assets. */
export const ExportProfile = z.enum(["demo", "production"]);
export type ExportProfile = z.infer<typeof ExportProfile>;

/** Per-state asset slots. Phase 2A stores paths only; the pipeline fills them later. */
export const AssetStates = z.object({
  static: z.string().optional(),
  spin: z.string().optional(),
  land: z.string().optional(),
  win: z.string().optional(),
  disabled: z.string().optional(),
});
export type AssetStates = z.infer<typeof AssetStates>;

/** Symbol definition: identity + skin hooks + math weights + payouts + states. */
export const SymbolDef = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: SymbolKind,
  /** Display color used by the placeholder renderer until real assets are wired. */
  color: z.string().default("#888888"),
  /** Short label drawn on the placeholder tile (e.g. "A", "WILD", "⚽"). */
  label: z.string().default(""),
  /** Relative drop weight per cell. Higher = more frequent. */
  weight: z.number().min(0),
  /** Cluster payout tiers. Empty for wild/scatter/coin which pay via features. */
  pays: z.array(PayTier).default([]),
  /** Coin face value (in bet multiples). Only meaningful for `kind: "coin"`. */
  coinValue: z.number().min(0).optional(),
  /** Per-symbol state asset slots (static/spin/land/win/disabled). */
  states: AssetStates.optional(),
});
export type SymbolDef = z.infer<typeof SymbolDef>;

export const GridConfig = z.object({
  columns: z.number().int().min(3).max(8),
  rows: z.number().int().min(3).max(8),
  /** Logical cell size in px used by the renderer. */
  cellSize: z.number().int().min(32).default(128),
});
export type GridConfig = z.infer<typeof GridConfig>;

export const FeatureFlags = z.object({
  clusterWins: z.boolean().default(true),
  cascades: z.boolean().default(true),
  freeSpins: z.boolean().default(false),
  coinCollector: z.boolean().default(false),
  bonusBuy: z.boolean().default(false),
});
export type FeatureFlags = z.infer<typeof FeatureFlags>;

export const FreeSpinsConfig = z.object({
  /** Scatters required in the base grid to trigger. */
  triggerScatters: z.number().int().min(2).default(3),
  /** Free spins awarded on trigger. */
  spinsAwarded: z.number().int().min(1).default(10),
  /** Global win multiplier applied during the free spins round. */
  multiplier: z.number().min(1).default(2),
});
export type FreeSpinsConfig = z.infer<typeof FreeSpinsConfig>;

export const MathConfig = z.object({
  targetRtp: z.number().min(50).max(120).default(96),
  volatility: Volatility.default("high"),
  /** Hard ceiling on a single round's total win, in bet multiples. */
  maxWin: z.number().min(1).default(5000),
  /** Smallest connected group that pays. */
  minClusterSize: z.number().int().min(3).default(5),
  /** Targets used by the validator / health score (not enforced by runtime). */
  hitFrequencyTarget: z.number().min(0).max(100).default(24),
  bonusFrequencyTarget: z.number().min(1).default(180),
  freeSpins: FreeSpinsConfig.default({}),
  /** Coins required on screen to collect (coin collector feature). */
  coinCollectThreshold: z.number().int().min(1).default(4),
});
export type MathConfig = z.infer<typeof MathConfig>;

export const AssetRegistry = z.object({
  background: z.string().optional(),
  frame: z.string().optional(),
  /** Keyed by symbol id → its state assets. */
  symbols: z.record(z.string(), AssetStates).default({}),
});
export type AssetRegistry = z.infer<typeof AssetRegistry>;

/** Canonical animation event names every slot understands. */
export const AnimationEvent = z.enum([
  "spin_start",
  "reel_drop",
  "reel_stop",
  "symbol_land",
  "win_detected",
  "cluster_highlight",
  "cluster_remove",
  "cascade_drop",
  "scatter_land",
  "bonus_near_miss",
  "bonus_trigger",
  "coin_collect",
  "big_win_start",
  "big_win_countup",
  "big_win_end",
]);
export type AnimationEvent = z.infer<typeof AnimationEvent>;

export const AnimationBinding = z.object({
  event: AnimationEvent,
  preset: z.string(),
  delayMs: z.number().min(0).default(0),
  durationMs: z.number().min(0).default(300),
});
export type AnimationBinding = z.infer<typeof AnimationBinding>;

export const SoundBinding = z.object({
  event: AnimationEvent,
  file: z.string(),
  delayMs: z.number().min(0).default(0),
  volume: z.number().min(0).max(1).default(0.8),
});
export type SoundBinding = z.infer<typeof SoundBinding>;

export const SlotProject = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().min(1),
  projectName: z.string().min(1),
  /** Mechanic template id, e.g. "cluster_6x5_collector". */
  template: z.string().min(1),
  /** Skin id, e.g. "football_black_gold". */
  theme: z.string().min(1),
  grid: GridConfig,
  features: FeatureFlags,
  math: MathConfig,
  symbols: z.array(SymbolDef).min(1),
  assets: AssetRegistry.default({ symbols: {} }),
  animations: z.array(AnimationBinding).default([]),
  sounds: z.array(SoundBinding).default([]),
});
export type SlotProject = z.infer<typeof SlotProject>;

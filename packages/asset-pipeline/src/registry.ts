import type { AssetStatus, SlotProject } from "@slotmaker/config";
import type { ResolveContext, ResolvedAsset } from "./types.js";
import { resolveAll } from "./resolver.js";

export interface Completeness {
  /** 0..1 share of slots that resolved to a real asset. */
  symbolStates: number;
  sounds: number;
  overall: number;
}

export interface ProductionAssessment {
  ready: boolean;
  /** Critical slots that are not real (block production export). */
  blockers: ResolvedAsset[];
}

export interface AssetRegistry {
  assets: ResolvedAsset[];
  counts: Record<AssetStatus, number>;
  completeness: Completeness;
  production: ProductionAssessment;
}

function realFraction(assets: ResolvedAsset[]): number {
  if (assets.length === 0) return 1;
  const real = assets.filter((a) => a.status === "real").length;
  return real / assets.length;
}

/**
 * Production readiness ignores the dev pack: it re-resolves with real assets
 * only, so any critical slot that depends on a generated/placeholder asset is
 * surfaced as a blocker. This is what the production export gate consults.
 */
export function assessProduction(project: SlotProject, realAssets?: ReadonlySet<string>): ProductionAssessment {
  const strict = resolveAll(project, { realAssets });
  const blockers = strict.filter((a) => a.critical && a.status !== "real");
  return { ready: blockers.length === 0, blockers };
}

/** Build the full asset registry report for a project under a resolution context. */
export function buildAssetRegistry(project: SlotProject, ctx: ResolveContext = {}): AssetRegistry {
  const assets = resolveAll(project, ctx);
  const counts: Record<AssetStatus, number> = { real: 0, generated: 0, placeholder: 0, missing: 0 };
  for (const a of assets) counts[a.status]++;

  const completeness: Completeness = {
    symbolStates: realFraction(assets.filter((a) => a.kind === "symbol")),
    sounds: realFraction(assets.filter((a) => a.kind === "sound")),
    overall: realFraction(assets),
  };

  return {
    assets,
    counts,
    completeness,
    production: assessProduction(project, ctx.realAssets),
  };
}

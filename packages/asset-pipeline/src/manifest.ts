import type { ExportProfile, SlotProject } from "@slotmaker/config";
import type { ResolveContext } from "./types.js";
import { buildAssetRegistry, type AssetRegistry } from "./registry.js";

export interface AssetManifest {
  profile: ExportProfile;
  counts: AssetRegistry["counts"];
  completeness: AssetRegistry["completeness"];
  productionReady: boolean;
  /** Critical slot keys still requiring real assets. */
  productionBlockers: string[];
  assets: {
    key: string;
    kind: string;
    status: string;
    source?: string;
    uri?: string;
    critical: boolean;
  }[];
}

/** Build a serializable asset manifest + status report for export bundles. */
export function buildAssetManifest(
  project: SlotProject,
  profile: ExportProfile,
  ctx: ResolveContext = {},
): AssetManifest {
  const reg = buildAssetRegistry(project, ctx);
  return {
    profile,
    counts: reg.counts,
    completeness: reg.completeness,
    productionReady: reg.production.ready,
    productionBlockers: reg.production.blockers.map((b) => b.key),
    assets: reg.assets.map((a) => ({
      key: a.key,
      kind: a.kind,
      status: a.status,
      source: a.source,
      uri: a.uri,
      critical: a.critical,
    })),
  };
}

import type { ExportProfile, SlotProject } from "@slotmaker/config";
import { computeHealth, type MathStats } from "@slotmaker/validator";
import {
  buildAssetManifest,
  createGoldenGoalRushDevPack,
  type AssetManifest,
  type DevPack,
} from "@slotmaker/asset-pipeline";

export interface ExportManifest {
  format: "slotmaker-bundle";
  formatVersion: 1;
  projectId: string;
  projectName: string;
  template: string;
  theme: string;
  profile: ExportProfile;
  exportedAt: string;
  health: number;
  exportReady: boolean;
}

export interface SlotBundle {
  manifest: ExportManifest;
  project: SlotProject;
  /** Asset registry + status report (Phase 2B). */
  assets: AssetManifest;
}

export interface ExportResult {
  ok: boolean;
  bundle: SlotBundle;
  /** Blockers that prevented a clean export (validator errors + production gate). */
  blockers: string[];
}

export interface ExportOptions {
  /** Export profile. "production" blocks placeholder/missing critical assets. */
  profile?: ExportProfile;
  /** Optional measured math, folded into the validation gate + manifest. */
  stats?: MathStats;
  /** Export even when there are blockers ("Export anyway"). */
  force?: boolean;
  /** Paths/uris considered real & shippable. */
  realAssets?: ReadonlySet<string>;
  /** Dev pack used to fill demo assets. Defaults to the Golden Goal Rush pack. */
  devPack?: DevPack;
  now?: () => Date;
}

/**
 * Build a portable, self-describing JSON bundle including an asset manifest.
 *
 * The Validator gates the export: a project with errors won't export. In the
 * "production" profile, any critical asset that is not real is also a blocker —
 * so a production build can never ship placeholder/missing assets unless forced.
 * The "demo" profile allows generated/placeholder assets (with the manifest
 * recording exactly what still needs real content).
 */
export function exportBundle(project: SlotProject, opts: ExportOptions = {}): ExportResult {
  const profile: ExportProfile = opts.profile ?? "demo";
  const health = computeHealth(project, opts.stats);

  // Demo resolves with the dev pack (generated assets ok); production resolves
  // strictly (real assets only) so the manifest tells the truth for shipping.
  const devPack = opts.devPack ?? createGoldenGoalRushDevPack();
  const assets = buildAssetManifest(project, profile, {
    realAssets: opts.realAssets,
    devPack: profile === "demo" ? devPack : undefined,
  });

  const blockers = health.issues
    .filter((i) => i.severity === "error")
    .map((i) => `[${i.category}] ${i.message}`);

  if (profile === "production" && !assets.productionReady) {
    for (const key of assets.productionBlockers) {
      blockers.push(`[assets] production requires a real asset for "${key}".`);
    }
  }

  const now = (opts.now ?? (() => new Date()))();
  const exportReady = blockers.length === 0;
  const bundle: SlotBundle = {
    manifest: {
      format: "slotmaker-bundle",
      formatVersion: 1,
      projectId: project.id,
      projectName: project.projectName,
      template: project.template,
      theme: project.theme,
      profile,
      exportedAt: now.toISOString(),
      health: health.score,
      exportReady,
    },
    project,
    assets,
  };

  return { ok: exportReady || opts.force === true, bundle, blockers };
}

/** Serialize a bundle to pretty JSON for writing to disk / download. */
export function serializeBundle(bundle: SlotBundle): string {
  return JSON.stringify(bundle, null, 2);
}

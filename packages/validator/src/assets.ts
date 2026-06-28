import type { ExportProfile, SlotProject } from "@slotmaker/config";
import { buildAssetRegistry, createGoldenGoalRushDevPack, type DevPack } from "@slotmaker/asset-pipeline";
import type { Issue } from "./checks.js";

export interface AssetCheckOptions {
  profile?: ExportProfile;
  realAssets?: ReadonlySet<string>;
  /** Dev pack used for demo resolution. Defaults to the Golden Goal Rush pack. */
  devPack?: DevPack;
}

/**
 * Resolution-level asset checks. Distinguishes the asset states the spec calls
 * out: generated dev asset used, placeholder used, missing critical asset, and
 * the production-export gate. Generated usage is informational; placeholders and
 * missing criticals warn (or block in production).
 */
export function checkAssetResolution(project: SlotProject, opts: AssetCheckOptions = {}): Issue[] {
  const profile: ExportProfile = opts.profile ?? "demo";
  const devPack = opts.devPack ?? createGoldenGoalRushDevPack();
  const reg = buildAssetRegistry(project, {
    realAssets: opts.realAssets,
    devPack: profile === "demo" ? devPack : undefined,
  });
  const issues: Issue[] = [];

  const critical = reg.assets.filter((a) => a.critical);
  const missing = critical.filter((a) => a.status === "missing");
  const placeholder = critical.filter((a) => a.status === "placeholder");
  const generated = critical.filter((a) => a.status === "generated");

  if (missing.length > 0) {
    issues.push({
      category: "assets",
      severity: profile === "production" ? "error" : "warning",
      message: `${missing.length} critical asset(s) are missing (${missing.slice(0, 3).map((a) => a.key).join(", ")}${missing.length > 3 ? "…" : ""}).`,
      autoFixable: false,
    });
  }
  if (placeholder.length > 0) {
    issues.push({
      category: "assets",
      severity: profile === "production" ? "error" : "warning",
      message: `${placeholder.length} critical asset(s) use a placeholder, not a real asset.`,
      autoFixable: false,
    });
  }
  if (generated.length > 0) {
    issues.push({
      category: "assets",
      severity: "info",
      message: `${generated.length} critical asset(s) use a generated dev asset — fine for demo, not production-ready.`,
      autoFixable: false,
    });
  }

  const optionalNotReal = reg.assets.filter((a) => a.kind === "symbol" && !a.critical && a.status !== "real").length;
  if (optionalNotReal > 0) {
    issues.push({
      category: "assets",
      severity: "info",
      message: `${optionalNotReal} optional symbol-state asset(s) are not real yet.`,
      autoFixable: false,
    });
  }

  if (profile === "production" && !reg.production.ready) {
    issues.push({
      category: "export",
      severity: "error",
      message: `Production export blocked: ${reg.production.blockers.length} critical asset(s) are not real.`,
      autoFixable: false,
    });
  }

  return issues;
}

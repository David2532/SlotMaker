import type { SlotProject } from "@slotmaker/config";
import { collectIssues, type Category, type Issue, type MathStats } from "./checks.js";
import { checkAssetResolution, type AssetCheckOptions } from "./assets.js";

const CATEGORIES: Category[] = ["assets", "symbols", "math", "animation", "sound", "mobile", "export"];

const PENALTY = { error: 35, warning: 12, info: 0 } as const;

export interface CategoryScore {
  category: Category;
  score: number;
}

export interface HealthReport {
  /** Overall 0–100 project health (average of category scores). */
  score: number;
  categories: CategoryScore[];
  issues: Issue[];
  exportReady: boolean;
}

/**
 * Compute the Slot Health Score. Each category starts at 100 and loses points
 * per issue. Export is "ready" only when there are no errors.
 */
export function computeHealth(
  project: SlotProject,
  stats?: MathStats,
  assetOptions?: AssetCheckOptions,
): HealthReport {
  const issues = [...collectIssues(project, stats), ...checkAssetResolution(project, assetOptions)];
  const categories: CategoryScore[] = CATEGORIES.map((category) => {
    const own = issues.filter((i) => i.category === category);
    const lost = own.reduce((s, i) => s + PENALTY[i.severity], 0);
    return { category, score: Math.max(0, 100 - lost) };
  });

  // Export readiness is its own category, gated on zero errors anywhere.
  const hasError = issues.some((i) => i.severity === "error");
  const exportCat = categories.find((c) => c.category === "export")!;
  exportCat.score = hasError ? 40 : 100;

  const score = Math.round(
    categories.reduce((s, c) => s + c.score, 0) / categories.length,
  );

  return { score, categories, issues, exportReady: !hasError };
}

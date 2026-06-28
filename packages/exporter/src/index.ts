import type { SlotProject } from "@slotmaker/config";
import { computeHealth, type MathStats } from "@slotmaker/validator";

export interface ExportManifest {
  format: "slotmaker-bundle";
  formatVersion: 1;
  projectId: string;
  projectName: string;
  template: string;
  theme: string;
  exportedAt: string;
  health: number;
  exportReady: boolean;
}

export interface SlotBundle {
  manifest: ExportManifest;
  project: SlotProject;
}

export interface ExportResult {
  ok: boolean;
  bundle: SlotBundle;
  /** Validation blockers that prevented a clean export (errors only). */
  blockers: string[];
}

export interface ExportOptions {
  /** Optional measured math, folded into the validation gate + manifest. */
  stats?: MathStats;
  /** Export even when the validator reports errors ("Export anyway"). */
  force?: boolean;
  now?: () => Date;
}

/**
 * Build a portable, self-describing JSON bundle. The Validator is the gate:
 * by default a project with errors will NOT export — no broken builds.
 */
export function exportBundle(project: SlotProject, opts: ExportOptions = {}): ExportResult {
  const health = computeHealth(project, opts.stats);
  const blockers = health.issues
    .filter((i) => i.severity === "error")
    .map((i) => `[${i.category}] ${i.message}`);

  const now = (opts.now ?? (() => new Date()))();
  const bundle: SlotBundle = {
    manifest: {
      format: "slotmaker-bundle",
      formatVersion: 1,
      projectId: project.id,
      projectName: project.projectName,
      template: project.template,
      theme: project.theme,
      exportedAt: now.toISOString(),
      health: health.score,
      exportReady: health.exportReady,
    },
    project,
  };

  const ok = health.exportReady || opts.force === true;
  return { ok, bundle, blockers };
}

/** Serialize a bundle to pretty JSON for writing to disk / download. */
export function serializeBundle(bundle: SlotBundle): string {
  return JSON.stringify(bundle, null, 2);
}

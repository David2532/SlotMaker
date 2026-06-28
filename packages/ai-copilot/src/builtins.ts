import type { SlotProject } from "@slotmaker/config";
import { autoFix } from "@slotmaker/validator";
import type { Proposal } from "./proposal.js";

/**
 * Production-readiness proposal backed by the existing Validator auto-fix: binds
 * default sounds/animations, fills placeholder labels and fits the board. It is a
 * deterministic, safe-only patch — never touches math weights or pays.
 */
export function proposeProductionFixes(project: SlotProject, now: () => Date = () => new Date()): Proposal {
  const { project: fixed, applied } = autoFix(project);
  return {
    id: `mock-prodfix-${now().getTime()}`,
    type: "qa",
    title: `Production readiness: ${applied.length} safe fix(es)`,
    summary: applied.length
      ? `Applies ${applied.length} safe fixes (default sounds/animations, labels, mobile fit). Real assets are still required for a production export.`
      : "No safe production fixes needed.",
    risk: "low",
    affectedAreas: ["animations", "sounds", "symbols.label", "grid.cellSize"],
    patch: { animations: fixed.animations, sounds: fixed.sounds, symbols: fixed.symbols, grid: fixed.grid },
    requiredValidation: ["schema", "health"],
    createdAt: now().toISOString(),
    provider: { name: "mock", model: "validator-autofix", version: "1" },
  };
}

import { parseProject, type SlotProject } from "@slotmaker/config";
import { computeHealth, type HealthReport } from "@slotmaker/validator";
import type { Proposal } from "./proposal.js";

type Json = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** JSON merge: objects merge recursively; arrays and primitives are replaced. */
export function deepMerge<T>(target: T, patch: unknown): T {
  if (!isPlainObject(target) || !isPlainObject(patch)) return patch as T;
  const out: Json = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export interface DiffEntry {
  path: string;
  before: string;
  after: string;
}

const show = (v: unknown) => {
  const s = JSON.stringify(v) ?? "undefined";
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
};

/** Field-level diff between two projects, for the review preview. */
export function diffProject(before: unknown, after: unknown, path = ""): DiffEntry[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].flatMap((k) => diffProject(before[k], after[k], path ? `${path}.${k}` : k));
  }
  return [{ path: path || "(root)", before: show(before), after: show(after) }];
}

const FORBIDDEN = [/"status"\s*:\s*"real"/i, /realassets/i, /apikey/i, /secret/i, /"token"/i];

export interface SafetyResult {
  ok: boolean;
  errors: string[];
}

/**
 * Reject proposals that try to do something the Copilot must never do: mark
 * assets as real, smuggle secrets/keys, or rewrite identity/version fields.
 */
export function validateProposalSafety(proposal: Proposal): SafetyResult {
  const errors: string[] = [];
  const blob = JSON.stringify(proposal);
  for (const re of FORBIDDEN) {
    if (re.test(blob)) errors.push(`Proposal contains a forbidden pattern (${re.source}).`);
  }
  if ("id" in proposal.patch) errors.push("A proposal may not change the project id.");
  if ("schemaVersion" in proposal.patch) errors.push("A proposal may not change schemaVersion.");
  return { ok: errors.length === 0, errors };
}

export interface ApplyResult {
  applied: boolean;
  /** The new project if applied, otherwise the original (rolled back). */
  project: SlotProject;
  rolledBack: boolean;
  errors: string[];
  validation?: HealthReport;
  diff: DiffEntry[];
}

export interface ApplyOptions {
  /** Apply even if validation reports errors (explicit override). */
  allowErrors?: boolean;
}

/**
 * Apply a proposal as a reviewed, validated patch. Safety + schema + health are
 * all checked; on any failure the project is rolled back to its prior state.
 */
export function applyProposal(project: SlotProject, proposal: Proposal, opts: ApplyOptions = {}): ApplyResult {
  const safety = validateProposalSafety(proposal);
  if (!safety.ok) {
    return { applied: false, project, rolledBack: true, errors: safety.errors, diff: [] };
  }

  const candidate = deepMerge(project, proposal.patch);
  const parsed = parseProject(candidate);
  if (!parsed.ok) {
    return { applied: false, project, rolledBack: true, errors: parsed.errors, diff: diffProject(project, candidate) };
  }

  const validation = computeHealth(parsed.project);
  const diff = diffProject(project, parsed.project);
  const hardErrors = validation.issues.filter((i) => i.severity === "error").map((i) => `[${i.category}] ${i.message}`);
  if (hardErrors.length > 0 && !opts.allowErrors) {
    return { applied: false, project, rolledBack: true, errors: hardErrors, validation, diff };
  }
  return { applied: true, project: parsed.project, rolledBack: false, errors: [], validation, diff };
}

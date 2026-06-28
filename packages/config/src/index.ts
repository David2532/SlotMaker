import { SlotProject } from "./schema.js";
import type { SlotProject as SlotProjectType } from "./schema.js";

export * from "./schema.js";
export * from "./features.js";
export * from "./templates.js";
export * from "./wizard.js";

/** Result of parsing/validating an unknown value against the project schema. */
export type ParseResult =
  | { ok: true; project: SlotProjectType }
  | { ok: false; errors: string[] };

/**
 * Validate and normalize an arbitrary value into a fully-defaulted SlotProject.
 * This is the single gate every loader (editor, CLI, runtime) goes through.
 */
export function parseProject(input: unknown): ParseResult {
  const parsed = SlotProject.safeParse(input);
  if (parsed.success) return { ok: true, project: parsed.data };
  const errors = parsed.error.issues.map(
    (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
  );
  return { ok: false, errors };
}

/** Throwing variant — use when a failure is a programmer error, not user input. */
export function loadProject(input: unknown): SlotProjectType {
  const res = parseProject(input);
  if (!res.ok) {
    throw new Error(`Invalid SlotProject:\n - ${res.errors.join("\n - ")}`);
  }
  return res.project;
}

/** Total drop weight across all symbols — handy for math + validation. */
export function totalWeight(project: SlotProjectType): number {
  return project.symbols.reduce((sum, s) => sum + s.weight, 0);
}

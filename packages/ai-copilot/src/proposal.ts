import { z } from "zod";

/**
 * The Copilot never mutates a project directly. It emits **proposals** — typed,
 * reviewable suggestions carrying a config patch. The user approves; the
 * Validator, Asset Registry and Math Lab decide whether a proposal is sound.
 */
export const ProposalType = z.enum([
  "theme",
  "assets",
  "animation",
  "sound",
  "math",
  "reskin",
  "export",
  "qa",
]);
export type ProposalType = z.infer<typeof ProposalType>;

export const RiskLevel = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

/** Which gates a proposal expects to pass before it should be trusted. */
export const ValidationRequirement = z.enum(["schema", "health", "math", "assets"]);
export type ValidationRequirement = z.infer<typeof ValidationRequirement>;

export const ProviderMeta = z.object({
  name: z.string(),
  model: z.string().optional(),
  version: z.string().optional(),
});
export type ProviderMeta = z.infer<typeof ProviderMeta>;

export const Proposal = z.object({
  id: z.string().min(1),
  type: ProposalType,
  title: z.string().min(1),
  summary: z.string(),
  risk: RiskLevel,
  affectedAreas: z.array(z.string()).default([]),
  /** A JSON merge patch applied onto the project (arrays replaced wholesale). */
  patch: z.record(z.string(), z.unknown()).default({}),
  requiredValidation: z.array(ValidationRequirement).default(["schema", "health"]),
  /** Set when the proposal needs the user to do something first (e.g. simulate). */
  blockedReason: z.string().optional(),
  createdAt: z.string(),
  provider: ProviderMeta,
});
export type Proposal = z.infer<typeof Proposal>;

export function parseProposal(input: unknown):
  | { ok: true; proposal: Proposal }
  | { ok: false; errors: string[] } {
  const r = Proposal.safeParse(input);
  if (r.success) return { ok: true, proposal: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

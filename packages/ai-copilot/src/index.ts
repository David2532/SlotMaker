export {
  Proposal,
  ProposalType,
  RiskLevel,
  ValidationRequirement,
  parseProposal,
  type ProviderMeta,
} from "./proposal.js";
export type { AIProvider } from "./provider.js";
export { createMockProvider } from "./mock.js";
export { proposeProductionFixes } from "./builtins.js";
export {
  deepMerge,
  diffProject,
  validateProposalSafety,
  applyProposal,
  type DiffEntry,
  type ApplyResult,
  type ApplyOptions,
  type SafetyResult,
} from "./patch.js";
export {
  createAuditLog,
  summarizeProposal,
  type AuditLog,
  type AuditEntry,
} from "./audit.js";

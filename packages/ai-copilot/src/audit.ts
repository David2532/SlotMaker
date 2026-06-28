import type { Proposal } from "./proposal.js";

export interface AuditEntry {
  at: string;
  prompt: string;
  proposalId: string;
  proposalType: string;
  summary: string;
  decision: "accepted" | "rejected";
  /** Validation outcome at apply time. */
  validation: "passed" | "failed" | "n/a";
  errors: string[];
}

export interface AuditLog {
  record(entry: Omit<AuditEntry, "at">): AuditEntry;
  entries(): readonly AuditEntry[];
}

/**
 * A simple in-memory proposal history. Holds no secrets — only prompt text,
 * proposal summaries and validation outcomes — so it is safe to export/inspect.
 */
export function createAuditLog(now: () => Date = () => new Date()): AuditLog {
  const log: AuditEntry[] = [];
  return {
    record(entry) {
      const full: AuditEntry = { at: now().toISOString(), ...entry };
      log.push(full);
      return full;
    },
    entries: () => log,
  };
}

export function summarizeProposal(p: Proposal): string {
  return `${p.type}: ${p.title}`;
}

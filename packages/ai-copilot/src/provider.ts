import type { SlotProject } from "@slotmaker/config";
import type { MathReport } from "@slotmaker/math-engine";
import type { Proposal } from "./proposal.js";

/**
 * Provider-neutral AI interface. Real providers (a hosted model, a local model)
 * implement this later; nothing here is provider-specific, and the mock provider
 * lets tests and CI run with no API keys.
 */
export interface AIProvider {
  readonly name: string;
  generateThemeProposal(project: SlotProject, prompt: string): Promise<Proposal>;
  generateAnimationProposal(project: SlotProject, prompt: string): Promise<Proposal>;
  generateSoundProposal(project: SlotProject, prompt: string): Promise<Proposal>;
  /** Balance proposals must reference a real math report — never fabricate RTP. */
  generateBalanceProposal(project: SlotProject, mathReport: MathReport | undefined, prompt: string): Promise<Proposal>;
  generateReskinProposal(project: SlotProject, prompt: string): Promise<Proposal>;
}

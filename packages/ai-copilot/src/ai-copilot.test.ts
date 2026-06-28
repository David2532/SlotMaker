import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { buildMathReport, multiSeedSimulate } from "@slotmaker/math-engine";
import { buildAssetRegistry, createGoldenGoalRushDevPack } from "@slotmaker/asset-pipeline";
import {
  applyProposal,
  createAuditLog,
  createMockProvider,
  parseProposal,
  proposeProductionFixes,
  validateProposalSafety,
  type Proposal,
} from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);
const provider = createMockProvider({ now: () => new Date("2026-01-01T00:00:00Z") });

describe("mock provider", () => {
  it("emits schema-valid proposals for theme/animation/sound", async () => {
    for (const p of [
      await provider.generateThemeProposal(project, "neon"),
      await provider.generateAnimationProposal(project, ""),
      await provider.generateSoundProposal(project, ""),
    ]) {
      expect(parseProposal(p).ok).toBe(true);
      expect(p.provider.name).toBe("mock");
    }
  });

  it("requires a math report before proposing balance changes", async () => {
    const blocked = await provider.generateBalanceProposal(project, undefined, "balance");
    expect(blocked.blockedReason).toBe("missing-math-report");
    expect(blocked.patch).toEqual({});

    const report = buildMathReport(project, multiSeedSimulate(project, { spins: 3000, seeds: 2 }));
    const real = await provider.generateBalanceProposal(project, report, "balance");
    expect(real.requiredValidation).toContain("math");
    expect(real.summary).toContain(report.rtp.observed.toFixed(2)); // references the real number
  });
});

describe("applyProposal", () => {
  it("applies a safe proposal and reports a diff", async () => {
    const p = await provider.generateAnimationProposal(project, "");
    const res = applyProposal(project, p);
    expect(res.applied).toBe(true);
    expect(res.rolledBack).toBe(false);
    expect(res.diff.length).toBeGreaterThan(0);
    expect(res.project.animations.length).toBeGreaterThanOrEqual(project.animations.length);
  });

  it("rolls back when the patch fails validation", () => {
    const bad: Proposal = {
      id: "x", type: "math", title: "break coins", summary: "", risk: "high",
      affectedAreas: [], requiredValidation: ["schema", "health"],
      // Removes the coin symbol while coinCollector is on → validator error.
      patch: { symbols: project.symbols.filter((s) => s.kind !== "coin") },
      createdAt: "2026-01-01T00:00:00Z", provider: { name: "mock" },
    };
    const res = applyProposal(project, bad);
    expect(res.applied).toBe(false);
    expect(res.rolledBack).toBe(true);
    expect(res.project).toBe(project); // unchanged
    expect(res.errors.some((e) => /coin/i.test(e))).toBe(true);
  });

  it("never lets a proposal mark generated assets as real, or carry secrets", () => {
    const malicious: Proposal = {
      id: "m", type: "assets", title: "fake real", summary: "", risk: "high",
      affectedAreas: [], requiredValidation: ["schema"],
      patch: { assets: { realAssets: ["x.png"] }, apiKey: "sk-123" } as Record<string, unknown>,
      createdAt: "2026-01-01T00:00:00Z", provider: { name: "mock" },
    };
    expect(validateProposalSafety(malicious).ok).toBe(false);
    expect(applyProposal(project, malicious).applied).toBe(false);
  });

  it("an applied asset proposal still resolves as not-real (no fake reals)", async () => {
    const sound = await provider.generateSoundProposal(project, "");
    const res = applyProposal(project, sound);
    const reg = buildAssetRegistry(res.project, { devPack: createGoldenGoalRushDevPack() });
    expect(reg.counts.real).toBe(0);
  });
});

describe("production fixes + audit log", () => {
  it("production-fix proposal raises health when applied", () => {
    const p = proposeProductionFixes(project, () => new Date("2026-01-01T00:00:00Z"));
    const res = applyProposal(project, p);
    expect(res.applied).toBe(true);
  });

  it("audit log records decisions and holds no secrets", () => {
    const log = createAuditLog(() => new Date("2026-01-01T00:00:00Z"));
    log.record({ prompt: "neon theme", proposalId: "mock-1", proposalType: "theme", summary: "palette", decision: "accepted", validation: "passed", errors: [] });
    expect(log.entries()).toHaveLength(1);
    const blob = JSON.stringify(log.entries());
    expect(/apikey|secret|token/i.test(blob)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { simulate, suggestBalance } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

describe("simulate", () => {
  it("is reproducible for a fixed seed", () => {
    const a = simulate(project, { spins: 5000, seed: 7 });
    const b = simulate(project, { spins: 5000, seed: 7 });
    expect(a.rtp).toBe(b.rtp);
    expect(a.bonusTriggers).toBe(b.bonusTriggers);
  });

  it("reports a finite, plausible RTP and consistent contributions", () => {
    const r = simulate(project, { spins: 20000, seed: 1 });
    expect(Number.isFinite(r.rtp)).toBe(true);
    expect(r.rtp).toBeGreaterThan(0);
    // base + freeSpins + coin contributions should sum to the total RTP.
    const sum = r.contribution.base + r.contribution.freeSpins + r.contribution.coin;
    expect(Math.abs(sum - r.rtp)).toBeLessThan(1e-6);
  });

  it("never reports a max win above the configured cap", () => {
    const r = simulate(project, { spins: 20000, seed: 3 });
    expect(r.maxWin).toBeLessThanOrEqual(project.math.maxWin);
  });

  it("distribution counts sum to the number of spins", () => {
    const spins = 8000;
    const r = simulate(project, { spins, seed: 5 });
    const total = r.distribution.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(spins);
  });
});

describe("suggestBalance", () => {
  it("produces at least one RTP-oriented suggestion", () => {
    const r = simulate(project, { spins: 5000, seed: 2 });
    const tips = suggestBalance(project, r);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.some((t) => t.message.toLowerCase().includes("rtp"))).toBe(true);
  });
});

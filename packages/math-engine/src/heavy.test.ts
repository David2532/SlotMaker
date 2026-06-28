import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import {
  analyzeBonusBuy,
  analyzeVolatility,
  buildMathReport,
  labelFromStdDev,
  multiSeedSimulate,
  simulate,
} from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

describe("multiSeedSimulate", () => {
  it("reports a spread and a confidence band, and is reproducible", () => {
    const a = multiSeedSimulate(project, { spins: 4000, seeds: 5 });
    const b = multiSeedSimulate(project, { spins: 4000, seeds: 5 });
    expect(a.seedCount).toBe(5);
    expect(a.totalSpins).toBe(20000);
    expect(a.rtp.min).toBeLessThanOrEqual(a.rtp.mean);
    expect(a.rtp.max).toBeGreaterThanOrEqual(a.rtp.mean);
    expect(a.confidence.low).toBeLessThanOrEqual(a.confidence.high);
    expect(a.rtp.mean).toBe(b.rtp.mean); // deterministic
  });

  it("reports progress for each seed", () => {
    const seen: number[] = [];
    multiSeedSimulate(project, { spins: 1000, seeds: 4, onProgress: (d) => seen.push(d) });
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it("aggregate distribution counts sum to the total spins", () => {
    const m = multiSeedSimulate(project, { spins: 3000, seeds: 3 });
    const total = m.aggregate.distribution.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(9000);
  });
});

describe("analyzeVolatility", () => {
  it("labels by stdDev and compares to config", () => {
    expect(labelFromStdDev(0.5)).toBe("low");
    expect(labelFromStdDev(10)).toBe("extreme");
    const agg = multiSeedSimulate(project, { spins: 8000, seeds: 3 }).aggregate;
    const v = analyzeVolatility(project, agg);
    expect(["low", "medium", "high", "extreme"]).toContain(v.label);
    expect(v.bigWinDependency).toBeGreaterThanOrEqual(0);
    expect(v.featureDependency).toBeGreaterThanOrEqual(0);
  });
});

describe("analyzeBonusBuy", () => {
  it("computes EV, fair price and flags a too-cheap buy as +EV", () => {
    const r = analyzeBonusBuy(project, { rounds: 5000 });
    expect(r.expectedValue).toBeGreaterThan(0);
    expect(r.fairPrice).toBeGreaterThan(0);
    // A buy price of 0 in config would be far below EV → warning present.
    const cheap = analyzeBonusBuy({ ...project, math: { ...project.math, bonusBuyCost: 1 } } as SlotProject, { rounds: 5000 });
    expect(cheap.warnings.length).toBeGreaterThan(0);
  });
});

describe("buildMathReport", () => {
  it("assembles a complete, serializable report with warnings", () => {
    const multi = multiSeedSimulate(project, { spins: 5000, seeds: 3 });
    const report = buildMathReport(project, multi, { bonusBuyRounds: 3000, now: () => new Date("2026-01-01T00:00:00Z") });
    expect(report.sampleSize).toBe(15000);
    expect(report.lowSample).toBe(true); // 15k < 100k
    expect(report.warnings.some((w) => /Sample size/.test(w))).toBe(true);
    expect(report.distribution.length).toBeGreaterThan(0);
    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(() => JSON.stringify(report)).not.toThrow();
  });
});

describe("simulate (reshaped)", () => {
  it("tracks return stddev/skew and win-rate buckets", () => {
    const r = simulate(project, { spins: 20000, seed: 1 });
    expect(r.returnStdDev).toBeGreaterThan(0);
    expect(Number.isFinite(r.returnSkew)).toBe(true);
    const rateSum = r.deadSpinRate + r.smallWinRate + r.mediumWinRate + r.bigWinRate;
    expect(Math.abs(rateSum - 100)).toBeLessThan(1e-6);
  });
});

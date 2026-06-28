import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { Rng, detectClusters, spin } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(123);
    const b = new Rng(123);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("returns values in [0,1)", () => {
    const r = new Rng(999);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("detectClusters", () => {
  it("pays a connected group at or above minClusterSize", () => {
    // 6x5 grid: place 5 'ace' in a connected L-shape, rest unique non-paying fillers.
    const grid = new Array(30).fill("scatter");
    // indices 0,1,2 (top row) + 6,12 (down left column) → connected 5-cluster
    for (const i of [0, 1, 2, 6, 12]) grid[i] = "ace";
    const wins = detectClusters(project, grid);
    const ace = wins.find((w) => w.symbolId === "ace");
    const expectedPay = project.symbols.find((s) => s.id === "ace")!.pays
      .filter((t) => t.minSize <= 5)
      .sort((a, b) => b.minSize - a.minSize)[0]!.multiplier;
    expect(ace).toBeDefined();
    expect(ace!.size).toBe(5);
    expect(ace!.multiplier).toBe(expectedPay);
  });

  it("does not pay groups below minClusterSize", () => {
    const grid = new Array(30).fill("scatter");
    for (const i of [0, 1, 2, 3]) grid[i] = "ace"; // only 4 connected
    expect(detectClusters(project, grid).find((w) => w.symbolId === "ace")).toBeUndefined();
  });

  it("lets wilds extend a cluster", () => {
    const grid = new Array(30).fill("scatter");
    for (const i of [0, 1, 2, 6]) grid[i] = "ace";
    grid[12] = "wild"; // wild bridges to make 5
    const ace = detectClusters(project, grid).find((w) => w.symbolId === "ace");
    expect(ace?.size).toBe(5);
  });
});

describe("spin", () => {
  it("is reproducible for the same seed and never exceeds maxWin", () => {
    const a = spin(project, 42);
    const b = spin(project, 42);
    expect(a.totalWin).toBe(b.totalWin);
    expect(a.totalWin).toBeLessThanOrEqual(project.math.maxWin);
    expect(a.steps.length).toBeGreaterThan(0);
  });
});

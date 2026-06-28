import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { autoFix, computeHealth } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

describe("computeHealth", () => {
  it("scores the reference project between 0 and 100 and lists categories", () => {
    const report = computeHealth(project);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.categories).toHaveLength(6);
  });

  it("marks export ready when there are no errors", () => {
    const report = computeHealth(project);
    expect(report.exportReady).toBe(report.issues.every((i) => i.severity !== "error"));
  });
});

describe("autoFix", () => {
  it("raises the health score by binding default sounds and animations", () => {
    const before = computeHealth(project).score;
    const { project: fixed, applied } = autoFix(project);
    const after = computeHealth(fixed).score;
    expect(applied.length).toBeGreaterThan(0);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("does not mutate the original project", () => {
    const soundsBefore = project.sounds.length;
    autoFix(project);
    expect(project.sounds.length).toBe(soundsBefore);
  });
});

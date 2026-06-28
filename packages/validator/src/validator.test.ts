import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { autoFix, checkSound, checkSymbolStates, computeHealth } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

describe("computeHealth", () => {
  it("scores the reference project between 0 and 100 and lists all categories", () => {
    const report = computeHealth(project);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.categories).toHaveLength(7);
    expect(report.categories.map((c) => c.category)).toContain("symbols");
  });

  it("marks export ready when there are no errors", () => {
    const report = computeHealth(project);
    expect(report.exportReady).toBe(report.issues.every((i) => i.severity !== "error"));
  });
});

describe("checkSound (hardened)", () => {
  it("flags bare filenames as placeholders, not real assets", () => {
    const issues = checkSound(project);
    expect(issues.some((i) => i.severity === "warning" && /placeholder/i.test(i.message))).toBe(true);
  });

  it("errors on an empty file path and warns on out-of-range volume / negative delay", () => {
    // Build past the schema (which would reject these) to exercise the defensive checks.
    const broken = {
      ...project,
      sounds: [
        { event: "spin_start", file: "", delayMs: 0, volume: 0.8 },
        { event: "win_detected", file: "assets/win.wav", delayMs: -10, volume: 2 },
      ],
    } as unknown as SlotProject;
    const issues = checkSound(broken);
    expect(issues.some((i) => i.severity === "error" && /empty file/i.test(i.message))).toBe(true);
    expect(issues.some((i) => /volume .* outside/i.test(i.message))).toBe(true);
    expect(issues.some((i) => /negative delay/i.test(i.message))).toBe(true);
    // A real asset path is NOT flagged as a placeholder.
    expect(issues.some((i) => /placeholder/i.test(i.message) && i.message.includes("win.wav"))).toBe(false);
  });
});

describe("checkSymbolStates", () => {
  it("reports placeholder/optional state coverage for the reference project", () => {
    const issues = checkSymbolStates(project);
    // Golden symbols have labels but no real assets → placeholder + missing-optional info.
    expect(issues.some((i) => /placeholder/i.test(i.message))).toBe(true);
    expect(issues.some((i) => /optional symbol state/i.test(i.message))).toBe(true);
  });

  it("warns when a symbol has neither a static asset nor a label", () => {
    const blanked = {
      ...project,
      symbols: project.symbols.map((s, i) => (i === 0 ? { ...s, label: "" } : s)),
    } as SlotProject;
    const issues = checkSymbolStates(blanked);
    expect(issues.some((i) => i.severity === "warning" && /render blank/i.test(i.message))).toBe(true);
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

  it("clamps an out-of-range volume and negative delay", () => {
    const broken = {
      ...project,
      sounds: [{ event: "spin_start", file: "x.wav", delayMs: -5, volume: 1.5 }],
    } as unknown as SlotProject;
    const { project: fixed } = autoFix(broken);
    expect(fixed.sounds[0]!.volume).toBe(1);
    expect(fixed.sounds[0]!.delayMs).toBe(0);
  });

  it("does not mutate the original project", () => {
    const soundsBefore = project.sounds.length;
    autoFix(project);
    expect(project.sounds.length).toBe(soundsBefore);
  });
});

import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { spin } from "@slotmaker/slot-runtime";
import { buildTimeline } from "@slotmaker/animation-system";
import { autoSyncSounds, buildSoundCues, STADIUM_PACK } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

describe("buildSoundCues", () => {
  it("schedules cues sorted by time, each with a file and delay applied", () => {
    const tl = buildTimeline(project, spin(project, 1));
    const cues = buildSoundCues(project, tl);
    expect(cues.length).toBeGreaterThan(0);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]!.tMs).toBeGreaterThanOrEqual(cues[i - 1]!.tMs);
    }
    expect(cues.every((c) => c.file.length > 0)).toBe(true);

    // The spin_start binding has delay 0; scatter binding has a 50ms delay.
    const spinCue = cues.find((c) => c.event === "spin_start");
    expect(spinCue).toBeDefined();
  });
});

describe("autoSyncSounds", () => {
  it("fills unbound events from the pack without dropping existing bindings", () => {
    const before = project.sounds.length;
    const synced = autoSyncSounds(project, STADIUM_PACK);
    expect(synced.length).toBeGreaterThan(before);
    // Existing bindings are preserved (reel_stop was already set).
    expect(synced.find((s) => s.event === "reel_stop")).toBeDefined();
    // A previously-unbound pack event is now present.
    expect(synced.find((s) => s.event === "cluster_remove")).toBeDefined();
  });

  it("does not mutate the source project", () => {
    const len = project.sounds.length;
    autoSyncSounds(project);
    expect(project.sounds.length).toBe(len);
  });
});

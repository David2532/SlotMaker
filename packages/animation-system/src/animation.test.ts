import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { spin, type RoundResult } from "@slotmaker/slot-runtime";
import { buildTimeline } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

/** Find a seed that produces at least one winning cascade step. */
function winningRound(): RoundResult {
  for (let s = 1; s < 500; s++) {
    const r = spin(project, s * 2654435761);
    if (r.steps.some((st) => st.wins.length > 0)) return r;
  }
  throw new Error("no winning round found");
}

describe("buildTimeline", () => {
  it("always starts with spin_start at the front", () => {
    const tl = buildTimeline(project, spin(project, 1));
    expect(tl.events[0]!.event).toBe("spin_start");
  });

  it("emits one reel_drop per column, on staggered lanes", () => {
    const tl = buildTimeline(project, spin(project, 1));
    const drops = tl.events.filter((e) => e.event === "reel_drop");
    expect(drops).toHaveLength(project.grid.columns);
    const lanes = new Set(drops.map((d) => d.lane));
    expect(lanes.size).toBe(project.grid.columns);
    // Staggered: later columns start later.
    const byCol = [...drops].sort((a, b) => a.column! - b.column!);
    for (let i = 1; i < byCol.length; i++) {
      expect(byCol[i]!.tStartMs).toBeGreaterThan(byCol[i - 1]!.tStartMs);
    }
  });

  it("is sorted by start time and has a positive total duration", () => {
    const tl = buildTimeline(project, winningRound());
    for (let i = 1; i < tl.events.length; i++) {
      expect(tl.events[i]!.tStartMs).toBeGreaterThanOrEqual(tl.events[i - 1]!.tStartMs);
    }
    expect(tl.totalMs).toBeGreaterThan(0);
  });

  it("produces cluster_remove events for winning cascade steps", () => {
    const round = winningRound();
    const tl = buildTimeline(project, round);
    const removes = tl.events.filter((e) => e.event === "cluster_remove");
    const winningSteps = round.steps.filter((s) => s.wins.length > 0).length;
    expect(removes).toHaveLength(winningSteps);
    expect(removes.every((r) => (r.positions?.length ?? 0) > 0)).toBe(true);
  });
});

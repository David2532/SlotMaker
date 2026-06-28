import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { createGoldenGoalRushDevPack } from "@slotmaker/asset-pipeline";
import { createToneSink, resolveSoundCue } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);
const devPack = createGoldenGoalRushDevPack();

describe("resolveSoundCue", () => {
  it("attaches a tone spec for a generated (demo) cue", () => {
    const r = resolveSoundCue(project, "spin_start", { devPack });
    expect(r.status).toBe("generated");
    expect(r.tone).toBeDefined();
    expect(r.tone!.freq).toBeGreaterThan(0);
  });

  it("resolves a real file when one is registered", () => {
    const p: SlotProject = { ...project, sounds: [{ event: "spin_start", file: "real/spin.wav", delayMs: 0, volume: 0.8 }] };
    const r = resolveSoundCue(p, "spin_start", { realAssets: new Set(["real/spin.wav"]) });
    expect(r.status).toBe("real");
    expect(r.tone).toBeUndefined();
  });

  it("is a placeholder when a file is referenced but not real and no dev pack", () => {
    const r = resolveSoundCue(project, "spin_start", {});
    expect(r.status).toBe("placeholder");
  });
});

describe("createToneSink", () => {
  it("is server-safe: returns a no-op sink when WebAudio is unavailable", () => {
    const sink = createToneSink();
    expect(sink.play("gen:tone/spin_start", 0.8)).toBeNull();
  });
});

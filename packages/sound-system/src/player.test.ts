import { describe, expect, it } from "vitest";
import { createSoundPlayer, categoryOf, type AudioSink, type SoundCue } from "./index.js";

const cue = (event: string, file = "snd.wav", volume = 1): SoundCue => ({
  event,
  file,
  tMs: 0,
  volume,
  lane: event,
});

function capturingSink() {
  const calls: { file: string; volume: number }[] = [];
  const stops: string[] = [];
  const sink: AudioSink = {
    play(file, volume) {
      calls.push({ file, volume });
      return { stop: () => stops.push(file) };
    },
  };
  return { sink, calls, stops };
}

describe("categoryOf", () => {
  it("maps events to mixer categories", () => {
    expect(categoryOf("reel_drop")).toBe("reel");
    expect(categoryOf("spin_start")).toBe("ui");
    expect(categoryOf("cluster_remove")).toBe("win");
    expect(categoryOf("bonus_trigger")).toBe("feature");
  });
});

describe("createSoundPlayer", () => {
  it("scales cue volume by master volume", () => {
    const { sink, calls } = capturingSink();
    const p = createSoundPlayer({ sink, masterVolume: 0.5 });
    const res = p.playCue(cue("win_detected", "w.wav", 0.8));
    expect(res.played).toBe(true);
    expect(res.volume).toBeCloseTo(0.4);
    expect(calls[0]!.volume).toBeCloseTo(0.4);
  });

  it("does not play when muted or category-muted", () => {
    const { sink } = capturingSink();
    const p = createSoundPlayer({ sink });
    p.setMuted(true);
    expect(p.playCue(cue("spin_start")).reason).toBe("muted");
    p.setMuted(false);
    p.muteCategory("reel", true);
    expect(p.playCue(cue("reel_drop")).reason).toBe("category-muted");
    expect(p.playCue(cue("spin_start")).played).toBe(true);
  });

  it("falls back without crashing when the file is missing (resolve null)", () => {
    const { sink } = capturingSink();
    const p = createSoundPlayer({ sink, resolve: () => null });
    const res = p.playCue(cue("bonus_trigger", "missing.wav"));
    expect(res.played).toBe(false);
    expect(res.reason).toBe("missing-file");
    expect(p.getMissingFiles()).toContain("missing.wav");
  });

  it("never throws even if the sink throws on a placeholder", () => {
    const sink: AudioSink = {
      play() {
        throw new Error("cannot decode placeholder");
      },
    };
    const p = createSoundPlayer({ sink });
    expect(() => p.playCue(cue("coin_collect"))).not.toThrow();
    expect(p.playCue(cue("coin_collect")).reason).toBe("missing-file");
  });

  it("reports no-sink for a pure simulate player", () => {
    const p = createSoundPlayer();
    const res = p.playCue(cue("spin_start", "s.wav", 0.8));
    expect(res.played).toBe(false);
    expect(res.reason).toBe("no-sink");
    expect(res.volume).toBeCloseTo(0.8);
  });

  it("stops tracked sounds by category", () => {
    const { sink, stops } = capturingSink();
    const p = createSoundPlayer({ sink });
    p.playCue(cue("reel_drop", "r.wav"));
    p.stopCategory("reel");
    expect(stops).toContain("r.wav");
  });
});

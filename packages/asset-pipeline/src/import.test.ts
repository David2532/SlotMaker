import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { createGoldenGoalRushDevPack, importAssets, resolveSymbolState } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);
const devPack = createGoldenGoalRushDevPack();
const sym = project.symbols[0]!.id;

describe("importAssets", () => {
  it("accepts a valid square image and overrides the generated asset with a real one", () => {
    const res = importAssets(project, [
      { kind: "symbol", symbolId: sym, state: "static", path: "assets/ace_static.png", width: 256, height: 256, format: "png" },
    ]);
    expect(res.accepted).toHaveLength(1);
    expect(res.realAssets.has("assets/ace_static.png")).toBe(true);
    expect(res.accepted[0]!.normalize?.canvas).toBe(256);

    // Importing a real file is not enough on its own — the project must reference
    // it; but the resolver, given the file as the symbol's static path + the real
    // set, now returns "real" instead of "generated".
    const withPath: SlotProject = {
      ...project,
      symbols: project.symbols.map((s) => (s.id === sym ? { ...s, states: { static: "assets/ace_static.png" } } : s)),
    };
    const r = resolveSymbolState(withPath, sym, "static", { realAssets: res.realAssets, devPack });
    expect(r.status).toBe("real");
  });

  it("rejects disallowed formats and too-small images", () => {
    const res = importAssets(project, [
      { kind: "symbol", symbolId: sym, state: "static", path: "a.gif", width: 256, height: 256, format: "gif" },
      { kind: "symbol", symbolId: sym, state: "win", path: "b.png", width: 32, height: 32, format: "png" },
    ]);
    expect(res.accepted).toHaveLength(0);
    expect(res.rejected).toHaveLength(2);
    expect(res.realAssets.size).toBe(0);
  });

  it("warns on non-square images but still accepts them", () => {
    const res = importAssets(project, [
      { kind: "symbol", symbolId: sym, state: "static", path: "wide.png", width: 256, height: 128, format: "png" },
    ]);
    expect(res.accepted).toHaveLength(1);
    expect(res.warnings.some((w) => /not square/.test(w.message))).toBe(true);
  });

  it("rejects an unknown symbol and validates audio formats", () => {
    const res = importAssets(project, [
      { kind: "symbol", symbolId: "nope", state: "static", path: "x.png", width: 256, height: 256, format: "png" },
      { kind: "sound", event: "bonus_trigger", path: "roar.wav", format: "wav" },
      { kind: "sound", event: "spin_start", path: "weird.flac", format: "flac" },
    ]);
    expect(res.rejected.some((r) => /unknown symbol/.test(r.message))).toBe(true);
    expect(res.realAssets.has("roar.wav")).toBe(true);
    expect(res.rejected.some((r) => /audio format/.test(r.message))).toBe(true);
  });
});

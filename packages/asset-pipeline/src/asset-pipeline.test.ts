import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import {
  assessProduction,
  buildAssetManifest,
  buildAssetRegistry,
  createGoldenGoalRushDevPack,
  resolveSymbolState,
} from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);
const devPack = createGoldenGoalRushDevPack();

describe("resolveSymbolState fallback chain", () => {
  it("uses a real asset when one is registered", () => {
    const withAsset: SlotProject = {
      ...project,
      symbols: project.symbols.map((s, i) =>
        i === 0 ? { ...s, states: { static: "real/ace_static.png" } } : s,
      ),
    };
    const r = resolveSymbolState(withAsset, withAsset.symbols[0]!.id, "static", {
      realAssets: new Set(["real/ace_static.png"]),
    });
    expect(r.status).toBe("real");
    expect(r.source).toBe("file");
  });

  it("falls back to the real static asset for an unset optional state", () => {
    const withAsset: SlotProject = {
      ...project,
      symbols: project.symbols.map((s, i) =>
        i === 0 ? { ...s, states: { static: "real/ace_static.png" } } : s,
      ),
    };
    const r = resolveSymbolState(withAsset, withAsset.symbols[0]!.id, "win", {
      realAssets: new Set(["real/ace_static.png"]),
    });
    expect(r.status).toBe("real");
    expect(r.fallbackFrom).toBe("static");
  });

  it("uses a generated dev asset when no real asset exists", () => {
    const r = resolveSymbolState(project, project.symbols[0]!.id, "win", { devPack });
    expect(r.status).toBe("generated");
    expect(r.uri).toMatch(/^gen:symbol\//);
  });

  it("is missing when there is neither a real nor a generated asset", () => {
    const r = resolveSymbolState(project, project.symbols[0]!.id, "static", {});
    expect(r.status).toBe("missing");
    expect(r.critical).toBe(true);
  });
});

describe("buildAssetRegistry", () => {
  it("classifies everything as generated in demo mode (no real assets yet)", () => {
    const reg = buildAssetRegistry(project, { devPack });
    expect(reg.counts.real).toBe(0);
    expect(reg.counts.generated).toBeGreaterThan(0);
    expect(reg.completeness.overall).toBe(0);
  });
});

describe("assessProduction", () => {
  it("blocks when critical assets are not real, listing blockers", () => {
    const p = assessProduction(project);
    expect(p.ready).toBe(false);
    expect(p.blockers.length).toBeGreaterThan(0);
    expect(p.blockers.every((b) => b.critical)).toBe(true);
  });

  it("blocks production when a required character is still generated", () => {
    const withCharacter: SlotProject = {
      ...project,
      character: {
        enabled: true,
        id: "mascot",
        name: "Mascot",
        description: "Generated mascot",
        position: "right",
        assetStatus: "generated",
        asset: "gen:character/mascot",
        requiredForProduction: true,
      },
    };
    const p = assessProduction(withCharacter);
    expect(p.ready).toBe(false);
    expect(p.blockers.some((b) => b.key === "character:mascot" && b.status === "generated")).toBe(true);
  });

  it("is ready once every critical slot has a real asset", () => {
    // Give every symbol a real static asset and every critical sound a real file.
    const real = new Set<string>();
    const symbols = project.symbols.map((s) => {
      const uri = `real/${s.id}_static.png`;
      real.add(uri);
      return { ...s, states: { static: uri } };
    });
    const sounds = project.sounds.map((s) => {
      const uri = `real/${s.event}.wav`;
      real.add(uri);
      return { ...s, file: uri };
    });
    // Ensure all critical sound events are bound to real files.
    for (const e of ["spin_start", "win_detected", "scatter_land", "bonus_trigger", "coin_collect"] as const) {
      if (!sounds.some((s) => s.event === e)) {
        const uri = `real/${e}.wav`;
        real.add(uri);
        sounds.push({ event: e, file: uri, delayMs: 0, volume: 0.8 });
      }
    }
    const ready = assessProduction({ ...project, symbols, sounds } as SlotProject, real);
    expect(ready.ready).toBe(true);
  });
});

describe("buildAssetManifest", () => {
  it("includes profile, counts, completeness and production status", () => {
    const m = buildAssetManifest(project, "demo", { devPack });
    expect(m.profile).toBe("demo");
    expect(m.assets.length).toBeGreaterThan(0);
    expect(m.productionReady).toBe(false);
    expect(m.productionBlockers.length).toBeGreaterThan(0);
  });
});

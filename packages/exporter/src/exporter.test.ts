import { describe, expect, it } from "vitest";
import { loadProject, type SlotProject } from "@slotmaker/config";
import { exportBundle, serializeBundle } from "./index.js";
import golden from "../../../projects/golden-goal-rush.json";

const project: SlotProject = loadProject(golden);

describe("exportBundle", () => {
  it("produces a self-describing bundle with a manifest", () => {
    const { bundle } = exportBundle(project, { now: () => new Date("2026-01-01T00:00:00Z") });
    expect(bundle.manifest.format).toBe("slotmaker-bundle");
    expect(bundle.manifest.projectId).toBe("golden-goal-rush");
    expect(bundle.manifest.exportedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(bundle.project.symbols.length).toBeGreaterThan(0);
  });

  it("blocks export when the validator finds an error, unless forced", () => {
    const broken: SlotProject = loadProject({
      ...golden,
      features: { ...project.features, coinCollector: true },
      symbols: project.symbols.filter((s) => s.kind !== "coin"),
    });
    const res = exportBundle(broken);
    expect(res.ok).toBe(false);
    expect(res.blockers.length).toBeGreaterThan(0);
    expect(exportBundle(broken, { force: true }).ok).toBe(true);
  });

  it("serializes to valid JSON", () => {
    const { bundle } = exportBundle(project);
    const json = serializeBundle(bundle);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

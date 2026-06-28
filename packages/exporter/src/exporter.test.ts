import { describe, expect, it } from "vitest";
import { canCreateTemplate, createProjectFromTemplate, loadProject, TEMPLATE_REGISTRY, type SlotProject } from "@slotmaker/config";
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

  it("includes an asset manifest with status counts", () => {
    const { bundle } = exportBundle(project, { profile: "demo" });
    expect(bundle.manifest.profile).toBe("demo");
    expect(bundle.assets.assets.length).toBeGreaterThan(0);
    expect(bundle.assets.counts.generated).toBeGreaterThan(0);
  });

  it("demo profile allows generated/placeholder assets", () => {
    const res = exportBundle(project, { profile: "demo" });
    expect(res.ok).toBe(true);
    expect(res.bundle.assets.productionReady).toBe(false);
  });

  it("embeds the math report in the bundle when provided, else null", () => {
    expect(exportBundle(project).bundle.math).toBeNull();
  });

  it("production profile blocks when critical assets are not real", () => {
    const res = exportBundle(project, { profile: "production" });
    expect(res.ok).toBe(false);
    expect(res.blockers.some((b) => /production requires a real asset/.test(b))).toBe(true);
    // ...but can be forced.
    expect(exportBundle(project, { profile: "production", force: true }).ok).toBe(true);
  });

  it("demo-exports every create-enabled template and keeps production asset-gated", () => {
    for (const template of TEMPLATE_REGISTRY.filter((t) => canCreateTemplate(t))) {
      const p = createProjectFromTemplate(template.id);
      expect(exportBundle(p, { profile: "demo" }).ok).toBe(true);
      const production = exportBundle(p, { profile: "production" });
      expect(production.ok).toBe(false);
      expect(production.blockers.some((b) => /production requires a real asset/.test(b))).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  advertisedTemplateMechanics,
  canCompleteWizard,
  canCreateTemplate,
  createInitialWizardState,
  createProjectFromTemplate,
  FEATURE_REGISTRY,
  getTemplateDefinition,
  getTemplateReadiness,
  parseProject,
  TEMPLATE_REGISTRY,
  templateHasPartialMechanics,
  wizardProgress,
} from "./index.js";

describe("template registry", () => {
  it("contains the required product templates", () => {
    expect(TEMPLATE_REGISTRY.map((t) => t.id)).toEqual([
      "cluster_6x5_collector",
      "gem_bonanza_tumble",
      "ancient_book_adventure",
      "candy_cascade",
      "classic_fruits",
      "gold_collector",
    ]);
  });

  it("keeps Golden Goal Rush as the implemented 6x5 cluster template", () => {
    const template = getTemplateDefinition("cluster_6x5_collector");
    expect(template.displayName).toBe("Golden Goal Rush");
    expect(template.grid).toMatchObject({ columns: 6, rows: 5 });
    expect(template.mechanicStatus.every((m) => m.status === "implemented")).toBe(true);
    expect(canCreateTemplate(template)).toBe(true);
  });

  it("marks unfinished mechanics instead of pretending they are complete", () => {
    expect(templateHasPartialMechanics(getTemplateDefinition("ancient_book_adventure"))).toBe(true);
    expect(getTemplateDefinition("ancient_book_adventure").mechanicStatus).toContainEqual(
      expect.objectContaining({ featureId: "expandingSymbolFreeSpins", status: "partial" }),
    );
    expect(getTemplateDefinition("gold_collector").mechanicStatus).toContainEqual(
      expect.objectContaining({ featureId: "holdAndWinRespins", status: "planned" }),
    );
  });

  it("allows Create only for fully implemented templates", () => {
    expect(TEMPLATE_REGISTRY.filter((t) => canCreateTemplate(t)).map((t) => t.id)).toEqual([
      "cluster_6x5_collector",
      "candy_cascade",
    ]);
    expect(getTemplateReadiness(getTemplateDefinition("gem_bonanza_tumble"))).toMatchObject({
      status: "coming-soon",
      createEnabled: false,
    });
    expect(getTemplateReadiness(getTemplateDefinition("ancient_book_adventure"))).toMatchObject({
      status: "partially-implemented",
      createEnabled: false,
    });
  });

  it("advertises only implemented mechanics as UI badges", () => {
    const gemBadges = advertisedTemplateMechanics(getTemplateDefinition("gem_bonanza_tumble")).map((m) => m.featureId);
    expect(gemBadges).toEqual(["clusterPays", "cascade", "scatterFreeSpins"]);
    expect(gemBadges).not.toContain("progressiveFreeSpinMultiplier");
    expect(gemBadges).not.toContain("anteBet");

    const candy = getTemplateDefinition("candy_cascade");
    expect(getTemplateReadiness(candy).status).toBe("fully-implemented");
    expect(advertisedTemplateMechanics(candy).map((m) => m.featureId)).toEqual([
      "clusterPays",
      "cascade",
      "scatterFreeSpins",
    ]);
  });
});

describe("feature registry", () => {
  it("defines implementation status for advanced feature types", () => {
    expect(FEATURE_REGISTRY.find((f) => f.id === "scatterFreeSpins")?.implementedStatus).toBe("implemented");
    expect(FEATURE_REGISTRY.find((f) => f.id === "linePays")?.implementedStatus).toBe("partial");
    expect(FEATURE_REGISTRY.find((f) => f.id === "progressiveFreeSpinMultiplier")?.runtimeSupport).toBe(false);
    expect(FEATURE_REGISTRY.find((f) => f.id === "anteBet")?.implementedStatus).toBe("planned");
    expect(FEATURE_REGISTRY.find((f) => f.id === "wildSubstitution")?.configKey).toBe("wildSubstitution");
  });
});

describe("createProjectFromTemplate", () => {
  it.each([
    ["cluster_6x5_collector", 6, 5],
    ["candy_cascade", 6, 5],
  ] as const)("creates a valid creatable project for %s", (templateId, columns, rows) => {
    const project = createProjectFromTemplate(templateId, { projectName: `Test ${templateId}` });
    expect(project.grid).toMatchObject({ columns, rows });
    expect(parseProject(project).ok).toBe(true);
    expect(project.symbols.length).toBeGreaterThan(0);
    expect(project.templateMeta?.templateName).toBe(getTemplateDefinition(templateId).displayName);
    expect(project.templateMeta?.mechanicStatus.every((m) => m.status === "implemented")).toBe(true);
  });

  it("creates a book-style config with line intent and expanding-symbol warnings", () => {
    const project = createProjectFromTemplate("ancient_book_adventure");
    expect(project.features.lineWins).toBe(true);
    expect(project.features.expandingSymbolFreeSpins).toBe(true);
    expect(project.features.clusterWins).toBe(false);
    expect(project.templateMeta?.warnings.join(" ")).toContain("expandingSymbolFreeSpins");
  });

  it("creates a Bonanza-style config with tumble and multiplier intent", () => {
    const project = createProjectFromTemplate("gem_bonanza_tumble");
    expect(project.features.cascades).toBe(true);
    expect(project.features.freeSpinMultiplier).toBe(true);
    expect(project.features.anteBet).toBe(true);
    expect(project.templateMeta?.warnings.join(" ")).toContain("progressiveFreeSpinMultiplier");
    expect(project.templateMeta?.warnings.join(" ")).toContain("anteBet");
  });
});

describe("wizard state", () => {
  it("starts on template selection and cannot complete without selections", () => {
    const state = createInitialWizardState();
    expect(state.step).toBe("template");
    expect(wizardProgress(state)).toBeGreaterThan(0);
    expect(canCompleteWizard(state)).toBe(false);
  });

  it("can complete once template, theme and project name are present", () => {
    const state = createInitialWizardState();
    state.selectedTemplateId = "cluster_6x5_collector";
    state.selectedThemeId = "football_black_gold";
    state.projectName = "My Slot";
    expect(canCompleteWizard(state)).toBe(true);
  });

  it("cannot complete for a preview-only template", () => {
    const state = createInitialWizardState();
    state.selectedTemplateId = "gem_bonanza_tumble";
    state.selectedThemeId = "gem_cave_neon";
    state.projectName = "Gem Draft";
    expect(canCompleteWizard(state)).toBe(false);
  });
});

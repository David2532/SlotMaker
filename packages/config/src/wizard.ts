import type { FeatureId } from "./features.js";
import { canCreateTemplate, getTemplateDefinition, type TemplateId } from "./templates.js";
import type { Volatility } from "./schema.js";

export type WizardStep = "template" | "theme" | "math" | "features" | "symbols" | "create";

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: "template", label: "Choose Template" },
  { id: "theme", label: "Choose Theme" },
  { id: "math", label: "Layout & Math" },
  { id: "features", label: "Features" },
  { id: "symbols", label: "Symbols" },
  { id: "create", label: "Create Project" },
];

export interface WizardState {
  step: WizardStep;
  selectedTemplateId?: TemplateId;
  selectedThemeId?: string;
  projectName: string;
  rtpTarget: number;
  volatility: Volatility;
  enabledFeatures: FeatureId[];
  characterEnabled: boolean;
}

export function createInitialWizardState(): WizardState {
  return {
    step: "template",
    projectName: "",
    rtpTarget: 96,
    volatility: "high",
    enabledFeatures: [],
    characterEnabled: true,
  };
}

export function wizardStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex((s) => s.id === step);
}

export function wizardProgress(state: WizardState): number {
  const index = wizardStepIndex(state.step);
  return index < 0 ? 0 : (index + 1) / WIZARD_STEPS.length;
}

export function nextWizardStep(step: WizardStep): WizardStep {
  const index = wizardStepIndex(step);
  return WIZARD_STEPS[Math.min(index + 1, WIZARD_STEPS.length - 1)]!.id;
}

export function previousWizardStep(step: WizardStep): WizardStep {
  const index = wizardStepIndex(step);
  return WIZARD_STEPS[Math.max(index - 1, 0)]!.id;
}

export function canCompleteWizard(state: WizardState): boolean {
  if (!state.selectedTemplateId || !state.selectedThemeId || state.projectName.trim().length === 0) return false;
  try {
    return canCreateTemplate(getTemplateDefinition(state.selectedTemplateId));
  } catch {
    return false;
  }
}

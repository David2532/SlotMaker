import type { FeatureFlags, MechanicImplementationStatus } from "./schema.js";

export type FeatureId =
  | "clusterPays"
  | "cascade"
  | "scatterFreeSpins"
  | "coinCollector"
  | "bonusBuy"
  | "linePays"
  | "expandingSymbolFreeSpins"
  | "freeSpinMultiplier"
  | "holdAndWinRespins"
  | "anteBet";

export interface FeatureDefinition {
  id: FeatureId;
  displayName: string;
  description: string;
  configKey?: keyof FeatureFlags;
  implementedStatus: MechanicImplementationStatus;
  validatorRequirements: string[];
  uiBadges: string[];
}

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  {
    id: "clusterPays",
    displayName: "Cluster Pays",
    description: "Pays connected groups of matching symbols.",
    configKey: "clusterWins",
    implementedStatus: "implemented",
    validatorRequirements: ["At least one paying symbol", "Configured min cluster size"],
    uiBadges: ["cluster", "implemented"],
  },
  {
    id: "cascade",
    displayName: "Cascade / Tumble",
    description: "Winning symbols clear and new symbols drop into the board.",
    configKey: "cascades",
    implementedStatus: "implemented",
    validatorRequirements: ["Cascade animation events", "Paying symbol tiers"],
    uiBadges: ["cascade", "implemented"],
  },
  {
    id: "scatterFreeSpins",
    displayName: "Scatter Free Spins",
    description: "Scatter symbols trigger a free-spins feature.",
    configKey: "freeSpins",
    implementedStatus: "implemented",
    validatorRequirements: ["Scatter symbol", "Free-spins math config", "Bonus trigger animation/sound"],
    uiBadges: ["free spins", "implemented"],
  },
  {
    id: "coinCollector",
    displayName: "Coin Collector",
    description: "Coin symbols contribute collectible values when enough land.",
    configKey: "coinCollector",
    implementedStatus: "implemented",
    validatorRequirements: ["Coin symbol", "Coin collect threshold", "Coin collect cue"],
    uiBadges: ["coins", "implemented"],
  },
  {
    id: "bonusBuy",
    displayName: "Bonus Buy",
    description: "Calculates bonus-buy value against the feature math.",
    configKey: "bonusBuy",
    implementedStatus: "implemented",
    validatorRequirements: ["Free-spins feature", "Configured buy cost", "Math report recommended"],
    uiBadges: ["bonus buy", "implemented"],
  },
  {
    id: "linePays",
    displayName: "Line Pays",
    description: "Classic paylines for 5x3 slots. Config generation is ready; runtime payout is planned.",
    configKey: "lineWins",
    implementedStatus: "partial",
    validatorRequirements: ["Payline definition", "Line runtime before production gameplay"],
    uiBadges: ["lines", "partial"],
  },
  {
    id: "expandingSymbolFreeSpins",
    displayName: "Expanding Symbol Free Spins",
    description: "A special symbol expands during free spins. Generated as clear config intent for now.",
    configKey: "expandingSymbolFreeSpins",
    implementedStatus: "partial",
    validatorRequirements: ["Special symbol selection UI", "Expansion runtime", "Free-spins trigger"],
    uiBadges: ["book", "partial"],
  },
  {
    id: "freeSpinMultiplier",
    displayName: "Free-Spin Multiplier",
    description: "Progressive or fixed multiplier applied during free spins.",
    configKey: "freeSpinMultiplier",
    implementedStatus: "partial",
    validatorRequirements: ["Multiplier progression rules", "Math validation"],
    uiBadges: ["multiplier", "partial"],
  },
  {
    id: "holdAndWinRespins",
    displayName: "Hold-and-Win Respins",
    description: "Coin respin bonus loop. Template intent is generated; full runtime is planned.",
    configKey: "holdAndWinRespins",
    implementedStatus: "planned",
    validatorRequirements: ["Respins runtime", "Collector meter UI", "Bonus math"],
    uiBadges: ["respins", "planned"],
  },
  {
    id: "anteBet",
    displayName: "Ante Bet",
    description: "Optional higher-bet mode that changes feature frequency.",
    configKey: "anteBet",
    implementedStatus: "planned",
    validatorRequirements: ["Ante math profile", "Export manifest flag"],
    uiBadges: ["ante", "planned"],
  },
];

export function getFeatureDefinition(id: FeatureId): FeatureDefinition {
  const feature = FEATURE_REGISTRY.find((f) => f.id === id);
  if (!feature) throw new Error(`Unknown feature: ${id}`);
  return feature;
}

export function featureLabel(id: FeatureId): string {
  return getFeatureDefinition(id).displayName;
}

export function featureStatus(id: FeatureId): MechanicImplementationStatus {
  return getFeatureDefinition(id).implementedStatus;
}

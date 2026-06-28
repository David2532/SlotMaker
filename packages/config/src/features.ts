import type { FeatureFlags, MechanicImplementationStatus } from "./schema.js";

export type FeatureId =
  | "clusterPays"
  | "cascade"
  | "scatterFreeSpins"
  | "coinCollector"
  | "bonusBuy"
  | "linePays"
  | "expandingSymbolFreeSpins"
  | "progressiveFreeSpinMultiplier"
  | "holdAndWinRespins"
  | "anteBet"
  | "wildSubstitution";

export interface FeatureDefinition {
  id: FeatureId;
  displayName: string;
  description: string;
  configKey?: keyof FeatureFlags;
  implementedStatus: MechanicImplementationStatus;
  runtimeSupport: boolean;
  mathSupport: boolean;
  animationEvents: string[];
  soundEvents: string[];
  validatorRules: string[];
  uiPanelSupport: boolean;
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
    runtimeSupport: true,
    mathSupport: true,
    animationEvents: ["win_detected", "cluster_remove", "cascade_drop"],
    soundEvents: ["win_detected"],
    validatorRules: ["paying symbols", "min cluster size"],
    uiPanelSupport: true,
    validatorRequirements: ["At least one paying symbol", "Configured min cluster size"],
    uiBadges: ["cluster", "implemented"],
  },
  {
    id: "cascade",
    displayName: "Cascade / Tumble",
    description: "Winning symbols clear and new symbols drop into the board.",
    configKey: "cascades",
    implementedStatus: "implemented",
    runtimeSupport: true,
    mathSupport: true,
    animationEvents: ["cascade_drop", "symbol_land"],
    soundEvents: ["reel_stop", "win_detected"],
    validatorRules: ["cascade event bindings"],
    uiPanelSupport: true,
    validatorRequirements: ["Cascade animation events", "Paying symbol tiers"],
    uiBadges: ["cascade", "implemented"],
  },
  {
    id: "scatterFreeSpins",
    displayName: "Scatter Free Spins",
    description: "Scatter symbols trigger a free-spins feature.",
    configKey: "freeSpins",
    implementedStatus: "implemented",
    runtimeSupport: true,
    mathSupport: true,
    animationEvents: ["scatter_land", "bonus_trigger"],
    soundEvents: ["scatter_land", "bonus_trigger"],
    validatorRules: ["scatter symbol exists", "free spins config"],
    uiPanelSupport: true,
    validatorRequirements: ["Scatter symbol", "Free-spins math config", "Bonus trigger animation/sound"],
    uiBadges: ["free spins", "implemented"],
  },
  {
    id: "coinCollector",
    displayName: "Coin Collector",
    description: "Coin symbols contribute collectible values when enough land.",
    configKey: "coinCollector",
    implementedStatus: "implemented",
    runtimeSupport: true,
    mathSupport: true,
    animationEvents: ["coin_collect"],
    soundEvents: ["coin_collect"],
    validatorRules: ["coin symbol exists", "coin collect threshold"],
    uiPanelSupport: true,
    validatorRequirements: ["Coin symbol", "Coin collect threshold", "Coin collect cue"],
    uiBadges: ["coins", "implemented"],
  },
  {
    id: "bonusBuy",
    displayName: "Bonus Buy",
    description: "Calculates bonus-buy value against the feature math.",
    configKey: "bonusBuy",
    implementedStatus: "implemented",
    runtimeSupport: true,
    mathSupport: true,
    animationEvents: ["bonus_trigger"],
    soundEvents: ["bonus_trigger"],
    validatorRules: ["bonus buy cost", "math report recommended"],
    uiPanelSupport: true,
    validatorRequirements: ["Free-spins feature", "Configured buy cost", "Math report recommended"],
    uiBadges: ["bonus buy", "implemented"],
  },
  {
    id: "linePays",
    displayName: "Line Pays",
    description: "Classic paylines for 5x3 slots. Config generation is ready; runtime payout is planned.",
    configKey: "lineWins",
    implementedStatus: "partial",
    runtimeSupport: false,
    mathSupport: false,
    animationEvents: [],
    soundEvents: [],
    validatorRules: ["line runtime support missing"],
    uiPanelSupport: false,
    validatorRequirements: ["Payline definition", "Line runtime before production gameplay"],
    uiBadges: ["lines", "partial"],
  },
  {
    id: "expandingSymbolFreeSpins",
    displayName: "Expanding Symbol Free Spins",
    description: "A special symbol expands during free spins. Generated as clear config intent for now.",
    configKey: "expandingSymbolFreeSpins",
    implementedStatus: "partial",
    runtimeSupport: false,
    mathSupport: false,
    animationEvents: [],
    soundEvents: [],
    validatorRules: ["expanding symbol runtime missing"],
    uiPanelSupport: false,
    validatorRequirements: ["Special symbol selection UI", "Expansion runtime", "Free-spins trigger"],
    uiBadges: ["book", "partial"],
  },
  {
    id: "progressiveFreeSpinMultiplier",
    displayName: "Progressive Free-Spin Multiplier",
    description: "Progressive or fixed multiplier applied during free spins.",
    configKey: "freeSpinMultiplier",
    implementedStatus: "partial",
    runtimeSupport: false,
    mathSupport: false,
    animationEvents: [],
    soundEvents: [],
    validatorRules: ["progressive multiplier runtime missing"],
    uiPanelSupport: false,
    validatorRequirements: ["Multiplier progression rules", "Math validation"],
    uiBadges: ["multiplier", "partial"],
  },
  {
    id: "holdAndWinRespins",
    displayName: "Hold-and-Win Respins",
    description: "Coin respin bonus loop. Template intent is generated; full runtime is planned.",
    configKey: "holdAndWinRespins",
    implementedStatus: "planned",
    runtimeSupport: false,
    mathSupport: false,
    animationEvents: [],
    soundEvents: [],
    validatorRules: ["hold-and-win runtime missing"],
    uiPanelSupport: false,
    validatorRequirements: ["Respins runtime", "Collector meter UI", "Bonus math"],
    uiBadges: ["respins", "planned"],
  },
  {
    id: "anteBet",
    displayName: "Ante Bet",
    description: "Optional higher-bet mode that changes feature frequency.",
    configKey: "anteBet",
    implementedStatus: "planned",
    runtimeSupport: false,
    mathSupport: false,
    animationEvents: [],
    soundEvents: [],
    validatorRules: ["ante bet math profile missing"],
    uiPanelSupport: false,
    validatorRequirements: ["Ante math profile", "Export manifest flag"],
    uiBadges: ["ante", "planned"],
  },
  {
    id: "wildSubstitution",
    displayName: "Wild Substitution",
    description: "Wilds substitute in cluster detection where the runtime supports it.",
    configKey: "wildSubstitution",
    implementedStatus: "implemented",
    runtimeSupport: true,
    mathSupport: true,
    animationEvents: ["win_detected"],
    soundEvents: ["win_detected"],
    validatorRules: ["wild symbols are optional but supported"],
    uiPanelSupport: true,
    validatorRequirements: ["Wild symbol if the template advertises wild substitution"],
    uiBadges: ["wilds", "implemented"],
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

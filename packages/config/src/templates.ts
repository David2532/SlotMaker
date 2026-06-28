import type {
  AnimationBinding,
  FeatureFlags,
  GridConfig,
  MathConfig,
  MechanicImplementationStatus,
  SlotProject as SlotProjectType,
  SoundBinding,
  SymbolDef,
  TemplateMechanicStatus,
  Volatility,
} from "./schema.js";
import { SlotProject as SlotProjectSchema } from "./schema.js";
import type { FeatureId } from "./features.js";

export type TemplateId =
  | "cluster_6x5_collector"
  | "gem_bonanza_tumble"
  | "ancient_book_adventure"
  | "candy_cascade"
  | "classic_fruits"
  | "gold_collector";

export type TemplateComplexity = "easy" | "medium" | "advanced";

export type TemplatePreviewState =
  | "idle"
  | "spin"
  | "small_win"
  | "big_win"
  | "near_miss"
  | "free_spins_trigger"
  | "coin_collect"
  | "cascade_chain";

export interface ThemeOption {
  id: string;
  name: string;
  palette: string[];
  description: string;
}

export interface CharacterTemplate {
  id: string;
  name: string;
  description: string;
  position: "left" | "right";
  requiredForProduction: boolean;
}

export interface TemplateMechanic {
  featureId: FeatureId;
  status: MechanicImplementationStatus;
  note: string;
}

export interface SlotTemplateDefinition {
  id: TemplateId;
  displayName: string;
  type: string;
  description: string;
  grid: GridConfig;
  winSystem: "cluster" | "line" | "coin" | "hybrid";
  defaultRtpTarget: number;
  volatility: Volatility;
  complexity: TemplateComplexity;
  bestFor: string;
  mechanics: FeatureId[];
  mechanicStatus: TemplateMechanic[];
  features: FeatureFlags;
  math: MathConfig;
  symbols: SymbolDef[];
  themes: ThemeOption[];
  defaultThemeId: string;
  animationPreset: string;
  soundPreset: string;
  assetRequirements: string[];
  productionBlockers: string[];
  supportedPreviewStates: TemplatePreviewState[];
  character: CharacterTemplate;
}

export interface CreateProjectOptions {
  projectName?: string;
  id?: string;
  themeId?: string;
  rtpTarget?: number;
  volatility?: Volatility;
  characterEnabled?: boolean;
}

const featureDefaults = (input: FeatureFlags): FeatureFlags => ({
  clusterWins: input.clusterWins,
  cascades: input.cascades,
  freeSpins: input.freeSpins,
  coinCollector: input.coinCollector,
  bonusBuy: input.bonusBuy,
  lineWins: input.lineWins,
  expandingSymbolFreeSpins: input.expandingSymbolFreeSpins,
  freeSpinMultiplier: input.freeSpinMultiplier,
  holdAndWinRespins: input.holdAndWinRespins,
  anteBet: input.anteBet,
});

const flags = (partial: Partial<FeatureFlags>): FeatureFlags => ({
  clusterWins: false,
  cascades: false,
  freeSpins: false,
  coinCollector: false,
  bonusBuy: false,
  lineWins: false,
  expandingSymbolFreeSpins: false,
  freeSpinMultiplier: false,
  holdAndWinRespins: false,
  anteBet: false,
  ...partial,
});

const DEFAULT_MATH: MathConfig = {
  targetRtp: 96,
  volatility: "high",
  maxWin: 5000,
  minClusterSize: 5,
  hitFrequencyTarget: 24,
  bonusFrequencyTarget: 180,
  freeSpins: {
    triggerScatters: 3,
    spinsAwarded: 10,
    multiplier: 2,
  },
  coinCollectThreshold: 4,
  bonusBuyCost: 100,
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function slug(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "slot-project";
}

function sym(
  id: string,
  name: string,
  kind: SymbolDef["kind"],
  color: string,
  label: string,
  weight: number,
  pays: SymbolDef["pays"] = [],
  coinValue?: number,
): SymbolDef {
  return {
    id,
    name,
    kind,
    color,
    label,
    weight,
    pays,
    ...(coinValue == null ? {} : { coinValue }),
  };
}

const lowPays = (base: number): SymbolDef["pays"] => [
  { minSize: 5, multiplier: base },
  { minSize: 8, multiplier: Number((base * 3).toFixed(2)) },
  { minSize: 12, multiplier: Number((base * 8).toFixed(2)) },
];

const highPays = (base: number): SymbolDef["pays"] => [
  { minSize: 5, multiplier: base },
  { minSize: 8, multiplier: Number((base * 2.8).toFixed(2)) },
  { minSize: 12, multiplier: Number((base * 8.5).toFixed(2)) },
];

const linePays = (base: number): SymbolDef["pays"] => [
  { minSize: 3, multiplier: base },
  { minSize: 4, multiplier: Number((base * 4).toFixed(2)) },
  { minSize: 5, multiplier: Number((base * 12).toFixed(2)) },
];

function commonAnimations(preset: string): AnimationBinding[] {
  return [
    { event: "spin_start", preset, delayMs: 0, durationMs: 220 },
    { event: "reel_drop", preset: "smooth_drop", delayMs: 80, durationMs: 360 },
    { event: "reel_stop", preset: "default", delayMs: 0, durationMs: 160 },
    { event: "symbol_land", preset: "land_bounce", delayMs: 0, durationMs: 150 },
    { event: "win_detected", preset: "cluster_glow", delayMs: 0, durationMs: 300 },
    { event: "cluster_remove", preset: "cascade_pop", delayMs: 0, durationMs: 230 },
    { event: "cascade_drop", preset: "cascade_drop", delayMs: 0, durationMs: 320 },
    { event: "scatter_land", preset: "scatter_tension", delayMs: 0, durationMs: 400 },
    { event: "bonus_trigger", preset: "stadium_hype", delayMs: 240, durationMs: 620 },
    { event: "coin_collect", preset: "coin_roll", delayMs: 0, durationMs: 400 },
    { event: "big_win_start", preset: "stadium_hype", delayMs: 0, durationMs: 600 },
  ];
}

function commonSounds(pack: string): SoundBinding[] {
  return [
    { event: "spin_start", file: `${pack}_spin.wav`, delayMs: 0, volume: 0.8 },
    { event: "reel_stop", file: `${pack}_stop.wav`, delayMs: 0, volume: 0.65 },
    { event: "win_detected", file: `${pack}_win.wav`, delayMs: 0, volume: 0.85 },
    { event: "scatter_land", file: `${pack}_scatter.wav`, delayMs: 40, volume: 0.9 },
    { event: "bonus_trigger", file: `${pack}_bonus.wav`, delayMs: 240, volume: 1 },
    { event: "coin_collect", file: `${pack}_coin.wav`, delayMs: 0, volume: 0.9 },
  ];
}

const implemented = (featureId: FeatureId, note: string): TemplateMechanic => ({ featureId, status: "implemented", note });
const partial = (featureId: FeatureId, note: string): TemplateMechanic => ({ featureId, status: "partial", note });
const planned = (featureId: FeatureId, note: string): TemplateMechanic => ({ featureId, status: "planned", note });

const goldenSymbols: SymbolDef[] = [
  sym("ten", "Ten", "low", "#7d8a99", "10", 150, lowPays(1.77)),
  sym("jack", "Jack", "low", "#8a7d99", "J", 140, lowPays(2.12)),
  sym("queen", "Queen", "low", "#998a7d", "Q", 130, lowPays(2.47)),
  sym("king", "King", "low", "#998d7d", "K", 120, lowPays(2.83)),
  sym("ace", "Ace", "low", "#a3937d", "A", 110, lowPays(3.53)),
  sym("boot", "Boot", "high", "#3a5a40", "BOOT", 34, highPays(7.06)),
  sym("glove", "Goalkeeper Glove", "high", "#2d6a4f", "GLV", 28, highPays(8.83)),
  sym("jersey", "Jersey", "high", "#bc4749", "KIT", 22, highPays(10.6)),
  sym("football", "Football", "high", "#f2f2f2", "BALL", 17, highPays(14.13)),
  sym("trophy", "Trophy", "high", "#f5c542", "CUP", 12, highPays(21.19)),
  sym("wild", "Wild", "wild", "#ffd700", "WILD", 14),
  sym("scatter", "Scatter", "scatter", "#e63946", "SCAT", 8),
  sym("coin", "Coin", "coin", "#ffbf00", "COIN", 13, [], 1.5),
];

export const TEMPLATE_REGISTRY: SlotTemplateDefinition[] = [
  {
    id: "cluster_6x5_collector",
    displayName: "Golden Goal Rush",
    type: "Cluster 6x5",
    description: "A high-volatility cluster slot with cascades, football symbols, free spins, coins and bonus buy.",
    grid: { columns: 6, rows: 5, cellSize: 92 },
    winSystem: "cluster",
    defaultRtpTarget: 96,
    volatility: "high",
    complexity: "advanced",
    bestFor: "Creators who want a full modern cluster slot foundation.",
    mechanics: ["clusterPays", "cascade", "scatterFreeSpins", "coinCollector", "bonusBuy"],
    mechanicStatus: [
      implemented("clusterPays", "Cluster detection and payouts are live in the runtime."),
      implemented("cascade", "Winning cells clear and refill through the cascade loop."),
      implemented("scatterFreeSpins", "Scatter-count trigger and free-spins value are simulated."),
      implemented("coinCollector", "Coin values collect when the threshold lands."),
      implemented("bonusBuy", "Bonus-buy EV is calculated from the feature math."),
    ],
    features: flags({ clusterWins: true, cascades: true, freeSpins: true, coinCollector: true, bonusBuy: true }),
    math: { ...DEFAULT_MATH, targetRtp: 96, volatility: "high", maxWin: 5000, bonusBuyCost: 100 },
    symbols: goldenSymbols,
    themes: [
      {
        id: "football_black_gold",
        name: "Football Black Gold",
        palette: ["#0b0f0a", "#f5c542", "#2d6a4f"],
        description: "Stadium lights, gold trophy energy and green pitch accents.",
      },
    ],
    defaultThemeId: "football_black_gold",
    animationPreset: "stadium_hype",
    soundPreset: "stadium",
    assetRequirements: ["Symbol static art", "Stadium background", "Win/sound pack", "Mascot side art"],
    productionBlockers: ["Generated symbol states must be replaced with real assets.", "Football mascot requires final production art."],
    supportedPreviewStates: ["idle", "spin", "small_win", "big_win", "near_miss", "free_spins_trigger", "coin_collect", "cascade_chain"],
    character: {
      id: "football-mascot",
      name: "Goal Mascot",
      description: "Generated football sidekick for onboarding and themed preview.",
      position: "right",
      requiredForProduction: true,
    },
  },
  {
    id: "gem_bonanza_tumble",
    displayName: "Gem Bonanza",
    type: "Tumble Multiplier",
    description: "A neutral gem tumble slot inspired by cascade + multiplier free-spin loops.",
    grid: { columns: 6, rows: 5, cellSize: 90 },
    winSystem: "cluster",
    defaultRtpTarget: 96,
    volatility: "high",
    complexity: "advanced",
    bestFor: "High-energy tumble games with scatter free spins and a multiplier promise.",
    mechanics: ["clusterPays", "cascade", "scatterFreeSpins", "freeSpinMultiplier", "anteBet"],
    mechanicStatus: [
      implemented("clusterPays", "Cluster pays power the current preview runtime."),
      implemented("cascade", "Tumbles are represented by the existing cascade loop."),
      implemented("scatterFreeSpins", "Scatter-triggered free spins are supported."),
      partial("freeSpinMultiplier", "A fixed free-spin multiplier exists; progressive multiplier UI/runtime is still pending."),
      planned("anteBet", "Ante bet is defined in the template but not yet simulated."),
    ],
    features: flags({ clusterWins: true, cascades: true, freeSpins: true, freeSpinMultiplier: true, anteBet: true }),
    math: { ...DEFAULT_MATH, targetRtp: 96, volatility: "high", maxWin: 12000, bonusFrequencyTarget: 210, freeSpins: { triggerScatters: 4, spinsAwarded: 12, multiplier: 3 } },
    symbols: [
      sym("ruby", "Ruby", "low", "#d64045", "RBY", 120, lowPays(1.4)),
      sym("emerald", "Emerald", "low", "#2d9c6f", "EMR", 110, lowPays(1.8)),
      sym("sapphire", "Sapphire", "low", "#3676d6", "SAP", 105, lowPays(2.2)),
      sym("topaz", "Topaz", "low", "#f5c542", "TOP", 95, lowPays(2.6)),
      sym("opal", "Opal", "high", "#cdb4db", "OPL", 36, highPays(6)),
      sym("crown", "Gem Crown", "high", "#ffd166", "CRN", 26, highPays(10)),
      sym("wild", "Wild Gem", "wild", "#ffffff", "WILD", 12),
      sym("scatter", "Scatter Cave", "scatter", "#7b2cbf", "SCAT", 9),
    ],
    themes: [
      { id: "gem_cave_neon", name: "Gem Cave Neon", palette: ["#070b12", "#2d9cdb", "#c77dff"], description: "Dark cave with electric gem highlights." },
      { id: "treasure_tumble", name: "Treasure Tumble", palette: ["#120d05", "#f5c542", "#2d6a4f"], description: "Treasure-room palette with high contrast gold." },
    ],
    defaultThemeId: "gem_cave_neon",
    animationPreset: "cascade_drop",
    soundPreset: "gem",
    assetRequirements: ["Gem symbol states", "Cave background", "Scatter animation", "Multiplier meter UI"],
    productionBlockers: ["Progressive multiplier is partially implemented.", "Ante bet is planned and must stay disabled for production math."],
    supportedPreviewStates: ["idle", "spin", "small_win", "big_win", "near_miss", "free_spins_trigger", "cascade_chain"],
    character: {
      id: "gem-guide",
      name: "Gem Guide",
      description: "Generated cave guide character for template onboarding.",
      position: "left",
      requiredForProduction: false,
    },
  },
  {
    id: "ancient_book_adventure",
    displayName: "Ancient Book Adventure",
    type: "Book-Style 5x3",
    description: "Neutral book-style lines slot with scatter book free spins and expanding special symbol intent.",
    grid: { columns: 5, rows: 3, cellSize: 104 },
    winSystem: "line",
    defaultRtpTarget: 96,
    volatility: "high",
    complexity: "medium",
    bestFor: "Classic free-spins games with a simple player story and familiar structure.",
    mechanics: ["linePays", "scatterFreeSpins", "expandingSymbolFreeSpins", "bonusBuy"],
    mechanicStatus: [
      partial("linePays", "Payline config intent is generated; cluster runtime still powers generic preview only."),
      implemented("scatterFreeSpins", "Scatter trigger config is valid and simulated through current feature hooks."),
      partial("expandingSymbolFreeSpins", "Special-symbol selection and expansion runtime are still TODO."),
      implemented("bonusBuy", "Bonus-buy math can evaluate the free-spins feature."),
    ],
    features: flags({ lineWins: true, freeSpins: true, expandingSymbolFreeSpins: true, bonusBuy: true }),
    math: { ...DEFAULT_MATH, targetRtp: 96, volatility: "high", maxWin: 5000, minClusterSize: 3, hitFrequencyTarget: 29, bonusFrequencyTarget: 150, freeSpins: { triggerScatters: 3, spinsAwarded: 10, multiplier: 2 }, bonusBuyCost: 80 },
    symbols: [
      sym("ten", "Ten", "low", "#7d8a99", "10", 90, linePays(0.4)),
      sym("jack", "Jack", "low", "#8a7d99", "J", 85, linePays(0.5)),
      sym("queen", "Queen", "low", "#998a7d", "Q", 80, linePays(0.7)),
      sym("king", "King", "low", "#998d7d", "K", 75, linePays(0.9)),
      sym("ace", "Ace", "low", "#a3937d", "A", 70, linePays(1.2)),
      sym("explorer", "Explorer", "high", "#2d6a4f", "EXP", 28, linePays(2.5)),
      sym("relic", "Relic", "high", "#bc6c25", "REL", 22, linePays(4)),
      sym("book", "Book Scatter", "scatter", "#d4a373", "BOOK", 14),
      sym("wild", "Wild Map", "wild", "#ffd166", "WILD", 8),
    ],
    themes: [
      { id: "ancient_temple", name: "Ancient Temple", palette: ["#0f1115", "#d4a373", "#2d6a4f"], description: "Dark stone, warm parchment and explorer green." },
    ],
    defaultThemeId: "ancient_temple",
    animationPreset: "scatter_tension",
    soundPreset: "temple",
    assetRequirements: ["Book scatter symbol", "Explorer character", "Temple background", "Expanding symbol animation"],
    productionBlockers: ["Line-pay runtime is partial.", "Expanding special symbol feature is partial.", "Generated explorer art is not production art."],
    supportedPreviewStates: ["idle", "spin", "small_win", "big_win", "near_miss", "free_spins_trigger"],
    character: {
      id: "temple-explorer",
      name: "Temple Explorer",
      description: "Generated explorer sidekick used in the book-style setup.",
      position: "left",
      requiredForProduction: true,
    },
  },
  {
    id: "candy_cascade",
    displayName: "Candy Cascade",
    type: "Candy Cluster",
    description: "Candy-symbol cluster game with cascades and placeholder booster/sugar-rush feature intent.",
    grid: { columns: 6, rows: 5, cellSize: 90 },
    winSystem: "cluster",
    defaultRtpTarget: 96,
    volatility: "medium",
    complexity: "medium",
    bestFor: "Bright, approachable cascade games with friendly production scope.",
    mechanics: ["clusterPays", "cascade", "scatterFreeSpins", "freeSpinMultiplier"],
    mechanicStatus: [
      implemented("clusterPays", "Cluster pays are implemented."),
      implemented("cascade", "Cascade loop is implemented."),
      implemented("scatterFreeSpins", "Sugar-rush free spins use scatter trigger config."),
      partial("freeSpinMultiplier", "Sugar-rush booster/multiplier behavior is represented as config intent."),
    ],
    features: flags({ clusterWins: true, cascades: true, freeSpins: true, freeSpinMultiplier: true }),
    math: { ...DEFAULT_MATH, targetRtp: 96, volatility: "medium", maxWin: 7500, hitFrequencyTarget: 31, bonusFrequencyTarget: 170, freeSpins: { triggerScatters: 4, spinsAwarded: 10, multiplier: 2 } },
    symbols: [
      sym("jelly", "Jelly", "low", "#ef476f", "JEL", 135, lowPays(1.2)),
      sym("mint", "Mint", "low", "#06d6a0", "MNT", 125, lowPays(1.5)),
      sym("lemon", "Lemon Drop", "low", "#ffd166", "LEM", 115, lowPays(1.9)),
      sym("berry", "Berry Cube", "low", "#118ab2", "BRY", 105, lowPays(2.4)),
      sym("cupcake", "Cupcake", "high", "#ffafcc", "CAKE", 34, highPays(5.5)),
      sym("lollipop", "Lollipop", "high", "#c77dff", "POP", 25, highPays(8)),
      sym("wild", "Rainbow Wild", "wild", "#ffffff", "WILD", 11),
      sym("scatter", "Sugar Scatter", "scatter", "#fb8500", "SCAT", 9),
    ],
    themes: [
      { id: "bright_candy_shop", name: "Bright Candy Shop", palette: ["#11131a", "#ef476f", "#06d6a0"], description: "Dark premium shell with candy-color highlights." },
    ],
    defaultThemeId: "bright_candy_shop",
    animationPreset: "cascade_pop",
    soundPreset: "candy",
    assetRequirements: ["Candy symbol states", "Candy-shop background", "Sugar-rush scatter", "Mascot placeholder"],
    productionBlockers: ["Sugar-rush booster logic is partial.", "Generated candy mascot must be replaced if enabled."],
    supportedPreviewStates: ["idle", "spin", "small_win", "big_win", "free_spins_trigger", "cascade_chain"],
    character: {
      id: "candy-mascot",
      name: "Candy Mascot",
      description: "Generated candy mascot for the friendly creator flow.",
      position: "right",
      requiredForProduction: false,
    },
  },
  {
    id: "classic_fruits",
    displayName: "Classic Fruits",
    type: "Classic Lines 5x3",
    description: "Simple fruit slot setup with paylines, wild, scatter and lightweight free spins.",
    grid: { columns: 5, rows: 3, cellSize: 104 },
    winSystem: "line",
    defaultRtpTarget: 95,
    volatility: "medium",
    complexity: "easy",
    bestFor: "First slot projects and low-risk theme experiments.",
    mechanics: ["linePays", "scatterFreeSpins"],
    mechanicStatus: [
      partial("linePays", "Line-pay configuration is generated; runtime payout engine is planned."),
      implemented("scatterFreeSpins", "Scatter free-spins config is available."),
    ],
    features: flags({ lineWins: true, freeSpins: true }),
    math: { ...DEFAULT_MATH, targetRtp: 95, volatility: "medium", maxWin: 1500, minClusterSize: 3, hitFrequencyTarget: 34, bonusFrequencyTarget: 130, freeSpins: { triggerScatters: 3, spinsAwarded: 8, multiplier: 2 } },
    symbols: [
      sym("cherry", "Cherry", "low", "#d00000", "CHR", 110, linePays(0.4)),
      sym("lemon", "Lemon", "low", "#ffd166", "LEM", 100, linePays(0.6)),
      sym("plum", "Plum", "low", "#7b2cbf", "PLM", 90, linePays(0.8)),
      sym("bell", "Bell", "high", "#f5c542", "BELL", 38, linePays(2)),
      sym("seven", "Seven", "high", "#ef233c", "7", 22, linePays(5)),
      sym("wild", "Wild", "wild", "#ffffff", "WILD", 10),
      sym("scatter", "Scatter", "scatter", "#2d9c6f", "SCAT", 8),
    ],
    themes: [
      { id: "premium_fruits", name: "Premium Fruits", palette: ["#0b0f0a", "#f5c542", "#d00000"], description: "Classic fruit colors inside a modern dark product shell." },
    ],
    defaultThemeId: "premium_fruits",
    animationPreset: "default",
    soundPreset: "classic",
    assetRequirements: ["Fruit symbol states", "Simple cabinet frame", "Spin and win sounds"],
    productionBlockers: ["Line-pay runtime is partial.", "Generated fruit symbols are demo-only."],
    supportedPreviewStates: ["idle", "spin", "small_win", "big_win", "near_miss", "free_spins_trigger"],
    character: {
      id: "lucky-host",
      name: "Lucky Host",
      description: "Optional generated host for onboarding cards.",
      position: "right",
      requiredForProduction: false,
    },
  },
  {
    id: "gold_collector",
    displayName: "Gold Collector",
    type: "Coin Collector",
    description: "Coin-heavy template with collector symbols, free spins and planned hold-and-win respin loop.",
    grid: { columns: 5, rows: 4, cellSize: 96 },
    winSystem: "hybrid",
    defaultRtpTarget: 96,
    volatility: "high",
    complexity: "advanced",
    bestFor: "Feature-forward coin collection games with strong bonus messaging.",
    mechanics: ["clusterPays", "coinCollector", "holdAndWinRespins", "bonusBuy"],
    mechanicStatus: [
      implemented("clusterPays", "Base-game cluster pays work in preview/runtime."),
      implemented("coinCollector", "Coin collector threshold and coin values are implemented."),
      planned("holdAndWinRespins", "Hold-and-win respins are defined but not implemented yet."),
      implemented("bonusBuy", "Bonus-buy math is available for feature valuation."),
    ],
    features: flags({ clusterWins: true, cascades: false, coinCollector: true, holdAndWinRespins: true, bonusBuy: true }),
    math: { ...DEFAULT_MATH, targetRtp: 96, volatility: "high", maxWin: 8000, minClusterSize: 5, hitFrequencyTarget: 23, bonusFrequencyTarget: 190, coinCollectThreshold: 5, bonusBuyCost: 120 },
    symbols: [
      sym("pickaxe", "Pickaxe", "low", "#8d99ae", "PCK", 120, lowPays(1.3)),
      sym("lantern", "Lantern", "low", "#ffb703", "LNT", 105, lowPays(1.8)),
      sym("minecart", "Mine Cart", "high", "#6c584c", "CART", 40, highPays(5)),
      sym("safe", "Safe", "high", "#adb5bd", "SAFE", 28, highPays(8)),
      sym("wild", "Wild Nugget", "wild", "#ffd700", "WILD", 12),
      sym("collector", "Collector", "scatter", "#2d6a4f", "COL", 10),
      sym("coin", "Gold Coin", "coin", "#f5c542", "COIN", 42, [], 2),
    ],
    themes: [
      { id: "deep_mine_gold", name: "Deep Mine Gold", palette: ["#0b0f0a", "#f5c542", "#6c584c"], description: "Charcoal mine backdrop with gold collection highlights." },
    ],
    defaultThemeId: "deep_mine_gold",
    animationPreset: "coin_roll",
    soundPreset: "gold",
    assetRequirements: ["Coin symbol variants", "Collector symbol", "Mine background", "Miner character"],
    productionBlockers: ["Hold-and-win respin loop is planned.", "Miner character uses generated placeholder art."],
    supportedPreviewStates: ["idle", "spin", "small_win", "big_win", "coin_collect"],
    character: {
      id: "gold-miner",
      name: "Gold Miner",
      description: "Generated miner character for the coin collector flow.",
      position: "left",
      requiredForProduction: true,
    },
  },
];

export function getTemplateDefinition(id: TemplateId): SlotTemplateDefinition {
  const template = TEMPLATE_REGISTRY.find((t) => t.id === id);
  if (!template) throw new Error(`Unknown slot template: ${id}`);
  return template;
}

export function getDefaultTemplate(): SlotTemplateDefinition {
  return getTemplateDefinition("cluster_6x5_collector");
}

export function templateMechanicStatuses(template: SlotTemplateDefinition): TemplateMechanicStatus[] {
  return template.mechanicStatus.map((m) => ({
    featureId: m.featureId,
    status: m.status,
    note: m.note,
  }));
}

export function templateHasPartialMechanics(template: SlotTemplateDefinition): boolean {
  return template.mechanicStatus.some((m) => m.status !== "implemented");
}

export function createProjectFromTemplate(templateId: TemplateId, options: CreateProjectOptions = {}): SlotProjectType {
  const template = getTemplateDefinition(templateId);
  const themeId = options.themeId ?? template.defaultThemeId;
  const theme = template.themes.find((t) => t.id === themeId) ?? template.themes[0];
  if (!theme) throw new Error(`Template ${template.id} has no theme options.`);

  const projectName = options.projectName?.trim() || template.displayName;
  const math: MathConfig = {
    ...clone(template.math),
    targetRtp: options.rtpTarget ?? template.math.targetRtp,
    volatility: options.volatility ?? template.math.volatility,
    freeSpins: { ...template.math.freeSpins },
  };
  const warnings = [
    ...template.productionBlockers,
    ...template.mechanicStatus
      .filter((m) => m.status !== "implemented")
      .map((m) => `${m.featureId}: ${m.note}`),
  ];

  return SlotProjectSchema.parse({
    schemaVersion: 1,
    id: options.id ?? slug(projectName),
    projectName,
    template: template.id,
    theme: theme.id,
    grid: clone(template.grid),
    features: featureDefaults(template.features),
    math,
    symbols: clone(template.symbols),
    assets: {
      background: `themes/${theme.id}/background.png`,
      symbols: {},
    },
    character: {
      enabled: options.characterEnabled ?? true,
      id: template.character.id,
      name: template.character.name,
      description: template.character.description,
      position: template.character.position,
      assetStatus: "generated",
      asset: `gen:character/${template.character.id}`,
      requiredForProduction: template.character.requiredForProduction,
    },
    templateMeta: {
      templateName: template.displayName,
      winSystem: template.winSystem,
      complexity: template.complexity,
      bestFor: template.bestFor,
      mechanicStatus: templateMechanicStatuses(template),
      warnings,
      nextActions: [
        "Run a 100k simulation",
        "Replace generated symbol art with real assets",
        templateHasPartialMechanics(template) ? "Review partial mechanics before production" : "Review production blockers",
      ],
    },
    animations: commonAnimations(template.animationPreset),
    sounds: commonSounds(template.soundPreset),
  });
}

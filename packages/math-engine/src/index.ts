export {
  simulate,
  type SimOptions,
  type SimResult,
  type WinBucket,
} from "./simulate.js";
export {
  multiSeedSimulate,
  type MultiSeedResult,
  type MultiSeedOptions,
  type Range,
} from "./multiseed.js";
export {
  analyzeVolatility,
  labelFromStdDev,
  type VolatilityReport,
} from "./volatility.js";
export {
  analyzeBonusBuy,
  type BonusBuyReport,
  type BonusBuyOptions,
} from "./bonusbuy.js";
export {
  buildMathReport,
  MIN_TRUSTWORTHY_SPINS,
  type MathReport,
  type MathReportOptions,
} from "./report.js";
export { suggestBalance, type BalanceSuggestion, type BalanceContext } from "./balance.js";

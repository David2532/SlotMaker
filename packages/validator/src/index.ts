export {
  collectIssues,
  checkAssets,
  checkMath,
  checkAnimation,
  checkSound,
  checkMobile,
  CORE_EVENTS,
  type Category,
  type Issue,
  type MathStats,
} from "./checks.js";
export { computeHealth, type HealthReport, type CategoryScore } from "./health.js";
export { autoFix, type AutoFixResult } from "./autofix.js";

import type { SlotProject } from "@slotmaker/config";
import type { MathReport } from "@slotmaker/math-engine";
import type { AIProvider } from "./provider.js";
import type { Proposal } from "./proposal.js";

const CORE_ANIM_EVENTS = [
  "spin_start", "reel_drop", "reel_stop", "symbol_land", "win_detected",
  "cluster_remove", "cascade_drop", "scatter_land", "bonus_trigger", "coin_collect", "big_win_start",
] as const;

const DEFAULT_SOUND: Record<string, string> = {
  spin_start: "spin_whoosh.wav", reel_drop: "reel_drop.wav", reel_stop: "reel_tick.wav",
  symbol_land: "soft_hit.wav", win_detected: "small_win.wav", cluster_remove: "pop_explosion.wav",
  cascade_drop: "drop.wav", scatter_land: "whistle_hit.wav", bonus_trigger: "stadium_roar.wav",
  coin_collect: "gold_coin.wav", big_win_start: "crowd_big_win.wav",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "reskin";

/**
 * A deterministic, offline mock provider. It produces honest, reviewable
 * proposals from existing tooling/heuristics — no network, no API keys, no
 * fabricated claims. Real providers implement the same `AIProvider` interface.
 */
export function createMockProvider(opts: { now?: () => Date } = {}): AIProvider {
  const now = opts.now ?? (() => new Date());
  let n = 0;
  const base = (): Pick<Proposal, "id" | "createdAt" | "provider"> => ({
    id: `mock-${++n}`,
    createdAt: now().toISOString(),
    provider: { name: "mock", model: "offline-heuristic", version: "1" },
  });

  return {
    name: "mock",

    async generateThemeProposal(project, prompt): Promise<Proposal> {
      // Cohesive palette: warm gold for premium symbols, cool slate for lows.
      const symbols = project.symbols.map((s) => ({
        ...s,
        color: s.kind === "high" || s.kind === "wild" ? "#f5c542" : s.kind === "scatter" ? "#e63946" : s.color,
      }));
      return {
        ...base(),
        type: "theme",
        title: "Cohesive premium palette",
        summary: `Unify premium symbols on gold to match "${prompt || project.theme}". Lows keep their tints.`,
        risk: "low",
        affectedAreas: ["symbols.color"],
        patch: { symbols },
        requiredValidation: ["schema", "health"],
      };
    },

    async generateAnimationProposal(project, _prompt): Promise<Proposal> {
      const bound = new Set(project.animations.map((a) => a.event));
      const additions = CORE_ANIM_EVENTS.filter((e) => !bound.has(e)).map((event) => ({
        event, preset: "default", delayMs: 0, durationMs: 300,
      }));
      return {
        ...base(),
        type: "animation",
        title: `Bind ${additions.length} missing animation event(s)`,
        summary: "Add default animation bindings for unbound core events to smooth playback.",
        risk: "low",
        affectedAreas: ["animations"],
        patch: { animations: [...project.animations, ...additions] },
        requiredValidation: ["schema", "health"],
      };
    },

    async generateSoundProposal(project, _prompt): Promise<Proposal> {
      const bound = new Set(project.sounds.map((s) => s.event));
      const additions = CORE_ANIM_EVENTS.filter((e) => !bound.has(e) && DEFAULT_SOUND[e]).map((event) => ({
        event, file: DEFAULT_SOUND[event]!, delayMs: 0, volume: 0.8,
      }));
      return {
        ...base(),
        type: "sound",
        title: `Map ${additions.length} missing sound cue(s)`,
        summary: "Auto-map placeholder sound files to unbound core events (still placeholders, not real audio).",
        risk: "low",
        affectedAreas: ["sounds"],
        patch: { sounds: [...project.sounds, ...additions] },
        requiredValidation: ["schema", "health"],
      };
    },

    async generateBalanceProposal(project, mathReport, _prompt): Promise<Proposal> {
      if (!mathReport) {
        return {
          ...base(),
          type: "math",
          title: "Run a simulation first",
          summary: "No math report available. Run a Heavy Math Lab simulation so balance ideas are based on measured RTP, not guesses.",
          risk: "low",
          affectedAreas: [],
          patch: {},
          requiredValidation: ["math"],
          blockedReason: "missing-math-report",
        };
      }
      const target = project.math.targetRtp;
      const observed = mathReport.rtp.observed;
      const factor = Math.max(0.6, Math.min(1.6, target / Math.max(observed, 1)));
      const symbols = project.symbols.map((s) =>
        s.kind === "high"
          ? { ...s, pays: s.pays.map((t) => ({ ...t, multiplier: +(t.multiplier * factor).toFixed(2) })) }
          : s,
      );
      return {
        ...base(),
        type: "math",
        title: `Scale premium pays ×${factor.toFixed(2)} toward ${target}% RTP`,
        summary: `Measured RTP is ${observed.toFixed(2)}% (target ${target}%). Scaling premium-symbol pays by ${factor.toFixed(2)} should move it toward target. Re-simulate to confirm.`,
        risk: "medium",
        affectedAreas: ["symbols.pays"],
        patch: { symbols },
        requiredValidation: ["schema", "health", "math"],
      };
    },

    async generateReskinProposal(project, prompt): Promise<Proposal> {
      const themeId = slug(prompt);
      const symbols = project.symbols.map((s) => ({ ...s, color: s.kind === "high" ? "#7b2ff7" : s.color }));
      return {
        ...base(),
        type: "reskin",
        title: `Reskin draft: ${prompt || "new theme"}`,
        summary: `Keep the mechanic; swap theme id to "${themeId}", rename the project, and retint premium symbols. Assets stay generated until real art is imported.`,
        risk: "medium",
        affectedAreas: ["theme", "projectName", "symbols.color"],
        patch: { theme: themeId, projectName: prompt || `${project.projectName} (reskin)`, symbols },
        requiredValidation: ["schema", "health"],
      };
    },
  };
}

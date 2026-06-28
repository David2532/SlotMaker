import {
  ALL_SYMBOL_STATES,
  type AnimationEvent,
  type SlotProject,
  type SymbolState,
} from "@slotmaker/config";
import { CRITICAL_SOUND_EVENTS, type ResolveContext, type ResolvedAsset } from "./types.js";

const EMPTY = new Set<string>();

function symbolStatePath(project: SlotProject, symbolId: string, state: SymbolState): string | undefined {
  const sym = project.symbols.find((s) => s.id === symbolId);
  return sym?.states?.[state] ?? project.assets.symbols[symbolId]?.[state];
}

/**
 * Resolve a symbol's render state through the fallback chain:
 *   1. real asset for the requested state
 *   2. real asset for `static` (state fallback)
 *   3. generated dev-pack asset
 *   4. missing
 */
export function resolveSymbolState(
  project: SlotProject,
  symbolId: string,
  state: SymbolState,
  ctx: ResolveContext = {},
): ResolvedAsset {
  const real = ctx.realAssets ?? EMPTY;
  const key = `symbol:${symbolId}:${state}`;
  const critical = state === "static";
  const base = { key, kind: "symbol" as const, critical, ownerId: symbolId, state };

  const own = symbolStatePath(project, symbolId, state);
  if (own && real.has(own)) return { ...base, status: "real", source: "file", uri: own };

  if (state !== "static") {
    const staticPath = symbolStatePath(project, symbolId, "static");
    if (staticPath && real.has(staticPath)) {
      return { ...base, status: "real", source: "file", uri: staticPath, fallbackFrom: "static" };
    }
  }

  if (ctx.devPack?.canSymbol(symbolId, state)) {
    return { ...base, status: "generated", source: "generated", uri: ctx.devPack.symbolUri(symbolId, state) };
  }
  if (own) return { ...base, status: "placeholder", source: "placeholder", uri: own };
  return { ...base, status: "missing" };
}

/**
 * Resolve a sound event: real file → generated tone (demo) → placeholder → missing.
 */
export function resolveSound(
  project: SlotProject,
  event: AnimationEvent,
  ctx: ResolveContext = {},
): ResolvedAsset {
  const real = ctx.realAssets ?? EMPTY;
  const key = `sound:${event}`;
  const critical = CRITICAL_SOUND_EVENTS.includes(event);
  const base = { key, kind: "sound" as const, critical, event };
  const binding = project.sounds.find((s) => s.event === event);

  if (binding?.file && real.has(binding.file)) {
    return { ...base, status: "real", source: "file", uri: binding.file };
  }
  if (ctx.devPack?.canSound(event)) {
    return { ...base, status: "generated", source: "generated", uri: ctx.devPack.soundUri(event) };
  }
  if (binding?.file) return { ...base, status: "placeholder", source: "placeholder", uri: binding.file };
  return { ...base, status: "missing" };
}

export function resolveBackground(project: SlotProject, ctx: ResolveContext = {}): ResolvedAsset {
  const real = ctx.realAssets ?? EMPTY;
  const base = { key: "background", kind: "background" as const, critical: false };
  const path = project.assets.background;
  if (path && real.has(path)) return { ...base, status: "real", source: "file", uri: path };
  if (ctx.devPack?.canBackground()) return { ...base, status: "generated", source: "generated", uri: ctx.devPack.backgroundUri() };
  if (path) return { ...base, status: "placeholder", source: "placeholder", uri: path };
  return { ...base, status: "missing" };
}

export function resolveCharacter(project: SlotProject, ctx: ResolveContext = {}): ResolvedAsset[] {
  const character = project.character;
  if (!character?.enabled) return [];

  const real = ctx.realAssets ?? EMPTY;
  const base = {
    key: `character:${character.id}`,
    kind: "character" as const,
    critical: character.requiredForProduction,
    ownerId: character.id,
  };

  if (character.asset && real.has(character.asset)) {
    return [{ ...base, status: "real", source: "file", uri: character.asset }];
  }
  if (character.assetStatus === "generated") {
    return [{ ...base, status: "generated", source: "generated", uri: character.asset ?? `gen:character/${character.id}` }];
  }
  if (character.asset) {
    return [{ ...base, status: "placeholder", source: "placeholder", uri: character.asset }];
  }
  return [{ ...base, status: "missing" }];
}

/** Every symbol-state slot, plus every critical/bound sound, plus background. */
export function resolveAll(project: SlotProject, ctx: ResolveContext = {}): ResolvedAsset[] {
  const out: ResolvedAsset[] = [];
  for (const s of project.symbols) {
    for (const st of ALL_SYMBOL_STATES) out.push(resolveSymbolState(project, s.id, st, ctx));
  }
  const soundEvents = new Set<AnimationEvent>([
    ...CRITICAL_SOUND_EVENTS,
    ...project.sounds.map((s) => s.event),
  ]);
  for (const e of soundEvents) out.push(resolveSound(project, e, ctx));
  out.push(resolveBackground(project, ctx));
  out.push(...resolveCharacter(project, ctx));
  return out;
}

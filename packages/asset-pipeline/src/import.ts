import type { AnimationEvent, SlotProject, SymbolState } from "@slotmaker/config";
import type { AssetKind } from "./types.js";

/**
 * A descriptor of a real asset file offered to the importer. The importer never
 * reads pixels/audio itself — callers supply metadata (from a file picker, a
 * build step, etc.). This keeps the pipeline pure and testable, and keeps real
 * binaries out of the repo.
 */
export interface ImportFile {
  kind: AssetKind;
  /** Real file path / uri that will resolve as a real asset. */
  path: string;
  symbolId?: string;
  state?: SymbolState;
  event?: AnimationEvent;
  /** Image pixel dimensions (required for symbol/background/frame). */
  width?: number;
  height?: number;
  /** File extension/format, e.g. "png", "webp", "wav". */
  format?: string;
}

export interface ImportOptions {
  canvasSize?: number;
  /** Fractional padding (0..0.5) reserved around symbol content. */
  padding?: number;
  minImageSize?: number;
  allowedImageFormats?: string[];
  allowedAudioFormats?: string[];
}

const DEFAULTS: Required<ImportOptions> = {
  canvasSize: 256,
  padding: 0.1,
  minImageSize: 64,
  allowedImageFormats: ["png", "webp"],
  allowedAudioFormats: ["wav", "mp3", "ogg"],
};

/** A normalization plan (target canvas + centered content box). No pixels touched. */
export interface NormalizePlan {
  canvas: number;
  /** Content box within the canvas (centered, padded). */
  content: { x: number; y: number; size: number };
  /** Uniform scale to apply to the source to fit the content box. */
  scale: number;
}

export interface ImportedAsset {
  key: string;
  kind: AssetKind;
  path: string;
  status: "real";
  source: "file";
  normalize?: NormalizePlan;
}

export interface ImportIssue {
  key: string;
  severity: "error" | "warning";
  message: string;
}

export interface ImportResult {
  /** Real asset paths to feed the resolver so these slots become `real`. */
  realAssets: Set<string>;
  accepted: ImportedAsset[];
  rejected: ImportIssue[];
  warnings: ImportIssue[];
}

function keyFor(f: ImportFile): string {
  if (f.kind === "symbol") return `symbol:${f.symbolId}:${f.state ?? "static"}`;
  if (f.kind === "sound") return `sound:${f.event}`;
  return f.kind;
}

function planNormalize(opts: Required<ImportOptions>, width: number, height: number): NormalizePlan {
  const inner = opts.canvasSize * (1 - opts.padding * 2);
  const scale = inner / Math.max(width, height);
  const offset = (opts.canvasSize - inner) / 2;
  return { canvas: opts.canvasSize, content: { x: offset, y: offset, size: inner }, scale };
}

/**
 * Validate + normalize a batch of real asset files, producing the set of real
 * asset paths the resolver should treat as `real` (overriding generated dev
 * assets automatically). Invalid files are rejected with reasons; nothing is
 * silently accepted.
 */
export function importAssets(
  project: SlotProject,
  files: ImportFile[],
  options: ImportOptions = {},
): ImportResult {
  const opts = { ...DEFAULTS, ...options };
  const realAssets = new Set<string>();
  const accepted: ImportedAsset[] = [];
  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const knownSymbols = new Set(project.symbols.map((s) => s.id));

  for (const f of files) {
    const key = keyFor(f);
    const isImage = f.kind !== "sound";
    const format = (f.format ?? f.path.split(".").pop() ?? "").toLowerCase();

    if (!f.path.trim()) {
      rejected.push({ key, severity: "error", message: "empty asset path." });
      continue;
    }
    if (f.kind === "symbol" && f.symbolId && !knownSymbols.has(f.symbolId)) {
      rejected.push({ key, severity: "error", message: `unknown symbol "${f.symbolId}".` });
      continue;
    }

    if (isImage) {
      if (!opts.allowedImageFormats.includes(format)) {
        rejected.push({ key, severity: "error", message: `image format "${format}" not allowed (use ${opts.allowedImageFormats.join("/")}).` });
        continue;
      }
      if (f.width == null || f.height == null) {
        rejected.push({ key, severity: "error", message: "image is missing width/height." });
        continue;
      }
      if (Math.min(f.width, f.height) < opts.minImageSize) {
        rejected.push({ key, severity: "error", message: `image ${f.width}x${f.height} is below the ${opts.minImageSize}px minimum.` });
        continue;
      }
      if (f.width !== f.height) {
        warnings.push({ key, severity: "warning", message: `image ${f.width}x${f.height} is not square; it will be normalized with padding.` });
      }
      accepted.push({
        key,
        kind: f.kind,
        path: f.path,
        status: "real",
        source: "file",
        normalize: planNormalize(opts, f.width, f.height),
      });
    } else {
      if (!opts.allowedAudioFormats.includes(format)) {
        rejected.push({ key, severity: "error", message: `audio format "${format}" not allowed (use ${opts.allowedAudioFormats.join("/")}).` });
        continue;
      }
      accepted.push({ key, kind: f.kind, path: f.path, status: "real", source: "file" });
    }
    realAssets.add(f.path);
  }

  return { realAssets, accepted, rejected, warnings };
}

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@slotmaker/config": pkg("packages/config/src/index.ts"),
      "@slotmaker/slot-runtime": pkg("packages/slot-runtime/src/index.ts"),
      "@slotmaker/math-engine": pkg("packages/math-engine/src/index.ts"),
      "@slotmaker/animation-system": pkg("packages/animation-system/src/index.ts"),
      "@slotmaker/sound-system": pkg("packages/sound-system/src/index.ts"),
      "@slotmaker/asset-pipeline": pkg("packages/asset-pipeline/src/index.ts"),
      "@slotmaker/validator": pkg("packages/validator/src/index.ts"),
      "@slotmaker/exporter": pkg("packages/exporter/src/index.ts"),
      "@slotmaker/ai-copilot": pkg("packages/ai-copilot/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts"],
  },
});

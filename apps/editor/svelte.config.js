import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Static build — the editor is a pure client-side SPA. No server needed.
    adapter: adapter({ fallback: "index.html" }),
    prerender: { entries: [] },
  },
};

export default config;

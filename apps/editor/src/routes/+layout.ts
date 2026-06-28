// Pure client-side SPA: no SSR (PixiJS needs the DOM). adapter-static serves a
// fallback index.html, so the route is rendered entirely in the browser.
export const ssr = false;
export const prerender = false;

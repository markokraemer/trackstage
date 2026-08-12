// Generated from public/favicon.svg and public/icon-192.png — regenerate with
// `base64 -i public/icon-192.png` if the brand mark changes.
//
// Why this file exists: the Convex deployment serves the public HTTP surfaces
// (MCP + REST) on its own origin, and MCP clients (Claude's connector list,
// ChatGPT) brand a connector with the favicon of the ENDPOINT's origin — which
// 404'd here and fell back to Convex's own mark. Serving the Trackstage icon
// from the router puts our brand on the connector, on the raw *.convex.site
// host and on the custom domain alike.

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" role="img" aria-label="Trackstage"><title>Trackstage</title><rect width="64" height="64" rx="11.52" fill="#2F5CE0"/><rect x="15.467" y="17.120" width="5.291" height="29.760" rx="2.645" fill="#FFFFFF" opacity="1"/><rect x="25.056" y="17.120" width="23.477" height="7.605" rx="3.307" fill="#FFFFFF" opacity="0.4"/><rect x="25.056" y="28.197" width="15.872" height="7.605" rx="3.307" fill="#FFFFFF" opacity="1"/><rect x="25.056" y="39.275" width="20.501" height="7.605" rx="3.307" fill="#FFFFFF" opacity="0.65"/></svg>`

/** 192px PNG, base64 — decoded once at module load in convex/http.ts. */
export const FAVICON_PNG_BASE64 =
  "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"

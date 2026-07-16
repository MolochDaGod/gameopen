/**
 * Client "build": polish index.html, inject fleet bootstrap, ensure aliases + manifest.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "client/public");

spawnSync(process.execPath, [path.join(__dirname, "fix-asset-aliases.mjs")], {
  stdio: "inherit",
});
spawnSync(process.execPath, [path.join(__dirname, "generate-asset-manifest.mjs")], {
  stdio: "inherit",
});

const indexPath = path.join(publicDir, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("Missing client/public/index.html — copy dist assets first");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");

// Fleet asset base (optional override via meta + bootstrap)
const bootstrap = `
<script>
  // Grudge fleet: prefer R2 CDN for heavy assets when configured
  // Default: same-origin public/ (Open ships models under Vercel static).
  // R2 /gameopen prefix is incomplete — only enable with explicit VITE_USE_R2=true
  // AND a working base (prefer assets.grudge-studio.com root, not /gameopen).
  window.__GAMEOPEN__ = window.__GAMEOPEN__ || {
    assetsCdn: ${JSON.stringify(process.env.VITE_ASSET_BASE_URL || "https://assets.grudge-studio.com")},
    useR2: ${JSON.stringify(process.env.VITE_USE_R2 === "true")},
    apiBase: ${JSON.stringify(process.env.VITE_API_BASE_URL || "")},
  };
  // Rewrite relative /models /anim /icons to CDN only when R2 flag is explicitly on
  (function () {
    if (!window.__GAMEOPEN__.useR2) return;
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
    var cdn = window.__GAMEOPEN__.assetsCdn.replace(/\\/$/, "");
    // Refuse incomplete gameopen prefix (mass 404s for props/races/vfx)
    if (/\\/gameopen\\/?$/i.test(cdn)) {
      console.warn("[gameopen] refusing R2 rewrite to incomplete /gameopen prefix");
      window.__GAMEOPEN__.useR2 = false;
      return;
    }
    var prefixes = ["/models/", "/anim/", "/icons/", "/ui/"];
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.startsWith("/") && prefixes.some(function (p) { return url.startsWith(p); })) {
          return origFetch(cdn + url, init);
        }
      } catch (e) {}
      return origFetch(input, init);
    };
  })();
</script>
`.trim();

if (!html.includes("window.__GAMEOPEN__")) {
  html = html.replace("</head>", `  ${bootstrap}\n  </head>`);
}

// Stronger SEO / fleet meta
if (!html.includes("og:image")) {
  html = html.replace(
    '<meta name="twitter:description"',
    '<meta property="og:image" content="/opengraph.jpg" />\n    <meta property="og:url" content="https://open.grudge-studio.com/" />\n    <meta name="twitter:description"',
  );
}

// Prefer Grudge Open branding while keeping Survival copy as description fallback
html = html.replace(
  /<title>[^<]*<\/title>/,
  "<title>Grudge Open — Combat Sandbox | Grudge Studio</title>",
);

fs.writeFileSync(indexPath, html);
console.log("[prepare-client] index.html polished");

// Marker for Vercel
fs.writeFileSync(
  path.join(publicDir, ".gameopen-build.json"),
  JSON.stringify({ builtAt: new Date().toISOString(), ok: true }, null, 2),
);

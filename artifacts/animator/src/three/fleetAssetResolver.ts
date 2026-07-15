/**
 * Fleet asset resolver — D1/R2 + same-origin strategy for Open games/scenes.
 *
 * Production truth (probed 2026-07):
 *  - **Same-origin** (`open.grudge-studio.com` / gameopen.vercel.app public/) ships
 *    Open lab pack: karate-boss, races, 30characters, props, vfx, icons, grudge/*.glb.
 *  - **R2 CDN** `https://assets.grudge-studio.com` (NOT `/gameopen` prefix) holds
 *    fleet packs: weapons, grudge6 FBX races, textures, baked anim JSON,
 *    characters/*.glb, /assets/{race}/… modular kit, /anims/baked.
 *  - **Arena** `grudge-arena.grudge-studio.com` — skinned race GLBs for combat.
 *  - **ObjectStore/info** registry JSON for icons/definitions (optional lookup).
 *  - Incomplete `assets.grudge-studio.com/gameopen/*` — last resort only.
 *
 * Loaders must use {@link resolveAssetCandidates} / {@link loadGltfFirst} with
 * Draco + Meshopt (+ KTX2 when renderer bound) so compressed GLBs decode.
 */

const _viteBase = import.meta.env.BASE_URL || "/";

/** Canonical public CDNs (CORS-enabled on r2-cdn worker). */
export const FLEET_ASSET_HOSTS = {
  /** Primary binary CDN (R2 grudge-assets via r2-cdn Worker). */
  r2: "https://assets.grudge-studio.com",
  /** Incomplete Open mirror — avoid unless dual-uploaded. */
  r2Gameopen: "https://assets.grudge-studio.com/gameopen",
  open: "https://open.grudge-studio.com",
  gameopenVercel: "https://gameopen.vercel.app",
  /** Skinned grudge6 race GLBs + anim JSON (combat runtime). */
  arena: "https://grudge-arena.grudge-studio.com",
  /** ObjectStore GitHub pages / info registry (icons, defs). */
  objectStorePages: "https://molochdagod.github.io/ObjectStore",
  infoApi: "https://info.grudge-studio.com/api/v1",
} as const;

function cleanPath(path: string): string {
  return path.replace(/^\//, "").replace(/\\/g, "/");
}

function sameOriginUrl(clean: string): string {
  const base = _viteBase.replace(/\/$/, "");
  return `${base}/${clean}`;
}

function abs(host: string, clean: string): string {
  return `${host.replace(/\/$/, "")}/${clean}`;
}

/**
 * Path aliases — logical Open path → alternate keys that exist on R2 or registry.
 * Keep short: only proven production keys (probed 2026-07).
 */
export function pathAliases(path: string): string[] {
  const clean = cleanPath(path);
  const out: string[] = [clean];

  // Race GLBs (Open public) ↔ characters/ on R2
  const raceM = clean.match(/^models\/races\/([a-z0-9_-]+)\.glb$/i);
  if (raceM) {
    const n = raceM[1]!.toLowerCase().replace(/_/g, "-");
    out.push(`models/characters/${n}.glb`);
    if (n === "high-elf" || n === "high_elf") {
      out.push("models/characters/elf.glb", "models/races/high_elf.glb");
    }
  }

  // Lab heroes
  if (clean === "models/orc.glb") out.push("models/characters/orc.glb");
  if (clean === "models/racalvin.glb") {
    out.push("models/characters/gunslinger.glb", "models/gunslinger.glb");
  }

  // grudge class GLBs (Open has models/grudge/{race}_{class}.glb; R2 may not)
  const grudgeCls = clean.match(/^models\/grudge\/([a-z0-9-]+)_(knight|warrior|ranger|mage)\.glb$/i);
  if (grudgeCls) {
    const race = grudgeCls[1]!.toLowerCase();
    // Fall back to race GLB / characters pack when class GLB missing on R2
    out.push(`models/races/${race === "high-elves" ? "high_elf" : race.replace(/s$/, "")}.glb`);
    out.push(`models/characters/${race.replace(/s$/, "")}.glb`);
  }

  // grudge6 baked roster — Open same-origin only (not on R2 root yet)
  if (clean === "models/grudge6/30characters.glb") {
    out.push("models/grudge6/30characters.glb", "models/characters/30characters.glb");
  }

  // Modular race kit (FBX + textures) — R2 /assets/{race}/... + grudge6 races + texture alt paths
  if (clean.startsWith("assets/")) {
    out.push(clean);
    const m = clean.match(
      /^assets\/(western-kingdoms|barbarians|dwarves|elves|orcs|undead)\/models\/characters\/([A-Z]+)_Characters/i,
    );
    if (m) {
      const pfx = m[2]!.toUpperCase();
      out.push(`models/grudge6/races/${pfx}_Characters.fbx`);
      out.push(`models/grudge6/races/${pfx}_Characters_customizable.FBX`);
      out.push(`models/grudge6/races/${pfx}_Characters.FBX`);
    }
    // Texture path under assets/… → also textures/grudge6/…
    const texM = clean.match(
      /^assets\/(western-kingdoms|barbarians|dwarves|elves|orcs|undead)\/textures\/(.+)$/i,
    );
    if (texM) {
      const raceFolder = texM[1]!.toLowerCase();
      const file = texM[2]!;
      const folderMap: Record<string, string> = {
        elves: "elves",
        "western-kingdoms": "western-kingdoms",
        barbarians: "barbarians",
        dwarves: "dwarves",
        orcs: "orcs",
        undead: "undead",
      };
      const tf = folderMap[raceFolder] ?? raceFolder;
      out.push(`textures/grudge6/${tf}/${file}`);
    }
  }

  // textures/grudge6 ↔ assets/{race}/textures
  const g6tex = clean.match(/^textures\/grudge6\/([^/]+)\/(.+)$/i);
  if (g6tex) {
    const folder = g6tex[1]!.toLowerCase();
    const file = g6tex[2]!;
    const raceMap: Record<string, string> = {
      "western-kingdoms": "western-kingdoms",
      barbarians: "barbarians",
      dwarves: "dwarves",
      elves: "elves",
      orcs: "orcs",
      undead: "undead",
    };
    const race = raceMap[folder];
    if (race) out.push(`assets/${race}/textures/${file}`);
  }

  // Arena skinned race GLBs (combat runtime)
  const arenaM = clean.match(/^cdn\/assets\/characters\/([^/]+)\/([^/]+)$/i);
  if (arenaM) {
    out.push(clean);
    // Also try R2-style keys if ever mirrored
    out.push(`models/grudge6/races/${arenaM[2]}`);
  }

  // Icons — Open pack + R2 root (icons/attack.png works; pack/ often 404)
  if (clean.startsWith("icons/")) {
    const name = clean.slice("icons/".length);
    out.push(`icons/${name}`);
    out.push(`icons/pack/${name}`);
    out.push(`icons/496_rpg_icons/${name.replace(/\.png$/i, "")}.png`);
  }

  // VFX — Open has models/vfx/*; R2 often missing
  if (clean.startsWith("models/vfx/")) {
    out.push(clean.replace("models/vfx/", "vfx/"));
  }

  // Weapons — both Open and R2 root
  if (clean.startsWith("models/weapons/")) {
    out.push(clean);
    out.push(clean.replace("models/weapons/", "weapons/"));
  }

  // Baked anim JSON
  if (clean.startsWith("anims/baked/") || clean.startsWith("anim/")) {
    out.push(clean);
  }

  // Explorer / Mixamo clip paths
  if (clean.startsWith("anim/animations/") || clean.startsWith("animations/")) {
    out.push(clean.replace(/^anim\//, ""));
    out.push(clean.startsWith("animations/") ? `anim/${clean}` : clean);
  }

  return [...new Set(out)];
}

/**
 * Ordered absolute URLs to try for a logical asset path.
 * Prefer same-origin (Open pack complete), then fleet R2 root, never prefer
 * broken /gameopen R2 prefix.
 */
export function resolveAssetCandidates(path: string): string[] {
  // Absolute URL → single candidate
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) {
    return [path];
  }

  const aliases = pathAliases(path);
  const urls: string[] = [];

  for (const a of aliases) {
    // 1) Same-origin SPA (fast, no CORS, full Open pack on Vercel)
    urls.push(sameOriginUrl(a));
    // 2) Production Open hosts (if running from another origin / preview)
    urls.push(abs(FLEET_ASSET_HOSTS.open, a));
    urls.push(abs(FLEET_ASSET_HOSTS.gameopenVercel, a));
    // 3) Canonical R2 CDN (weapons, grudge6 FBX, textures, anims JSON)
    urls.push(abs(FLEET_ASSET_HOSTS.r2, a));
    // 4) Arena for skinned characters / baked anims
    if (
      a.startsWith("cdn/") ||
      a.startsWith("anims/") ||
      a.includes("grudge6") ||
      a.startsWith("assets/")
    ) {
      urls.push(abs(FLEET_ASSET_HOSTS.arena, a));
    }
    // 5) ObjectStore pages for icon registry paths
    if (a.startsWith("icons/")) {
      urls.push(abs(FLEET_ASSET_HOSTS.objectStorePages, a));
    }
  }

  // 6) Incomplete gameopen R2 prefix — last resort
  for (const a of aliases) {
    urls.push(abs(FLEET_ASSET_HOSTS.r2Gameopen, a));
  }

  return [...new Set(urls.filter(Boolean))];
}

/** Primary URL for <img src> / simple cases (same-origin first). */
export function resolveAssetUrl(path: string): string {
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  return sameOriginUrl(cleanPath(path));
}

/**
 * HEAD/GET probe first live URL (browser). Used for icons / optional soft fail.
 */
export async function resolveLiveAssetUrl(
  path: string,
  opts?: { method?: "HEAD" | "GET"; timeoutMs?: number },
): Promise<string | null> {
  const method = opts?.method ?? "HEAD";
  const timeoutMs = opts?.timeoutMs ?? 4000;
  for (const url of resolveAssetCandidates(path)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(url, { method, signal: ctrl.signal, mode: "cors" });
      clearTimeout(t);
      if (r.ok) {
        // Reject HTML fake-200 (SPA fallback)
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("text/html")) continue;
        return url;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Fetch first live URL as Response (for JSON clips / binary soft loads). */
export async function fetchAssetFirst(
  path: string,
  opts?: { timeoutMs?: number; accept?: string },
): Promise<{ response: Response; url: string }> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  let lastErr: unknown;
  for (const url of resolveAssetCandidates(path)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(url, {
        signal: ctrl.signal,
        mode: "cors",
        headers: opts?.accept ? { Accept: opts.accept } : undefined,
      });
      clearTimeout(t);
      if (!r.ok) {
        lastErr = new Error(`HTTP ${r.status} ${url}`);
        continue;
      }
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        lastErr = new Error(`HTML fake-200 ${url}`);
        continue;
      }
      return { response: r, url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`Failed to fetch asset: ${path}`);
}

/** Optional: soft-load ObjectStore/info asset-registry for icon UUID lookup. */
let registryPromise: Promise<Map<string, string> | null> | null = null;

export async function loadInfoAssetRegistry(): Promise<Map<string, string> | null> {
  if (registryPromise) return registryPromise;
  registryPromise = (async () => {
    try {
      const r = await fetch(`${FLEET_ASSET_HOSTS.infoApi}/asset-registry.json`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as {
        assets?: Record<string, { path?: string; cdn?: string; filename?: string }>;
        baseUrl?: string;
      };
      const map = new Map<string, string>();
      const base = (data.baseUrl || FLEET_ASSET_HOSTS.objectStorePages).replace(/\/$/, "");
      if (data.assets) {
        for (const a of Object.values(data.assets)) {
          if (a.filename) {
            const cdn = a.cdn || (a.path ? `${base}/${a.path.replace(/^\//, "")}` : "");
            if (cdn) {
              map.set(a.filename.toLowerCase(), cdn);
              map.set(a.filename.toLowerCase().replace(/\.png$/, ""), cdn);
            }
          }
          if (a.path) {
            map.set(a.path.toLowerCase(), a.cdn || `${base}/${a.path.replace(/^\//, "")}`);
          }
        }
      }
      return map;
    } catch {
      return null;
    }
  })();
  return registryPromise;
}

/** Resolve icon with registry fallback (no 404 if ObjectStore has the name). */
export async function resolveIconUrl(name: string): Promise<string> {
  const file = name.endsWith(".png") ? name : `${name}.png`;
  const path = file.startsWith("icons/") ? file : `icons/${file}`;
  const live = await resolveLiveAssetUrl(path, { method: "HEAD", timeoutMs: 2500 });
  if (live) return live;
  const reg = await loadInfoAssetRegistry();
  const hit =
    reg?.get(file.toLowerCase()) ||
    reg?.get(name.toLowerCase()) ||
    reg?.get(file.toLowerCase().replace(/_/g, ""));
  if (hit) return hit;
  return resolveAssetUrl(path);
}

/**
 * Canonical grudge6 race FBX paths (R2-proven) for a RaceId-like slug.
 */
export const GRUDGE6_RACE_FBX: Record<string, string> = {
  human: "models/grudge6/races/WK_Characters.fbx",
  "western-kingdoms": "models/grudge6/races/WK_Characters.fbx",
  barbarian: "models/grudge6/races/BRB_Characters.fbx",
  barbarians: "models/grudge6/races/BRB_Characters.fbx",
  dwarf: "models/grudge6/races/DWF_Characters.fbx",
  dwarves: "models/grudge6/races/DWF_Characters.fbx",
  elf: "models/grudge6/races/ELF_Characters.fbx",
  "high-elves": "models/grudge6/races/ELF_Characters.fbx",
  orc: "models/grudge6/races/ORC_Characters.fbx",
  orcs: "models/grudge6/races/ORC_Characters.fbx",
  undead: "models/grudge6/races/UD_Characters.fbx",
};

/** Prefer game-hosted webp + R2 texture atlases. */
export const GRUDGE6_TEX_PATHS: Record<string, string[]> = {
  "western-kingdoms": [
    "textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
    "assets/western-kingdoms/textures/WK_Standard_Units.webp",
  ],
  barbarians: [
    "textures/grudge6/barbarians/BRB_StandardUnits_texture.webp",
    "assets/barbarians/textures/BRB_StandardUnits_texture.webp",
  ],
  dwarves: [
    "textures/grudge6/dwarves/DWF_Standard_Units.webp",
    "assets/dwarves/textures/DWF_Standard_Units.webp",
  ],
  "high-elves": [
    "textures/grudge6/elves/ELF_HighElves_Texture.webp",
    "assets/elves/textures/ELF_HighElves_Texture.webp",
  ],
  orcs: [
    "textures/grudge6/orcs/ORC_StandardUnits.webp",
    "assets/orcs/textures/ORC_StandardUnits.webp",
  ],
  undead: [
    "textures/grudge6/undead/UD_Standard_Units.webp",
    "assets/undead/textures/UD_Standard_Units.webp",
  ],
};

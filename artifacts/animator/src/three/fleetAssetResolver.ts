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
 *  - Incomplete `assets.grudge-studio.com/gameopen/*` — never use for loads.
 *
 * Loaders must use {@link resolveAssetCandidates} / {@link loadGltfFirst} with
 * Draco + Meshopt (+ KTX2 when renderer bound) so compressed GLBs decode.
 */

const _viteBase = import.meta.env.BASE_URL || "/";

/** Canonical public CDNs (CORS-enabled on r2-cdn worker). */
export const FLEET_ASSET_HOSTS = {
  /** Primary binary CDN (R2 grudge-assets via r2-cdn Worker). */
  r2: "https://assets.grudge-studio.com",
  open: "https://open.grudge-studio.com",
  gameopenVercel: "https://gameopen.vercel.app",
  /** Skinned grudge6 race GLBs + anim JSON (combat runtime). */
  arena: "https://grudge-arena.grudge-studio.com",
  /** Static ObjectStore mirror (GitHub pages). */
  objectStorePages: "https://molochdagod.github.io/ObjectStore",
  /** Definitions SSOT — catalogs JSON (not binaries). */
  infoApi: "https://info.grudge-studio.com/api/v1",
  /** @deprecated Prefer infoApi — public objectstore catalogs often 404. */
  objectStoreApi: "https://objectstore.grudge-studio.com/api/v1",
} as const;

/**
 * Incomplete R2 prefix — never use for GLB/texture loads.
 * Probed 2026-07: `assets.grudge-studio.com/gameopen/models/**` mass-404s.
 */
export const R2_GAMEOPEN_PREFIX_DO_NOT_USE =
  "https://assets.grudge-studio.com/gameopen";

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

  // Race GLBs — production SSOT is grudge6 modular kit on R2; races/* is lab fallback
  const raceM = clean.match(/^models\/races\/([a-z0-9_-]+)\.glb$/i);
  if (raceM) {
    const n = raceM[1]!.toLowerCase().replace(/_/g, "-");
    const g6 = grudge6RaceGlbForSlug(n);
    if (g6) {
      // Prefer grudge6 first in candidate list
      out.unshift(g6);
      out.push(g6.replace(/\.glb$/i, ".fbx"));
    }
    out.push(`models/characters/${n}.glb`);
    if (n === "high-elf" || n === "high_elf") {
      out.push(
        GRUDGE6_RACE_GLB.elf!,
        "models/characters/elf.glb",
        "models/races/high_elf.glb",
      );
    }
  }
  // Direct grudge6 race GLB — also accept FBX authoring path
  const g6m = clean.match(/^models\/grudge6\/races\/([A-Z]+)_Characters\.glb$/i);
  if (g6m) {
    const pfx = g6m[1]!.toUpperCase();
    out.push(`models/grudge6/races/${pfx}_Characters.glb`);
    out.push(`models/grudge6/races/${pfx}_Characters.fbx`);
    out.push(`models/grudge6/races/${pfx}_Characters_customizable.FBX`);
  }

  // Lab heroes — prefer models that exist on R2 / Open public (probed 2026-07)
  if (clean === "models/orc.glb") out.push("models/characters/orc.glb");
  // Dead arena key — alias to live war-zone shell (never probe instarena hosts)
  if (
    clean === "models/instarena-phyxt-fight.glb" ||
    clean === "models/instarena.glb" ||
    /instarena/i.test(clean)
  ) {
    out.length = 0;
    out.push(
      "models/arena-war-zone.glb",
      "models/dungeon.glb",
      "models/dj-booth.glb",
    );
  }
  if (clean === "models/racalvin.glb") {
    out.push(
      "models/racalvin.glb",
      "models/characters/gunslinger.glb",
      "models/gunslinger.glb",
      "models/karate-boss.glb",
      "models/orc.glb",
    );
  }
  // Dead voxel stand-ins → live weapon GLBs (probed 2026-07)
  if (
    clean === "models/weapons/voxel/00.obj" ||
    clean === "models/weapons/voxel/00.glb" ||
    /^models\/weapons\/voxel\//i.test(clean)
  ) {
    out.length = 0;
    out.push(
      "models/weapons/sword.glb",
      "models/weapons/greatsword.glb",
      "models/weapons/dagger.glb",
    );
  }
  // Scythe family: no dedicated scythe GLB yet → war-spear / spear
  if (/scythe/i.test(clean) && !out.some((p) => /war-spear|spear/.test(p))) {
    out.push("models/weapons/war-spear.glb", "models/weapons/spear.glb");
  }
  // Tome / book offhand stand-in until dedicated mesh
  if (/models\/weapons\/tome/i.test(clean)) {
    out.push("models/weapons/shield.glb", "models/weapons/staff.glb");
  }

  // Racalvin living twin swords (Brothers Keeper)
  if (
    clean === "models/weapons/my-brothers-keeper.prod.glb" ||
    clean === "models/weapons/my-brothers-keeper.glb" ||
    /brothers.?keeper/i.test(clean)
  ) {
    out.length = 0;
    out.push(
      "models/weapons/my-brothers-keeper.prod.glb",
      "models/weapons/my-brothers-keeper.glb",
      "models/weapons/sword.glb",
      "models/weapons/sculk-sword.glb",
      "models/weapons/greatsword.glb",
    );
  }
  // Cinema / doors hall — introgamer/astrocreeper never shipped to R2; rewrite entirely
  // so loaders never HEAD the dead URL (console 404 spam on lobby).
  if (
    clean === "models/introgamer.glb" ||
    clean === "models/astrocreeper.glb" ||
    clean === "models/landing/astrocreeper.glb" ||
    clean === "models/landing/helpers.glb"
  ) {
    out.length = 0;
    out.push(
      "models/racalvin.glb",
      "models/karate-boss.glb",
      "models/orc.glb",
      "models/skeleton-warrior.glb",
    );
  }
  if (clean === "models/dj-booth.glb") {
    out.push("models/dj-booth.glb", "models/dungeon.glb");
  }
  // Camp props — dying-torch lives on R2; same-origin often stale deploy
  if (clean === "models/props/dying-torch.glb") {
    out.push(
      "models/props/dying-torch.glb",
      "models/props/torch-burning.glb",
      "models/props/torch.glb",
    );
  }
  if (clean === "models/camp/claim-flag.glb") {
    out.push("models/camp/claim-flag.glb");
  }
  // Hip-hop clip often missing — don't block; loaders skip 404
  if (clean.includes("hip-hop-dancing")) {
    out.push("anim/animations/extra/front-flip.fbx", "anim/extra/front-flip.fbx");
  }
  // Portraits: human_warrior → pack race icon
  if (
    /human[_-]?warrior/i.test(clean) ||
    clean === "races/portraits/human-warrior.png"
  ) {
    out.push(
      "icons/pack/races/human.png",
      "icons/pack/classes/warrior.png",
      "races/human.png",
    );
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
  // 30characters.glb PURGED — never alias as grudge6 hero path
  if (/30characters/i.test(clean)) {
    return out; // empty aliases — refuse to resolve
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

  // Arena skinned race GLBs (combat runtime) — R2 holds models/grudge6/races/*.glb
  const arenaM = clean.match(/^cdn\/assets\/characters\/([^/]+)\/([^/]+)$/i);
  if (arenaM) {
    out.push(clean);
    // Production R2 path (200) — never assets…/cdn/assets/… (404)
    out.push(`models/grudge6/races/${arenaM[2]}`);
    // Open same-origin proxy path
    out.push(`cdn/assets/characters/${arenaM[1]}/${arenaM[2]}`);
  }

  // Icons — Open pack + R2 root (icons/attack.png works; pack/ often 404)
  if (clean.startsWith("icons/")) {
    const name = clean.slice("icons/".length);
    out.push(`icons/${name}`);
    out.push(`icons/pack/${name}`);
    out.push(`icons/496_rpg_icons/${name.replace(/\.png$/i, "")}.png`);
    // WCS equipment icons often live under icons/wcs/equipment or icons only
    if (name.startsWith("wcs/equipment/")) {
      const bare = name.replace(/^wcs\/equipment\//, "").replace(/\.png$/i, "");
      out.push(`icons/${bare}.png`);
      out.push(`icons/equip.png`);
    }
  }

  // Account paperdoll race portraits (TI assets copied to public/races/)
  const racePng = clean.match(/^races\/([a-z0-9_-]+)\.png$/i);
  if (racePng) {
    const n = racePng[1]!.toLowerCase().replace(/_/g, "-");
    const map: Record<string, string> = {
      human: "human",
      orc: "orc",
      elf: "elf",
      "high-elf": "elf",
      highelf: "elf",
      dwarf: "dwarf",
      barbarian: "barbarian",
      barb: "barbarian",
      undead: "undead",
    };
    const key = map[n] ?? n;
    out.push(`races/${key}.png`);
    out.push(`ui/races/${key}.png`);
    out.push(`icons/races/${key}.png`);
  }

  // Account equipment banner (alias library account scene)
  if (
    clean === "rooms/equipment-banner.png" ||
    clean === "equipment-banner.png"
  ) {
    out.push("rooms/equipment-banner.png");
    out.push("rooms/library-account-scene.png");
    out.push("rooms/library-account-scene.jpg");
    out.push("rooms/lobby-scene.png");
  }

  // VFX — Open public + R2 both host models/vfx/* (probed 200)
  if (clean.startsWith("models/vfx/") || clean.startsWith("vfx/")) {
    const base = clean.replace(/^vfx\//, "models/vfx/").replace(/\\/g, "/");
    out.push(base);
    out.push(base.replace("models/vfx/", "vfx/"));
    // underscore ↔ hyphen (stylized_ice_bow vs stylized-ice-bow)
    if (base.includes("_")) out.push(base.replace(/_/g, "-"));
    if (base.includes("-")) out.push(base.replace(/-/g, "_"));
    // ice bow not always deployed — fall back to shipped slash VFX
    if (/ice.?bow|stylized_ice/i.test(base)) {
      out.push(
        "models/vfx/light-of-slash.glb",
        "models/vfx/attack-slashes.glb",
        "models/vfx/elemental-swords.glb",
      );
    }
  }

  // Weapons — both Open and R2 root
  if (clean.startsWith("models/weapons/")) {
    out.push(clean);
    out.push(clean.replace("models/weapons/", "weapons/"));
  }

  // Baked anim JSON (same-origin first via resolveAssetCandidates)
  if (clean.startsWith("anims/baked/")) {
    out.push(clean);
  }

  // Explorer / Mixamo clip paths — Open ships under anim/ and anim/animations/
  // (same-origin first). Hip-hop etc. often missing → fall back to shipped extras.
  if (clean.startsWith("anim/animations/") || clean.startsWith("animations/")) {
    const leaf = clean.replace(/^anim\/animations\//, "").replace(/^animations\//, "");
    out.push(`anim/animations/${leaf}`);
    out.push(`anim/${leaf}`);
    out.push(`animations/${leaf}`);
    if (/hip-hop|hiphop/i.test(leaf)) {
      out.push("anim/extra/front-flip.fbx", "anim/animations/extra/front-flip.fbx");
    }
  } else if (clean.startsWith("anim/") && !clean.startsWith("anim/base/")) {
    out.push(clean);
  }
  if (clean.startsWith("anim/extra/") || clean.startsWith("anim/animations/extra/")) {
    const name = clean.split("/").pop()!;
    out.push(`anim/extra/${name}`, `anim/animations/extra/${name}`);
  }

  return [...new Set(out)];
}

/**
 * Paths that only exist on R2 (or arena) — never trust same-origin first.
 * (Probed: open.grudge-studio.com/textures/grudge6/* and models/grudge6/* 404 without rewrite.)
 */
function isFleetCdnFirst(clean: string): boolean {
  return (
    clean.startsWith("textures/grudge6/") ||
    clean.startsWith("models/grudge6/") ||
    clean.startsWith("models/voxels/") ||
    clean.startsWith("models/props/") ||
    clean.startsWith("models/camp/") ||
    clean.startsWith("models/vfx/") ||
    clean === "models/racalvin.glb" ||
    clean === "models/dj-booth.glb" ||
    clean === "models/introgamer.glb" ||
    clean.startsWith("models/landing/") ||
    clean.startsWith("assets/western-kingdoms/") ||
    clean.startsWith("assets/barbarians/") ||
    clean.startsWith("assets/dwarves/") ||
    clean.startsWith("assets/elves/") ||
    clean.startsWith("assets/orcs/") ||
    clean.startsWith("assets/undead/") ||
    clean.startsWith("icons/pack/") ||
    clean.startsWith("icons/wcs/") ||
    clean.startsWith("cdn/assets/characters/")
  );
}

/**
 * Ordered absolute URLs to try for a logical asset path.
 * Fleet CDN-first for grudge6 textures/models; same-origin first for Open lab pack.
 * Absolute CDN URLs get Mine-Loader deploy-epoch ?v= bust when epoch is set.
 */
export function resolveAssetCandidates(path: string): string[] {
  // Absolute URL → single candidate (still epoch-bust http(s) CDN)
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) {
    return [withFleetEpochBust(path)];
  }

  const aliases = pathAliases(path);
  const urls: string[] = [];

  for (const a of aliases) {
    const cdnFirst = isFleetCdnFirst(a);

    if (cdnFirst) {
      // Production race kits / atlases / TVS — R2 then same-origin (after vercel rewrite)
      urls.push(abs(FLEET_ASSET_HOSTS.r2, a));
      urls.push(sameOriginUrl(a));
      urls.push(abs(FLEET_ASSET_HOSTS.open, a));
      urls.push(abs(FLEET_ASSET_HOSTS.gameopenVercel, a));
    } else {
      // Open lab pack (karate, weapons stand-ins, local props)
      urls.push(sameOriginUrl(a));
      urls.push(abs(FLEET_ASSET_HOSTS.open, a));
      urls.push(abs(FLEET_ASSET_HOSTS.gameopenVercel, a));
      urls.push(abs(FLEET_ASSET_HOSTS.r2, a));
    }

    // Arena: skinned race GLB fallback ONLY — never baked anims (CORS broken from Open).
    if (
      (a.startsWith("cdn/") || a.includes("grudge6") || a.startsWith("assets/")) &&
      !a.startsWith("anims/")
    ) {
      urls.push(abs(FLEET_ASSET_HOSTS.arena, a));
    }
    // ObjectStore pages for icon registry paths
    if (a.startsWith("icons/")) {
      urls.push(abs(FLEET_ASSET_HOSTS.objectStorePages, a));
    }
  }

  // Never append r2Gameopen — that prefix 404s for Open lab pack (props/races/vfx)
  // and only pollutes the network panel + lastErr when all real hosts fail.

  return [...new Set(urls.filter(Boolean).map(withFleetEpochBust))];
}

/** Deploy-epoch query for fleet CDN hosts (Mine-Loader worldFleet / stamp). */
function withFleetEpochBust(url: string): string {
  try {
    // Lazy import path avoided — use localStorage epoch set by bootstrap
    const epoch =
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("grudge_fleet_deploy_epoch")) ||
      "";
    if (!epoch || !url || url.startsWith("data:")) return url;
    if (!/^https?:\/\//i.test(url)) return url;
    if (/[?&]v=/.test(url)) return url;
    // Bust R2 / open hosts / mine SPA island paths only
    if (
      !/assets\.grudge-studio\.com|open\.grudge-studio\.com|mine-loader\.vercel\.app|mine\.grudge-studio\.com|grudge-arena\.grudge-studio\.com/i.test(
        url,
      )
    ) {
      return url;
    }
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(epoch)}`;
  } catch {
    return url;
  }
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
 * Authoring / convert source — prefer {@link GRUDGE6_RACE_GLB} for play.
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

/**
 * Production grudge6 race GLBs (R2 HEAD 200 2026-07) — textured SI bake, Bip001.
 * Use for play / loadout / combat. charactersgrudox races/*.glb is lab fallback only.
 */
export const GRUDGE6_RACE_GLB: Record<string, string> = {
  human: "models/grudge6/races/WK_Characters.glb",
  "western-kingdoms": "models/grudge6/races/WK_Characters.glb",
  barbarian: "models/grudge6/races/BRB_Characters.glb",
  barbarians: "models/grudge6/races/BRB_Characters.glb",
  dwarf: "models/grudge6/races/DWF_Characters.glb",
  dwarves: "models/grudge6/races/DWF_Characters.glb",
  elf: "models/grudge6/races/ELF_Characters.glb",
  "high-elves": "models/grudge6/races/ELF_Characters.glb",
  "high-elf": "models/grudge6/races/ELF_Characters.glb",
  orc: "models/grudge6/races/ORC_Characters.glb",
  orcs: "models/grudge6/races/ORC_Characters.glb",
  undead: "models/grudge6/races/UD_Characters.glb",
};

/** Fleet race slug → grudge6 production GLB path (or null). */
export function grudge6RaceGlbForSlug(raceId?: string | null): string | null {
  if (!raceId) return null;
  const k = String(raceId)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (GRUDGE6_RACE_GLB[k]) return GRUDGE6_RACE_GLB[k]!;
  if (k.includes("orc")) return GRUDGE6_RACE_GLB.orc!;
  if (k.includes("elf")) return GRUDGE6_RACE_GLB.elf!;
  if (k.includes("dwarf") || k.includes("dwf")) return GRUDGE6_RACE_GLB.dwarf!;
  if (k.includes("barb")) return GRUDGE6_RACE_GLB.barbarian!;
  if (k.includes("undead") || k === "ud") return GRUDGE6_RACE_GLB.undead!;
  if (k.includes("human") || k.includes("kingdom") || k === "wk") return GRUDGE6_RACE_GLB.human!;
  return null;
}

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

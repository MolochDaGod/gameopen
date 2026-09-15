/**
 * Entry catch system — correct start points, anti-loop, wrong-page recovery.
 *
 * SSOT for "where should this URL land?" across Open + fleet handoffs.
 * Used by openRoutes + login return builders. Do not invent parallel redirects.
 *
 * Docs: docs/ENTRY_CATCH_SSOT.md
 */

import type { AppMode } from "./openRoutes";

/** Canonical production hosts (no trailing slash). */
export const ENTRY_HOSTS = {
  open: "https://open.grudge-studio.com",
  openAlias: "https://gameopen.vercel.app",
  grudox: "https://grudox.grudge-studio.com",
  foundry: "https://character.grudge-studio.com",
  warlords: "https://client.grudge-studio.com",
  warlordsPlay: "https://grudgewarlords.com",
  /** Warstrat / Warlord Genesis warcamp (canonical production SPA) */
  warstrat: "https://warstrat.grudge-studio.com",
  warlordGenesis: "https://warlord-genesis.vercel.app",
  id: "https://id.grudge-studio.com",
  ui: "https://ui.grudge-studio.com",
  traits: "https://traits.grudge.studio",
  forge: "https://forge.grudge-studio.com",
  assets: "https://assets.grudge-studio.com",
  /** Voxel Realms (Mine-Loader) production */
  mineLoader: "https://mineloader.grudge-studio.com",
  /** Client play host (home island · world map · pirate lobby) */
  warlordsClient: "https://client.grudge-studio.com",
  /** Grudge Studio Trader desk */
  trader: "https://trader.grudge-studio.com",
} as const;

/**
 * Product start points — where users/agents should land for each intent.
 * Prefer these over naked deep-links that skip handoff.
 */
export const PRODUCT_STARTS = {
  /** Open library hub */
  openHub: `${ENTRY_HOSTS.open}/`,
  /** Open all-era combat sandbox */
  danger: `${ENTRY_HOSTS.open}/danger`,
  /** Open Danger voxel lane */
  dangerVoxel: `${ENTRY_HOSTS.open}/danger?era=voxel`,
  /** GRUDOX voxel Danger (Mixamo explorer) — not Open /danger */
  grudoxVoxelDanger: `${ENTRY_HOSTS.grudox}/voxgrudge/tvs-showcase.html`,
  /** Account / roster after Foundry equip handoff */
  account: `${ENTRY_HOSTS.open}/account`,
  /** 4-seat TVS campfire hub (charactersgrudox) — not AccountPanel */
  campfire: `${ENTRY_HOSTS.open}/characters`,
  /** Sign-in (fleet session) */
  signIn: `${ENTRY_HOSTS.open}/login`,
  /** Foundry create only */
  foundryCreate: `${ENTRY_HOSTS.foundry}/foundry`,
  /** Foundry 4-slot hub */
  foundryHub: `${ENTRY_HOSTS.foundry}/`,
  /** Warlords home island (needs characterId on handoff) */
  warlordsHome: `${ENTRY_HOSTS.warlordsClient}/home-island`,
  /** Warlords Aethermoor world map / sector sail hub */
  warlordsWorldMap: `${ENTRY_HOSTS.warlordsClient}/island-3d?mode=lobby`,
  /** Warlords tutorial (shipwreck / opening mesh — not Open /game) */
  warlordsTutorial: `${ENTRY_HOSTS.warlordsClient}/tutorial`,
  /** Warstrat warcamp lobby (shared Railway account characters) */
  warstratLobby: `${ENTRY_HOSTS.warstrat}/lobby`,
  /** GRUDOX arcade root */
  grudoxArcade: `${ENTRY_HOSTS.grudox}/arcade`,
  /** Voxel Realms islands — harvest/craft/build/sail (Mine-Loader) */
  mineLoader: `${ENTRY_HOSTS.mineLoader}/`,
  /** Open in-app Realms surface */
  openRealms: `${ENTRY_HOSTS.open}/realms`,
  /** Open voxel worldbuilder (deployables / blocks) */
  openVoxel: `${ENTRY_HOSTS.open}/voxel`,
  /** Open Danger harvest lab */
  openHarvest: `${ENTRY_HOSTS.open}/danger?activity=harvest`,
  /** Character info / equipment (UUID · mesh bake · owned gear) */
  equipment: `${ENTRY_HOSTS.open}/equipment`,
  /** Canonical Trait Store (Unity paperdoll on Main Panel) */
  traitStore: `${ENTRY_HOSTS.traits}/`,
  /** CDN assets root (binaries — not a SPA mode) */
  assetsCdn: `${ENTRY_HOSTS.assets}`,
  /** Grudge Studio portal / The ENGINE (marketing + product index, not a second roster) */
  studioPortal: "https://grudge-studio.com/",
  /** Legion AI hub — chat / image / agents (JWT from Grudge ID) */
  aiHub: "https://ai.grudge-studio.com/",
  /** Vibe IDE */
  coder: "https://coder.grudge-studio.com/",
  /** Wallet product UI (same Railway account row) */
  wallet: "https://wallet.grudge-studio.com/",
  /** Grudge Studio Trader — same Grudge ID, not a second account */
  trader: `${ENTRY_HOSTS.trader}/`,
  /** HUD / main-panel UI studio */
  uiStudio: `${ENTRY_HOSTS.ui}/`,
  uiHotkeys: `${ENTRY_HOSTS.ui}/hotkeys`,
  uiAssets: `${ENTRY_HOSTS.ui}/assets`,
  /** Agentic Three.js editor (Studio tools) */
  grokBuilder: "https://grok-builder.vercel.app/",
  /** Warlords scene editor (not Forge) */
  threeFlow: "https://threeflow.vercel.app/",
  /** Grudge Studio map/deploy editor */
  forge: "https://forge.grudge-studio.com/",
  /** Open mimic encounter */
  mimic: `${ENTRY_HOSTS.open}/mimic`,
  /** Warlords modular dungeon forge + crawl */
  grudgeDungeons: "https://grudge-dungeons.vercel.app/",
  /** Linear boss crawl (entrance → mini-boss → boss arena) */
  grudgeDungeonBoss: "https://grudge-dungeons.vercel.app/?linear=1",
  /** Magma Core — platforms over lava, Slag Warlord, linear crawl */
  grudgeDungeonMolten:
    "https://grudge-dungeons.vercel.app/?theme=molten&linear=1",
} as const;

/** Cabinets that MUST run on grudox, never Open SPA. */
export const GRUDOX_ONLY_CABINETS = new Set([
  "racer",
  "race",
  "velocity",
  "voxel-velocity",
  "zombie",
  "undead",
  "sword-master",
  "swordmaster",
  "z-brawl",
  "zbrawl",
  "sailing",
  "carrier",
  "boat",
  "brawler",
  "brawl",
  "arena",
]);

/**
 * Hosts that must never be used as login/return destinations (loop / wrong product).
 * Matching is hostname endsWith or exact.
 */
export const BLOCKED_RETURN_HOST_SUFFIXES = [
  "character.grudge-studio.com",
  "grudge6.grudge-studio.com",
  "id.grudge-studio.com",
  "assets.grudge-studio.com",
] as const;

/** Hosts allowed as returnTo / redirect_uri for Grudge ID. */
export const ALLOWED_RETURN_HOST_SUFFIXES = [
  "open.grudge-studio.com",
  "gameopen.vercel.app",
  "client.grudge-studio.com",
  "grudgewarlords.com",
  "play.grudgewarlords.com",
  "grudox.grudge-studio.com",
  "forge.grudge-studio.com",
  "ui.grudge-studio.com",
  "mine.grudge-studio.com",
  "mineloader.grudge-studio.com",
  "mine-loader.vercel.app",
  "warstrat.grudge-studio.com",
  "warlord-genesis.vercel.app",
  "trader.grudge-studio.com",
  "localhost",
  "127.0.0.1",
] as const;

export type CatchAction =
  | {
      kind: "mode";
      mode: AppMode;
      reason: string;
      /** Replace history when applying */
      replace?: boolean;
    }
  | {
      kind: "hard_redirect";
      url: string;
      reason: string;
    }
  | {
      kind: "stay";
      mode: AppMode;
      reason: string;
    };

export interface CatchInput {
  pathname: string;
  search: string;
  hostname?: string;
  /** Has fleet JWT in storage (optional — improves landing→hub) */
  hasSession?: boolean;
}

function q(search: string): URLSearchParams {
  const s = search.startsWith("?") ? search : search ? `?${search}` : "";
  return new URLSearchParams(s);
}

function segs(pathname: string): string[] {
  return pathname.split("/").filter(Boolean).map((x) => x.toLowerCase());
}

function hostMatches(hostname: string, suffix: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  const s = suffix.toLowerCase();
  return h === s || h.endsWith(`.${s}`) || h.endsWith(s);
}

/** True if hostname is blocked as a return destination. */
export function isBlockedReturnHost(hostname: string): boolean {
  return BLOCKED_RETURN_HOST_SUFFIXES.some((s) => hostMatches(hostname, s));
}

/** True if hostname is allowlisted for returnTo. */
export function isAllowedReturnHost(hostname: string): boolean {
  if (!hostname) return false;
  if (isBlockedReturnHost(hostname)) return false;
  return ALLOWED_RETURN_HOST_SUFFIXES.some((s) => hostMatches(hostname, s));
}

/**
 * Sanitize a return/redirect URL for Grudge ID.
 * Returns brand Open hub if invalid / loop / blocked.
 */
export function safeReturnUrl(
  candidate: string | null | undefined,
  fallback = PRODUCT_STARTS.openHub,
): string {
  if (!candidate || typeof candidate !== "string") return fallback;
  const raw = candidate.trim();
  if (!raw) return fallback;
  try {
    // Relative path on current Open origin
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : ENTRY_HOSTS.open;
      const u = new URL(raw, origin);
      if (isBlockedReturnHost(u.hostname)) return fallback;
      // Strip re-entry loop params after handoff
      u.searchParams.delete("mode");
      // Keep characterId / open / from for account handoff
      return u.toString();
    }
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    // Foundry is create-only — never return there; land Open account instead
    if (hostMatches(u.hostname, "character.grudge-studio.com")) {
      return PRODUCT_STARTS.account;
    }
    // Never bounce login back to id.* / assets
    if (isBlockedReturnHost(u.hostname)) return fallback;
    if (!isAllowedReturnHost(u.hostname)) return fallback;
    return u.toString();
  } catch {
    return fallback;
  }
}

/**
 * Catch wrong paths / cabinets / loops and emit mode or hard redirect.
 * Call before or inside mode resolution; hard_redirect takes precedence.
 */
export function catchEntry(input: CatchInput): CatchAction {
  const pathname = input.pathname || "/";
  const search = input.search || "";
  const params = q(search);
  const parts = segs(pathname);
  const from = (params.get("from") || params.get("source") || "").toLowerCase();
  const modeQ = (params.get("mode") || "").toLowerCase();
  const door = (params.get("door") || "").toLowerCase();

  // ── 0. Trader is its own product host (same Grudge ID, not Open) ──────
  if (parts[0] === "trader" || door === "trader" || modeQ === "trader") {
    return {
      kind: "hard_redirect",
      url: PRODUCT_STARTS.trader,
      reason: "trader intent → trader.grudge-studio.com",
    };
  }

  // ── 1. Foundry / create intent must leave Open SPA ─────────────────────
  // ?mode=create or path /foundry on Open → character foundry create
  if (
    modeQ === "create" ||
    parts[0] === "foundry" ||
    door === "foundry" ||
    door === "create-hero"
  ) {
    const returnTo = safeReturnUrl(
      params.get("returnTo") || params.get("redirect_uri") || PRODUCT_STARTS.account,
    );
    const dest = new URL(PRODUCT_STARTS.foundryCreate);
    dest.searchParams.set("era", "warlords");
    dest.searchParams.set("returnTo", returnTo);
    return {
      kind: "hard_redirect",
      url: dest.toString(),
      reason: "create/foundry intent → character.grudge-studio.com/foundry",
    };
  }

  // ── 1b. Magma Core (platforms over lava) lives on Grudge Dungeons ─────
  // Open /mimic stays the barrel Test Dungeon. Do not invent a second lava engine.
  const lavaDoor =
    door === "lava" ||
    door === "molten" ||
    door === "magma" ||
    door === "magma-core" ||
    door === "slag";
  const lavaPath =
    parts[0] === "lava" ||
    parts[0] === "molten" ||
    parts[0] === "magma" ||
    parts[0] === "magma-core" ||
    parts[0] === "slag";
  if (lavaDoor || lavaPath || modeQ === "molten" || modeQ === "lava") {
    return {
      kind: "hard_redirect",
      url: PRODUCT_STARTS.grudgeDungeonMolten,
      reason: "lava/molten intent → Magma Core crawl (theme=molten&linear=1)",
    };
  }

  // ── 2. GRUDOX-only arcade cabinets (anti wrong-host loop) ──────────────
  if (parts[0] === "arcade" && parts[1] === "play" && parts[2]) {
    const cabinetId = parts[2]!;
    if (GRUDOX_ONLY_CABINETS.has(cabinetId)) {
      const dest = new URL(
        `${ENTRY_HOSTS.grudox}/arcade/play/${encodeURIComponent(cabinetId)}`,
      );
      // Preserve query but force open=1 for shell context
      const src = q(search);
      src.forEach((v, k) => dest.searchParams.set(k, v));
      if (!dest.searchParams.has("open")) dest.searchParams.set("open", "1");
      return {
        kind: "hard_redirect",
        url: dest.toString(),
        reason: `cabinet ${cabinetId} is GRUDOX-only — not Open Danger`,
      };
    }
    // Voxel explorer play is GRUDOX Danger — Open /danger remains the all-era lab.
    if (cabinetId === "explorer") {
      if (params.get("dressing") === "1") {
        return {
          kind: "mode",
          mode: "editor",
          reason: "arcade explorer dressing → Open editor",
        };
      }
      const dest = new URL(PRODUCT_STARTS.grudoxVoxelDanger);
      dest.searchParams.set("era", "voxel");
      dest.searchParams.set("from", "open-library");
      return {
        kind: "hard_redirect",
        url: dest.toString(),
        reason: "arcade explorer → GRUDOX voxel Danger (tvs-showcase)",
      };
    }
  }

  // Voxel play stays on GRUDOX / Mine-Loader — Open is the library only.
  if (parts[0] === "realms" || parts[0] === "mine" || parts[0] === "mineloader") {
    const dest = new URL(PRODUCT_STARTS.mineLoader);
    dest.searchParams.set("from", "open-library");
    dest.hash = "/play";
    return {
      kind: "hard_redirect",
      url: dest.toString(),
      reason: "voxel Realms play → mine.grudge-studio.com (GRUDOX era)",
    };
  }
  if (parts[0] === "voxel") {
    const dest = new URL(`${ENTRY_HOSTS.grudox}/studio/`);
    dest.searchParams.set("from", "open-library");
    return {
      kind: "hard_redirect",
      url: dest.toString(),
      reason: "voxel worldbuilder → GRUDOX studio",
    };
  }

  // ── 3. Explicit campfire entry ALWAYS wins (before from= handoffs) ─────
  // Product SSOT: door=characters / /characters / /lobby → CampfireLobby,
  // never AccountPanel (AGENTS.md · productionSystemsPattern.CAMPFIRE_SURFACES).
  const campfireDoor =
    door === "characters" ||
    door === "charactersgrudox" ||
    door === "campfire" ||
    door === "roster-hub" ||
    door === "lobby";
  const campfirePath =
    parts[0] === "characters" ||
    parts[0] === "campfire" ||
    parts[0] === "lobby" ||
    parts[0] === "charactersgrudox";
  if (campfireDoor || campfirePath) {
    return {
      kind: "mode",
      mode: "characters",
      reason: "explicit campfire entry → CampfireLobby (not account)",
      replace: true,
    };
  }

  // ── 3b. Foundry / GCS / foreign handoff → Account hub (not combat) ─────
  // Note: from=charactersgrudox alone used to force account and broke
  // Create-hero returnTo ?door=characters. Campfire paths handled above.
  if (
    from === "character-studio" ||
    from === "gcs" ||
    from === "character" ||
    from === "foundry"
  ) {
    return {
      kind: "mode",
      mode: "account",
      reason: `handoff from=${from || "character"} → account hub`,
      replace: true,
    };
  }
  // Soft handoff: charactersgrudox deep-link without door/path → campfire
  if (from === "charactersgrudox" && (!parts[0] || parts[0] === "hub" || parts[0] === "doors")) {
    return {
      kind: "mode",
      mode: "characters",
      reason: "from=charactersgrudox hub → campfire roster",
      replace: true,
    };
  }
  // Combat deep-links with from=charactersgrudox keep target mode via openRoutes
  // (do not steal /danger → account).

  // ── 3c. Purge legacy /game — never Combat Sandbox SPA as "the game" ───
  // Historical: open.grudge-studio.com/game served a sandbox title. Production
  // island play is Mine-Loader; Warlords tutorial is client /tutorial.
  if (parts[0] === "game" || parts[0] === "games") {
    const dest = new URL(PRODUCT_STARTS.mineLoader);
    dest.searchParams.set("from", "open-game-purge");
    dest.searchParams.set("entry", "islands");
    return {
      kind: "hard_redirect",
      url: dest.toString(),
      reason: "/game purged → Voxel Realms (Mine-Loader) islands entry",
    };
  }

  // ── 4. Warlords play deep-link mistakes on Open ────────────────────────
  // Note: Open /world = voxgrudge lab — do NOT redirect that to Warlords.
  const warlordsOnly = new Set(["home-island", "home_island", "tutorial", "island-3d"]);
  if (parts[0] && warlordsOnly.has(parts[0])) {
    const path = parts[0] === "home_island" ? "home-island" : parts[0];
    const dest = new URL(`${ENTRY_HOSTS.warlords}/${path}`);
    const cid = params.get("characterId");
    if (cid) dest.searchParams.set("characterId", cid);
    dest.searchParams.set("from", "open-catch");
    return {
      kind: "hard_redirect",
      url: dest.toString(),
      reason: `/${path} is Warlords client, not Open`,
    };
  }

  // ── 5. Auth / landing when already signed in → hub ─────────────────────
  if (
    input.hasSession &&
    (parts[0] === "login" ||
      parts[0] === "sign-in" ||
      parts[0] === "signin" ||
      parts[0] === "landing" ||
      parts[0] === "welcome")
  ) {
    return {
      kind: "mode",
      mode: "doors",
      reason: "already signed in — skip landing",
      replace: true,
    };
  }

  // ── 6. Loop params: strip mode=create after caught above; bare era traps
  // Open never auto-opens foundry on era=warlords alone
  if (params.get("era") === "warlords" && !params.get("characterId") && !from) {
    // Stay hub — do not bounce to foundry
    if (!parts[0] || parts[0] === "hub" || parts[0] === "doors") {
      return {
        kind: "mode",
        mode: "doors",
        reason: "era=warlords alone is not a foundry trap",
      };
    }
  }

  // ── 7. Unknown path segments → hub (never invent Danger) ───────────────
  // Let openRoutes resolve known modes; this only fires for explicit junk.
  const KNOWN_FIRST = new Set([
    "login",
    "sign-in",
    "signin",
    "welcome",
    "landing",
    "hub",
    "doors",
    "home",
    "select",
    "library",
    "danger",
    "danger-room",
    "combat",
    "train",
    "sandbox",
    "annihilate-demo",
    "annihilate",
    "play",
    "racing",
    "street-racing",
    "raver",
    "raver-racing",
    "genesis",
    "brawl",
    "survival",
    "vox-battle",
    "mimic",
    "voxel",
    "world",
    "dressing",
    "editor",
    "avatar",
    "anim",
    "anim-ai",
    "ui",
    "characters",
    "realms",
    "lobby",
    "rooms",
    "zones",
    "account",
    "ledmask",
    "arcade",
    "api",
    "assets",
    "models",
    "auth",
  ]);
  if (parts[0] && !KNOWN_FIRST.has(parts[0]) && !parts[0].includes(".")) {
    // Static files / unknown app paths → hub
    if (!parts[0].match(/^(assets|models|anim|anims|ui|favicon|sw)/)) {
      return {
        kind: "mode",
        mode: "doors",
        reason: `unknown path /${parts[0]} → library hub`,
        replace: true,
      };
    }
  }

  // ── Default: no catch — openRoutes resolves ────────────────────────────
  return {
    kind: "stay",
    mode: "doors",
    reason: "no catch — defer to openRoutes",
  };
}

/**
 * Apply catch at boot. Performs hard redirects; returns mode when no redirect.
 * When kind=stay, caller should still run resolveModeFromLocation.
 */
export function applyEntryCatch(input?: Partial<CatchInput>): {
  mode: AppMode | null;
  redirected: boolean;
  reason: string;
} {
  const pathname =
    input?.pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "/");
  const search =
    input?.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const hostname =
    input?.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");
  let hasSession = input?.hasSession;
  if (hasSession === undefined && typeof window !== "undefined") {
    try {
      hasSession = !!(
        localStorage.getItem("grudge_auth_token") ||
        localStorage.getItem("grudge_session_token") ||
        localStorage.getItem("grudge.token") ||
        localStorage.getItem("sso_token")
      );
    } catch {
      hasSession = false;
    }
  }

  const result = catchEntry({
    pathname,
    search,
    hostname,
    hasSession,
  });

  if (result.kind === "hard_redirect") {
    if (typeof window !== "undefined") {
      console.info(`[entryCatch] redirect: ${result.reason} → ${result.url}`);
      window.location.replace(result.url);
    }
    return { mode: null, redirected: true, reason: result.reason };
  }

  if (result.kind === "mode") {
    return { mode: result.mode, redirected: false, reason: result.reason };
  }

  return { mode: null, redirected: false, reason: result.reason };
}

/** Intent → preferred start URL (for agents / deep-link builders). */
export function startUrlForIntent(
  intent:
    | "hub"
    | "danger"
    | "grudoxDanger"
    | "account"
    | "campfire"
    | "characters"
    | "worldMap"
    | "signIn"
    | "foundryCreate"
    | "foundryHub"
    | "warlordsHome"
    | "warlordsTutorial"
    | "grudoxArcade"
    | "arcadeCabinet"
    | "mineLoader"
    | "realms"
    | "islands"
    | "warstrat"
    | "warlordGenesis"
    | "harvest"
    | "deployables"
    | "grokBuilder"
    | "threeFlow"
    | "forge"
    | "mimic"
    | "dungeon"
    | "dungeonBoss"
    | "dungeonMolten"
    | "equipment"
    | "studio"
    | "ai"
    | "coder"
    | "wallet"
    | "trader"
    | "uiStudio"
    | "uiHotkeys"
    | "uiAssets",
  opts?: { cabinetId?: string; characterId?: string | null; returnTo?: string },
): string {
  switch (intent) {
    case "hub":
      return PRODUCT_STARTS.openHub;
    case "danger":
      return PRODUCT_STARTS.danger;
    case "grudoxDanger":
      return PRODUCT_STARTS.grudoxVoxelDanger;
    case "account":
      return PRODUCT_STARTS.account;
    case "equipment": {
      const u = new URL(PRODUCT_STARTS.equipment);
      if (opts?.characterId) u.searchParams.set("characterId", opts.characterId);
      return u.toString();
    }
    case "campfire":
    case "characters":
      return PRODUCT_STARTS.campfire;
    case "worldMap": {
      const u = new URL(PRODUCT_STARTS.warlordsWorldMap);
      if (opts?.characterId) u.searchParams.set("characterId", opts.characterId);
      u.searchParams.set("from", "charactersgrudox");
      return u.toString();
    }
    case "harvest":
      return PRODUCT_STARTS.openHarvest;
    case "deployables":
      return `${ENTRY_HOSTS.grudox}/studio/`;
    case "signIn":
      return PRODUCT_STARTS.signIn;
    case "foundryCreate": {
      const u = new URL(PRODUCT_STARTS.foundryCreate);
      u.searchParams.set("era", "warlords");
      if (opts?.returnTo) u.searchParams.set("returnTo", safeReturnUrl(opts.returnTo));
      return u.toString();
    }
    case "foundryHub":
      return PRODUCT_STARTS.foundryHub;
    case "grokBuilder":
      return PRODUCT_STARTS.grokBuilder;
    case "threeFlow":
      return PRODUCT_STARTS.threeFlow;
    case "forge":
      return PRODUCT_STARTS.forge;
    case "mimic":
      return PRODUCT_STARTS.mimic;
    case "dungeon":
      return PRODUCT_STARTS.grudgeDungeons;
    case "dungeonBoss":
      return PRODUCT_STARTS.grudgeDungeonBoss;
    case "dungeonMolten":
      return PRODUCT_STARTS.grudgeDungeonMolten;
    case "warlordsHome": {
      const u = new URL(PRODUCT_STARTS.warlordsHome);
      if (opts?.characterId) u.searchParams.set("characterId", opts.characterId);
      u.searchParams.set("from", "gcs");
      return u.toString();
    }
    case "warlordsTutorial":
      return PRODUCT_STARTS.warlordsTutorial;
    case "grudoxArcade":
      return PRODUCT_STARTS.grudoxArcade;
    case "arcadeCabinet": {
      const id = opts?.cabinetId || "racer";
      return `${ENTRY_HOSTS.grudox}/arcade/play/${encodeURIComponent(id)}?open=1`;
    }
    case "mineLoader":
    case "islands": {
      const u = new URL(PRODUCT_STARTS.mineLoader);
      u.searchParams.set("entry", "islands");
      if (opts?.characterId) u.searchParams.set("characterId", opts.characterId);
      return u.toString();
    }
    case "warstrat":
    case "warlordGenesis": {
      const u = new URL(PRODUCT_STARTS.warstratLobby);
      u.searchParams.set("from", "open");
      if (opts?.characterId) u.searchParams.set("characterId", opts.characterId);
      return u.toString();
    }
    case "realms":
      return PRODUCT_STARTS.mineLoader;
    case "studio":
      return PRODUCT_STARTS.studioPortal;
    case "ai":
      return PRODUCT_STARTS.aiHub;
    case "coder":
      return PRODUCT_STARTS.coder;
    case "wallet":
      return PRODUCT_STARTS.wallet;
    case "trader":
      return PRODUCT_STARTS.trader;
    case "uiStudio":
      return PRODUCT_STARTS.uiStudio;
    case "uiHotkeys":
      return PRODUCT_STARTS.uiHotkeys;
    case "uiAssets":
      return PRODUCT_STARTS.uiAssets;
    default:
      return PRODUCT_STARTS.openHub;
  }
}

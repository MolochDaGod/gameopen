/**
 * Account shared state — Railway Postgres SSOT via same-origin /api/*.
 *
 * Scope (grudge-production-wiring + ACCOUNT_DATA_SHARE):
 *   Account  → /api/account, /api/account/resources, /api/wallet/status, /api/nfts
 *              bag · currencies · wallet · cNFTs · home island (shared)
 *   Character → /api/characters?era=…  roster, saveData, equipment, progress
 *
 * Never store account bag only in localStorage.
 */

import { apiFetch, getStoredToken } from "./grudgeAuth";

/** Era slot row from Railway `accounts.eraSlots`. */
export type EraSlotInfo = {
  max?: number;
  activeCharacterId?: string | null;
};

/**
 * Full shared account row fields that fleet UIs must surface for Grudge Studio users.
 * Source: GET /api/account (+ wallet/status for hasWallet convenience).
 */
export type FleetAccountProfile = {
  id?: string;
  grudgeId?: string;
  userId?: string;
  displayName?: string | null;
  homeIslandId?: string | null;
  homeIsland?: boolean;
  homeIslandMintActionId?: string | null;
  /** Soft currency */
  gold?: number;
  premiumCurrency?: number;
  /** GBUX — also on wallet status */
  gbux?: number;
  credits?: number;
  characterTokens?: number;
  accountXp?: number;
  avatarUrl?: string | null;
  /** Solana / Crossmint custodial or linked external */
  walletAddress?: string | null;
  walletType?: string | null;
  crossmintWalletId?: string | null;
  crossmintEmail?: string | null;
  eraSlots?: Record<string, EraSlotInfo>;
  createdAt?: number;
  updatedAt?: number;
  raw: Record<string, unknown>;
};

export type ResourceMap = Record<string, number>;

/** Wallet status from GET /api/wallet/status (same Postgres account row). */
export type FleetWalletStatus = {
  hasWallet: boolean;
  walletAddress: string | null;
  walletType: string | null;
  crossmintEmail?: string | null;
  gbuxBalance?: number;
};

/** Character / island cNFT row from GET /api/nfts. */
export type FleetNft = {
  id?: string;
  characterId?: string | null;
  accountId?: string;
  mintAddress?: string | null;
  assetId?: string | null;
  collectionAddress?: string | null;
  metadataUri?: string | null;
  imageUri?: string | null;
  status?: string;
  isCompressed?: boolean;
  ownerWalletAddress?: string | null;
  mintedToExternal?: boolean;
  characterName?: string;
  name?: string;
  raw: Record<string, unknown>;
};

/** Home island summary from GET /api/island. */
export type FleetIslandSummary = {
  id?: string;
  name?: string;
  seed?: string;
  mapStyle?: string;
  thumbnailUrl?: string | null;
  accountId?: string;
  raw: Record<string, unknown>;
};

const HANDOFF_FROM_KEY = "grudge.open.handoffFrom";
const HANDOFF_OPEN_KEY = "grudge.open.handoffOpen";

/** Capture open=1&from=charactersgrudox (and peers) before URL scrub. */
export function captureAccountHandoffFlags(
  qs: URLSearchParams | { get: (k: string) => string | null },
): void {
  try {
    const from = qs.get("from") || qs.get("source") || "";
    const open = qs.get("open") || "";
    if (from) sessionStorage.setItem(HANDOFF_FROM_KEY, from);
    if (open === "1" || open === "true") sessionStorage.setItem(HANDOFF_OPEN_KEY, "1");
  } catch {
    /* */
  }
}

export function getHandoffFrom(): string | null {
  try {
    return sessionStorage.getItem(HANDOFF_FROM_KEY);
  } catch {
    return null;
  }
}

export function isOpenHandoff(): boolean {
  try {
    return sessionStorage.getItem(HANDOFF_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearHandoffFlags(): void {
  try {
    sessionStorage.removeItem(HANDOFF_FROM_KEY);
    sessionStorage.removeItem(HANDOFF_OPEN_KEY);
  } catch {
    /* */
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v != null && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  return v != null && v !== "" ? String(v) : undefined;
}

/** GET /api/account — full profile row for the JWT account (wallet, currencies, era slots). */
export async function fetchAccountProfile(): Promise<FleetAccountProfile | null> {
  try {
    const r = await apiFetch("/api/account", { method: "GET" });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    const gbuxRaw = data.gbux ?? data.gbuxBalance ?? data.credits ?? data.softCurrency;
    const eraSlots =
      data.eraSlots && typeof data.eraSlots === "object"
        ? (data.eraSlots as Record<string, EraSlotInfo>)
        : undefined;
    return {
      id: str(data.id),
      grudgeId: str(data.grudgeId) ?? str(data.grudge_id),
      userId: str(data.userId) ?? str(data.user_id),
      displayName: str(data.displayName) ?? str(data.display_name) ?? null,
      homeIslandId: str(data.homeIslandId) ?? str(data.home_island_id) ?? null,
      homeIsland: data.homeIsland === true || data.home_island === true,
      homeIslandMintActionId:
        str(data.homeIslandMintActionId) ?? str(data.home_island_mint_action_id) ?? null,
      gold: num(data.gold),
      premiumCurrency: num(data.premiumCurrency) ?? num(data.premium_currency),
      gbux: num(gbuxRaw),
      credits: num(data.credits),
      characterTokens: num(data.characterTokens) ?? num(data.character_tokens),
      accountXp: num(data.accountXp) ?? num(data.account_xp),
      avatarUrl: str(data.avatarUrl) ?? str(data.avatar_url) ?? null,
      walletAddress: str(data.walletAddress) ?? str(data.wallet_address) ?? null,
      walletType: str(data.walletType) ?? str(data.wallet_type) ?? null,
      crossmintWalletId: str(data.crossmintWalletId) ?? str(data.crossmint_wallet_id) ?? null,
      crossmintEmail: str(data.crossmintEmail) ?? str(data.crossmint_email) ?? null,
      eraSlots,
      createdAt: num(data.createdAt) ?? num(data.created_at),
      updatedAt: num(data.updatedAt) ?? num(data.updated_at),
      raw: data,
    };
  } catch {
    return null;
  }
}

/** GET /api/account/resources — shared bag across all characters. */
export const fetchAccountResources = fetchAccountBag;

/** GET /api/account/resources — shared bag across all characters. */
export async function fetchAccountBag(): Promise<ResourceMap> {
  try {
    const r = await apiFetch("/api/account/resources", { method: "GET" });
    if (!r.ok) return {};
    const data = (await r.json()) as { resources?: ResourceMap };
    return data.resources && typeof data.resources === "object" ? data.resources : {};
  } catch {
    return {};
  }
}

/** GET /api/account/inventory — account-scoped inventory list (when present). */
export async function fetchAccountInventory(): Promise<unknown[]> {
  try {
    const r = await apiFetch("/api/account/inventory", { method: "GET" });
    if (!r.ok) return [];
    const data = await r.json();
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)) {
      return (data as { items: unknown[] }).items;
    }
    if (data && typeof data === "object" && Array.isArray((data as { inventory?: unknown[] }).inventory)) {
      return (data as { inventory: unknown[] }).inventory;
    }
    return [];
  } catch {
    return [];
  }
}

/** GET /api/wallet/status — custodial / linked wallet on the same account row. */
export async function fetchWalletStatus(): Promise<FleetWalletStatus | null> {
  if (!getStoredToken()) return null;
  try {
    const r = await apiFetch("/api/wallet/status", { method: "GET" });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    return {
      hasWallet: Boolean(data.hasWallet ?? data.walletAddress),
      walletAddress: str(data.walletAddress) ?? str(data.wallet_address) ?? null,
      walletType: str(data.walletType) ?? str(data.wallet_type) ?? null,
      crossmintEmail: str(data.crossmintEmail) ?? str(data.crossmint_email) ?? null,
      gbuxBalance: num(data.gbuxBalance) ?? num(data.gbux_balance) ?? num(data.gbux),
    };
  } catch {
    return null;
  }
}

/** GET /api/nfts — character / island cNFTs for this account. */
export async function fetchAccountNfts(): Promise<FleetNft[]> {
  try {
    const r = await apiFetch("/api/nfts", { method: "GET" });
    if (!r.ok) return [];
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data as { nfts?: unknown[] })?.nfts;
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      const n = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        id: str(n.id),
        characterId: str(n.characterId) ?? str(n.character_id) ?? null,
        accountId: str(n.accountId) ?? str(n.account_id),
        mintAddress: str(n.mintAddress) ?? str(n.mint_address) ?? null,
        assetId: str(n.assetId) ?? str(n.asset_id) ?? null,
        collectionAddress: str(n.collectionAddress) ?? str(n.collection_address) ?? null,
        metadataUri: str(n.metadataUri) ?? str(n.metadata_uri) ?? null,
        imageUri: str(n.imageUri) ?? str(n.image_uri) ?? str(n.image) ?? null,
        status: str(n.status),
        isCompressed: n.isCompressed === true || n.is_compressed === true || n.isCompressed == null,
        ownerWalletAddress: str(n.ownerWalletAddress) ?? str(n.owner_wallet_address) ?? null,
        mintedToExternal: n.mintedToExternal === true || n.minted_to_external === true,
        characterName: str(n.characterName) ?? str(n.character_name) ?? str(n.name),
        name: str(n.name) ?? str(n.characterName),
        raw: n,
      };
    });
  } catch {
    return [];
  }
}

/**
 * One-shot shared account bundle (parity with GRUDOX loadSharedAccountBundle).
 * Same Railway Postgres routes via same-origin /api/*.
 */
export async function loadSharedAccountBundle(): Promise<{
  account: FleetAccountProfile | null;
  wallet: FleetWalletStatus | null;
  nfts: FleetNft[];
  resources: ResourceMap;
  island: FleetIslandSummary | null;
  inventory: unknown[];
}> {
  if (!getStoredToken()) {
    return {
      account: null,
      wallet: null,
      nfts: [],
      resources: {},
      island: null,
      inventory: [],
    };
  }
  const [account, wallet, nfts, resources, island, inventory] = await Promise.all([
    fetchAccountProfile(),
    fetchWalletStatus(),
    fetchAccountNfts(),
    fetchAccountResources(),
    fetchHomeIsland(),
    fetchAccountInventory(),
  ]);
  return {
    account,
    wallet,
    nfts,
    resources: resources || {},
    island,
    inventory: inventory || [],
  };
}

/** GET /api/island — home island for the JWT account (when present). */
export async function fetchHomeIsland(): Promise<FleetIslandSummary | null> {
  try {
    const r = await apiFetch("/api/island", { method: "GET" });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;
    // Empty / error shapes
    if (data.error || (!data.id && !data.seed && !data.name)) return null;
    return {
      id: str(data.id),
      name: str(data.name) ?? "Home Island",
      seed: str(data.seed),
      mapStyle: str(data.mapStyle) ?? str(data.map_style),
      thumbnailUrl: str(data.thumbnailUrl) ?? str(data.thumbnail_url) ?? null,
      accountId: str(data.accountId) ?? str(data.account_id),
      raw: data,
    };
  } catch {
    return null;
  }
}

/** Truncate wallet / mint addresses for UI. */
export function shortAddress(addr: string | null | undefined, head = 4, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export type CreateCharacterInput = {
  name: string;
  raceId: string;
  classId?: string;
  /** Catalog id e.g. race-human for Open mesh resolver */
  catalogId?: string;
  /** Fleet era — 4 slots per era on Railway. Default warlords. */
  gameEra?: "warlords" | "voxel" | "nexus" | "armada";
  /** Optional Foundry slot 0–3 */
  slotIndex?: number;
  /**
   * Starting equipment bag (mesh_ids + slots + open loadout).
   * Built via {@link buildStartingEquipment} for GrudaChain / main-panel parity.
   */
  equipment?: Record<string, unknown>;
  saveData?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

/**
 * POST Railway /api/characters — create fleet character for an era.
 * Account is shared (bag/wallet); playable roster is per gameEra (4 slots).
 * Body fields dual-written for schema variants (raceId vs race, gameEra vs era).
 */
export async function createFleetCharacter(
  input: CreateCharacterInput,
): Promise<{ ok: true; id: string; raw: Record<string, unknown> } | { ok: false; error: string }> {
  const name = input.name.trim() || "Hero";
  const raceId = normalizeRaceId(input.raceId);
  const classId = input.classId || "warrior";
  const era = input.gameEra || "warlords";
  const equipment = input.equipment || {};
  const isVoxel = era === "voxel";
  const saveData = {
    ...(input.saveData || {}),
    equipment,
    open: (equipment as { open?: unknown }).open || input.saveData?.open,
    ...(isVoxel ? { realms: { pipeline: "box_hero" } } : {}),
  };
  const config = {
    catalogId: input.catalogId,
    source: "gameopen-account",
    from: "charactersgrudox",
    ...(input.config || {}),
    equipment,
    open: (equipment as { open?: unknown }).open,
    // Voxel Realms: Explorer body — never grudge6 kit on Mine-Loader maps
    ...(isVoxel
      ? {
          baseId: "explorer",
          avatarKey: "box_hero",
          renderPipeline: "voxel",
          pipeline: "box_hero",
        }
      : {}),
    gameEra: era,
  };

  const slot =
    typeof input.slotIndex === "number" && Number.isFinite(input.slotIndex)
      ? Math.max(0, Math.min(3, Math.trunc(input.slotIndex)))
      : undefined;

  const bodies: Record<string, unknown>[] = [
    {
      name,
      raceId,
      classId,
      gameEra: era,
      era,
      prefabId: input.catalogId,
      equipment,
      saveData,
      config,
      ...(slot != null ? { slotIndex: slot, slot } : {}),
    },
    {
      name,
      race: raceId,
      class: classId,
      game_era: era,
      era,
      equipment,
      save_data: saveData,
      config,
      ...(slot != null ? { slot_index: slot, slot } : {}),
    },
  ];

  for (const body of bodies) {
    try {
      const r = await apiFetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        if (r.status === 401) return { ok: false, error: "Sign in required (401)" };
        // try next body shape
        if (r.status === 400 || r.status === 422) continue;
        return { ok: false, error: `Create failed (${r.status}) ${errText.slice(0, 120)}` };
      }
      const data = (await r.json()) as Record<string, unknown>;
      const id = String(
        data.id ||
          data.uuid ||
          data.characterId ||
          (data.character as { id?: string } | undefined)?.id ||
          "",
      );
      if (!id) return { ok: false, error: "Create returned no character id" };
      return { ok: true, id, raw: data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error creating character",
      };
    }
  }
  return { ok: false, error: "Character create rejected by API (check race/class schema)" };
}

function normalizeRaceId(raw: string): string {
  const s = raw.replace(/^race-/, "").toLowerCase().replace(/_/g, "-");
  if (s === "high-elf" || s === "highelf") return "elf";
  if (s === "high-elves") return "elf";
  if (s === "western-kingdoms" || s === "wk") return "human";
  if (s === "barbarians") return "barbarian";
  if (s === "dwarves") return "dwarf";
  if (s === "orcs") return "orc";
  return s || "human";
}

/**
 * Deep-link to Character Studio Foundry for era create (4 slots per era).
 * Default warlords; use era=voxel for Mine-Loader Avatar Explorers.
 */
export function characterStudioCreateUrl(opts?: {
  token?: string | null;
  returnTo?: string;
  era?: "warlords" | "voxel" | "nexus" | "armada";
  mode?: "create" | "select";
}): string {
  const u = new URL("https://character.grudge-studio.com/foundry");
  u.searchParams.set("era", opts?.era || "warlords");
  u.searchParams.set("mode", opts?.mode || "create");
  u.searchParams.set("from", "gameopen");
  u.searchParams.set("open", "1");
  if (opts?.returnTo) u.searchParams.set("redirect_uri", opts.returnTo);
  if (opts?.token) {
    u.searchParams.set("sso_token", opts.token);
    u.searchParams.set("grudge_token", opts.token);
  }
  return u.toString();
}

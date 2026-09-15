/**
 * Account hub — fleet SSOT only. No invent create-hero race kits, no portrait
 * grids, no fake systems.
 *
 * Structure (same for every production era):
 *   Era tabs → Overview · Characters · Inventory · Wallet · cNFTs · Saves · Crafting
 *
 * Shared account data (Railway Postgres via same-origin /api/*):
 *   Profile / currencies / wallet → GET /api/account · /api/wallet/status
 *   Bag / inventory               → GET /api/account/resources · inventory
 *   cNFTs                         → GET /api/nfts
 *   Home island                   → GET /api/island
 *   Characters + saveData         → gameSession roster (Railway /api/characters)
 *   Create hero                   → Character Foundry deep-link only
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import {
  getStoredToken,
  loginWithGrudgeId,
  logoutGrudge,
  type GrudgeCharacter,
} from "../lib/grudgeAuth";
import { getCachedWallet, ensureWallet, type GrudgeWallet } from "../lib/walletService";
import {
  characterStudioCreateUrl,
  fetchAccountBag,
  fetchAccountInventory,
  fetchAccountNfts,
  fetchAccountProfile,
  fetchHomeIsland,
  fetchWalletStatus,
  getHandoffFrom,
  loadSharedAccountBundle,
  shortAddress,
  type FleetAccountProfile,
  type FleetIslandSummary,
  type FleetNft,
  type FleetWalletStatus,
  type ResourceMap,
} from "../lib/accountShared";
import {
  FLEET_SURFACES,
  fleetAccountHandoffUrl,
  GRUDOX_ACCOUNT_URL,
} from "../lib/fleetAccountAccess";
import { GAME_LIBRARY, SHARED_ACCOUNT_SCHEME, type GameCategory } from "../game/gameLibrary";
import { CharacterAvatar } from "./CharacterAvatar";
import { CharacterPicker } from "./CharacterPicker";
import { TraitStoreEmbed } from "./TraitStoreEmbed";
import { resolveCharacterEquipmentVisualSync } from "../lib/characterEquipmentMesh";
import { matIconUrl, warmGameMedia } from "../lib/gameMedia";
import { warmProductionMedia } from "../lib/productionMedia";
import { iconUrl } from "../three/icons";
import { GRUDOX_ZONES } from "../game/grudoxZones";
import { embedSessionForZone } from "../lib/inAppLaunch";

/** Playable production eras (same sub-tabs on each). */
type EraId = "warlords" | "voxel" | "nexus" | "armada";
type PanelId =
  | "overview"
  | "characters"
  | "inventory"
  | "wallet"
  | "cnfts"
  | "saves"
  | "crafting";

const ERAS: { id: EraId; label: string; tone: string; blurb: string }[] = [
  {
    id: "warlords",
    label: "Warlords",
    tone: "#e86a1a",
    blurb: "Fantasy flagship · grudge6 heroes · islands · Danger · dressing",
  },
  {
    id: "voxel",
    label: "Voxel",
    tone: "#5fe0ff",
    blurb: "VoxGrudge · Realms · DCQ · Worldbuilder · arenas",
  },
  {
    id: "nexus",
    label: "Nexus",
    tone: "#9d8bff",
    blurb: "Sci-fi · mech · metaverse · carrier",
  },
  {
    id: "armada",
    label: "Armada",
    tone: "#4fc3c8",
    blurb: "Naval · Grim Armada · sail maps",
  },
];

const PANELS: { id: PanelId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "characters", label: "Characters" },
  { id: "inventory", label: "Inventory" },
  { id: "wallet", label: "Wallet" },
  { id: "cnfts", label: "cNFTs" },
  { id: "saves", label: "Saves" },
  { id: "crafting", label: "Crafting" },
];

const WALLET_SITE = "https://wallet.grudge-studio.com";
const SOLSCAN_ADDR = "https://solscan.io/account/";

const CRAFTING_LINKS: Record<EraId, { label: string; href: string }[]> = {
  warlords: [
    { label: "Warlords crafting (Puter)", href: "https://puter.com/app/warlords" },
    { label: "grudge-crafting.puter.site", href: "https://grudge-crafting.puter.site" },
    { label: "Warlords (home island in-game)", href: "https://client.grudge-studio.com/home" },
  ],
  voxel: [
    { label: "Mine-Loader Realms", href: "https://mine.grudge-studio.com" },
    { label: "mineloader play host", href: "https://mineloader.grudge-studio.com" },
    { label: "VoxGrudge world", href: "https://voxgrudge.vercel.app" },
  ],
  nexus: [
    { label: "Metaverse", href: "https://metaverse.grudge-studio.com" },
    { label: "Carrier", href: "https://carrier.grudge-studio.com" },
  ],
  armada: [{ label: "Open library · Armada", href: "https://open.grudge-studio.com/?door=library" }],
};

const VOXEL_KIT_IDS = /^(explorer|orc|sanji|skeleton-warrior|striker|brute|skeleton)$/i;

function characterEra(c: GrudgeCharacter): EraId {
  const base = String(c.config?.baseId || c.classId || "");
  const pipe = String(c.config?.renderPipeline || c.config?.pipeline || "");
  const modelBase = String(
    (c.model3d as { baseModelId?: string } | undefined)?.baseModelId || "",
  );
  const looksVoxel =
    pipe === "voxel" ||
    pipe === "box_hero" ||
    VOXEL_KIT_IDS.test(base) ||
    VOXEL_KIT_IDS.test(modelBase) ||
    c.config?.baseId === "explorer";
  const raw =
    c.gameEra ||
    (c as { gameEra?: string }).gameEra ||
    (c.config?.gameEra as string | undefined) ||
    (c.saveData?.gameEra as string | undefined) ||
    (c.config?.era as string | undefined) ||
    (looksVoxel ? "voxel" : undefined) ||
    "warlords";
  const e = String(raw).toLowerCase();
  if (e === "voxel" || e === "nexus" || e === "armada" || e === "warlords") return e;
  return "warlords";
}

function gamesForEra(era: EraId) {
  return GAME_LIBRARY.filter(
    (g) => g.category === (era as GameCategory) && (g.status === "live" || g.status === "beta"),
  );
}

/** Prefer fleet equipment icons; fall back to our action icon pack — never invent URLs. */
function slotIcon(url: string | undefined, fallback: "equip" | "attack" | "inventory" | "defend"): string {
  if (url && (url.startsWith("http") || url.startsWith("/") || url.startsWith("data:"))) return url;
  return iconUrl(fallback);
}

/** Human-readable summary of character saveData / equipment for the Saves tab. */
function summarizeSave(c: GrudgeCharacter): { lines: string[]; keys: string[] } {
  const save = (c.saveData && typeof c.saveData === "object" ? c.saveData : {}) as Record<string, unknown>;
  const equip = (c.equipment && typeof c.equipment === "object" ? c.equipment : {}) as Record<string, unknown>;
  const open = (save.open && typeof save.open === "object" ? save.open : {}) as Record<string, unknown>;
  const keys = Object.keys(save);
  const lines: string[] = [];
  if (keys.length === 0 && Object.keys(equip).length === 0) {
    lines.push("No saveData blob yet — play once to persist progress.");
  } else {
    lines.push(`saveData keys: ${keys.length || 0}`);
  }
  if (open.lastMode != null) lines.push(`last mode: ${String(open.lastMode)}`);
  if (open.weaponId != null) lines.push(`open weapon: ${String(open.weaponId)}`);
  if (open.offHand != null) lines.push(`open off-hand: ${String(open.offHand)}`);
  if (open.avatarId != null) lines.push(`avatar: ${String(open.avatarId)}`);
  const meshIds = Array.isArray((save as { mesh_ids?: unknown }).mesh_ids)
    ? ((save as { mesh_ids: unknown[] }).mesh_ids)
    : Array.isArray((equip as { mesh_ids?: unknown }).mesh_ids)
      ? ((equip as { mesh_ids: unknown[] }).mesh_ids)
      : null;
  if (meshIds) lines.push(`mesh_ids: ${meshIds.length}`);
  const equipKeys = Object.keys(equip).filter((k) => equip[k] != null && equip[k] !== "");
  if (equipKeys.length) lines.push(`equipment slots: ${equipKeys.slice(0, 8).join(", ")}${equipKeys.length > 8 ? "…" : ""}`);
  if (c.model3d && typeof c.model3d === "object") {
    const m = c.model3d as Record<string, unknown>;
    if (m.race || m.kit || m.pack) lines.push(`model3d: ${String(m.race || m.kit || m.pack)}`);
  }
  return { lines, keys };
}

export function AccountPanel({
  onPlayRace,
  onEnterGame,
  onOpenInApp,
}: {
  onPlayRace?: (characterCatalogId: string) => void;
  onEnterGame?: (
    mode: "danger" | "brawl" | "genesis" | "zones" | "voxgrudge-native" | "voxel",
  ) => void;
  onOpenInApp?: (session: import("../lib/inAppLaunch").InAppEmbedSession) => void;
}) {
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);
  const [era, setEra] = useState<EraId>(() => {
    try {
      const e = new URLSearchParams(window.location.search).get("era")?.toLowerCase();
      if (e === "voxel" || e === "nexus" || e === "armada" || e === "warlords") return e;
    } catch {
      /* */
    }
    return "warlords";
  });
  const [panel, setPanel] = useState<PanelId>(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && PANELS.some((p) => p.id === t)) return t as PanelId;
    } catch {
      /* */
    }
    return "overview";
  });
  const [wallet, setWallet] = useState<GrudgeWallet | null>(() => getCachedWallet());
  const [walletStatus, setWalletStatus] = useState<FleetWalletStatus | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [profile, setProfile] = useState<FleetAccountProfile | null>(null);
  const [bag, setBag] = useState<ResourceMap>({});
  const [inventoryItems, setInventoryItems] = useState<unknown[]>([]);
  const [nfts, setNfts] = useState<FleetNft[]>([]);
  const [island, setIsland] = useState<FleetIslandSummary | null>(null);
  const [sharedBusy, setSharedBusy] = useState(false);
  const [handoffFrom] = useState(() => getHandoffFrom());
  const [copiedAddr, setCopiedAddr] = useState(false);

  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const refreshShared = useCallback(async () => {
    if (!getStoredToken()) {
      setProfile(null);
      setBag({});
      setInventoryItems([]);
      setNfts([]);
      setIsland(null);
      setWalletStatus(null);
      return;
    }
    setSharedBusy(true);
    try {
      // Same bundle shape as GRUDOX /account (Railway Postgres SSOT)
      const bundle = await loadSharedAccountBundle();
      setProfile(bundle.account);
      setBag(bundle.resources);
      setInventoryItems(bundle.inventory);
      setNfts(bundle.nfts);
      setIsland(bundle.island);
      setWalletStatus(bundle.wallet);
    } finally {
      setSharedBusy(false);
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    setWalletBusy(true);
    try {
      const [w, ws] = await Promise.all([ensureWallet(), fetchWalletStatus()]);
      setWallet(w);
      setWalletStatus(ws);
    } finally {
      setWalletBusy(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await gameSession.refreshCharacters();
    await refreshShared();
    if (snap.account) await refreshWallet();
  }, [refreshShared, refreshWallet, snap.account]);

  useEffect(() => {
    void warmProductionMedia();
    void warmGameMedia();
    void refreshShared();
    if (snap.account) void refreshWallet();
  }, [refreshShared, refreshWallet, snap.account]);

  const walletAddress =
    walletStatus?.walletAddress ||
    profile?.walletAddress ||
    wallet?.address ||
    null;
  const walletType =
    walletStatus?.walletType || profile?.walletType || wallet?.walletType || null;
  const gbuxDisplay =
    walletStatus?.gbuxBalance ??
    profile?.gbux ??
    wallet?.gbux ??
    profile?.credits ??
    0;

  const eraChars = useMemo(
    () => snap.characters.filter((c) => characterEra(c) === era),
    [snap.characters, era],
  );

  const selectedChar = useMemo(() => {
    const inEra = eraChars.find((c) => c.id === snap.selectedCharacterId);
    return inEra ?? eraChars[0] ?? null;
  }, [eraChars, snap.selectedCharacterId]);

  const selectedVisual = useMemo(
    () => (selectedChar ? resolveCharacterEquipmentVisualSync(selectedChar) : null),
    [selectedChar],
  );

  const bagEntries = useMemo(
    () =>
      Object.entries(bag)
        .filter(([, n]) => typeof n === "number" && n > 0)
        .sort((a, b) => b[1] - a[1]),
    [bag],
  );

  const eraTone = ERAS.find((e) => e.id === era)?.tone ?? "#4fc3ff";
  const eraGames = useMemo(() => gamesForEra(era).slice(0, 8), [era]);

  const openFoundry = (forEra: EraId = era) => {
    const url = characterStudioCreateUrl({
      era: forEra,
      mode: "create",
      token: getStoredToken(),
      returnTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/account?open=1&era=${forEra}`
          : `https://open.grudge-studio.com/account?open=1&era=${forEra}`,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /** Mine-Loader / GRUDOX handoff — era=voxel + 4character kit, Railway UUID. */
  const playVoxelRealms = (ch: GrudgeCharacter | null) => {
    if (ch) gameSession.selectCharacter(ch.id);
    const token = getStoredToken();
    const kit = String(
      ch?.config?.baseId ||
        ch?.classId ||
        (ch?.model3d as { baseModelId?: string } | undefined)?.baseModelId ||
        "explorer",
    );
    void import("../auth/mineLoaderConfig").then(({ openMineLoaderLive }) => {
      openMineLoaderLive({
        surface: "lobby",
        token,
        characterId: ch?.id ?? null,
        characterName: ch?.name ?? null,
        baseId: kit,
        raceId: ch?.raceId ?? null,
        worldMode: "drc",
      });
    });
  };

  const openExternalZone = (zoneId: string) => {
    const session = embedSessionForZone(
      zoneId,
      { token: getStoredToken(), characterId: snap.selectedCharacterId },
      "account",
    );
    if (session && onOpenInApp) {
      onOpenInApp(session);
      return;
    }
    if (session) window.open(session.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={shell}>
      <header style={head}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.04em" }}>
            ACCOUNT
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>
            Grudge ID · wallet · cNFTs · bag · saves · per-era roster (shared Railway account)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {snap.account ? (
            <>
              <span style={{ color: "#8ec3ff", fontSize: 13 }}>
                {snap.account.displayName || profile?.displayName || snap.account.grudgeId}
              </span>
              <button type="button" style={btnGhost} onClick={() => void refreshAll()} disabled={sharedBusy}>
                {sharedBusy ? "…" : "Refresh"}
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  logoutGrudge();
                  void loginWithGrudgeId(true);
                }}
              >
                Switch
              </button>
            </>
          ) : (
            <button type="button" style={btnPrimary} onClick={() => void loginWithGrudgeId(false)}>
              Sign in · Grudge ID
            </button>
          )}
        </div>
      </header>

      {handoffFrom && (
        <div style={banner}>
          Returned from <strong>{handoffFrom}</strong>
          {selectedChar ? (
            <>
              {" "}
              · selected <strong>{selectedChar.name}</strong>
            </>
          ) : null}
        </div>
      )}

      {/* Fleet accessibility — same account data on Open · GRUDOX · Warlords · Poker · GST */}
      <section style={fleetStrip} aria-label="Fleet account surfaces">
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
          Shared account · {SHARED_ACCOUNT_SCHEME.dataLaw.characters} · open everywhere with Grudge ID
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FLEET_SURFACES.filter((s) => s.id !== "open").map((s) => (
            <a
              key={s.id}
              href={fleetAccountHandoffUrl(s.id, {
                token: getStoredToken(),
                characterId: snap.selectedCharacterId,
                from: "open-account",
              })}
              target="_blank"
              rel="noreferrer"
              style={fleetChip}
              title={s.blurb}
            >
              {s.label}
              {s.id === "grudox" ? " · voxel hub" : ""}
            </a>
          ))}
          <a
            href={GRUDOX_ACCOUNT_URL}
            target="_blank"
            rel="noreferrer"
            style={{ ...fleetChip, borderColor: "rgba(212,175,55,0.45)", color: "#e8d48a" }}
            title="GRUDOX voxel editor · deployer · account (same Railway data)"
          >
            GRUDOX /account
          </a>
        </div>
      </section>

      {/* Era strip — same structure for every era */}
      <nav style={eraBar} aria-label="Production eras">
        {ERAS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              setEra(e.id);
              setPanel("overview");
            }}
            style={{
              ...eraBtn,
              borderColor: era === e.id ? e.tone : "transparent",
              color: era === e.id ? "#eaf4ff" : "#8aa0bc",
              background: era === e.id ? `${e.tone}22` : "transparent",
            }}
          >
            {e.label}
          </button>
        ))}
      </nav>

      {/* Same panels for every era */}
      <nav style={tabBar} aria-label="Account panels">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPanel(p.id)}
            style={{
              ...tabBtn,
              borderColor: panel === p.id ? eraTone : "transparent",
              color: panel === p.id ? "#eaf4ff" : "#8aa0bc",
              background: panel === p.id ? `${eraTone}18` : "transparent",
            }}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <div style={body}>
        {/* ── Overview ── */}
        {panel === "overview" && (
          <div style={grid2}>
            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Account</h3>
              {!snap.account ? (
                <p style={muted}>
                  Sign in with Grudge ID to load the shared Railway account (wallet, bag, cNFTs,
                  characters, saves).
                </p>
              ) : (
                <dl style={dlWide}>
                  <dt>Display</dt>
                  <dd>{snap.account.displayName || profile?.displayName || "—"}</dd>
                  <dt>Grudge ID</dt>
                  <dd>
                    <code style={{ fontSize: 12 }}>{snap.account.grudgeId || profile?.grudgeId || "—"}</code>
                  </dd>
                  <dt>Account id</dt>
                  <dd>
                    <code style={{ fontSize: 11 }}>{profile?.id || "—"}</code>
                  </dd>
                  <dt>Wallet</dt>
                  <dd>
                    {walletAddress ? (
                      <>
                        <code style={{ fontSize: 11 }} title={walletAddress}>
                          {shortAddress(walletAddress, 6, 6)}
                        </code>
                        {walletType ? (
                          <span style={{ ...muted, marginLeft: 6 }}>({walletType})</span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt>GBUX</dt>
                  <dd>
                    {gbuxDisplay}
                    {walletBusy || sharedBusy ? " …" : ""}
                  </dd>
                  <dt>Gold</dt>
                  <dd>{profile?.gold ?? 0}</dd>
                  <dt>Premium</dt>
                  <dd>{profile?.premiumCurrency ?? 0}</dd>
                  <dt>Char tokens</dt>
                  <dd>{profile?.characterTokens ?? 0}</dd>
                  <dt>Account XP</dt>
                  <dd>{profile?.accountXp ?? 0}</dd>
                  <dt>Home island</dt>
                  <dd>
                    {island?.name || (profile?.homeIsland ? "Yes" : "—")}
                    {profile?.homeIslandId ? (
                      <span style={{ ...muted, display: "block", fontSize: 11 }}>
                        {shortAddress(profile.homeIslandId, 8, 6)}
                      </span>
                    ) : null}
                  </dd>
                  <dt>This era</dt>
                  <dd>
                    {eraChars.length} character{eraChars.length === 1 ? "" : "s"}
                    {profile?.eraSlots?.[era] ? (
                      <span style={muted}>
                        {" "}
                        · slots {eraChars.length}/{profile.eraSlots[era].max ?? "?"}
                      </span>
                    ) : null}
                  </dd>
                  <dt>cNFTs</dt>
                  <dd>
                    {nfts.length} on account
                    {bagEntries.length > 0 ? ` · bag ${bagEntries.length} types` : ""}
                  </dd>
                </dl>
              )}
              <p style={{ ...muted, marginTop: 12 }}>{ERAS.find((e) => e.id === era)?.blurb}</p>
              {snap.account && profile?.eraSlots && (
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ ...h3, fontSize: 12, marginBottom: 6 }}>Era slots (shared)</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(profile.eraSlots).map(([k, v]) => (
                      <span key={k} style={chip}>
                        {k}: {v?.activeCharacterId ? "active" : "—"} / max {v?.max ?? "?"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>{ERAS.find((e) => e.id === era)?.label} · play</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {era === "warlords" && (
                  <>
                    <button type="button" style={btnPrimary} onClick={() => onEnterGame?.("danger")}>
                      Danger Room
                    </button>
                    <button type="button" style={btnGhost} onClick={() => onEnterGame?.("genesis")}>
                      Genesis
                    </button>
                    <button type="button" style={btnGhost} onClick={() => onEnterGame?.("brawl")}>
                      Brawl
                    </button>
                  </>
                )}
                {era === "voxel" && (
                  <>
                    <button type="button" style={btnPrimary} onClick={() => onEnterGame?.("voxel")}>
                      Worldbuilder
                    </button>
                    <button type="button" style={btnGhost} onClick={() => onEnterGame?.("voxgrudge-native")}>
                      Vox native
                    </button>
                    <button type="button" style={btnGhost} onClick={() => openExternalZone("mine-loader")}>
                      Mine-Loader
                    </button>
                  </>
                )}
                {eraGames.map((g) => {
                  const href = g.url || (g.nativeMode ? `https://open.grudge-studio.com/?door=${g.nativeMode}` : "#");
                  return (
                    <a
                      key={g.id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...btnGhost, textDecoration: "none" }}
                    >
                      {g.title}
                    </a>
                  );
                })}
              </div>
              {(era === "warlords" || era === "voxel") && (
                <p style={{ ...muted, marginTop: 14 }}>
                  New heroes: use{" "}
                  <button type="button" style={linkBtn} onClick={() => openFoundry(era)}>
                    Character Foundry ({era})
                  </button>{" "}
                  — 4 slots per era on Railway. Same account bag/wallet; separate playable roster.
                </p>
              )}
            </section>
          </div>
        )}

        {/* ── Characters ── */}
        {panel === "characters" && (
          <div style={grid2}>
            <section style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <h3 style={{ ...h3, color: eraTone, margin: 0 }}>
                  {ERAS.find((e) => e.id === era)?.label} · 4 slots
                </h3>
                {(era === "warlords" || era === "voxel") && (
                  <button type="button" style={btnGhost} onClick={() => openFoundry(era)}>
                    Foundry ↗
                  </button>
                )}
              </div>
              <p style={muted}>
                Railway Postgres · era=<code>{era}</code> · shared Grudge ID + bag · not cross-play
                bodies (Warlords grudge6 ≠ Voxel Explorer).
              </p>
              {era === "warlords" && <CharacterPicker />}
              {/* 4-slot strip (empty = free) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {[0, 1, 2, 3].map((i) => {
                  const bySlot = eraChars.find(
                    (c) =>
                      c.slotIndex === i ||
                      (c.config?.slotIndex as number | undefined) === i,
                  );
                  const fill =
                    bySlot ||
                    eraChars.filter(
                      (c) =>
                        c.slotIndex == null &&
                        (c.config?.slotIndex as number | undefined) == null,
                    )[i] ||
                    null;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (fill) gameSession.selectCharacter(fill.id);
                        else openFoundry(era);
                      }}
                      style={{
                        ...listItem,
                        flexDirection: "column",
                        alignItems: "stretch",
                        minHeight: 96,
                        borderColor:
                          fill && selectedChar?.id === fill.id
                            ? eraTone
                            : "rgba(110,168,255,0.15)",
                        background:
                          fill && selectedChar?.id === fill.id
                            ? `${eraTone}14`
                            : "rgba(8,12,20,0.65)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 10, opacity: 0.55, fontFamily: "monospace" }}>
                        Slot {i + 1}
                      </div>
                      {fill ? (
                        <>
                          <CharacterAvatar character={fill} size={36} />
                          <strong style={{ color: "#eaf4ff", fontSize: 12 }}>{fill.name}</strong>
                          <span style={{ ...muted, fontSize: 10, fontFamily: "monospace" }}>
                            {fill.id.slice(0, 8)}…
                          </span>
                        </>
                      ) : (
                        <span style={{ ...muted, fontSize: 12 }}>
                          {era === "voxel"
                            ? `+ ${["Explorer", "Brute", "Striker", "Skeleton"][i]}`
                            : "+ Create"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {eraChars.length === 0 ? (
                <p style={{ ...muted, marginTop: 16 }}>
                  No characters for this era yet. Create in Foundry (era={era}), then Refresh.
                </p>
              ) : (
                <ul style={list}>
                  {eraChars.map((c) => {
                    const active = selectedChar?.id === c.id;
                    const vis = resolveCharacterEquipmentVisualSync(c);
                    return (
                      <li
                        key={c.id}
                        style={{
                          ...listItem,
                          borderColor: active ? eraTone : "rgba(110,168,255,0.15)",
                          background: active ? `${eraTone}14` : "rgba(8,12,20,0.65)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                          <CharacterAvatar character={c} size={44} />
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ color: "#eaf4ff" }}>{c.name}</strong>
                            <div style={muted}>
                              {c.raceId || "—"} · {c.classId || vis.presetId} · L{c.level ?? 1}
                              {c.slotIndex != null ? ` · slot ${c.slotIndex + 1}` : ""}
                            </div>
                            <div
                              style={{ fontSize: 11, opacity: 0.75, fontFamily: "monospace" }}
                              title="Railway characters.id UUID — play handoff"
                            >
                              UUID {c.id}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.6 }}>
                              era {characterEra(c)}
                              {snap.account?.grudgeId ? ` · account ${snap.account.grudgeId}` : ""}
                              {c.config?.baseId ? ` · kit ${String(c.config.baseId)}` : ""}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            style={btnGhost}
                            onClick={() => gameSession.selectCharacter(c.id)}
                          >
                            Select
                          </button>
                          {era === "warlords" && (
                            <button
                              type="button"
                              style={btnPrimary}
                              onClick={() => {
                                gameSession.selectCharacter(c.id);
                                const cat =
                                  (typeof c.config?.catalogId === "string" && c.config.catalogId) ||
                                  (typeof c.config?.baseId === "string" && c.config.baseId) ||
                                  (c.raceId ? `race-${c.raceId}` : "race-human");
                                onPlayRace?.(cat);
                                onEnterGame?.("danger");
                              }}
                            >
                              Play
                            </button>
                          )}
                          {era === "voxel" && (
                            <>
                              <button
                                type="button"
                                style={btnPrimary}
                                onClick={() => playVoxelRealms(c)}
                              >
                                Play
                              </button>
                              <a
                                href={`https://character.grudge-studio.com/?era=voxel`}
                                style={{ ...btnGhost, textDecoration: "none", fontSize: 12 }}
                              >
                                4-kit hub
                              </a>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Trait Store · mesh look</h3>
              {!selectedChar ? (
                <p style={muted}>Select a character slot to open the Trait Store.</p>
              ) : (
                <>
                  <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                    <strong>{selectedChar.name}</strong>
                    <span style={muted}>
                      {" "}
                      · UUID <code>{selectedChar.id}</code>
                      {" · "}
                      {selectedVisual?.raceId || selectedChar.raceId || "—"}/
                      {selectedVisual?.presetId || selectedChar.classId || "—"}
                      {" · "}
                      {selectedVisual?.meshIds.length ?? 0} meshes
                      {" · "}
                      {selectedVisual?.source || "railway"}
                    </span>
                  </p>
                  <p style={{ ...muted, margin: "0 0 10px", fontSize: 11 }}>
                    Railway character row + Toon RTS kit visibility. Mesh def UUID =
                    sha1(grudge-asset:kit#meshId). Owned gear = ledger grudge_uuid. Unarmed body is locked.
                  </p>
                  <TraitStoreEmbed
                    era={era}
                    characterId={selectedChar.id}
                    raceId={selectedVisual?.raceId || selectedChar.raceId}
                    meshIds={selectedVisual?.meshIds || []}
                    height={640}
                  />
                </>
              )}
            </section>
          </div>
        )}

        {/* ── Inventory ── */}
        {panel === "inventory" && (
          <div style={grid2}>
            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Shared bag · all eras</h3>
              <p style={muted}>
                Account resources from Railway <code>/api/account/resources</code> (shared vault). Icons from fleet
                master-items / materials CDN.
              </p>
              {!snap.account ? (
                <p style={muted}>Sign in to load bag.</p>
              ) : bagEntries.length === 0 ? (
                <p style={muted}>{sharedBusy ? "Loading…" : "Bag empty — harvest / craft to fill."}</p>
              ) : (
                <div style={invGrid}>
                  {bagEntries.map(([id, qty]) => (
                    <div key={id} style={invCell} title={id}>
                      <img
                        src={matIconUrl(id)}
                        alt=""
                        width={40}
                        height={40}
                        style={{ objectFit: "contain", imageRendering: "pixelated" }}
                        onError={(e) => {
                          e.currentTarget.src = iconUrl("inventory");
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{qty}</span>
                      <span
                        style={{
                          fontSize: 10,
                          opacity: 0.7,
                          maxWidth: 72,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                style={{ ...btnGhost, marginTop: 12 }}
                onClick={() => void refreshShared()}
                disabled={sharedBusy}
              >
                Refresh bag
              </button>
            </section>
            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Account inventory</h3>
              <p style={muted}>
                <code>/api/account/inventory</code> — account-scoped items (not character equip).
              </p>
              {!snap.account ? (
                <p style={muted}>Sign in to load inventory.</p>
              ) : inventoryItems.length === 0 ? (
                <p style={muted}>{sharedBusy ? "Loading…" : "No inventory rows yet."}</p>
              ) : (
                <ul style={list}>
                  {inventoryItems.slice(0, 40).map((item, i) => {
                    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
                    const label =
                      String(row.itemId || row.id || row.name || row.item_id || `item-${i}`);
                    const qty = row.quantity ?? row.qty ?? row.count ?? 1;
                    return (
                      <li key={`${label}-${i}`} style={{ ...listItem, justifyContent: "flex-start" }}>
                        <span style={{ fontWeight: 650 }}>{label}</span>
                        <span style={muted}>×{String(qty)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* ── Wallet ── */}
        {panel === "wallet" && (
          <div style={grid2}>
            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Solana wallet · shared account</h3>
              <p style={muted}>
                From Railway <code>/api/wallet/status</code> and <code>/api/account</code> — one wallet for every
                Grudge Studio game on this Grudge ID.
              </p>
              {!snap.account ? (
                <p style={muted}>Sign in to load wallet.</p>
              ) : (
                <dl style={dlWide}>
                  <dt>Status</dt>
                  <dd>
                    {walletAddress ? (
                      <span style={{ color: "#86efac" }}>Linked</span>
                    ) : (
                      <span style={{ color: "#fbbf24" }}>None yet</span>
                    )}
                    {walletBusy ? " …" : ""}
                  </dd>
                  <dt>Type</dt>
                  <dd>{walletType || "—"}</dd>
                  <dt>Address</dt>
                  <dd>
                    {walletAddress ? (
                      <code style={{ fontSize: 11, wordBreak: "break-all" }}>{walletAddress}</code>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt>GBUX</dt>
                  <dd>{gbuxDisplay}</dd>
                  <dt>Crossmint email</dt>
                  <dd style={{ fontSize: 12 }}>
                    {profile?.crossmintEmail || walletStatus?.crossmintEmail || wallet?.crossmintEmail || "—"}
                  </dd>
                  <dt>Crossmint id</dt>
                  <dd>
                    <code style={{ fontSize: 11 }}>{profile?.crossmintWalletId || "—"}</code>
                  </dd>
                </dl>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  style={btnPrimary}
                  disabled={!walletAddress}
                  onClick={async () => {
                    if (!walletAddress) return;
                    try {
                      await navigator.clipboard.writeText(walletAddress);
                      setCopiedAddr(true);
                      window.setTimeout(() => setCopiedAddr(false), 1600);
                    } catch {
                      /* */
                    }
                  }}
                >
                  {copiedAddr ? "Copied" : "Copy address"}
                </button>
                {walletAddress ? (
                  <a
                    href={`${SOLSCAN_ADDR}${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...btnGhost, textDecoration: "none" }}
                  >
                    Solscan ↗
                  </a>
                ) : null}
                <a
                  href={WALLET_SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...btnGhost, textDecoration: "none" }}
                >
                  wallet.grudge-studio.com ↗
                </a>
                <button type="button" style={btnGhost} onClick={() => void refreshWallet()} disabled={walletBusy}>
                  Refresh wallet
                </button>
              </div>
            </section>
            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Balances · account row</h3>
              <p style={muted}>Currencies on the shared <code>accounts</code> table (not per-character).</p>
              {!snap.account ? (
                <p style={muted}>Sign in required.</p>
              ) : (
                <div style={balanceGrid}>
                  <div style={balanceCell}>
                    <span style={muted}>GBUX</span>
                    <strong>{gbuxDisplay}</strong>
                  </div>
                  <div style={balanceCell}>
                    <span style={muted}>Gold</span>
                    <strong>{profile?.gold ?? 0}</strong>
                  </div>
                  <div style={balanceCell}>
                    <span style={muted}>Premium</span>
                    <strong>{profile?.premiumCurrency ?? 0}</strong>
                  </div>
                  <div style={balanceCell}>
                    <span style={muted}>Char tokens</span>
                    <strong>{profile?.characterTokens ?? 0}</strong>
                  </div>
                  <div style={balanceCell}>
                    <span style={muted}>Account XP</span>
                    <strong>{profile?.accountXp ?? 0}</strong>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── cNFTs ── */}
        {panel === "cnfts" && (
          <section style={card}>
            <h3 style={{ ...h3, color: eraTone }}>cNFTs · character & island</h3>
            <p style={muted}>
              Compressed NFTs from Railway <code>/api/nfts</code> (account-scoped). Mint / claim also available
              from wallet tools when provisioned.
            </p>
            {!snap.account ? (
              <p style={muted}>Sign in to load cNFTs.</p>
            ) : sharedBusy ? (
              <p style={muted}>Loading…</p>
            ) : nfts.length === 0 ? (
              <div>
                <p style={muted}>
                  No cNFTs on this account yet. Mint a character or island NFT from Foundry / wallet flows — they
                  will list here for every fleet game.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <a
                    href={WALLET_SITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...btnGhost, textDecoration: "none" }}
                  >
                    Open wallet site ↗
                  </a>
                  <button type="button" style={btnGhost} onClick={() => void refreshShared()}>
                    Refresh cNFTs
                  </button>
                </div>
              </div>
            ) : (
              <ul style={list}>
                {nfts.map((n, i) => (
                  <li key={n.id || n.mintAddress || n.characterId || `nft-${i}`} style={listItem}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                      {n.imageUri ? (
                        <img
                          src={n.imageUri}
                          alt=""
                          width={44}
                          height={44}
                          style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            background: "rgba(168,85,247,0.15)",
                            border: "1px solid rgba(168,85,247,0.35)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ color: "#eaf4ff" }}>
                          {n.characterName || n.name || "cNFT"}
                        </strong>
                        <div style={muted}>
                          {n.status || "—"}
                          {n.isCompressed !== false ? " · compressed" : " · standard"}
                          {n.characterId ? ` · char ${shortAddress(n.characterId, 6, 4)}` : ""}
                        </div>
                        {n.mintAddress ? (
                          <div style={{ fontSize: 11, opacity: 0.7 }}>
                            mint {shortAddress(n.mintAddress, 8, 6)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {n.mintAddress ? (
                        <a
                          href={`${SOLSCAN_ADDR}${n.mintAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...btnGhost, textDecoration: "none", fontSize: 12 }}
                        >
                          Solscan
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Saves ── */}
        {panel === "saves" && (
          <div style={grid2}>
            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Character saves · {ERAS.find((e) => e.id === era)?.label}</h3>
              <p style={muted}>
                Per-character <code>saveData</code> / equipment from Railway roster (not localStorage). Switch era
                above to filter.
              </p>
              {!snap.account ? (
                <p style={muted}>Sign in to load saves.</p>
              ) : eraChars.length === 0 ? (
                <p style={muted}>No characters in this era — create in Foundry or play a game that writes gameEra.</p>
              ) : (
                <ul style={list}>
                  {eraChars.map((c) => {
                    const summary = summarizeSave(c);
                    const active = selectedChar?.id === c.id;
                    return (
                      <li
                        key={c.id}
                        style={{
                          ...listItem,
                          flexDirection: "column",
                          alignItems: "stretch",
                          borderColor: active ? eraTone : "rgba(110,168,255,0.15)",
                          background: active ? `${eraTone}14` : "rgba(8,12,20,0.65)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                            <CharacterAvatar character={c} size={40} />
                            <div>
                              <strong style={{ color: "#eaf4ff" }}>{c.name}</strong>
                              <div style={muted}>
                                {c.raceId || "—"} · L{c.level ?? 1} · {shortAddress(c.id, 6, 4)}
                              </div>
                            </div>
                          </div>
                          <button type="button" style={btnGhost} onClick={() => gameSession.selectCharacter(c.id)}>
                            Select
                          </button>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                          {summary.lines.map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                        {summary.keys.length > 0 && (
                          <details style={{ marginTop: 8, fontSize: 11, opacity: 0.75 }}>
                            <summary>saveData keys ({summary.keys.length})</summary>
                            <code style={{ wordBreak: "break-all" }}>{summary.keys.join(", ")}</code>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Home island save</h3>
              <p style={muted}>
                Account / ownership island from <code>/api/island</code> (shared with Warlords home).
              </p>
              {!snap.account ? (
                <p style={muted}>Sign in required.</p>
              ) : !island ? (
                <p style={muted}>
                  {sharedBusy ? "Loading…" : profile?.homeIslandId ? "Island id on account but detail empty." : "No home island yet."}
                  {profile?.homeIslandId ? (
                    <span style={{ display: "block", marginTop: 6 }}>
                      id <code>{profile.homeIslandId}</code>
                    </span>
                  ) : null}
                </p>
              ) : (
                <dl style={dlWide}>
                  <dt>Name</dt>
                  <dd>{island.name || "Home Island"}</dd>
                  <dt>Id</dt>
                  <dd>
                    <code style={{ fontSize: 11 }}>{island.id || "—"}</code>
                  </dd>
                  <dt>Seed</dt>
                  <dd>
                    <code style={{ fontSize: 11 }}>{island.seed || "—"}</code>
                  </dd>
                  <dt>Map style</dt>
                  <dd>{island.mapStyle || "—"}</dd>
                  <dt>Mint action</dt>
                  <dd>
                    <code style={{ fontSize: 11 }}>{profile?.homeIslandMintActionId || "—"}</code>
                  </dd>
                </dl>
              )}
              <button
                type="button"
                style={{ ...btnGhost, marginTop: 12 }}
                onClick={() => void refreshShared()}
                disabled={sharedBusy}
              >
                Refresh island
              </button>
            </section>
          </div>
        )}

        {/* ── Crafting ── */}
        {panel === "crafting" && (
          <section style={card}>
            <h3 style={{ ...h3, color: eraTone }}>{ERAS.find((e) => e.id === era)?.label} · crafting</h3>
            <p style={muted}>
              Era crafting surfaces (existing fleet apps). No second invent system on Account.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {CRAFTING_LINKS[era].map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, display: "inline-flex", textDecoration: "none" }}>
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
            {era === "warlords" && bagEntries.length > 0 && (
              <p style={{ ...muted, marginTop: 16 }}>
                You have {bagEntries.length} resource types in bag — use crafting apps above with the same Grudge ID.
              </p>
            )}
            {era === "voxel" && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {GRUDOX_ZONES.filter((z) => /mine|vox|realm/i.test(z.id + z.title)).slice(0, 4).map((z) => (
                  <button key={z.id} type="button" style={btnGhost} onClick={() => openExternalZone(z.id)}>
                    {z.title || z.id}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* ── styles (inline — matches dark Open shell) ─────────────────────────── */

const shell: CSSProperties = {
  position: "relative",
  minHeight: "100%",
  overflow: "visible",
  background: "linear-gradient(165deg, #0a0e16 0%, #121a28 50%, #0d121c 100%)",
  color: "#e8eef8",
  padding: "16px 18px 48px",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  boxSizing: "border-box",
};

const head: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const fleetStrip: CSSProperties = {
  margin: "0 0 12px",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(79,195,255,0.18)",
  background: "rgba(10,16,28,0.85)",
};
const fleetChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(79,195,255,0.28)",
  background: "rgba(7,11,20,0.7)",
  color: "#cfe8ff",
  fontSize: 11,
  fontWeight: 600,
  textDecoration: "none",
};
const banner: CSSProperties = {
  padding: "8px 12px",
  marginBottom: 12,
  borderRadius: 10,
  background: "rgba(79,195,255,0.1)",
  border: "1px solid rgba(79,195,255,0.25)",
  fontSize: 12,
};

const eraBar: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 8,
};

const eraBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const tabBar: CSSProperties = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  marginBottom: 14,
  borderBottom: "1px solid rgba(110,168,255,0.12)",
  paddingBottom: 8,
};

const tabBtn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 650,
  fontSize: 12,
};

const body: CSSProperties = { maxWidth: 1100 };

const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

const card: CSSProperties = {
  background: "rgba(12,16,26,0.88)",
  border: "1px solid rgba(110,168,255,0.14)",
  borderRadius: 14,
  padding: "14px 16px",
};

const h3: CSSProperties = { margin: "0 0 8px", fontSize: 14, fontWeight: 800 };

const muted: CSSProperties = { margin: 0, fontSize: 12, opacity: 0.72, lineHeight: 1.45 };

const dl: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px 1fr",
  gap: "6px 10px",
  fontSize: 13,
  margin: 0,
};

const dlWide: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: "6px 10px",
  fontSize: 13,
  margin: 0,
};

const chip: CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(110,168,255,0.22)",
  background: "rgba(8,12,20,0.65)",
  color: "#c5d4ea",
};

const balanceGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
  gap: 10,
  marginTop: 8,
};

const balanceCell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(212,175,55,0.2)",
  background: "rgba(212,175,55,0.06)",
};

const list: CSSProperties = { listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 8 };

const listItem: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(110,168,255,0.15)",
};

const equipGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
  gap: 8,
};

const equipCell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: 8,
  borderRadius: 10,
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(110,168,255,0.12)",
};

const invGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const invCell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "8px 4px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.28)",
  border: "1px solid rgba(110,168,255,0.12)",
};

const btnPrimary: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 9,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "linear-gradient(180deg, #3a6fd8, #2a4fb0)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 9,
  border: "1px solid rgba(110,168,255,0.22)",
  background: "rgba(30,40,60,0.6)",
  color: "#cfe0ff",
  fontWeight: 650,
  fontSize: 12,
  cursor: "pointer",
};

const linkBtn: CSSProperties = {
  ...btnGhost,
  padding: "2px 6px",
  display: "inline",
  fontSize: 12,
};

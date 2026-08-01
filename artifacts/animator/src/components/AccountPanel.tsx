/**
 * Account hub — fleet SSOT only. No invent create-hero race kits, no portrait
 * grids, no fake systems.
 *
 * Structure (same for every production era):
 *   Era tabs → Overview · Characters · Inventory · Crafting
 *
 * Data:
 *   Profile / bag  → GET /api/account · /api/account/resources
 *   Characters     → gameSession roster (Railway /api/characters?era=…)
 *   Equipment icons → resolveCharacterEquipmentVisualSync (master-items / fleet)
 *   Create hero    → Character Foundry deep-link only (not a second Open system)
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
  fetchAccountProfile,
  getHandoffFrom,
  type FleetAccountProfile,
  type ResourceMap,
} from "../lib/accountShared";
import { GAME_LIBRARY, type GameCategory } from "../game/gameLibrary";
import { CharacterAvatar } from "./CharacterAvatar";
import { CharacterPicker } from "./CharacterPicker";
import { resolveCharacterEquipmentVisualSync } from "../lib/characterEquipmentMesh";
import { matIconUrl, warmGameMedia } from "../lib/gameMedia";
import { warmProductionMedia } from "../lib/productionMedia";
import { iconUrl } from "../three/icons";
import { GRUDOX_ZONES } from "../game/grudoxZones";
import { embedSessionForZone } from "../lib/inAppLaunch";

/** Playable production eras (same sub-tabs on each). */
type EraId = "warlords" | "voxel" | "nexus" | "armada";
type PanelId = "overview" | "characters" | "inventory" | "crafting";

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
  { id: "crafting", label: "Crafting" },
];

const CRAFTING_LINKS: Record<EraId, { label: string; href: string }[]> = {
  warlords: [
    { label: "Warlords crafting (Puter)", href: "https://puter.com/app/warlords" },
    { label: "grudge-crafting.puter.site", href: "https://grudge-crafting.puter.site" },
    { label: "Client home island", href: "https://client.grudge-studio.com" },
  ],
  voxel: [
    { label: "Mine-Loader Realms", href: "https://mine-loader.vercel.app" },
    { label: "VoxGrudge world", href: "https://voxgrudge.vercel.app" },
  ],
  nexus: [
    { label: "Metaverse", href: "https://metaverse.grudge-studio.com" },
    { label: "Carrier", href: "https://carrier.grudge-studio.com" },
  ],
  armada: [{ label: "Open library · Armada", href: "https://open.grudge-studio.com/?door=library" }],
};

function characterEra(c: GrudgeCharacter): EraId {
  const raw =
    (c as { gameEra?: string }).gameEra ||
    (c.config?.gameEra as string | undefined) ||
    (c.saveData?.gameEra as string | undefined) ||
    (c.config?.era as string | undefined) ||
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
  const [era, setEra] = useState<EraId>("warlords");
  const [panel, setPanel] = useState<PanelId>("overview");
  const [wallet, setWallet] = useState<GrudgeWallet | null>(() => getCachedWallet());
  const [walletBusy, setWalletBusy] = useState(false);
  const [profile, setProfile] = useState<FleetAccountProfile | null>(null);
  const [bag, setBag] = useState<ResourceMap>({});
  const [sharedBusy, setSharedBusy] = useState(false);
  const [handoffFrom] = useState(() => getHandoffFrom());

  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const refreshShared = useCallback(async () => {
    if (!getStoredToken()) {
      setProfile(null);
      setBag({});
      return;
    }
    setSharedBusy(true);
    try {
      const [p, r] = await Promise.all([fetchAccountProfile(), fetchAccountBag()]);
      setProfile(p);
      setBag(r);
    } finally {
      setSharedBusy(false);
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    setWalletBusy(true);
    try {
      setWallet(await ensureWallet());
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

  const openFoundry = () => {
    const url = characterStudioCreateUrl({
      token: getStoredToken(),
      returnTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/account?open=1`
          : "https://open.grudge-studio.com/account?open=1",
    });
    window.open(url, "_blank", "noopener,noreferrer");
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
            Grudge ID · Railway characters · bag · per-era roster
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
                <p style={muted}>Sign in to load Railway profile, bag, and characters.</p>
              ) : (
                <dl style={dl}>
                  <dt>Display</dt>
                  <dd>{snap.account.displayName || profile?.displayName || "—"}</dd>
                  <dt>Grudge ID</dt>
                  <dd>
                    <code style={{ fontSize: 12 }}>{snap.account.grudgeId || profile?.grudgeId || "—"}</code>
                  </dd>
                  <dt>Home island</dt>
                  <dd>{profile?.homeIslandId || "—"}</dd>
                  <dt>GBUX / credits</dt>
                  <dd>
                    {profile?.gbux ?? profile?.credits ?? wallet?.gbux ?? "—"}
                    {walletBusy ? " …" : ""}
                  </dd>
                  <dt>This era roster</dt>
                  <dd>
                    {eraChars.length} character{eraChars.length === 1 ? "" : "s"}
                  </dd>
                </dl>
              )}
              <p style={{ ...muted, marginTop: 12 }}>{ERAS.find((e) => e.id === era)?.blurb}</p>
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
              {era === "warlords" && (
                <p style={{ ...muted, marginTop: 14 }}>
                  New heroes: use{" "}
                  <button type="button" style={linkBtn} onClick={openFoundry}>
                    Character Foundry
                  </button>{" "}
                  (character.grudge-studio.com) — not a second create system here.
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
                  {ERAS.find((e) => e.id === era)?.label} characters
                </h3>
                {era === "warlords" && (
                  <button type="button" style={btnGhost} onClick={openFoundry}>
                    Foundry ↗
                  </button>
                )}
              </div>
              <p style={muted}>
                Only heroes already on your account (Railway). Equipment from saveData / mesh_ids —
                no race-kit invent.
              </p>
              {era === "warlords" && <CharacterPicker />}
              {eraChars.length === 0 ? (
                <p style={{ ...muted, marginTop: 16 }}>
                  No characters for this era yet.
                  {era === "warlords"
                    ? " Create in Foundry, then Refresh."
                    : " Era roster fills as that game writes characters with gameEra."}
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
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.6 }}>
                              {vis.meshIds.length} meshes · {vis.source}
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
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section style={card}>
              <h3 style={{ ...h3, color: eraTone }}>Equipment · selected</h3>
              {!selectedChar || !selectedVisual ? (
                <p style={muted}>Select a character to see current gear.</p>
              ) : (
                <>
                  <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                    <strong>{selectedChar.name}</strong>
                    <span style={muted}>
                      {" "}
                      · {selectedVisual.raceId}/{selectedVisual.presetId}
                    </span>
                  </p>
                  <div style={equipGrid}>
                    {Object.keys(selectedVisual.slotIcons).length === 0 &&
                    Object.keys(selectedVisual.slotLabels).length === 0 ? (
                      <p style={muted}>
                        No slot map on this character yet — mesh kit:{" "}
                        {selectedVisual.meshIds.slice(0, 8).join(", ") || "none"}
                        {selectedVisual.meshIds.length > 8 ? "…" : ""}
                      </p>
                    ) : (
                      Object.entries({
                        ...Object.fromEntries(
                          Object.keys(selectedVisual.slotLabels).map((k) => [k, selectedVisual.slotIcons[k] || ""]),
                        ),
                        ...selectedVisual.slotIcons,
                      }).map(([slot, url]) => (
                        <div key={slot} style={equipCell} title={selectedVisual.slotLabels[slot] || slot}>
                          <img
                            src={slotIcon(url, slot.includes("weapon") || slot === "mainHand" ? "attack" : "equip")}
                            alt=""
                            width={36}
                            height={36}
                            style={{ objectFit: "contain", imageRendering: "pixelated" }}
                            onError={(e) => {
                              e.currentTarget.src = iconUrl("equip");
                            }}
                          />
                          <span style={{ fontSize: 10, opacity: 0.85, textAlign: "center" }}>
                            {selectedVisual.slotLabels[slot] || slot}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedVisual.meshIds.length > 0 && (
                    <details style={{ marginTop: 12, fontSize: 11, opacity: 0.75 }}>
                      <summary>mesh_ids ({selectedVisual.meshIds.length})</summary>
                      <code style={{ wordBreak: "break-all" }}>{selectedVisual.meshIds.join(", ")}</code>
                    </details>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {/* ── Inventory ── */}
        {panel === "inventory" && (
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
                    <span style={{ fontSize: 10, opacity: 0.7, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis" }}>
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
  position: "absolute",
  inset: 0,
  overflow: "auto",
  background: "linear-gradient(165deg, #0a0e16 0%, #121a28 50%, #0d121c 100%)",
  color: "#e8eef8",
  padding: "16px 18px 40px",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

const head: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
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

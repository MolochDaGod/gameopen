/**
 * Account hub — fleet SSOT (Railway Postgres) + charactersgrudox races.
 * Surface: gameopen.vercel.app/account?open=1&from=charactersgrudox
 *          open.grudge-studio.com/account · ?door=account
 *
 * Scope (production wiring):
 *   Account bag / profile → GET /api/account · /api/account/resources
 *   Characters            → GET/POST /api/characters?era=warlords
 *   Wallet                → optional /api/wallet (may 404 until provisioned)
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
  createFleetCharacter,
  fetchAccountBag,
  fetchAccountProfile,
  getHandoffFrom,
  type FleetAccountProfile,
  type ResourceMap,
} from "../lib/accountShared";
import { raceCharacterIdForFleetRace } from "../three/assets";
import { GRUDOX_ZONES, grudoxDeepLink, lobbyIslandDeepLink } from "../game/grudoxZones";
import { assetUrl } from "../lib/fleet";
import { CharacterPicker } from "./CharacterPicker";
import {
  AccountPaperdoll,
  RacePortraitGrid,
  RACE_DISPLAY,
  catalogIdToPaperRace,
  type PaperRaceKey,
  type PaperSlotId,
  type PaperEquipped,
} from "./equip/AccountPaperdoll";
import "./equip/AccountPaperdoll.css";

type TabId = "characters" | "shared" | "wallet" | "games" | "grudox" | "treaty";

const TABS: { id: TabId; label: string; tone: string }[] = [
  { id: "characters", label: "Characters", tone: "#4fc3ff" },
  { id: "shared", label: "Shared bag", tone: "#ffd24d" },
  { id: "wallet", label: "Wallet", tone: "#9fe8a0" },
  { id: "games", label: "Games", tone: "#ff7a7a" },
  { id: "grudox", label: "GRUDOX", tone: "#5fe0ff" },
  { id: "treaty", label: "Treaty", tone: "#c9a0ff" },
];

export function AccountPanel({
  onPlayRace,
  onEnterGame,
}: {
  /** Spawn / equip a charactersgrudox race in Danger Room. */
  onPlayRace?: (characterCatalogId: string) => void;
  onEnterGame?: (mode: "danger" | "brawl" | "genesis" | "zones" | "voxgrudge-native") => void;
}) {
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);
  const [tab, setTab] = useState<TabId>("characters");
  const [wallet, setWallet] = useState<GrudgeWallet | null>(() => getCachedWallet());
  const [walletBusy, setWalletBusy] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createRace, setCreateRace] = useState("race-human");
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [paperToast, setPaperToast] = useState("");
  const [createWeapon, setCreateWeapon] = useState<"sword" | "axe" | "staff" | null>("sword");
  const [profile, setProfile] = useState<FleetAccountProfile | null>(null);
  const [bag, setBag] = useState<ResourceMap>({});
  const [sharedBusy, setSharedBusy] = useState(false);
  const [handoffFrom] = useState(() => getHandoffFrom());
  const [treatyInput, setTreatyInput] = useState("");
  const [treatyLog, setTreatyLog] = useState<{ who: string; text: string; t: number }[]>(() => {
    try {
      const raw = localStorage.getItem("grudge.open.treaty");
      return raw ? (JSON.parse(raw) as { who: string; text: string; t: number }[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const grudoxTier = useMemo(() => {
    const n = snap.characters.length;
    if (n >= 8) return { name: "Warlord", level: 3, color: "#ffd24d" };
    if (n >= 3) return { name: "Captain", level: 2, color: "#4fc3ff" };
    if (snap.account) return { name: "Recruit", level: 1, color: "#9fe8a0" };
    return { name: "Guest", level: 0, color: "#8899aa" };
  }, [snap.characters.length, snap.account]);

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
      const w = await ensureWallet();
      setWallet(w);
    } finally {
      setWalletBusy(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await gameSession.refreshCharacters();
    await refreshShared();
    if (snap.account) void refreshWallet();
  }, [refreshShared, refreshWallet, snap.account]);

  useEffect(() => {
    if (snap.account) {
      void refreshShared();
      if (!wallet) void refreshWallet();
    }
  }, [snap.account, wallet, refreshShared, refreshWallet]);

  /** Create on Railway when signed in; local draft when guest. */
  const createCharacter = async () => {
    const paperKey = catalogIdToPaperRace(createRace);
    const name = createName.trim() || RACE_DISPLAY[paperKey].name || "Hero";
    const raceKey = createRace.replace(/^race-/, "").replace(/-/g, "_");
    const raceId = raceKey === "high_elf" ? "elf" : raceKey === "high_elves" ? "elf" : raceKey;

    if (snap.account && getStoredToken()) {
      setCreateBusy(true);
      setCreateMsg("Creating on Railway…");
      try {
        const res = await createFleetCharacter({
          name,
          raceId,
          classId: "warrior",
          catalogId: createRace,
          gameEra: "warlords",
        });
        if (!res.ok) {
          setCreateMsg(res.error);
          return;
        }
        await gameSession.refreshCharacters();
        gameSession.selectCharacter(res.id);
        setCreateMsg(`Fleet character ${name} · ${res.id.slice(0, 8)}… · Warlords era`);
        onPlayRace?.(createRace);
      } finally {
        setCreateBusy(false);
      }
      return;
    }

    // Guest draft — local only (not SSOT)
    const id = `local_${createRace}_${Date.now().toString(36)}`;
    const draft: GrudgeCharacter = {
      id,
      name,
      raceId: raceKey === "high_elf" ? "high-elves" : raceKey,
      classId: "warrior",
      level: 1,
      config: { catalogId: createRace, source: "charactersgrudox" },
    };
    gameSession.upsertLocalCharacter(draft);
    setCreateMsg(`Local draft ${name} · sign in to save to fleet Postgres`);
    onPlayRace?.(createRace);
  };

  const postTreaty = () => {
    const text = treatyInput.trim();
    if (!text) return;
    const who = snap.account?.displayName || snap.account?.grudgeId || "Guest";
    const next = [{ who, text, t: Date.now() }, ...treatyLog].slice(0, 40);
    setTreatyLog(next);
    setTreatyInput("");
    try {
      localStorage.setItem("grudge.open.treaty", JSON.stringify(next));
    } catch {
      /* */
    }
  };

  const openExternal = (zoneId: string) => {
    const url = grudoxDeepLink(zoneId, {
      token: getStoredToken(),
      characterId: snap.selectedCharacterId,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const bagEntries = useMemo(
    () => Object.entries(bag).filter(([, n]) => typeof n === "number" && n > 0).sort((a, b) => b[1] - a[1]),
    [bag],
  );

  return (
    <div style={shell}>
      <header style={head}>
        <div>
          <div className="brand" style={{ fontSize: 18 }}>
            ACCOUNT<span className="brand-accent"> HUB</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>
            Railway Postgres SSOT · charactersgrudox races · shared account bag · GRUDOX
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {snap.account ? (
            <>
              <span style={{ color: "#8ec3ff", fontSize: 13 }}>
                {snap.account.displayName || profile?.displayName || snap.account.grudgeId}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 999,
                  border: `1px solid ${grudoxTier.color}66`,
                  color: grudoxTier.color,
                }}
              >
                {grudoxTier.name} · L{grudoxTier.level}
              </span>
              <button type="button" style={btnGhost} onClick={() => void refreshAll()}>
                Refresh
              </button>
              <button type="button" style={btnGhost} onClick={() => { logoutGrudge(); void loginWithGrudgeId(true); }}>
                Switch
              </button>
            </>
          ) : (
            <button type="button" style={btnPrimary} onClick={() => void loginWithGrudgeId(false)}>
              Grudge ID
            </button>
          )}
        </div>
      </header>

      {handoffFrom && (
        <div style={banner}>
          Returned from <strong>{handoffFrom}</strong>
          {snap.selectedCharacterId ? (
            <>
              {" "}
              · active character{" "}
              <code style={{ fontSize: 11 }}>{snap.selectedCharacterId.slice(0, 12)}…</code>
            </>
          ) : null}
          · roster and bag load from Railway
        </div>
      )}

      <nav style={tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...tabBtn,
              borderColor: tab === t.id ? t.tone : "transparent",
              color: tab === t.id ? "#eaf4ff" : "#8aa0bc",
              background: tab === t.id ? `${t.tone}22` : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={body}>
        {tab === "characters" && (
          <div style={col}>
            <CharacterPicker />

            {/* ── TI /equipment main panel (banner + paperdoll + race art) ── */}
            <div
              className="ap-banner"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.88)), url(${assetUrl("rooms/equipment-banner.png")})`,
              }}
            >
              <div>
                <p className="ap-banner-kicker">Equipment · Create</p>
                <h2 className="ap-banner-title">GRUDGE WARLORD LOADOUT</h2>
                <p className="ap-banner-sub">
                  Tactical Infinity <strong>/equipment</strong> chrome · race portraits · paperdoll
                  slots · charactersgrudox models under <code>models/races/*.glb</code>
                </p>
              </div>
            </div>

            <div className="ap-main">
              <AccountPaperdoll
                race={catalogIdToPaperRace(createRace)}
                title="GRUDGE WARLORD"
                heroName={createName.trim() || undefined}
                equipped={
                  {
                    weapon: createWeapon
                      ? {
                          name: createWeapon === "sword" ? "Sword" : createWeapon === "axe" ? "Axe" : "Staff",
                          iconName:
                            createWeapon === "staff"
                              ? "skill-vfx-lab"
                              : createWeapon === "axe"
                                ? "charge"
                                : "equip",
                        }
                      : undefined,
                  } satisfies PaperEquipped
                }
                onSlotClick={(id: PaperSlotId) => {
                  if (id === "weapon") {
                    const cycle: Array<"sword" | "axe" | "staff"> = ["sword", "axe", "staff"];
                    const i = createWeapon ? cycle.indexOf(createWeapon) : -1;
                    const next = cycle[(i + 1) % cycle.length];
                    setCreateWeapon(next);
                    setPaperToast(`Main hand → ${next}`);
                    return;
                  }
                  if (id === "add") {
                    setPaperToast("Pick a race below, name your hero, then Create");
                    return;
                  }
                  setPaperToast(`${id} — armor catalogue soon (TI paperdoll parity)`);
                }}
              />

              <div className="ap-side">
                <div className="ap-side-card">
                  <h4>Create hero</h4>
                  <p className="ap-hint">
                    Click paperdoll slots to cycle starter weapon. Select a race portrait, then
                    create on fleet (Railway) or local draft.
                  </p>
                  <div className="ap-action-row" style={{ marginTop: 10 }}>
                    <input
                      className="ap-input"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="Hero name"
                    />
                    <button
                      type="button"
                      className="ap-btn ap-btn-primary"
                      disabled={createBusy}
                      onClick={() => void createCharacter()}
                    >
                      {createBusy
                        ? "Saving…"
                        : snap.account
                          ? "Create on fleet"
                          : "Create local draft"}
                    </button>
                    <button
                      type="button"
                      className="ap-btn"
                      onClick={() => onPlayRace?.(createRace)}
                    >
                      Play race preview
                    </button>
                    <button
                      type="button"
                      className="ap-btn"
                      onClick={() => {
                        const url = characterStudioCreateUrl({
                          token: getStoredToken(),
                          returnTo:
                            typeof window !== "undefined"
                              ? `${window.location.origin}/account?open=1&from=charactersgrudox`
                              : "https://gameopen.vercel.app/account?open=1&from=charactersgrudox",
                        });
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      Character Studio ↗
                    </button>
                  </div>
                  <p className="ap-toast">{paperToast || createMsg || "\u00a0"}</p>
                  {!snap.account && (
                    <p className="ap-hint">
                      Sign in with Grudge ID to write characters to Railway Postgres. Local drafts
                      stay on this device only.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <h3 style={{ ...h3, color: "#fcd34d" }}>Race kit · portraits</h3>
            <RacePortraitGrid
              selected={catalogIdToPaperRace(createRace)}
              onSelect={(race: PaperRaceKey) => {
                setCreateRace(RACE_DISPLAY[race].catalogId);
                setPaperToast(`Race → ${RACE_DISPLAY[race].name}`);
              }}
            />

            <h3 style={h3}>Fleet roster · era=warlords</h3>
            {snap.characters.length === 0 ? (
              <p style={muted}>
                No fleet characters yet — create above, open Character Studio, or sign in and Refresh.
              </p>
            ) : (
              <ul style={list}>
                {snap.characters.map((c) => {
                  const glb = raceCharacterIdForFleetRace(c.raceId);
                  const paperRace = catalogIdToPaperRace(
                    (typeof c.config?.baseId === "string" && c.config.baseId) ||
                      (c.raceId ? `race-${c.raceId}` : "race-human"),
                  );
                  const active = c.id === snap.selectedCharacterId;
                  return (
                    <li
                      key={c.id}
                      style={{
                        ...listItem,
                        borderColor: active ? "#fcd34d" : "rgba(146,64,14,0.35)",
                        background: "rgba(12,10,9,0.75)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <img
                          src={assetUrl(`races/${paperRace === "elf" ? "elf" : paperRace}.png`)}
                          alt=""
                          width={48}
                          height={48}
                          style={{
                            borderRadius: 8,
                            objectFit: "cover",
                            border: "1px solid rgba(146,64,14,0.45)",
                          }}
                          draggable={false}
                        />
                        <div>
                          <strong style={{ color: "#fef3c7" }}>{c.name}</strong>
                          <span style={muted}> · {c.raceId || "—"} · L{c.level ?? 1}</span>
                          <div style={{ fontSize: 11, opacity: 0.65 }}>model {glb}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" style={btnGhost} onClick={() => gameSession.selectCharacter(c.id)}>
                          Select
                        </button>
                        <button type="button" style={btnPrimary} onClick={() => onPlayRace?.(glb)}>
                          Play
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === "shared" && (
          <div style={col}>
            <h3 style={h3}>Shared account bag</h3>
            <p style={muted}>
              Account-scoped materials (all characters). Railway{" "}
              <code>/api/account/resources</code> · not stored only in localStorage.
            </p>
            {!snap.account ? (
              <p style={muted}>Sign in to load the shared bag from Postgres.</p>
            ) : (
              <>
                <div style={statCard}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Account</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
                    {profile?.grudgeId || snap.account.grudgeId}
                  </div>
                  {profile?.id && (
                    <div style={muted}>row {profile.id}</div>
                  )}
                  {(profile?.gbux != null || profile?.credits != null) && (
                    <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: "#ffd24d" }}>
                      {profile.gbux ?? profile.credits}{" "}
                      <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>GBUX / credits</span>
                    </div>
                  )}
                  {profile?.homeIslandId && (
                    <div style={{ ...muted, marginTop: 6 }}>Home island · {profile.homeIslandId}</div>
                  )}
                </div>
                <button type="button" style={btnGhost} disabled={sharedBusy} onClick={() => void refreshShared()}>
                  {sharedBusy ? "Loading…" : "Reload bag"}
                </button>
                {bagEntries.length === 0 ? (
                  <p style={muted}>Bag empty — harvest on Island / GRUDOX fills the shared bag.</p>
                ) : (
                  <ul style={list}>
                    {bagEntries.map(([id, n]) => (
                      <li key={id} style={listItem}>
                        <strong style={{ textTransform: "capitalize" }}>{id.replace(/_/g, " ")}</strong>
                        <span style={{ color: "#ffd24d", fontWeight: 700 }}>×{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {tab === "wallet" && (
          <div style={col}>
            <h3 style={h3}>Custodial wallet</h3>
            <p style={muted}>
              Optional Solana wallet on Railway. Route may 404 until wallet service is enabled — play
              works without it.
            </p>
            {!snap.account ? (
              <p style={muted}>Sign in with Grudge ID to provision a wallet.</p>
            ) : wallet ? (
              <div style={statCard}>
                <div style={{ fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>{wallet.address}</div>
                <div style={muted}>
                  {wallet.chain || "Solana"} · scoped to {wallet.grudgeId || snap.account.grudgeId}
                </div>
                <button type="button" style={btnGhost} onClick={() => void navigator.clipboard.writeText(wallet.address)}>
                  Copy address
                </button>
              </div>
            ) : (
              <button type="button" style={btnPrimary} disabled={walletBusy} onClick={() => void refreshWallet()}>
                {walletBusy ? "Checking…" : "Try provision wallet"}
              </button>
            )}
          </div>
        )}

        {tab === "games" && (
          <div style={col}>
            <h3 style={h3}>Jump into a game</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {(
                [
                  ["danger", "Danger Room", "#ff7a7a"],
                  ["brawl", "Ruins Brawler", "#4fc3ff"],
                  ["genesis", "Warlord Genesis", "#ffd24d"],
                  ["voxgrudge-native", "VoxGrudge", "#5fe0ff"],
                  ["zones", "GRUDOX Zones", "#5fe0ff"],
                ] as const
              ).map(([mode, label, tone]) => (
                <button
                  key={mode}
                  type="button"
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${tone}55`,
                    background: "rgba(7,11,20,0.75)",
                    color: "#eaf4ff",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    if (mode === "genesis") {
                      void import("../lib/warlordGenesisLaunch").then(({ launchWarlordGenesis }) => {
                        launchWarlordGenesis({ target: "_blank" });
                      });
                      return;
                    }
                    onEnterGame?.(mode);
                  }}
                >
                  <div style={{ fontWeight: 700, color: tone }}>{label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                    {mode === "genesis" ? "fleet handoff ↗" : "as active character"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "grudox" && (
          <div style={col}>
            <h3 style={h3}>
              GRUDOX sub · <span style={{ color: grudoxTier.color }}>{grudoxTier.name}</span>
            </h3>
            <p style={muted}>
              Level {grudoxTier.level} — unlocks track with roster size & Island progress. Deep-links carry your
              Grudge ID + character.
            </p>
            <button
              type="button"
              style={btnPrimary}
              onClick={() => {
                const url = lobbyIslandDeepLink({
                  token: getStoredToken(),
                  characterId: snap.selectedCharacterId,
                });
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              Open GRUDOX Island ↗
            </button>
            <ul style={list}>
              {GRUDOX_ZONES.map((z) => (
                <li key={z.id} style={listItem}>
                  <div>
                    <strong style={{ color: z.tone }}>{z.title}</strong>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{z.blurb}</div>
                  </div>
                  <button type="button" style={btnGhost} onClick={() => openExternal(z.id)}>
                    Launch
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "treaty" && (
          <div style={col}>
            <h3 style={h3}>Treaty chat</h3>
            <p style={muted}>
              Lightweight alliance / party notes (local for now). Fleet treaty rooms will bind to Railway later.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={treatyInput}
                onChange={(e) => setTreatyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && postTreaty()}
                placeholder="Propose a treaty, raid time, loot split…"
                style={{ ...input, flex: 1 }}
              />
              <button type="button" style={btnPrimary} onClick={postTreaty}>
                Send
              </button>
            </div>
            <ul style={{ ...list, maxHeight: 280, overflow: "auto" }}>
              {treatyLog.length === 0 && <li style={muted}>No messages yet.</li>}
              {treatyLog.map((m, i) => (
                <li key={`${m.t}-${i}`} style={{ ...listItem, flexDirection: "column", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 11, color: "#8ec3ff" }}>
                    {m.who} · {new Date(m.t).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13 }}>{m.text}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <footer style={{ ...muted, fontSize: 11, padding: "8px 4px" }}>
        <img src={assetUrl("icons/inventory.png")} alt="" width={14} height={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
        gameopen.vercel.app/account · Railway grudge-api-production · charactersgrudox · same Grudge ID
      </footer>
    </div>
  );
}

const banner: CSSProperties = {
  maxWidth: 960,
  margin: "0 auto 12px",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(79,195,255,0.35)",
  background: "rgba(40,100,160,0.2)",
  fontSize: 13,
  color: "#cfe8ff",
};

const shell: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 30,
  overflow: "auto",
  padding: "max(16px, env(safe-area-inset-top)) 16px 80px",
  background:
    "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(40,80,140,0.25), transparent 60%), #070b14",
  color: "#cfe0fa",
  fontFamily: "Inter, system-ui, sans-serif",
};

const head: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
  marginBottom: 14,
  maxWidth: 1080,
  marginInline: "auto",
};

const tabBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  maxWidth: 1080,
  margin: "0 auto 14px",
};

const tabBtn: CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  cursor: "pointer",
  background: "transparent",
  color: "#8aa0bc",
};

const body: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
};

const col: CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

const h3: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#8ec3ff",
};

const muted: CSSProperties = { fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: 0 };

const list: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };

const listItem: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(79,195,255,0.15)",
  background: "rgba(7,11,20,0.65)",
};

const statCard: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,210,77,0.25)",
  background: "rgba(20,16,8,0.7)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const input: CSSProperties = {
  background: "rgba(7,11,20,0.92)",
  border: "1px solid rgba(79,195,255,0.28)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  minWidth: 160,
};

const btnPrimary: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.5)",
  background: "linear-gradient(180deg, rgba(40,90,160,0.9), rgba(20,40,80,0.95))",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.28)",
  background: "rgba(7,11,20,0.55)",
  color: "#cfe0fa",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12,
  cursor: "pointer",
};

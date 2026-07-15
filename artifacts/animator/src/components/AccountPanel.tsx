/**
 * Account hub — charactersgrudox races, credits, wallet, games, GRUDOX tier, treaty chat.
 * Surface: open.grudge-studio.com Account tab / ?door=account
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
import { RACE_CHARACTERS, raceCharacterIdForFleetRace } from "../three/assets";
import { GRUDOX_ZONES, grudoxDeepLink, lobbyIslandDeepLink } from "../game/grudoxZones";
import { assetUrl } from "../lib/fleet";
import { CharacterPicker } from "./CharacterPicker";
import { AttachmentSlotCards } from "./equip/AttachmentSlotCards";
import { CHARACTER_SLOT_ANCHORS, type AttachmentSlotDef } from "./equip/attachmentCardModel";

type TabId = "characters" | "credits" | "wallet" | "games" | "grudox" | "treaty";

const TABS: { id: TabId; label: string; tone: string }[] = [
  { id: "characters", label: "Characters", tone: "#4fc3ff" },
  { id: "credits", label: "Credits", tone: "#ffd24d" },
  { id: "wallet", label: "Wallet", tone: "#9fe8a0" },
  { id: "games", label: "Games", tone: "#ff7a7a" },
  { id: "grudox", label: "GRUDOX", tone: "#5fe0ff" },
  { id: "treaty", label: "Treaty", tone: "#c9a0ff" },
];

/** Race kit from charactersgrudox — create / preview roster. */
const RACE_META: Record<string, { blurb: string; color: string }> = {
  "race-human": { blurb: "Western Kingdoms — balanced freelancers.", color: "#6ea8ff" },
  "race-orc": { blurb: "Green tide — raw power, short temper.", color: "#5fd48a" },
  "race-high-elf": { blurb: "Arcane long-lived — glass and lightning.", color: "#b8e0ff" },
  "race-dwarf": { blurb: "Mountain forge — stout and stubborn.", color: "#e0a060" },
  "race-barbarian": { blurb: "Steppe fury — speed and rage.", color: "#ff8a5c" },
  "race-undead": { blurb: "Risen legion — cold magic, no fear.", color: "#a090c0" },
};

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

  // Soft credits (local ledger) until fleet SSOT ships.
  const [credits, setCredits] = useState(() => {
    try {
      const raw = localStorage.getItem("grudge.open.credits");
      if (raw) return Math.max(0, Number(JSON.parse(raw).balance) || 0);
    } catch {
      /* */
    }
    return 250;
  });

  const grudoxTier = useMemo(() => {
    // Placeholder sub level until billing webhook lands — derive from char count.
    const n = snap.characters.length;
    if (n >= 8) return { name: "Warlord", level: 3, color: "#ffd24d" };
    if (n >= 3) return { name: "Captain", level: 2, color: "#4fc3ff" };
    if (snap.account) return { name: "Recruit", level: 1, color: "#9fe8a0" };
    return { name: "Guest", level: 0, color: "#8899aa" };
  }, [snap.characters.length, snap.account]);

  const refreshWallet = useCallback(async () => {
    setWalletBusy(true);
    try {
      const w = await ensureWallet();
      setWallet(w);
    } finally {
      setWalletBusy(false);
    }
  }, []);

  useEffect(() => {
    if (snap.account && !wallet) void refreshWallet();
  }, [snap.account, wallet, refreshWallet]);

  const createLocalCharacter = () => {
    const name = createName.trim() || RACE_CHARACTERS.find((r) => r.id === createRace)?.name || "Hero";
    const raceKey = createRace.replace(/^race-/, "").replace(/-/g, "_");
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
    setCreateMsg(`Created ${name} · equipped ${createRace}`);
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

  return (
    <div style={shell}>
      <header style={head}>
        <div>
          <div className="brand" style={{ fontSize: 18 }}>
            ACCOUNT<span className="brand-accent"> HUB</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>
            Characters from Fantasy Scene Creator (charactersgrudox) · fleet wallet · GRUDOX
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {snap.account ? (
            <>
              <span style={{ color: "#8ec3ff", fontSize: 13 }}>
                {snap.account.displayName || snap.account.grudgeId}
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
            <h3 style={h3}>Create — charactersgrudox races</h3>
            <p style={muted}>
              Models: <code>public/models/races/*.glb</code>. Attachment cards follow
              three-js-basic-character-customisation (slot ＋ → options → apply).
            </p>
            {/* Character container: race / weapon / armor / legs hotspots */}
            <div style={charPreview}>
              <div style={charSilhouette} aria-hidden />
              <AttachmentSlotCards
                kind="character"
                slots={
                  [
                    {
                      id: "race",
                      label: "Race",
                      anchor: CHARACTER_SLOT_ANCHORS.race,
                      equippedId: createRace,
                      options: RACE_CHARACTERS.map((r) => ({
                        id: r.id,
                        label: r.name,
                        icon: "◆",
                        tone: RACE_META[r.id]?.color,
                      })),
                    },
                    {
                      id: "weapon",
                      label: "Weapon",
                      anchor: CHARACTER_SLOT_ANCHORS.weapon,
                      equippedId: null,
                      emptyLabel: "Weapon",
                      options: [
                        { id: "sword", label: "Sword", icon: "⚔" },
                        { id: "axe", label: "Axe", icon: "🪓" },
                        { id: "staff", label: "Staff", icon: "🪄" },
                      ],
                    },
                    {
                      id: "armor",
                      label: "Armor",
                      anchor: CHARACTER_SLOT_ANCHORS.armor,
                      equippedId: null,
                      emptyLabel: "Armor",
                      options: [
                        { id: "light", label: "Light", icon: "👕", disabled: true },
                        { id: "heavy", label: "Heavy", icon: "🛡", disabled: true },
                      ],
                    },
                    {
                      id: "legs",
                      label: "Legs",
                      anchor: CHARACTER_SLOT_ANCHORS.legs,
                      equippedId: null,
                      emptyLabel: "Legs",
                      options: [
                        { id: "boots", label: "Boots", icon: "👢", disabled: true },
                        { id: "peg", label: "Peg", icon: "🪵", disabled: true },
                      ],
                    },
                  ] satisfies AttachmentSlotDef[]
                }
                onApply={(slotId, optionId) => {
                  if (slotId === "race" && optionId) setCreateRace(optionId);
                }}
              />
            </div>
            <div style={raceGrid}>
              {RACE_CHARACTERS.map((r) => {
                const meta = RACE_META[r.id] || { blurb: r.name, color: "#4fc3ff" };
                const selected = createRace === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setCreateRace(r.id)}
                    style={{
                      ...raceCard,
                      borderColor: selected ? meta.color : "rgba(79,195,255,0.2)",
                      boxShadow: selected ? `0 0 0 1px ${meta.color}88` : "none",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: meta.color }}>{r.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{meta.blurb}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Hero name"
                style={input}
              />
              <button type="button" style={btnPrimary} onClick={createLocalCharacter}>
                Create & equip
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => onPlayRace?.(createRace)}
              >
                Play race preview
              </button>
            </div>
            {createMsg && <p style={{ color: "#9fe8a0", fontSize: 12 }}>{createMsg}</p>}

            <h3 style={h3}>Fleet roster</h3>
            {snap.characters.length === 0 ? (
              <p style={muted}>No fleet characters yet — create one above or sign in.</p>
            ) : (
              <ul style={list}>
                {snap.characters.map((c) => {
                  const glb = raceCharacterIdForFleetRace(c.raceId);
                  const active = c.id === snap.selectedCharacterId;
                  return (
                    <li key={c.id} style={{ ...listItem, borderColor: active ? "#4fc3ff" : "rgba(79,195,255,0.15)" }}>
                      <div>
                        <strong>{c.name}</strong>
                        <span style={muted}> · {c.raceId || "—"} · L{c.level ?? 1}</span>
                        <div style={{ fontSize: 11, opacity: 0.65 }}>model {glb}</div>
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

        {tab === "credits" && (
          <div style={col}>
            <h3 style={h3}>Studio credits</h3>
            <div style={statCard}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#ffd24d" }}>{credits}</div>
              <div style={muted}>Soft balance (local ledger) · fleets share GRUDOX rewards later</div>
            </div>
            <p style={muted}>
              Earn credits in Ruins Brawler, Danger Room clear bonuses, and Island quests. Spend on cosmetics
              and GRUDOX sub perks when the store lights up.
            </p>
            <button
              type="button"
              style={btnGhost}
              onClick={() => {
                const next = credits + 50;
                try {
                  localStorage.setItem(
                    "grudge.open.credits",
                    JSON.stringify({ balance: next, at: Date.now() }),
                  );
                } catch {
                  /* */
                }
                setCredits(next);
                setCreateMsg(`+50 credits → ${next}`);
              }}
            >
              Claim +50 demo
            </button>
          </div>
        )}

        {tab === "wallet" && (
          <div style={col}>
            <h3 style={h3}>Custodial wallet</h3>
            {!snap.account ? (
              <p style={muted}>Sign in with Grudge ID to provision a Solana wallet (Crossmint / Railway).</p>
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
                {walletBusy ? "Provisioning…" : "Provision wallet"}
              </button>
            )}
          </div>
        )}

        {tab === "games" && (
          <div style={col}>
            <h3 style={h3}>Jump into a game</h3>
            <div style={raceGrid}>
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
                  style={{ ...raceCard, borderColor: `${tone}55` }}
                  onClick={() => onEnterGame?.(mode)}
                >
                  <div style={{ fontWeight: 700, color: tone }}>{label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>as active character</div>
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
        open.grudge-studio.com · charactersgrudox race kit · same Grudge ID everywhere
      </footer>
    </div>
  );
}

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
  maxWidth: 960,
  marginInline: "auto",
};

const tabBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  maxWidth: 960,
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
  maxWidth: 960,
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

const charPreview: CSSProperties = {
  position: "relative",
  height: 200,
  borderRadius: 12,
  border: "1px solid rgba(232,168,110,0.28)",
  background:
    "radial-gradient(ellipse 50% 55% at 50% 40%, rgba(80,50,30,0.25), transparent 70%), rgba(8,10,16,0.9)",
  overflow: "hidden",
};

const charSilhouette: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "14%",
  transform: "translateX(-50%)",
  width: 64,
  height: "72%",
  borderRadius: "32px 32px 16px 16px",
  background:
    "linear-gradient(180deg, rgba(200,160,120,0.4), rgba(80,70,100,0.3) 50%, rgba(40,45,55,0.5))",
  pointerEvents: "none",
};

const raceGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: 8,
};

const raceCard: CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(79,195,255,0.2)",
  background: "rgba(7,11,20,0.75)",
  color: "#eaf4ff",
  cursor: "pointer",
};

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

/**
 * GrudgeMenu — the post-login main menu: a full 3D campfire scene
 * (GrudgeMenuScene) with the account's four roster heroes standing in the
 * night forest, plus the DOM chrome from the reference design: GRUDGE logo,
 * right-side wooden menu (PvE / PvP / Grudge Arena / Leaderboard / Shop /
 * Settings), "+" markers over empty slots, and the picked hero's name with
 * EDIT / SCENE actions at the bottom.
 *
 * Roster state + cloud sync mirror the old HeroLobby exactly (rosterStore);
 * this surface only changes the presentation and the deploy routing:
 *   PvE          → solo Danger Room session with the picked hero
 *   PvP          → the multiplayer lobby (sharable Danger Room rooms)
 *   Grudge Arena → Danger Room with the Colosseum preset
 *   SCENE        → the doors hall (rest of the facility)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "../three/assetHost";
import { CHARACTERS } from "../three/assets";
import { restoreSession, signOut, type GrudgeUser } from "../auth/grudgeAuth";
import { ensureSession, type GrudgeSession } from "../auth/grudgeIdApi";
import { saveRoomPreset } from "../three/RoomPresets";
import {
  GrudgeMenuScene,
  SLOT_COUNT,
  type SlotAnchor,
} from "../three/menu/GrudgeMenuScene";
import {
  ROSTER_SLOTS,
  deleteHero,
  loadRoster,
  saveHero,
  setRosterUser,
  syncRoster,
  type HeroRecord,
  type Roster,
} from "../roster/rosterStore";
import { CreatePanel } from "./HeroLobby";
import "./heroLobby.css";
import "./grudgeMenu.css";

interface Props {
  /** Deploy the picked hero into a solo Danger Room session (PvE). */
  onDeploy: (hero: HeroRecord) => void;
  /** Open the multiplayer lobby — sharable Danger Room rooms (PvP). */
  onLobby: (hero: HeroRecord) => void;
  /** Open the doors hall (the rest of the facility). */
  onDoors: () => void;
  /** Sign-out finished — return to the landing page. */
  onSignedOut: () => void;
}

const menuIcon = (name: string) => assetUrl(`ui/menu/${name}.png`);

function formName(baseId: string): string {
  return CHARACTERS.find((c) => c.id === baseId)?.name ?? baseId;
}

interface EditState {
  slot: number;
  existing: HeroRecord | null;
}

export function GrudgeMenu({ onDeploy, onLobby, onDoors, onSignedOut }: Props) {
  const [roster, setRoster] = useState<Roster>(() => loadRoster());
  const [picked, setPicked] = useState<number>(() => {
    const r = loadRoster();
    const i = r.findIndex((h) => h !== null);
    return i >= 0 ? i : 0;
  });
  const [edit, setEdit] = useState<EditState | null>(null);
  const [session, setSession] = useState<GrudgeSession | null>(null);
  const [user, setUser] = useState<GrudgeUser | null>(null);
  /** WebGL unavailable — fall back to a 2D slot picker over the gradient. */
  const [flat, setFlat] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<GrudgeMenuScene | null>(null);
  const anchorRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  // ── 3D scene lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let scene: GrudgeMenuScene;
    try {
      scene = new GrudgeMenuScene(mount, {
        onPickSlot: (slot) => {
          if (rosterRef.current[slot]) setPicked(slot);
        },
        onAnchors: (anchors: SlotAnchor[]) => {
          // Position the "+" overlays directly (no React re-render per frame).
          for (const a of anchors) {
            const el = anchorRefs.current[a.slot];
            if (!el) continue;
            const show = a.visible && !a.occupied;
            el.style.display = show ? "" : "none";
            if (show) el.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -50%)`;
          }
        },
      });
    } catch (err) {
      // No WebGL (headless / very old device) — degrade to the 2D picker
      // instead of letting the React tree die (see animator-avatar-edit).
      console.warn("[GrudgeMenu] WebGL unavailable — using flat fallback", err);
      setFlat(true);
      return;
    }
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  // Mirror roster + selection into the scene.
  useEffect(() => {
    sceneRef.current?.setRoster(
      roster.map((h) => (h ? { uuid: h.uuid, baseId: h.baseId } : null)),
      roster[picked] ? picked : -1,
    );
  }, [roster, picked]);

  // ── Account scope + cloud sync (same flow as the old HeroLobby) ─────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await restoreSession();
      if (cancelled) return;
      setUser(u);
      if (!u) return;
      const s = await ensureSession(u);
      if (cancelled) return;
      setSession(s);
      setRosterUser(s ? s.userId : null);
      const synced = await syncRoster();
      if (cancelled) return;
      setRoster(synced);
      const i = synced.findIndex((h) => h !== null);
      setPicked((p) => (synced[p] ? p : i >= 0 ? i : 0));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hero = roster[picked] ?? null;

  const onSave = useCallback((rec: HeroRecord) => {
    setRoster(saveHero(rec));
    setPicked(rec.slot);
    setEdit(null);
  }, []);

  const onDelete = useCallback((slot: number) => {
    setRoster(deleteHero(slot));
    setEdit(null);
  }, []);

  const logOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      /* best-effort */
    }
    setRosterUser(null);
    onSignedOut();
  }, [onSignedOut]);

  const menu = useMemo(
    () =>
      [
        {
          id: "pve",
          label: "PvE — solo Danger Room",
          needsHero: true,
          soon: false,
          go: () => hero && onDeploy(hero),
        },
        {
          id: "pvp",
          label: "PvP — multiplayer rooms",
          needsHero: true,
          soon: false,
          go: () => hero && onLobby(hero),
        },
        {
          id: "grudge-arena",
          label: "Grudge Arena — Colosseum",
          needsHero: true,
          soon: false,
          go: () => {
            if (!hero) return;
            saveRoomPreset("colosseum");
            onDeploy(hero);
          },
        },
        { id: "leaderboard", label: "Leaderboard — coming soon", needsHero: false, soon: true, go: () => {} },
        { id: "shop", label: "Shop — coming soon", needsHero: false, soon: true, go: () => {} },
        { id: "settings", label: "Settings — coming soon", needsHero: false, soon: true, go: () => {} },
      ] as const,
    [hero, onDeploy, onLobby],
  );

  return (
    <div className="gmenu">
      <div className="gmenu-stage" ref={mountRef} />

      {/* WebGL-less fallback: plain slot cards so the roster stays usable. */}
      {flat && (
        <div className="gmenu-flat">
          {Array.from({ length: ROSTER_SLOTS }, (_, slot) => {
            const h = roster[slot];
            const on = slot === picked && !!h;
            return (
              <button
                key={slot}
                className={`hlobby-slot ${on ? "on" : ""} ${h ? "" : "empty"}`}
                onClick={() => {
                  if (h) setPicked(slot);
                  else setEdit({ slot, existing: null });
                }}
              >
                <span className="hlobby-slot-num">Slot {slot + 1}</span>
                {h ? (
                  <>
                    <span className="hlobby-slot-name">{h.name}</span>
                    <span className="hlobby-slot-form">{formName(h.baseId)}</span>
                  </>
                ) : (
                  <span className="hlobby-slot-create">+ Create character</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* "+" create markers over empty slots (positioned by the scene). */}
      {Array.from({ length: SLOT_COUNT }, (_, slot) => (
        <button
          key={slot}
          ref={(el) => {
            anchorRefs.current[slot] = el;
          }}
          className="gmenu-plus"
          style={{ display: "none" }}
          title={`Create a hero — slot ${slot + 1}`}
          onClick={() => setEdit({ slot, existing: null })}
        >
          +
        </button>
      ))}

      <div className="gmenu-head">
        <img className="gmenu-helmet" src={menuIcon("grudge-helmet")} alt="" draggable={false} />
        <img className="gmenu-logo" src={menuIcon("grudge-logo")} alt="GRUDGE" draggable={false} />
        <p className="gmenu-sub">Gather your band — choose a hero</p>
      </div>

      <div className="gmenu-account">
        {session ? (
          <>
            <span className="gmenu-gid" title={session.grudgeId}>
              {session.displayName}
            </span>
            <span className="gmenu-gbux">{session.gbuxBalance} GBUX</span>
          </>
        ) : user ? (
          <span className="gmenu-gid">{user.username}</span>
        ) : (
          <span className="gmenu-note">Heroes saved on this device only</span>
        )}
        {user && (
          <button className="gmenu-logout" onClick={logOut}>
            Log out
          </button>
        )}
      </div>

      <nav className="gmenu-nav">
        {menu.map((item) => {
          const disabled = item.soon || (item.needsHero && !hero);
          return (
            <button
              key={item.id}
              className={`gmenu-btn ${item.soon ? "soon" : ""}`}
              disabled={disabled}
              title={item.needsHero && !hero ? "Pick a hero first" : item.label}
              onClick={item.go}
            >
              <img src={menuIcon(item.id)} alt={item.label} draggable={false} />
            </button>
          );
        })}
      </nav>

      <div className="gmenu-foot">
        <div className="gmenu-pick">
          {hero ? (
            <>
              <b>{hero.name}</b>
              <span>{formName(hero.baseId)}</span>
            </>
          ) : (
            <span className="dim">No hero selected — click a hero or a + slot</span>
          )}
        </div>
        <div className="gmenu-actions">
          {hero && (
            <button className="gmenu-chip" onClick={() => setEdit({ slot: picked, existing: hero })}>
              ✎ EDIT
            </button>
          )}
          <button className="gmenu-chip" onClick={onDoors} title="All doors — the full facility">
            ⌂ SCENE
          </button>
        </div>
      </div>

      {edit && edit.slot >= 0 && edit.slot < ROSTER_SLOTS && (
        <CreatePanel
          slot={edit.slot}
          existing={edit.existing}
          onSave={onSave}
          onDelete={onDelete}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}

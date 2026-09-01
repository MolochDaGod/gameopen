/**
 * Hero Lobby — the "4 character system" landing surface, ported from the
 * standalone 4character page. Every Grudge ID account owns four hero slots;
 * heroes are named builds of a character-catalog form (baseId) and follow the
 * account across devices (Puter KV sync, see rosterStore). The lobby is shown
 * right after Grudge ID sign-in (before the doors hall) and also has its own
 * door. Picking a hero arms the deploy actions: PvP drops the hero straight
 * into the Danger Room; Doors opens the facility hall.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { assetUrl } from "../three/assetHost";
import { CHARACTERS } from "../three/assets";
import { restoreSession, type GrudgeUser } from "../auth/grudgeAuth";
import { ensureSession, type GrudgeSession } from "../auth/grudgeIdApi";
import {
  ROSTER_SLOTS,
  deleteHero,
  loadRoster,
  newHeroUuid,
  saveHero,
  setRosterUser,
  syncRoster,
  type HeroRecord,
  type Roster,
} from "../roster/rosterStore";
import "./heroLobby.css";

interface Props {
  /** Deploy the picked hero into the Danger Room (PvP sparring). */
  onDeploy: (hero: HeroRecord) => void;
  /** Open the doors hall (the rest of the facility). */
  onDoors: () => void;
}

const menuIcon = (name: string) => assetUrl(`ui/menu/${name}.png`);

function formName(baseId: string): string {
  return CHARACTERS.find((c) => c.id === baseId)?.name ?? baseId;
}

interface EditState {
  slot: number;
  existing: HeroRecord | null;
}

export function HeroLobby({ onDeploy, onDoors }: Props) {
  const [roster, setRoster] = useState<Roster>(() => loadRoster());
  const [picked, setPicked] = useState<number>(() => {
    const r = loadRoster();
    const i = r.findIndex((h) => h !== null);
    return i >= 0 ? i : 0;
  });
  const [edit, setEdit] = useState<EditState | null>(null);
  const [session, setSession] = useState<GrudgeSession | null>(null);
  const [user, setUser] = useState<GrudgeUser | null>(null);

  // Attach the account scope: restore the puter session, mint/reuse the Grudge
  // ID server session, then re-scope + cloud-sync the roster. All best-effort —
  // signed-out (or offline) users keep a device-local roster.
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

  const heroCount = useMemo(() => roster.filter((h) => h !== null).length, [roster]);

  return (
    <div className="hlobby">
      <div className="hlobby-head">
        <img className="hlobby-helmet" src={menuIcon("grudge-helmet")} alt="" draggable={false} />
        <img className="hlobby-logo" src={menuIcon("grudge-logo")} alt="GRUDGE" draggable={false} />
        <p className="hlobby-sub">Gather your band — choose a hero</p>
        <div className="hlobby-account">
          {session ? (
            <>
              <span className="hlobby-gid" title={session.grudgeId}>
                {session.displayName}
              </span>
              <span className="hlobby-gbux">{session.gbuxBalance} GBUX</span>
            </>
          ) : user ? (
            <span className="hlobby-gid">{user.username}</span>
          ) : (
            <span className="hlobby-note">Heroes saved on this device only</span>
          )}
        </div>
      </div>

      <div className="hlobby-slots">
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

      <nav className="hlobby-menu">
        <button
          className="hlobby-btn"
          disabled={!hero}
          title={hero ? "Deploy into the Danger Room — PvP & sparring" : "Pick a hero first"}
          onClick={() => hero && onDeploy(hero)}
        >
          <img src={menuIcon("pvp")} alt="PvP — Danger Room" draggable={false} />
        </button>
        <button className="hlobby-btn" title="All doors — the full facility" onClick={onDoors}>
          <img src={menuIcon("grudge-arena")} alt="Doors" draggable={false} />
        </button>
      </nav>

      <div className="hlobby-foot">
        <div className="hlobby-pick">
          {hero ? (
            <>
              <b>{hero.name}</b>
              <span>{formName(hero.baseId)}</span>
            </>
          ) : (
            <span className="dim">No hero selected — pick a slot</span>
          )}
        </div>
        <div className="hlobby-actions">
          {hero && (
            <button
              className="hlobby-edit"
              onClick={() => setEdit({ slot: picked, existing: hero })}
            >
              ✎ Edit
            </button>
          )}
          {heroCount < ROSTER_SLOTS && (
            <button
              className="hlobby-edit"
              onClick={() => {
                const slot = roster.findIndex((h) => h === null);
                if (slot >= 0) setEdit({ slot, existing: null });
              }}
            >
              + New hero
            </button>
          )}
        </div>
      </div>

      {edit && (
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

interface CreateProps {
  slot: number;
  existing: HeroRecord | null;
  onSave: (rec: HeroRecord) => void;
  onDelete: (slot: number) => void;
  onClose: () => void;
}

export function CreatePanel({ slot, existing, onSave, onDelete, onClose }: CreateProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [baseId, setBaseId] = useState(existing?.baseId ?? "explorer");

  const save = () => {
    onSave({
      uuid: existing?.uuid ?? newHeroUuid(),
      slot,
      name: name.trim() || "Adventurer",
      baseId,
      createdAt: existing?.createdAt ?? Date.now(),
    });
  };

  return (
    <div className="hlobby-create-backdrop" onClick={onClose}>
      <div className="hlobby-create" onClick={(e) => e.stopPropagation()}>
        <div className="hlobby-create-head">
          <h2>{existing ? "Edit Character" : "Create Character"}</h2>
          <p>Slot {slot + 1}</p>
          <button className="hlobby-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <label className="hlobby-field">
          <span>Name</span>
          <input
            value={name}
            maxLength={20}
            placeholder="Adventurer"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <div className="hlobby-field">
          <span>Form</span>
          <div className="hlobby-forms">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                className={`hlobby-form ${baseId === c.id ? "on" : ""}`}
                onClick={() => setBaseId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="hlobby-create-actions">
          <button className="hlobby-save" onClick={save}>
            Save Hero
          </button>
          {existing && (
            <button className="hlobby-delete" onClick={() => onDelete(slot)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

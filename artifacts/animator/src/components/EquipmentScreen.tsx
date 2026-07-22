/**
 * In-play loadout — Warlords water SPA equipment UI chrome + Three.js mesh center.
 * Layout originally patterned after water.grudge-studio.com equipment views.
 *
 * Layout (TI paperdoll):
 *   amber/stone warlord panel · armor/weapon slots · hub catalogue
 * Mesh system (Open / Danger Room stack):
 *   Character GLB + mountWeaponModel on hand bones inside the portrait cell
 */
import { useCallback, useMemo, useState } from "react";
import {
  HardHat,
  Shirt,
  Hand,
  Footprints,
  ShieldHalf,
  Sword,
  Shield,
  Gem,
  Anchor,
  Sparkles,
  Circle,
  Plus,
  X,
} from "lucide-react";
import type { WeaponGroup, WeaponId } from "../three/types";
import { WEAPONS, OFF_HAND_WEAPONS, offHandEligible } from "../three/arsenal";
import { WEAPON_ICON } from "../three/icons";
import { Icon } from "./Icon";
import { LoadoutMeshStage } from "./equip/LoadoutMeshStage";
import "./EquipmentScreen.css";

export type LoadoutRaceKey =
  | "human"
  | "barbarian"
  | "dwarf"
  | "elf"
  | "orc"
  | "undead";

interface Props {
  characterName: string;
  /** Paperdoll race → race GLB mesh id. */
  race?: LoadoutRaceKey;
  currentWeapon: WeaponId;
  currentOffHand: WeaponId | null;
  onEquip: (id: WeaponId) => void;
  onEquipOff: (id: WeaponId | null) => void;
  onClose: () => void;
}

type SlotId =
  | "helmet"
  | "chest"
  | "gloves"
  | "legs"
  | "boots"
  | "weapon"
  | "offhand"
  | "amulet"
  | "belt"
  | "cloak"
  | "ring"
  | "add";

type SlotDef = {
  id: SlotId;
  label: string;
  emoji: string;
  Icon: typeof Sword;
  col: 1 | 3;
  row: 1 | 2 | 3 | 4 | 5;
  live?: "weapon" | "offhand";
};

const LEFT_SLOTS: SlotDef[] = [
  { id: "helmet", label: "Helmet", emoji: "⛑", Icon: HardHat, col: 1, row: 1 },
  { id: "chest", label: "Chest", emoji: "🛡", Icon: Shirt, col: 1, row: 2 },
  { id: "gloves", label: "Gloves", emoji: "🧤", Icon: Hand, col: 1, row: 3 },
  { id: "legs", label: "Leggings", emoji: "🦵", Icon: ShieldHalf, col: 1, row: 4 },
  { id: "boots", label: "Boots", emoji: "👢", Icon: Footprints, col: 1, row: 5 },
];

const RIGHT_SLOTS: SlotDef[] = [
  { id: "weapon", label: "Main Hand", emoji: "⚔", Icon: Sword, col: 3, row: 1, live: "weapon" },
  { id: "offhand", label: "Off Hand", emoji: "🛡", Icon: Shield, col: 3, row: 2, live: "offhand" },
  { id: "amulet", label: "Amulet", emoji: "💎", Icon: Gem, col: 3, row: 3 },
  { id: "belt", label: "Belt", emoji: "🔗", Icon: Anchor, col: 3, row: 4 },
  { id: "cloak", label: "Cloak", emoji: "🧥", Icon: Sparkles, col: 3, row: 5 },
];

const GROUP_ORDER: { id: WeaponGroup; label: string }[] = [
  { id: "melee-1h", label: "One-Handed" },
  { id: "melee-2h", label: "Two-Handed" },
  { id: "ranged", label: "Ranged" },
  { id: "magic", label: "Magic" },
  { id: "unarmed", label: "Unarmed" },
];

const RACE_LABEL: Record<LoadoutRaceKey, string> = {
  human: "HUMAN",
  barbarian: "BARBARIAN",
  dwarf: "DWARF",
  elf: "ELF",
  orc: "ORC",
  undead: "UNDEAD",
};

const PANEL_W = 420;

export function EquipmentScreen({
  characterName,
  race = "human",
  currentWeapon,
  currentOffHand,
  onEquip,
  onEquipOff,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [lastAction, setLastAction] = useState("");

  const active = WEAPONS.find((w) => w.id === currentWeapon);
  const activeOff = currentOffHand ? WEAPONS.find((w) => w.id === currentOffHand) : null;
  const offEligible = offHandEligible(currentWeapon);

  const mainWeapons = useMemo(
    () => WEAPONS.filter((w) => (w.group ?? "unarmed") !== "off-hand"),
    [],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GROUP_ORDER.map(({ id, label }) => ({
      id,
      label,
      items: WEAPONS.filter(
        (w) => (w.group ?? "unarmed") === id && (!q || w.label.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const totalShown = groups.reduce((n, g) => n + g.items.length, 0);

  const SLOT_PX = Math.round(Math.max(48, Math.min(72, PANEL_W * 0.16)));
  const GAP_PX = Math.round(SLOT_PX * 0.18);
  const PAD_PX = Math.round(SLOT_PX * 0.22);

  /** Cycle main-hand arsenal (TI equipment click-to-cycle). */
  const cycleWeapon = useCallback(() => {
    const idx = mainWeapons.findIndex((w) => w.id === currentWeapon);
    const next = mainWeapons[(idx + 1) % mainWeapons.length];
    if (next) {
      onEquip(next.id);
      setLastAction(`Equipped ${next.label} (main hand)`);
    }
  }, [mainWeapons, currentWeapon, onEquip]);

  const cycleOffHand = useCallback(() => {
    if (!offEligible) {
      setLastAction("Off-hand locked — use a one-handed main");
      return;
    }
    const opts: Array<WeaponId | null> = [null, ...OFF_HAND_WEAPONS.map((w) => w.id)];
    const idx = opts.findIndex((id) => id === currentOffHand);
    const next = opts[(idx + 1) % opts.length] ?? null;
    onEquipOff(next);
    if (next) {
      const w = WEAPONS.find((x) => x.id === next);
      setLastAction(`Equipped ${w?.label ?? next} (off-hand)`);
    } else {
      setLastAction("Unequipped off-hand");
    }
  }, [offEligible, currentOffHand, onEquipOff]);

  const onSlotClick = (id: SlotId) => {
    if (id === "weapon") {
      cycleWeapon();
      return;
    }
    if (id === "offhand") {
      cycleOffHand();
      return;
    }
    if (id === "add") {
      setLastAction("Open catalogue on the right to pick weapons");
      return;
    }
    setLastAction(`${id} — modular armor soon (TI paperdoll parity)`);
  };

  const applyStarter = () => {
    onEquip("sword");
    onEquipOff(null);
    setLastAction("Applied Starter preset (sword)");
  };
  const applyVeteran = () => {
    const twoH = WEAPONS.find((w) => w.group === "melee-2h") ?? WEAPONS.find((w) => w.id === "sword");
    if (twoH) onEquip(twoH.id);
    onEquipOff(null);
    setLastAction(twoH ? `Applied Veteran preset (${twoH.label})` : "Veteran preset unavailable");
  };
  const clearLoadout = () => {
    onEquip("none");
    onEquipOff(null);
    setLastAction("Cleared loadout");
  };

  const renderSlot = (slot: SlotDef) => {
    const isWeapon = slot.live === "weapon";
    const isOff = slot.live === "offhand";
    const filled = isWeapon
      ? currentWeapon !== "none"
      : isOff
        ? !!currentOffHand
        : false;
    const label = isWeapon
      ? active?.label ?? slot.label
      : isOff
        ? activeOff?.label ?? slot.label
        : slot.label;
    const IconCmp = slot.Icon;
    const disabled = isOff && !offEligible;

    return (
      <button
        key={slot.id}
        type="button"
        className={[
          "eq-slot",
          filled ? "on" : "",
          filled && isWeapon ? "eq-rarity-rare" : "",
          filled && isOff ? "eq-rarity-uncommon" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ gridColumn: slot.col, gridRow: slot.row }}
        title={
          disabled
            ? "Off-hand unavailable for this main weapon"
            : filled
              ? `${label} — click to cycle`
              : `${slot.label} — click to equip`
        }
        disabled={disabled}
        onClick={() => onSlotClick(slot.id)}
      >
        {isWeapon && filled ? (
          <Icon name={WEAPON_ICON[currentWeapon]} size={28} className="eq-slot-icon" />
        ) : isOff && activeOff ? (
          <Icon name={WEAPON_ICON[activeOff.id]} size={28} className="eq-slot-icon" />
        ) : (
          <IconCmp className="eq-slot-icon" strokeWidth={1.4} />
        )}
      </button>
    );
  };

  return (
    <div className="eq-screen" role="dialog" aria-label="Equipment loadout">
      <button className="eq-backdrop" aria-label="Close loadout" onClick={onClose} />

      {/* Hero banner — TI EquipmentDemo */}
      <header className="eq-banner">
        <div>
          <p className="eq-banner-kicker">Equipment</p>
          <h1 className="eq-banner-title">GRUDGE WARLORD LOADOUT</h1>
          <p className="eq-banner-sub">
            {characterName} · Three.js mesh preview · click slots to cycle · <kbd>Esc</kbd> close
          </p>
        </div>
        <div className="eq-banner-actions">
          <div className="eq-preset-group">
            <button type="button" className="eq-btn" onClick={applyStarter}>
              Starter
            </button>
            <button type="button" className="eq-btn" onClick={applyVeteran}>
              Veteran
            </button>
            <button type="button" className="eq-btn" onClick={clearLoadout}>
              Clear
            </button>
          </div>
          <button type="button" className="eq-btn eq-btn-close" onClick={onClose} aria-label="Close">
            <X size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Close
          </button>
        </div>
      </header>

      <div className="eq-body" onClick={(e) => e.stopPropagation()}>
        {/* Paperdoll — TI EquipmentPanel */}
        <div className="eq-doll" style={{ width: PANEL_W }}>
          <div className="eq-doll-title-wrap">
            <h2 className="eq-doll-title">GRUDGE WARLORD</h2>
          </div>
          <div className="eq-doll-race-wrap">
            <h3 className="eq-doll-race">{RACE_LABEL[race]}</h3>
          </div>

          <div
            className="eq-doll-grid"
            style={{
              gridTemplateColumns: `${SLOT_PX}px 1fr ${SLOT_PX}px`,
              gridTemplateRows: `repeat(5, ${SLOT_PX}px) ${SLOT_PX}px`,
              columnGap: GAP_PX,
              rowGap: GAP_PX,
              padding: PAD_PX,
            }}
          >
            {/* Center: Three.js Character + weapon hand mounts (mesh system) */}
            <div className="eq-portrait eq-portrait-mesh">
              <LoadoutMeshStage
                race={race}
                weaponId={currentWeapon}
                offHandId={currentOffHand}
              />
              <div className="eq-portrait-vignette" />
            </div>

            {LEFT_SLOTS.map(renderSlot)}
            {RIGHT_SLOTS.map(renderSlot)}

            <button
              type="button"
              className="eq-slot"
              style={{ gridColumn: 1, gridRow: 6 }}
              title="Ring"
              onClick={() => onSlotClick("ring")}
            >
              <Circle className="eq-slot-icon" strokeWidth={1.6} />
            </button>
            <div className="eq-slot-divider">
              <div className="eq-slot-divider-line" />
            </div>
            <button
              type="button"
              className="eq-slot eq-slot-add"
              style={{ gridColumn: 3, gridRow: 6 }}
              title="Add item"
              onClick={() => onSlotClick("add")}
            >
              <Plus size={28} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Catalogue side — live weapon equip */}
        <div className="eq-side">
          <div className="eq-status">
            <p className="eq-status-kicker">GEAR SYSTEM</p>
            <p>
              Main hand: <strong>{active?.label ?? "Unarmed"}</strong>
              {activeOff ? (
                <>
                  {" "}
                  · Off: <strong>{activeOff.label}</strong>
                </>
              ) : null}
            </p>
            <p style={{ marginTop: 6 }}>
              UI chrome from Warlords water equipment patterns (
              <strong>water.grudge-studio.com</strong>). Center stage is a{" "}
              <strong>Three.js</strong> race mesh with live hand-mounted weapons (same{" "}
              <code>Character</code> + <code>mountWeaponModel</code> stack as Danger Room).
            </p>
            <div className="eq-status-action">{lastAction}</div>
          </div>

          <div className="eq-search">
            <input
              type="search"
              placeholder="Search weapons…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <span className="eq-count">{totalShown}</span>
          </div>

          <div className="eq-catalogue">
            {OFF_HAND_WEAPONS.length > 0 && (
              <section className="eq-group">
                <h3 className="eq-group-head">
                  Off-Hand <span>{OFF_HAND_WEAPONS.length}</span>
                </h3>
                {!offEligible && (
                  <p className="eq-offhand-note">
                    Equip a single one-handed weapon (or unarmed) to use an off-hand.
                  </p>
                )}
                <div className="eq-grid">
                  <button
                    type="button"
                    className={`eq-card ${!currentOffHand ? "on" : ""}`}
                    onClick={() => {
                      onEquipOff(null);
                      setLastAction("Unequipped off-hand");
                    }}
                    disabled={!offEligible}
                  >
                    <Icon name={WEAPON_ICON.none} size={28} className="eq-card-icon" />
                    <span className="eq-card-name">None</span>
                    {!currentOffHand && <span className="eq-card-badge">On</span>}
                  </button>
                  {OFF_HAND_WEAPONS.map((w) => {
                    const on = w.id === currentOffHand;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`eq-card ${on ? "on" : ""}`}
                        disabled={!offEligible}
                        onClick={() => {
                          onEquipOff(w.id);
                          setLastAction(`Equipped ${w.label}`);
                        }}
                      >
                        <Icon name={WEAPON_ICON[w.id]} size={28} className="eq-card-icon" />
                        <span className="eq-card-name">{w.label}</span>
                        {on && <span className="eq-card-badge">On</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {groups.map((g) => (
              <section className="eq-group" key={g.id}>
                <h3 className="eq-group-head">
                  {g.label} <span>{g.items.length}</span>
                </h3>
                <div className="eq-grid">
                  {g.items.map((w) => {
                    const on = w.id === currentWeapon;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`eq-card ${on ? "on" : ""}`}
                        title={`${w.label} · ${w.animSet}`}
                        onClick={() => {
                          onEquip(w.id);
                          setLastAction(`Equipped ${w.label}`);
                        }}
                      >
                        <Icon name={WEAPON_ICON[w.id]} size={28} className="eq-card-icon" />
                        <span className="eq-card-name">{w.label}</span>
                        {on && <span className="eq-card-badge">On</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            {groups.length === 0 && <p className="eq-empty">No weapons match “{query}”.</p>}
          </div>

          <footer className="eq-foot">
            Click paperdoll slots to cycle · catalogue equips live · <kbd>I</kbd> toggle ·{" "}
            <kbd>Esc</kbd> close
          </footer>
        </div>
      </div>
    </div>
  );
}

/** Map fleet / grudge race strings onto TI paperdoll race keys. */
export function loadoutRaceFromFleet(raceId?: string | null): LoadoutRaceKey {
  const r = (raceId || "").toLowerCase().replace(/[_-]/g, "");
  if (r.includes("barb")) return "barbarian";
  if (r.includes("dwarf")) return "dwarf";
  if (r.includes("elf")) return "elf";
  if (r.includes("orc")) return "orc";
  if (r.includes("undead") || r === "ud") return "undead";
  if (r.includes("human") || r.includes("kingdom") || r.includes("wk") || r.includes("western"))
    return "human";
  return "human";
}

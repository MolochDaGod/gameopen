import { useCallback, useMemo, useState } from "react";
import type { WeaponGroup, WeaponId } from "../three/types";
import { WEAPONS, OFF_HAND_WEAPONS, offHandEligible } from "../three/arsenal";
import { WEAPON_ICON } from "../three/icons";
import { Icon } from "./Icon";
import { AttachmentSlotCards } from "./equip/AttachmentSlotCards";
import { PLAYER_SLOT_ANCHORS, type AttachmentSlotDef } from "./equip/attachmentCardModel";
import "./EquipmentScreen.css";

interface Props {
  /** Display name of the character whose loadout we're editing. */
  characterName: string;
  /** Currently equipped weapon id (drives the highlighted card + Main Hand slot). */
  currentWeapon: WeaponId;
  /** Currently equipped off-hand piece id, or null when the off hand is empty. */
  currentOffHand: WeaponId | null;
  /** Equip a weapon live (mirrors the real combat equip path via studio.setWeapon). */
  onEquip: (id: WeaponId) => void;
  /** Equip / clear the independent off-hand piece (studio.setOffHand). */
  onEquipOff: (id: WeaponId | null) => void;
  /** Close the overlay. */
  onClose: () => void;
}

/**
 * Display order + headings for the weapon families surfaced in the loadout grid.
 * The off-hand family is intentionally NOT here — off-hand pieces live in their
 * own slot picker (they mount alongside a main weapon, not as a main weapon).
 */
const GROUP_ORDER: { id: WeaponGroup; label: string }[] = [
  { id: "melee-1h", label: "One-Handed" },
  { id: "melee-2h", label: "Two-Handed" },
  { id: "ranged", label: "Ranged" },
  { id: "magic", label: "Magic" },
  { id: "unarmed", label: "Unarmed" },
];

/**
 * Future modular equipment slots. Main Hand + Off-Hand are wired to the live
 * combat equip path; the rest are intentional teasers that frame this overlay as
 * the foundation for a full modular loadout system.
 */
const TEASER_SLOTS = ["Armor", "Trinket"] as const;

/**
 * In-play loadout overlay — swap the active weapon live, mid-session, instead of
 * having to back out to the Dressing Room. Presentational: it consumes the
 * existing arsenal catalog + engine equip callback so it stays additive to the
 * weapon data model. The Off-Hand slot (Tower Shield) is gated to single
 * one-handed / unarmed mains that aren't already dual-wielding.
 */
export function EquipmentScreen({
  characterName,
  currentWeapon,
  currentOffHand,
  onEquip,
  onEquipOff,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");

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

  const active = WEAPONS.find((w) => w.id === currentWeapon);
  const activeOff = currentOffHand ? WEAPONS.find((w) => w.id === currentOffHand) : null;
  const offEligible = offHandEligible(currentWeapon);
  const totalShown = groups.reduce((n, g) => n + g.items.length, 0);

  /**
   * Viewport attachment cards — same outline as three-js-basic-character-customisation:
   * slot hotspot → option strip → apply → live equip (draw/rebuild).
   */
  const attachmentSlots: AttachmentSlotDef[] = useMemo(() => {
    const mains = WEAPONS.filter((w) => (w.group ?? "unarmed") !== "unarmed" || w.id === "none").slice(
      0,
      12,
    );
    return [
      {
        id: "weapon",
        label: "Main Hand",
        anchor: PLAYER_SLOT_ANCHORS.weapon,
        equippedId: currentWeapon,
        emptyLabel: "Weapon",
        options: mains.map((w) => ({
          id: w.id,
          label: w.label,
          icon: "⚔",
          tone: w.id === currentWeapon ? "#7ee0a0" : undefined,
        })),
      },
      {
        id: "offhand",
        label: "Off-Hand",
        anchor: PLAYER_SLOT_ANCHORS.offhand,
        equippedId: currentOffHand,
        emptyLabel: "Off",
        options: [
          ...OFF_HAND_WEAPONS.map((w) => ({
            id: w.id,
            label: w.label,
            icon: "🛡",
            disabled: !offEligible,
            tone: w.id === currentOffHand ? "#7ee0a0" : undefined,
          })),
        ],
      },
      {
        id: "legs",
        label: "Legs",
        anchor: PLAYER_SLOT_ANCHORS.legs,
        equippedId: null,
        emptyLabel: "Legs",
        options: [
          { id: "boots", label: "Boots", icon: "👢", disabled: true },
          { id: "greaves", label: "Greaves", icon: "🦿", disabled: true },
        ],
      },
    ];
  }, [currentWeapon, currentOffHand, offEligible]);

  const onAttachmentApply = useCallback(
    (slotId: string, optionId: string | null) => {
      if (slotId === "weapon" && optionId) onEquip(optionId as WeaponId);
      if (slotId === "offhand") onEquipOff(optionId as WeaponId | null);
      // legs/armor teasers — no engine path yet
    },
    [onEquip, onEquipOff],
  );

  return (
    <div className="eq-screen" role="dialog" aria-label="Equipment loadout">
      <button className="eq-backdrop" aria-label="Close loadout" onClick={onClose} />

      <div className="eq-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="eq-head">
          <div className="eq-title">
            <span className="eq-title-main">LOADOUT</span>
            <span className="eq-title-sub">{characterName}</span>
          </div>
          <button className="eq-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {/* Character container — attachment cards over a figure preview (CodePen outline) */}
        <div className="eq-figure" aria-label="Equipment attachment cards">
          <div className="eq-figure-silhouette" aria-hidden />
          <AttachmentSlotCards
            kind="player"
            slots={attachmentSlots}
            onApply={onAttachmentApply}
            showLabels
          />
          <p className="eq-figure-tip">Tap ＋ on the body to swap gear — same pattern as character customisation</p>
        </div>

        {/* Modular slot strip — Main Hand + Off-Hand are live, the rest are upcoming. */}
        <div className="eq-slots">
          <div className="eq-slot eq-slot-active">
            <span className="eq-slot-label">Main Hand</span>
            <div className="eq-slot-body">
              <Icon name={WEAPON_ICON[currentWeapon]} size={30} className="eq-slot-icon" />
              <div className="eq-slot-meta">
                <span className="eq-slot-name">{active?.label ?? "Unarmed"}</span>
                <span className="eq-slot-tag">{active?.animSet ?? "unarmed"}</span>
              </div>
            </div>
          </div>

          <div
            className={`eq-slot ${activeOff ? "eq-slot-active" : ""} ${offEligible ? "" : "eq-slot-disabled"}`}
            title={offEligible ? "Off-hand piece" : "Off-hand unavailable while dual-wielding / two-handed"}
          >
            <span className="eq-slot-label">Off-Hand</span>
            <div className="eq-slot-body">
              {activeOff ? (
                <>
                  <Icon name={WEAPON_ICON[activeOff.id]} size={30} className="eq-slot-icon" />
                  <div className="eq-slot-meta">
                    <span className="eq-slot-name">{activeOff.label}</span>
                    <button className="eq-slot-clear" onClick={() => onEquipOff(null)}>
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="eq-slot-empty">＋</span>
                  <span className="eq-slot-soon">{offEligible ? "Empty" : "N/A"}</span>
                </>
              )}
            </div>
          </div>

          {TEASER_SLOTS.map((s) => (
            <div className="eq-slot eq-slot-locked" key={s} title="Modular slot — coming soon">
              <span className="eq-slot-label">{s}</span>
              <div className="eq-slot-body">
                <span className="eq-slot-empty">＋</span>
                <span className="eq-slot-soon">Soon</span>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="eq-search">
          <input
            type="text"
            placeholder="Search weapons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <span className="eq-count">{totalShown}</span>
        </div>

        {/* Grouped weapon grid */}
        <div className="eq-grid-scroll">
          {/* Off-hand picker — None + each off-hand piece, gated by main eligibility. */}
          {OFF_HAND_WEAPONS.length > 0 && (
            <section className="eq-group">
              <h3 className="eq-group-head">
                Off-Hand <span>{OFF_HAND_WEAPONS.length}</span>
              </h3>
              {!offEligible && (
                <p className="eq-offhand-note">
                  Equip a single one-handed weapon (or unarmed) to use an off-hand — dual-wielding
                  and two-handed kits already occupy that hand.
                </p>
              )}
              <div className="eq-grid">
                <button
                  className={`eq-card ${!currentOffHand ? "on" : ""}`}
                  onClick={() => onEquipOff(null)}
                  disabled={!offEligible}
                  title="No off-hand"
                >
                  <Icon name={WEAPON_ICON["none"]} size={28} className="eq-card-icon" />
                  <span className="eq-card-name">None</span>
                  {!currentOffHand && <span className="eq-card-badge">Equipped</span>}
                </button>
                {OFF_HAND_WEAPONS.map((w) => {
                  const on = w.id === currentOffHand;
                  return (
                    <button
                      key={w.id}
                      className={`eq-card ${on ? "on" : ""}`}
                      onClick={() => onEquipOff(w.id)}
                      disabled={!offEligible}
                      title={`${w.label} · off-hand`}
                    >
                      <Icon name={WEAPON_ICON[w.id]} size={28} className="eq-card-icon" />
                      <span className="eq-card-name">{w.label}</span>
                      {on && <span className="eq-card-badge">Equipped</span>}
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
                      className={`eq-card ${on ? "on" : ""}`}
                      onClick={() => onEquip(w.id)}
                      title={`${w.label} · ${w.animSet}`}
                    >
                      <Icon name={WEAPON_ICON[w.id]} size={28} className="eq-card-icon" />
                      <span className="eq-card-name">{w.label}</span>
                      {on && <span className="eq-card-badge">Equipped</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {groups.length === 0 && <p className="eq-empty">No weapons match “{query}”.</p>}
        </div>

        {/* Footer hint */}
        <footer className="eq-foot">
          <span>
            Click to equip live · <kbd>I</kbd> toggle · <kbd>Esc</kbd> close
          </span>
        </footer>
      </div>
    </div>
  );
}

/**
 * Canonical account-hub paperdoll — Warlords water equipment layout
 * (water.grudge-studio.com patterns; not tactical-infinity.vercel.app).
 * Amber/stone warlord chrome · race portrait images · 12 gear slots · icons.
 *
 * Reference layout: water SPA EquipmentPanel (source tree may still be named Tactical-Infinity).
 * Production host: https://water.grudge-studio.com only.
 */
import { useState, type CSSProperties } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { assetCandidates } from "../../three/assets";
import { Icon as RpgIcon } from "../Icon";
import "./AccountPaperdoll.css";

export type PaperRaceKey =
  | "human"
  | "orc"
  | "elf"
  | "dwarf"
  | "barbarian"
  | "undead";

export type PaperSlotId =
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
  id: PaperSlotId;
  label: string;
  Icon: LucideIcon;
  col: 1 | 3;
  row: 1 | 2 | 3 | 4 | 5;
};

const LEFT: SlotDef[] = [
  { id: "helmet", label: "Helmet", Icon: HardHat, col: 1, row: 1 },
  { id: "chest", label: "Chest", Icon: Shirt, col: 1, row: 2 },
  { id: "gloves", label: "Gloves", Icon: Hand, col: 1, row: 3 },
  { id: "legs", label: "Leggings", Icon: ShieldHalf, col: 1, row: 4 },
  { id: "boots", label: "Boots", Icon: Footprints, col: 1, row: 5 },
];

const RIGHT: SlotDef[] = [
  { id: "weapon", label: "Main Hand", Icon: Sword, col: 3, row: 1 },
  { id: "offhand", label: "Off Hand", Icon: Shield, col: 3, row: 2 },
  { id: "amulet", label: "Amulet", Icon: Gem, col: 3, row: 3 },
  { id: "belt", label: "Belt", Icon: Anchor, col: 3, row: 4 },
  { id: "cloak", label: "Cloak", Icon: Sparkles, col: 3, row: 5 },
];

/** Logical race portrait paths under public/races/ (TI equipment pack). */
export const RACE_PORTRAIT_PATH: Record<PaperRaceKey, string> = {
  human: "races/human.png",
  orc: "races/orc.png",
  elf: "races/elf.png",
  dwarf: "races/dwarf.png",
  barbarian: "races/barbarian.png",
  undead: "races/undead.png",
};

/** Primary URL for a race portrait (same-origin first). */
export function racePortraitUrl(race: PaperRaceKey): string {
  const cands = assetCandidates(RACE_PORTRAIT_PATH[race]);
  return cands[0] ?? `/${RACE_PORTRAIT_PATH[race]}`;
}

/** @deprecated use racePortraitUrl — kept for callers expecting a static map */
export const RACE_PORTRAIT: Record<PaperRaceKey, string> = {
  human: racePortraitUrl("human"),
  orc: racePortraitUrl("orc"),
  elf: racePortraitUrl("elf"),
  dwarf: racePortraitUrl("dwarf"),
  barbarian: racePortraitUrl("barbarian"),
  undead: racePortraitUrl("undead"),
};

/** <img> with fleet multi-host fallback so missing same-origin still resolves. */
function ResilientImg({
  path,
  alt,
  className,
  style,
}: {
  path: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  const cands = assetCandidates(path);
  const [idx, setIdx] = useState(0);
  const src = cands[Math.min(idx, cands.length - 1)] ?? path;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => {
        setIdx((i) => (i + 1 < cands.length ? i + 1 : i));
      }}
    />
  );
}

export const RACE_DISPLAY: Record<
  PaperRaceKey,
  { name: string; blurb: string; color: string; catalogId: string }
> = {
  human: {
    name: "Human",
    blurb: "Western Kingdoms — balanced freelancers.",
    color: "#6ea8ff",
    catalogId: "race-human",
  },
  orc: {
    name: "Orc",
    blurb: "Green tide — raw power, short temper.",
    color: "#5fd48a",
    catalogId: "race-orc",
  },
  elf: {
    name: "High Elf",
    blurb: "Arcane long-lived — glass and lightning.",
    color: "#b8e0ff",
    catalogId: "race-high-elf",
  },
  dwarf: {
    name: "Dwarf",
    blurb: "Mountain forge — stout and stubborn.",
    color: "#e0a060",
    catalogId: "race-dwarf",
  },
  barbarian: {
    name: "Barbarian",
    blurb: "Steppe fury — speed and rage.",
    color: "#ff8a5c",
    catalogId: "race-barbarian",
  },
  undead: {
    name: "Undead",
    blurb: "Risen legion — cold magic, no fear.",
    color: "#a090c0",
    catalogId: "race-undead",
  },
};

export function catalogIdToPaperRace(catalogId: string): PaperRaceKey {
  const k = catalogId.replace(/^race-/, "").toLowerCase().replace(/_/g, "-");
  if (k.includes("orc")) return "orc";
  if (k.includes("undead")) return "undead";
  if (k.includes("barb")) return "barbarian";
  if (k.includes("dwarf")) return "dwarf";
  if (k.includes("elf")) return "elf";
  return "human";
}

export type PaperEquipped = Partial<
  Record<PaperSlotId, { name?: string; iconName?: string; iconUrl?: string }>
>;

export interface AccountPaperdollProps {
  race: PaperRaceKey;
  title?: string;
  equipped?: PaperEquipped;
  width?: number;
  onSlotClick?: (id: PaperSlotId) => void;
  heroName?: string;
}

function SlotCell({
  slot,
  item,
  onClick,
}: {
  slot: SlotDef;
  item?: PaperEquipped[PaperSlotId];
  onClick?: (id: PaperSlotId) => void;
}) {
  const Icon = slot.Icon;
  return (
    <button
      type="button"
      className="ap-slot"
      style={{ gridColumn: slot.col, gridRow: slot.row }}
      title={item?.name ?? slot.label}
      onClick={() => onClick?.(slot.id)}
    >
      {item?.iconUrl ? (
        <img src={item.iconUrl} alt="" className="ap-slot-img" draggable={false} />
      ) : item?.iconName ? (
        <RpgIcon name={item.iconName} size={28} className="ap-slot-icon-img" />
      ) : (
        <Icon className="ap-slot-lucide" strokeWidth={1.4} aria-hidden />
      )}
      <span className="ap-slot-label">{item?.name ?? slot.label}</span>
    </button>
  );
}

export function AccountPaperdoll({
  race,
  title = "GRUDGE WARLORD",
  equipped = {},
  width = 420,
  onSlotClick,
  heroName,
}: AccountPaperdollProps) {
  const SLOT = Math.round(Math.max(48, Math.min(72, width * 0.16)));
  const GAP = Math.round(SLOT * 0.18);
  const PAD = Math.round(SLOT * 0.22);
  const meta = RACE_DISPLAY[race];
  const portraitPath = RACE_PORTRAIT_PATH[race];

  return (
    <div className="ap-doll" style={{ width }}>
      <div className="ap-doll-title-wrap">
        <h2 className="ap-doll-title">{title}</h2>
      </div>
      <div className="ap-doll-race-wrap">
        <div className="ap-doll-race">
          {heroName ? `${heroName.toUpperCase()} · ` : ""}
          {meta.name.toUpperCase()}
        </div>
      </div>

      <div
        className="ap-doll-grid"
        style={{
          gridTemplateColumns: `${SLOT}px 1fr ${SLOT}px`,
          gridTemplateRows: `repeat(5, ${SLOT}px) ${SLOT}px`,
          gap: GAP,
          padding: PAD,
        }}
      >
        {LEFT.map((s) => (
          <SlotCell key={s.id} slot={s} item={equipped[s.id]} onClick={onSlotClick} />
        ))}

        <div className="ap-portrait" style={{ gridColumn: 2, gridRow: "1 / 6" }}>
          <ResilientImg
            path={portraitPath}
            alt={meta.name}
            className="ap-portrait-img"
          />
          <div className="ap-portrait-vignette" />
          <div className="ap-portrait-caption">{meta.name}</div>
        </div>

        {RIGHT.map((s) => (
          <SlotCell key={s.id} slot={s} item={equipped[s.id]} onClick={onSlotClick} />
        ))}

        <button
          type="button"
          className="ap-slot"
          style={{ gridColumn: 1, gridRow: 6 }}
          title={equipped.ring?.name ?? "Ring"}
          onClick={() => onSlotClick?.("ring")}
        >
          {equipped.ring?.iconUrl ? (
            <img src={equipped.ring.iconUrl} alt="" className="ap-slot-img" draggable={false} />
          ) : (
            <Circle className="ap-slot-lucide" strokeWidth={1.6} aria-hidden />
          )}
          <span className="ap-slot-label">{equipped.ring?.name ?? "Ring"}</span>
        </button>

        <button
          type="button"
          className="ap-slot ap-slot-add"
          style={{ gridColumn: 3, gridRow: 6 }}
          title="Add item"
          onClick={() => onSlotClick?.("add")}
        >
          <Plus className="ap-slot-lucide ap-slot-plus" strokeWidth={2.2} aria-hidden />
          <span className="ap-slot-label">Add</span>
        </button>
      </div>
    </div>
  );
}

/** Race picker cards with portrait images (TI equipment demo). */
export function RacePortraitGrid({
  selected,
  onSelect,
}: {
  selected: PaperRaceKey;
  onSelect: (race: PaperRaceKey) => void;
}) {
  const races = Object.keys(RACE_DISPLAY) as PaperRaceKey[];
  return (
    <div className="ap-race-grid">
      {races.map((key) => {
        const meta = RACE_DISPLAY[key];
        const active = selected === key;
        return (
          <button
            key={key}
            type="button"
            className={`ap-race-card${active ? " is-active" : ""}`}
            style={{ ["--race-tone" as string]: meta.color } as CSSProperties}
            onClick={() => onSelect(key)}
          >
            <div className="ap-race-thumb-wrap">
              <ResilientImg
                path={RACE_PORTRAIT_PATH[key]}
                alt={meta.name}
                className="ap-race-thumb"
              />
            </div>
            <div className="ap-race-meta">
              <div className="ap-race-name">{meta.name}</div>
              <div className="ap-race-blurb">{meta.blurb}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

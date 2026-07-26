/**
 * HUD Tight bottom bar — threejs-rapier / HUD.psd production chrome.
 *
 * Geometry measured off hud-tight-bar.png (3800×726): HP orb left, stamina
 * orb right, two 3×2 quick grids, avatar arch center. Used as the default
 * combat HUD on Open play / Danger Room.
 */
import type { CSSProperties, ReactNode } from "react";
import type { HudSnapshot, SlotBinding } from "../../three/types";
import { WEAPON_ICON } from "../../three/icons";
import { resolveSlotIconUrl, resolveSlotLocalName } from "../../three/skillIcons";
import { Icon } from "../Icon";
import { HUD_ART } from "../../lib/mmoUi";
import {
  QUICK_ACTIONS,
  QUICK_SLOTS_PER_SIDE,
  defaultQuickSlots,
  type QuickActionId,
  type QuickSlots,
} from "../../hud/quickActions";
import type { HudPanelBinding } from "../../hud/useHudEditor";

const TB_W = 3800;
const TB_H = 726;
const tbX = (px: number) => `${((px / TB_W) * 100).toFixed(3)}%`;
const tbY = (px: number) => `${((px / TB_H) * 100).toFixed(3)}%`;

const TB_CELL_W = 230;
const TB_CELL_H = 132;
const TB_COLS = [776, 1028, 1274, 2276, 2526, 2772];
const TB_ROWS = [378, 548];
const TB_ORB_R = 150;
const TB_ORB_HP = { cx: 354, cy: 360 };
const TB_ORB_MP = { cx: 3446, cy: 360 };

function tbSlotStyle(i: number): CSSProperties {
  const grid = i < QUICK_SLOTS_PER_SIDE ? 0 : 1;
  const j = i % QUICK_SLOTS_PER_SIDE;
  const col = grid * 3 + (j % 3);
  const row = Math.floor(j / 3);
  return {
    left: tbX(TB_COLS[col]),
    top: tbY(TB_ROWS[row]),
    width: tbX(TB_CELL_W),
    height: tbY(TB_CELL_H),
  };
}

function tbOrbStyle(orb: { cx: number; cy: number }): CSSProperties {
  return {
    left: tbX(orb.cx - TB_ORB_R),
    top: tbY(orb.cy - TB_ORB_R),
    width: tbX(TB_ORB_R * 2),
    height: tbY(TB_ORB_R * 2),
  };
}

function TightOrb({
  kind,
  value,
  max,
}: {
  kind: "hp" | "mp";
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const label = kind === "hp" ? "Health" : "Stamina";
  return (
    <div
      className={`tb-orb tb-orb-${kind}`}
      style={tbOrbStyle(kind === "hp" ? TB_ORB_HP : TB_ORB_MP)}
      title={`${label} — ${Math.round(value)}/${Math.round(max)}`}
    >
      <div className="tb-orb-drain" style={{ height: `${100 - pct}%` }} />
      <span className="tb-orb-val">{Math.round(value)}</span>
    </div>
  );
}

function resolveQuickAction(
  id: QuickActionId,
  hud: HudSnapshot,
  slotByName: (slot: string) => SlotBinding | undefined,
): { keyLabel: string; name: string; icon: string; iconUrl?: string; cd: number; cdMax: number; accent: boolean } {
  const def = QUICK_ACTIONS[id];
  switch (id) {
    case "primary": {
      const s = slotByName("primary");
      return {
        keyLabel: s?.key ?? def.key,
        name: s?.label ?? def.label,
        icon: s?.icon || resolveSlotLocalName("primary", hud.weapon),
        iconUrl: s?.iconUrl || resolveSlotIconUrl("primary", hud.weapon),
        cd: 0,
        cdMax: 0,
        accent: false,
      };
    }
    case "fskill": {
      const s = slotByName("fskill");
      return {
        keyLabel: s?.key ?? def.key,
        name: hud.skillName || s?.label || def.label,
        icon: s?.icon || resolveSlotLocalName("fskill", hud.weapon),
        iconUrl: s?.iconUrl || resolveSlotIconUrl("fskill", hud.weapon),
        cd: hud.skillCooldown,
        cdMax: hud.skillCooldownMax,
        accent: false,
      };
    }
    case "sig1":
    case "sig2":
    case "sig3":
    case "sig4": {
      const i = Number(id.slice(3)) - 1;
      const s = slotByName(id);
      const sigCdMax = hud.sigCooldownMaxes[i] ?? 0;
      return {
        keyLabel: s?.key ?? def.key,
        name: s?.label ?? def.label,
        icon:
          s?.icon ||
          resolveSlotLocalName(`sig${i + 1}` as "sig1" | "sig2" | "sig3" | "sig4", hud.weapon),
        iconUrl:
          s?.iconUrl ||
          resolveSlotIconUrl(`sig${i + 1}` as "sig1" | "sig2" | "sig3" | "sig4", hud.weapon),
        cd: sigCdMax > 0 ? (hud.sigCooldowns[i] ?? 0) : hud.skillCooldown,
        cdMax: sigCdMax > 0 ? sigCdMax : hud.skillCooldownMax,
        accent: false,
      };
    }
    case "heavy":
      return {
        keyLabel: def.key,
        name: def.label,
        icon: resolveSlotLocalName("heavy", hud.weapon),
        iconUrl: resolveSlotIconUrl("heavy", hud.weapon),
        cd: hud.skyfallCooldown,
        cdMax: hud.skyfallCooldownMax,
        accent: true,
      };
    default:
      return {
        keyLabel: def.key,
        name: def.label,
        icon: def.icon,
        cd: 0,
        cdMax: 0,
        accent: false,
      };
  }
}

function applyBind(
  b: HudPanelBinding | undefined,
  baseClass: string,
  baseStyle?: CSSProperties,
) {
  if (!b) return { className: baseClass, style: baseStyle };
  return {
    "data-hud-panel": b["data-hud-panel"],
    className: `${baseClass} ${b.className}`.trim(),
    style: { ...baseStyle, ...b.style },
    onPointerDown: b.onPointerDown,
    onContextMenu: b.onContextMenu,
  };
}

export interface TightBarProps {
  hud: HudSnapshot;
  slots?: QuickSlots;
  bind?: HudPanelBinding;
  portraitFallback?: ReactNode;
}

export function TightBar({ hud, slots, bind, portraitFallback }: TightBarProps) {
  const quickSlots = slots?.length ? slots : defaultQuickSlots();
  const slotByName = (slot: string): SlotBinding | undefined =>
    hud.slots.find((s) => s.slot === slot);
  const poisePct =
    hud.maxPoise > 0 ? Math.max(0, Math.min(100, (hud.poise / hud.maxPoise) * 100)) : 0;
  const portraitUrl =
    (hud as { playerPortraitUrl?: string }).playerPortraitUrl ||
    (hud as { portraitUrl?: string }).portraitUrl;

  return (
    <div
      {...applyBind(bind, "tightbar", {
        backgroundImage: `url(${HUD_ART.tightBar})`,
      })}
    >
      <TightOrb kind="hp" value={hud.health} max={hud.maxHealth} />
      <TightOrb kind="mp" value={hud.stamina} max={hud.maxStamina} />

      {quickSlots.map((id, i) => {
        const style = tbSlotStyle(i);
        if (!id) {
          return (
            <div key={i} className="tb-slot tb-empty" style={style} title="Empty slot">
              <span className="tb-key">·</span>
            </div>
          );
        }
        const r = resolveQuickAction(id, hud, slotByName);
        const onCd = r.cd > 0 && r.cdMax > 0;
        const frac = onCd ? Math.max(0, Math.min(1, r.cd / r.cdMax)) : 0;
        return (
          <div
            key={`${id}-${i}`}
            className={`tb-slot ${r.accent ? "tb-accent" : ""} ${onCd ? "on-cd" : "ready"}`}
            style={style}
            title={r.keyLabel ? `${r.name} — ${r.keyLabel}` : r.name}
          >
            <Icon name={r.icon} src={r.iconUrl} fallbackName={r.icon} size={30} title={r.name} />
            {onCd && (
              <div
                className="tb-sweep"
                style={{
                  background: `conic-gradient(rgba(4,10,20,0.78) ${frac * 360}deg, transparent 0deg)`,
                }}
              />
            )}
            {onCd && <span className="tb-cd">{r.cd.toFixed(1)}</span>}
            <span className="tb-key">{r.keyLabel}</span>
          </div>
        );
      })}

      <div className="tb-avatar">
        {portraitUrl ? (
          <img src={portraitUrl} alt={hud.character} draggable={false} />
        ) : (
          portraitFallback ?? <Icon name={WEAPON_ICON[hud.weapon]} size={44} />
        )}
        <span className="tb-avatar-name">{hud.character}</span>
      </div>

      <div
        className="tb-poise"
        title={`Poise — ${Math.round(hud.poise)}/${hud.maxPoise}`}
      >
        <div
          className={`tb-poise-fill${hud.critWindow > 0 ? " crit" : ""}`}
          style={{ width: `${poisePct}%` }}
        />
      </div>
    </div>
  );
}

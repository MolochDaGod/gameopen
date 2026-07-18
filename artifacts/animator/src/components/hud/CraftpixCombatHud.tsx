/**
 * Craftpix Part_2 combat HUD — two-row action bar.
 *
 * Geometry rules (PSD-native):
 *   ab1_shortcut_frame = 50×50  → slot button size
 *   icon plate           = 34×34  → same center XY as frame hole (8px pad)
 *   ab1_bonus_slot       = 120×122 → primary / heavy (scaled 60×60, icon 44)
 *   Globes left/right    = HP / stamina fill
 *
 * Part_7: rich tooltips (notification / paper frames).
 * Layout: [HP globe] [2×6 skill/utility slots] [SP globe] + XP strip.
 */
import { useCallback, useState, type MouseEvent } from "react";
import type { HudSnapshot, SlotBinding } from "../../three/types";
import { resolveSlotIconUrl, resolveSlotLocalName } from "../../three/skillIcons";
import { portraitOnError } from "../../lib/characterPortrait";
import { Icon } from "../Icon";
import {
  QUICK_ACTIONS,
  defaultQuickSlots,
  leftWingSlots,
  rightWingSlots,
  type QuickActionId,
} from "../../hud/quickActions";
import "./craftpixHud.css";

export interface CraftpixCombatHudProps {
  hud: HudSnapshot;
  /** Optional production shell open */
  onOpenProduction?: () => void;
}

type TipState = {
  x: number;
  y: number;
  title: string;
  body: string;
  sub?: string;
} | null;

function wingCooldown(
  id: QuickActionId,
  hud: HudSnapshot,
): { cd: number; cdMax: number } {
  switch (id) {
    case "fskill":
      return { cd: hud.skillCooldown, cdMax: hud.skillCooldownMax };
    case "sig1":
      return {
        cd: (hud.sigCooldownMaxes[0] ?? 0) > 0 ? (hud.sigCooldowns[0] ?? 0) : hud.skillCooldown,
        cdMax: (hud.sigCooldownMaxes[0] ?? 0) > 0 ? (hud.sigCooldownMaxes[0] ?? 0) : hud.skillCooldownMax,
      };
    case "sig2":
      return {
        cd: (hud.sigCooldownMaxes[1] ?? 0) > 0 ? (hud.sigCooldowns[1] ?? 0) : hud.skillCooldown,
        cdMax: (hud.sigCooldownMaxes[1] ?? 0) > 0 ? (hud.sigCooldownMaxes[1] ?? 0) : hud.skillCooldownMax,
      };
    case "sig3":
      return {
        cd: (hud.sigCooldownMaxes[2] ?? 0) > 0 ? (hud.sigCooldowns[2] ?? 0) : hud.skillCooldown,
        cdMax: (hud.sigCooldownMaxes[2] ?? 0) > 0 ? (hud.sigCooldownMaxes[2] ?? 0) : hud.skillCooldownMax,
      };
    case "sig4":
      return {
        cd: (hud.sigCooldownMaxes[3] ?? 0) > 0 ? (hud.sigCooldowns[3] ?? 0) : hud.skillCooldown,
        cdMax: (hud.sigCooldownMaxes[3] ?? 0) > 0 ? (hud.sigCooldownMaxes[3] ?? 0) : hud.skillCooldownMax,
      };
    case "heavy":
      return { cd: hud.skyfallCooldown, cdMax: hud.skyfallCooldownMax };
    default:
      return { cd: 0, cdMax: 0 };
  }
}

function wingPresentation(
  id: QuickActionId,
  hud: HudSnapshot,
  slotByName: (slot: string) => SlotBinding | undefined,
): { name: string; icon: string; iconUrl?: string; key: string } {
  const base = QUICK_ACTIONS[id];
  const key = base.key;
  if (id === "primary") {
    const s = slotByName("primary");
    return {
      key: s?.key ?? key,
      name: s?.label ?? base.label,
      icon: s?.icon || resolveSlotLocalName("primary", hud.weapon),
      iconUrl: s?.iconUrl || resolveSlotIconUrl("primary", hud.weapon),
    };
  }
  if (id === "fskill") {
    const s = slotByName("fskill");
    return {
      key: s?.key ?? key,
      name: hud.skillName || s?.label || base.label,
      icon: s?.icon || resolveSlotLocalName("fskill", hud.weapon),
      iconUrl: s?.iconUrl || resolveSlotIconUrl("fskill", hud.weapon),
    };
  }
  if (id === "sig1" || id === "sig2" || id === "sig3" || id === "sig4") {
    const s = slotByName(id);
    const i = Number(id.slice(3)) - 1;
    return {
      key: s?.key ?? key,
      name: s?.label ?? base.label,
      icon:
        s?.icon ||
        resolveSlotLocalName(`sig${i + 1}` as "sig1" | "sig2" | "sig3" | "sig4", hud.weapon),
      iconUrl:
        s?.iconUrl ||
        resolveSlotIconUrl(`sig${i + 1}` as "sig1" | "sig2" | "sig3" | "sig4", hud.weapon),
    };
  }
  if (id === "heavy") {
    return {
      key,
      name: base.label,
      icon: resolveSlotLocalName("heavy", hud.weapon),
      iconUrl: resolveSlotIconUrl("heavy", hud.weapon),
    };
  }
  return { key, name: base.label, icon: base.icon };
}

type SlotView = {
  id: string;
  keyLabel: string;
  name: string;
  icon: string;
  iconUrl?: string;
  cd: number;
  cdMax: number;
  accent?: boolean;
  empty?: boolean;
  large?: boolean;
};

function CombatSlot({
  slot,
  onTip,
  onClearTip,
}: {
  slot: SlotView;
  onTip: (e: MouseEvent, s: SlotView) => void;
  onClearTip: () => void;
}) {
  const onCd = !slot.empty && slot.cd > 0 && slot.cdMax > 0;
  const frac = onCd ? Math.max(0, Math.min(1, slot.cd / slot.cdMax)) : 0;
  return (
    <button
      type="button"
      className={
        "cx-cslot" +
        (slot.large ? " is-large" : "") +
        (slot.accent ? " is-accent" : "") +
        (onCd ? " is-cd" : " is-ready") +
        (slot.empty ? " is-empty" : "")
      }
      aria-label={slot.empty ? "Empty slot" : slot.name}
      disabled={!!slot.empty}
      onMouseEnter={(e) => onTip(e, slot)}
      onMouseLeave={onClearTip}
      onFocus={(e) => onTip(e as unknown as MouseEvent, slot)}
      onBlur={onClearTip}
    >
      <span className="cx-cslot-key">{slot.keyLabel}</span>
      {!slot.empty && (
        <>
          {slot.iconUrl ? (
            <img
              className="cx-cslot-icon"
              src={slot.iconUrl}
              alt=""
              draggable={false}
              onError={(e) => {
                e.currentTarget.dataset.broken = "1";
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <span className="cx-cslot-glyph" aria-hidden>
            <Icon name={slot.icon} fallbackName={slot.icon} size={slot.large ? 28 : 22} />
          </span>
        </>
      )}
      {onCd && (
        <span
          className="cx-cslot-sweep"
          style={{
            background: `conic-gradient(rgba(4,8,14,0.78) ${frac * 360}deg, transparent 0deg)`,
          }}
        />
      )}
      {onCd && <span className="cx-cslot-cd">{slot.cd.toFixed(1)}</span>}
      {/* Part_2 hover / push overlays share the same box as the frame */}
      <span className="cx-cslot-hover" aria-hidden />
    </button>
  );
}

export function CraftpixCombatHud({ hud, onOpenProduction }: CraftpixCombatHudProps) {
  const [tip, setTip] = useState<TipState>(null);
  const slotByName = useCallback(
    (slot: string) => hud.slots?.find((s) => s.slot === slot),
    [hud.slots],
  );

  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const spPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const xpPct = Math.max(0, Math.min(100, ((hud.level ?? 1) % 10) * 10 + 12));

  // Row 1 = combat skills (left wing / mech abilities)
  // Row 2 = utility (right wing)
  const row1: SlotView[] = (() => {
    if (hud.mech) {
      const out: SlotView[] = [
        {
          id: "lmb",
          keyLabel: "LMB",
          name: "Power Smash",
          icon: "attack",
          cd: 0,
          cdMax: 0,
          large: true,
          accent: true,
        },
      ];
      for (const a of hud.mech.abilities.slice(0, 5)) {
        out.push({
          id: a.key,
          keyLabel: a.key,
          name: a.name,
          icon: a.icon,
          cd: a.cd,
          cdMax: a.cdMax,
          accent: true,
        });
      }
      while (out.length < 6) {
        out.push({
          id: `pad-m-${out.length}`,
          keyLabel: "·",
          name: "Empty",
          icon: "empty",
          cd: 0,
          cdMax: 0,
          empty: true,
        });
      }
      return out;
    }
    return leftWingSlots(defaultQuickSlots()).map((id, i) => {
      if (!id) {
        return {
          id: `L${i}`,
          keyLabel: "·",
          name: "Empty",
          icon: "empty",
          cd: 0,
          cdMax: 0,
          empty: true,
        };
      }
      const pres = wingPresentation(id, hud, slotByName);
      const { cd, cdMax } = wingCooldown(id, hud);
      return {
        id,
        keyLabel: pres.key,
        name: pres.name,
        icon: pres.icon,
        iconUrl: pres.iconUrl,
        cd,
        cdMax,
        large: id === "primary" || id === "heavy",
        accent: id === "primary" || id === "heavy" || id.startsWith("sig"),
      };
    });
  })();

  const row2: SlotView[] = rightWingSlots(defaultQuickSlots()).map((id, i) => {
    if (!id) {
      return {
        id: `R${i}`,
        keyLabel: "·",
        name: "Empty",
        icon: "empty",
        cd: 0,
        cdMax: 0,
        empty: true,
      };
    }
    const pres = wingPresentation(id, hud, slotByName);
    const { cd, cdMax } = wingCooldown(id, hud);
    return {
      id,
      keyLabel: pres.key,
      name: pres.name,
      icon: pres.icon,
      iconUrl: pres.iconUrl,
      cd,
      cdMax,
      accent: id === "dodge" || id === "parry",
    };
  });

  const showTip = (e: MouseEvent, s: SlotView) => {
    if (s.empty) {
      setTip(null);
      return;
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(window.innerWidth - 24, Math.max(24, r.left + r.width / 2));
    const y = Math.max(12, r.top - 8);
    setTip({
      x,
      y,
      title: s.name,
      body: s.accent
        ? "Combat skill — press the keybind to activate."
        : "Utility action — press the keybind to use.",
      sub: onCdSub(s),
    });
  };

  return (
    <div className="cx-hud cx-combat-hud" data-mode="combat">
      <div className="cx-combat-bar" role="toolbar" aria-label="Combat action bar">
        {/* Left HP globe — Part_2 */}
        <div className="cx-globe cx-globe-hp" title={`HP ${Math.round(hud.health)}/${hud.maxHealth}`}>
          <div className="cx-globe-fill hp" style={{ height: `${hpPct}%` }} />
          <div className="cx-globe-overlay" />
          <span className="cx-globe-label">
            {Math.round(hud.health)}
            <small>HP</small>
          </span>
        </div>

        <div className="cx-combat-center">
          {/* Identity strip */}
          <div className="cx-combat-id">
            <div className="cx-avatar-ring cx-combat-avatar">
              {hud.portraitUrl ? (
                <img
                  src={hud.portraitUrl}
                  alt={hud.character}
                  draggable={false}
                  onError={(e) =>
                    portraitOnError(e.currentTarget, hud.portraitCandidates ?? [])
                  }
                />
              ) : (
                <span className="cx-avatar-letter">
                  {(hud.character || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="cx-combat-meta">
              <span className="cx-name">{hud.character}</span>
              <span className="cx-mode">{hud.weaponLabel || "Combat"}</span>
              <span className="cx-combat-lv">Lv {hud.level ?? 1}</span>
            </div>
            {onOpenProduction && (
              <button
                type="button"
                className="cx-cslot cx-cslot-prod"
                title="Production shell (P)"
                onClick={onOpenProduction}
              >
                <span className="cx-cslot-key">P</span>
                <span className="cx-cslot-glyph" aria-hidden>
                  ⛏
                </span>
              </button>
            )}
          </div>

          {/* Two rows of Part_2 shortcut frames — icons share size + center with frames */}
          <div className="cx-combat-rows">
            <div className="cx-combat-row" aria-label="Combat skills row">
              {row1.map((s) => (
                <CombatSlot
                  key={s.id}
                  slot={s}
                  onTip={showTip}
                  onClearTip={() => setTip(null)}
                />
              ))}
            </div>
            <div className="cx-combat-row" aria-label="Utility row">
              {row2.map((s) => (
                <CombatSlot
                  key={s.id}
                  slot={s}
                  onTip={showTip}
                  onClearTip={() => setTip(null)}
                />
              ))}
            </div>
          </div>

          {/* XP — Part_2 ab1_xp */}
          <div className="cx-combat-xp" title="Level progress">
            <div className="cx-combat-xp-fill" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        {/* Right SP globe */}
        <div
          className="cx-globe cx-globe-sp"
          title={`SP ${Math.round(hud.stamina)}/${hud.maxStamina}`}
        >
          <div className="cx-globe-fill sp" style={{ height: `${spPct}%` }} />
          <div className="cx-globe-overlay" />
          <span className="cx-globe-label">
            {Math.round(hud.stamina)}
            <small>SP</small>
          </span>
        </div>
      </div>

      {/* Part_7 tooltip */}
      {tip && (
        <div
          className="cx-tip cx-tip-part7"
          style={{ left: tip.x, top: tip.y }}
          role="tooltip"
        >
          <div className="cx-tip-head">{tip.title}</div>
          <div className="cx-tip-body">{tip.body}</div>
          {tip.sub && <div className="cx-tip-sub">{tip.sub}</div>}
        </div>
      )}
    </div>
  );
}

function onCdSub(s: SlotView): string {
  if (s.cdMax > 0 && s.cd > 0) return `${s.keyLabel} · CD ${s.cd.toFixed(1)}s / ${s.cdMax}s`;
  if (s.cdMax > 0) return `${s.keyLabel} · CD ${s.cdMax}s`;
  return s.keyLabel;
}

import type { CSSProperties } from "react";
import type { HudSnapshot, SlotBinding } from "../three/types";
import { WEAPON_ICON } from "../three/icons";
import { resolveSlotIconUrl, resolveSlotLocalName } from "../three/skillIcons";
import { Icon } from "./Icon";
import type { HudEditApi, HudPanelBinding } from "../hud/useHudEditor";
import type { HudPanelId } from "../hud/hudConfig";
import { RadialMenu } from "./RadialMenu";
import {
  MODE_BANNER_FRAME,
  MODE_COLOR,
  MODE_ICON,
  MODE_LABEL,
  type PlayerActivityMode,
} from "../three/playerMode";
import { UnitFrame } from "./hud/UnitFrame";
import { CraftpixHarvestHud } from "./hud/CraftpixHarvestHud";
import { CraftpixCombatHud } from "./hud/CraftpixCombatHud";
import { portraitOnError } from "../lib/characterPortrait";
import {
  COMBAT_KEY_LEGEND,
  QUICK_ACTIONS,
  defaultQuickSlots,
  leftWingSlots,
  rightWingSlots,
  type QuickActionId,
} from "../hud/quickActions";

interface Props {
  hud: HudSnapshot | null;
  /** Optional HUD-editor api: applies persisted layout and (when editing) drag/select. */
  edit?: HudEditApi;
  /** Arena match: retry same opponents. */
  onArenaRetry?: () => void;
  /** Arena match: clear opponents and return to free Danger Room. */
  onArenaReturn?: () => void;
  /** Radial wheel: commit tool selection. */
  onRadialSelect?: (id: string) => void;
  onRadialCancel?: () => void;
  /** Open full harvest production shell (craft / codex / maps / trees). */
  onOpenProduction?: () => void;
  /** Open character 3×3 bag. */
  onOpenBag?: () => void;
  canDeposit?: boolean;
  bagOccupied?: number;
  bagCapacity?: number;
}

/** Merge a panel's edit binding onto its base className + inline style. */
function applyBind(b: HudPanelBinding | undefined, baseClass: string, baseStyle?: CSSProperties) {
  if (!b) return { className: baseClass, style: baseStyle };
  return {
    "data-hud-panel": b["data-hud-panel"],
    className: `${baseClass} ${b.className}`.trim(),
    style: { ...baseStyle, ...b.style },
    onPointerDown: b.onPointerDown,
    onContextMenu: b.onContextMenu,
  };
}

const bindOf = (edit: HudEditApi | undefined, id: HudPanelId) => edit?.bind(id);

function VitalBar({
  value,
  max,
  className,
  label,
}: {
  value: number;
  max: number;
  className: string;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`vital ${className}`}>
      <span className="vital-label">{label}</span>
      <div className="vital-track">
        <div className="vital-fill" style={{ width: `${pct}%` }} />
        <span className="vital-num">
          {Math.round(value)} / {max}
        </span>
      </div>
    </div>
  );
}

/** A single action-bar slot with icon, keybind and a radial cooldown sweep. */
function SkillSlot({
  keyLabel,
  name,
  icon,
  iconUrl,
  cd,
  cdMax,
  accent,
  compact,
}: {
  keyLabel: string;
  name: string;
  icon: string;
  /** R2 / pack absolute URL (preferred). */
  iconUrl?: string;
  cd: number;
  cdMax: number;
  accent?: boolean;
  /** Compact wing slot (no name label) for dual 6-banks. */
  compact?: boolean;
}) {
  const onCd = cd > 0 && cdMax > 0;
  const frac = onCd ? Math.max(0, Math.min(1, cd / cdMax)) : 0;
  return (
    <div
      className={`act-slot ${accent ? "act-accent" : ""} ${onCd ? "on-cd" : "ready"} ${compact ? "act-compact" : ""}`}
      title={name}
    >
      <div className="act-icon">
        <Icon name={icon} src={iconUrl} fallbackName={icon} size={compact ? 26 : 30} title={name} />
        {onCd && (
          <div
            className="act-sweep"
            style={{ background: `conic-gradient(rgba(4,10,20,0.78) ${frac * 360}deg, transparent 0deg)` }}
          />
        )}
        {onCd && <span className="act-cd">{cd.toFixed(1)}</span>}
      </div>
      <span className="act-key">{keyLabel}</span>
      {!compact && <span className="act-name">{name}</span>}
    </div>
  );
}

/** Live CD for a quick-action id from the Hud snapshot. */
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

/** Label/icon overrides when Studio has live skill names. */
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

/** Per-relationship accent palette for the floating lock-on frames. */
const FRAME_ACCENTS = {
  hostile: {
    border: "rgba(255, 70, 70, 0.55)",
    glow: "0 0 10px rgba(255, 50, 50, 0.35)",
    name: "#ff8a8a",
    value: "#ffd0d0",
    bar: "linear-gradient(90deg, #ff3b3b, #ff7a5a)",
  },
  ally: {
    border: "rgba(70, 230, 130, 0.55)",
    glow: "0 0 10px rgba(50, 220, 110, 0.35)",
    name: "#8affb0",
    value: "#d0ffe0",
    bar: "linear-gradient(90deg, #2fe070, #7affa8)",
  },
} as const;

/** Lock-on health frame, anchored up-and-left of the projected head. */
function TargetFrame({
  target,
  accent = "hostile",
}: {
  target: NonNullable<HudSnapshot["selectedTarget"]>;
  accent?: keyof typeof FRAME_ACCENTS;
}) {
  const pct = Math.max(0, Math.min(100, (target.health / target.maxHealth) * 100));
  const c = FRAME_ACCENTS[accent];
  return (
    <div
      style={{
        position: "absolute",
        left: `${target.x}px`,
        top: `${target.y}px`,
        transform: "translate(-100%, -130%)",
        minWidth: 132,
        pointerEvents: "none",
        padding: "5px 7px",
        background: "rgba(8, 6, 10, 0.62)",
        border: `1px solid ${c.border}`,
        borderRadius: 5,
        boxShadow: c.glow,
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: c.name,
          marginBottom: 3,
        }}
      >
        <span>{target.name}</span>
        <span style={{ color: c.value }}>
          {Math.round(target.health)}/{target.maxHealth}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(255, 255, 255, 0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: c.bar,
            transition: "width 120ms linear",
          }}
        />
      </div>
    </div>
  );
}

/** A compact bar used for poise (no number label on small versions). */
function PoiseBar({ value, max, crit }: { value: number; max: number; crit: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="vital vital-poise">
      <span className="vital-label">POI</span>
      <div className="vital-track">
        <div
          className="vital-fill"
          style={{
            width: `${pct}%`,
            background: crit ? "linear-gradient(90deg,#ffcc22,#ff6600)" : "linear-gradient(90deg,#6490ff,#3060cc)",
          }}
        />
      </div>
    </div>
  );
}

/** Chip showing the active combat state when it is anything other than idle. */
function CombatStateChip({ state, critWindow }: { state: string; critWindow: number }) {
  if (state === "idle" && critWindow <= 0) return null;
  const isNeutral = state === "parry" || state === "block" || state === "dodge";
  const isHurt = state === "stagger" || state === "stunned" || state === "fallen" || state === "getUp";
  const isCrit = critWindow > 0;
  let bg = "#3060cc88";
  let label = state.toUpperCase();
  if (isCrit) { bg = "#ff660099"; label = "CRIT OPEN"; }
  else if (isHurt) bg = "#aa222288";
  else if (isNeutral) bg = "#22aa6688";

  return (
    <span
      style={{
        display: "inline-block",
        marginTop: 2,
        padding: "1px 7px",
        borderRadius: 4,
        background: bg,
        color: isCrit ? "#ffcc22" : isHurt ? "#ff8888" : "#88ffcc",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        border: isCrit ? "1px solid #ff660066" : "1px solid rgba(255,255,255,0.1)",
        animation: isCrit ? "combat-crit-pulse 0.6s ease-in-out infinite alternate" : undefined,
      }}
    >
      {label}
    </span>
  );
}

/** Right-side enemy mini-panel showing the focused dummy's combat state. */
function EnemyPanel({ hud, edit }: { hud: HudSnapshot; edit?: HudEditApi }) {
  const hp = Math.max(0, Math.min(100, (hud.enemyHealth / hud.enemyMaxHealth) * 100));
  const sp = Math.max(0, Math.min(100, (hud.enemyStamina / hud.enemyMaxStamina) * 100));
  const poi = Math.max(0, Math.min(100, (hud.enemyPoise / hud.enemyMaxPoise) * 100));
  const isCrit = hud.enemyCritWindow > 0;
  const isDown =
    hud.enemyCombatState === "stunned" ||
    hud.enemyCombatState === "fallen" ||
    hud.enemyCombatState === "stagger";
  const isStunned = hud.enemyCombatState === "stunned" || hud.enemyCombatState === "stagger";
  return (
    <div
      {...applyBind(bindOf(edit, "enemy"), "rpg-enemy", {
        position: "absolute",
        top: 16,
        right: 16,
        minWidth: 160,
        background: "rgba(4,8,20,0.72)",
        border: `1px solid ${isCrit ? "#ff6600aa" : "rgba(96,128,220,0.35)"}`,
        borderRadius: 8,
        padding: "8px 12px",
        fontFamily: "monospace",
        fontSize: 11,
        color: "#bbd0ff",
        backdropFilter: "blur(6px)",
        transition: "border-color 0.3s",
      })}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#e0e8ff", letterSpacing: "0.06em" }}>
        ENEMY
        {isDown && (
          <span
            style={{
              marginLeft: 6,
              color: "#ff8888",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            ↯ {hud.enemyCombatState.toUpperCase()}
          </span>
        )}
        {isCrit && (
          <span
            style={{
              marginLeft: 6,
              color: "#ffcc22",
              fontSize: 9,
              fontWeight: 700,
              animation: "combat-crit-pulse 0.6s ease-in-out infinite alternate",
            }}
          >
            ✦ CRIT OPEN
          </span>
        )}
      </div>
      {/* HP bar */}
      <div style={{ marginBottom: 3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 1, opacity: 0.7 }}>
          <span>HP</span>
          <span>{hud.enemyHealth}</span>
        </div>
        <div style={{ height: 6, background: "#0a1020", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${hp}%`,
              background: hp > 50 ? "linear-gradient(90deg,#44ff88,#22cc55)" : hp > 20 ? "linear-gradient(90deg,#ffcc22,#ff8800)" : "linear-gradient(90deg,#ff4444,#cc2222)",
              borderRadius: 3,
              transition: "width 0.2s",
            }}
          />
        </div>
      </div>
      {/* Stamina bar */}
      <div style={{ marginBottom: 3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 1, opacity: 0.7 }}>
          <span>SP</span>
          <span>{hud.enemyStamina}</span>
        </div>
        <div style={{ height: 4, background: "#0a1020", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${sp}%`,
              background: isStunned
                ? "linear-gradient(90deg,#ff8800,#ff4400)"
                : "linear-gradient(90deg,#44ccff,#2299cc)",
              borderRadius: 2,
              transition: "width 0.2s",
            }}
          />
        </div>
      </div>
      {/* Poise bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 1, opacity: 0.7 }}>
          <span>POI</span>
          <span>{hud.enemyPoise}</span>
        </div>
        <div style={{ height: 4, background: "#0a1020", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${poi}%`,
              background: isCrit ? "linear-gradient(90deg,#ffcc22,#ff6600)" : "linear-gradient(90deg,#6490ff,#3060cc)",
              borderRadius: 2,
              transition: "width 0.2s",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Per-zone presentation for the dungeon depth cue. */
const ZONE_META: Record<
  NonNullable<HudSnapshot["zone"]>,
  { label: string; sub: string; icon: string; color: string }
> = {
  surface: { label: "SURFACE", sub: "Forge Map", icon: "⛰", color: "#9fd3ff" },
  underwater: { label: "UNDERWATER", sub: "The Descent", icon: "≋", color: "#4fc7e8" },
  pit: { label: "THE PIT", sub: "Sealed Depths", icon: "▼", color: "#ff7a5c" },
};

/** Top-center dungeon zone cue (surface / underwater / pit). */
function ZoneIndicator({ zone }: { zone: NonNullable<HudSnapshot["zone"]> }) {
  const meta = ZONE_META[zone];
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(4,8,20,0.72)",
        border: `1px solid ${meta.color}55`,
        borderRadius: 999,
        padding: "5px 14px",
        fontFamily: "monospace",
        color: meta.color,
        backdropFilter: "blur(6px)",
        pointerEvents: "none",
        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{meta.icon}</span>
      <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.14em" }}>{meta.label}</span>
      <span style={{ fontSize: 10, opacity: 0.7, letterSpacing: "0.06em" }}>{meta.sub}</span>
    </div>
  );
}

/** Distinct boss health bar (bottom-center) for the locked boss-tier hostile. */
function BossBar({ boss }: { boss: NonNullable<HudSnapshot["boss"]> }) {
  const hp = Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100));
  return (
    <div
      style={{
        position: "absolute",
        bottom: 92,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(560px, 60vw)",
        textAlign: "center",
        fontFamily: "monospace",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.22em",
          color: "#ffd9c2",
          textShadow: "0 0 10px rgba(255,80,40,0.7), 0 1px 3px rgba(0,0,0,0.8)",
          marginBottom: 5,
        }}
      >
        {boss.name.toUpperCase()}
      </div>
      <div
        style={{
          height: 14,
          background: "rgba(8,4,6,0.82)",
          border: "1px solid rgba(255,90,60,0.55)",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 0 14px rgba(255,60,30,0.35)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${hp}%`,
            background: "linear-gradient(90deg,#ff3b1f,#a30d0d)",
            boxShadow: "0 0 12px rgba(255,70,40,0.6) inset",
            transition: "width 0.25s",
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: "#ffb59c", opacity: 0.85, marginTop: 3 }}>
        {boss.health} / {boss.maxHealth}
      </div>
      {boss.hint && (
        <div
          style={{
            marginTop: 6,
            display: "inline-block",
            padding: "3px 12px",
            background: "rgba(8,4,6,0.7)",
            border: "1px solid rgba(255,210,63,0.45)",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#ffd23f",
            textShadow: "0 0 8px rgba(255,180,40,0.55), 0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          {boss.hint}
        </div>
      )}
    </div>
  );
}

/** Prefight countdown + WIN/LOSE banner + Retry / Return choices. */
function ArenaMatchOverlay({
  arena,
  onRetry,
  onReturn,
}: {
  arena: NonNullable<HudSnapshot["arena"]>;
  onRetry?: () => void;
  onReturn?: () => void;
}) {
  const showBanner =
    arena.phase === "countdown" ||
    arena.phase === "result" ||
    arena.phase === "choice" ||
    (arena.phase === "fighting" && !!arena.label);
  const isWin = arena.outcome === "win";
  const isLose = arena.outcome === "lose";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: arena.canChoose ? "auto" : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
        background:
          arena.phase === "choice"
            ? "rgba(4,6,12,0.55)"
            : arena.phase === "result"
              ? "rgba(4,6,12,0.28)"
              : "transparent",
      }}
    >
      {showBanner && arena.label && (
        <div
          style={{
            fontSize: arena.phase === "countdown" ? 96 : 64,
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: isWin ? "#7dffb0" : isLose ? "#ff6b6b" : "#e8f4ff",
            textShadow:
              isWin
                ? "0 0 40px rgba(80,255,160,0.65), 0 4px 12px rgba(0,0,0,0.85)"
                : isLose
                  ? "0 0 40px rgba(255,80,80,0.55), 0 4px 12px rgba(0,0,0,0.85)"
                  : "0 0 36px rgba(120,200,255,0.55), 0 4px 12px rgba(0,0,0,0.85)",
            animation: "combat-flash-in 0.2s ease-out",
            userSelect: "none",
          }}
        >
          {arena.label}
        </div>
      )}
      {arena.phase === "countdown" && (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.75, letterSpacing: "0.18em" }}>
          ROUND {arena.round} · {arena.opponentLabel}
        </div>
      )}
      {arena.canChoose && (
        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.7, letterSpacing: "0.08em" }}>
            {isWin ? "You defeated the opponents." : "You were defeated."}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "12px 22px",
                borderRadius: 8,
                border: "1px solid rgba(140,200,255,0.45)",
                background: "linear-gradient(180deg, rgba(40,70,120,0.95), rgba(20,35,70,0.95))",
                color: "#e8f4ff",
                fontWeight: 700,
                letterSpacing: "0.06em",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              RETRY
            </button>
            <button
              type="button"
              onClick={onReturn}
              style={{
                padding: "12px 22px",
                borderRadius: 8,
                border: "1px solid rgba(255,180,120,0.4)",
                background: "linear-gradient(180deg, rgba(90,50,30,0.95), rgba(40,22,12,0.95))",
                color: "#ffe8d4",
                fontWeight: 700,
                letterSpacing: "0.06em",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              RETURN TO DANGER ROOM
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, maxWidth: 320, textAlign: "center" }}>
            Retry rematches the same opponents. Return clears them so you will not fight this loadout again.
          </div>
        </div>
      )}
    </div>
  );
}

/** Center-screen event flash (PERFECT PARRY!, SHIELD BREAK!, etc.). */
function CombatFlash({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: "32%",
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        textAlign: "center",
        zIndex: 100,
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "6px 20px",
          background: "rgba(4,8,20,0.8)",
          border: "1px solid rgba(255,220,60,0.6)",
          borderRadius: 8,
          color: "#ffe060",
          fontSize: 22,
          fontWeight: 900,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          textShadow: "0 0 12px #ffaa00aa",
          animation: "combat-flash-in 0.18s ease-out",
        }}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * Activity mode banner — top centre, above combat/harvest chrome.
 * Uses local pack icons + Craftpix shortcut frame (real UI assets).
 * Re-keys on mode so Q swaps animate cleanly.
 */
function ModeBanner({ mode, tool }: { mode: PlayerActivityMode; tool: string }) {
  const color = MODE_COLOR[mode];
  const label = MODE_LABEL[mode];
  const icon = MODE_ICON[mode];
  return (
    <div className="mode-banner" key={mode} aria-live="polite">
      <div
        className="mode-banner-inner"
        style={
          {
            ["--mode-color" as string]: color,
            backgroundImage: `url(${MODE_BANNER_FRAME})`,
          } as CSSProperties
        }
      >
        <img
          className="mode-banner-icon"
          src={icon}
          alt=""
          draggable={false}
          onError={(e) => {
            // Fallback chain for missing local icons
            const el = e.currentTarget;
            if (mode === "combat" && !el.src.includes("attack")) el.src = "/icons/attack.png";
            else if (mode === "harvest" && !el.src.includes("loot")) el.src = "/icons/loot.png";
            else if (mode === "build" && !el.src.includes("building")) el.src = "/icons/building-kit.png";
          }}
        />
        <div className="mode-banner-text">
          <span className="mode-banner-label">{label}</span>
          <span className="mode-banner-tool">{(tool || "—").toUpperCase()}</span>
        </div>
        <span className="mode-banner-hint">Q · cycle</span>
      </div>
      {/* Sibling modes for context (dimmed) */}
      <div className="mode-banner-rail" aria-hidden>
        {(["combat", "harvest", "build"] as PlayerActivityMode[]).map((m) => (
          <span
            key={m}
            className={`mode-rail-dot ${m === mode ? "on" : ""}`}
            style={{ ["--dot-color" as string]: MODE_COLOR[m] } as CSSProperties}
            title={MODE_LABEL[m]}
          >
            <img src={MODE_ICON[m]} alt="" draggable={false} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function Hud({
  hud,
  edit,
  onArenaRetry,
  onArenaReturn,
  onRadialSelect,
  onRadialCancel,
  onOpenProduction,
  onOpenBag,
  canDeposit,
  bagOccupied,
  bagCapacity,
}: Props) {
  if (!hud) return null;

  const slotByName = (slot: string): SlotBinding | undefined => hud.slots.find((s) => s.slot === slot);

  const mode = hud.activityMode ?? "combat";
  const isHarvestBuild = mode === "harvest" || mode === "build";

  return (
    <>
      {/* Fire-tinted pulsing rim while the Striker hovers */}
      {hud.hovering && <div className="hover-vignette" />}

      {/* Mode banner — top centre, above class skills / vitals (Q cycle) */}
      <ModeBanner mode={mode} tool={hud.activityTool ?? ""} />

      {/* Combat key legend — bottom-left, not competing with centre mode banner */}
      {!isHarvestBuild && (
        <div className="combat-key-legend" aria-hidden>
          {COMBAT_KEY_LEGEND}
        </div>
      )}

      <RadialMenu
        open={!!hud.radialOpen}
        mode={mode}
        selectedId={hud.activityTool ?? "attack"}
        onSelect={(id) => onRadialSelect?.(id)}
        onCancel={() => onRadialCancel?.()}
      />

      {/* Red rim that fades after taking a hit */}
      {hud.hurt > 0 && (
        <div className="hurt-vignette" style={{ opacity: Math.min(1, hud.hurt / 0.4) }} />
      )}

      {/* Floating health frame for the Tab-locked enemy, up-and-left of its head */}
      {hud.selectedTarget && <TargetFrame target={hud.selectedTarget} accent="hostile" />}

      {/* Green health frame for the Shift+Tab-selected ally */}
      {hud.selectedAllyTarget && <TargetFrame target={hud.selectedAllyTarget} accent="ally" />}

      {/* Dungeon zone cue (surface / underwater / pit) */}
      {hud.zone && <ZoneIndicator zone={hud.zone} />}

      {/* Distinct boss health bar when the boss is the locked hostile */}
      {hud.boss && <BossBar boss={hud.boss} />}

      {/* Contextual interaction prompt (e.g. the dungeon door portal) */}
      {hud.prompt && <div className="interact-prompt">{hud.prompt}</div>}

      {/* Defeated overlay (free roam only — arena match owns its result UI) */}
      {hud.defeated && !hud.arena?.active && (
        <div className="defeat-overlay">
          <span className="defeat-title">DEFEATED</span>
          <span className="defeat-sub">Respawning…</span>
        </div>
      )}

      {/* Player-vs-NPC arena: countdown / result / choice */}
      {hud.arena?.active && (
        <ArenaMatchOverlay
          arena={hud.arena}
          onRetry={onArenaRetry}
          onReturn={onArenaReturn}
        />
      )}

      {/* Center-screen event flash */}
      <CombatFlash text={hud.combatFlash} />

      {/*
        Mode-switched player chrome:
          combat  → Craftpix Part_2 two-row bar (slots = icon XY) + Part_7 tips
          harvest/build → Craftpix Part_3 bar (HP/SP, avatar, gold, professions, 6 tools)
      */}
      {isHarvestBuild ? (
        <CraftpixHarvestHud
          hud={hud}
          mode={mode}
          onSelectTool={(id) => onRadialSelect?.(id)}
          onOpenProduction={onOpenProduction}
          onOpenBag={onOpenBag}
          canDeposit={canDeposit}
          bagOccupied={bagOccupied}
          bagCapacity={bagCapacity}
        />
      ) : (
        <div {...applyBind(bindOf(edit, "vitals"), "cx-combat-bind")}>
          <CraftpixCombatHud hud={hud} onOpenProduction={onOpenProduction} />
          {/* Poise / combat-state chip sits above the Part_2 bar */}
          <div className="cx-combat-poise-float">
            <PoiseBar value={hud.poise} max={hud.maxPoise} crit={hud.critWindow > 0} />
            <CombatStateChip state={hud.combatState} critWindow={hud.critWindow} />
          </div>
        </div>
      )}

      {/* Enemy panel (top-right) — UnitFrame-style target when locked */}
      {hud.selectedTarget ? (
        <div {...applyBind(bindOf(edit, "enemy"), "uf-panel uf-panel-target")}>
          <UnitFrame
            side="right"
            variant="target"
            name={hud.selectedTarget.name}
            sub="HOSTILE"
            hp={{ value: hud.selectedTarget.health, max: hud.selectedTarget.maxHealth }}
            energy={{ value: hud.enemyStamina, max: Math.max(1, hud.enemyMaxStamina) }}
            portrait={
              <span className="uf-portrait-letter">
                {(hud.selectedTarget.name || "E").slice(0, 1).toUpperCase()}
              </span>
            }
          />
        </div>
      ) : (
        <EnemyPanel hud={hud} edit={edit} />
      )}

      {/* Combat-only secondary action bar + readout (harvest/build use Craftpix bar) */}
      {!isHarvestBuild && (
        <>
          <div {...applyBind(bindOf(edit, "actionbar"), "rpg-actionbar rpg-actionbar-secondary")}>
            {hud.mech ? (
              <>
                <SkillSlot keyLabel="LMB" name="Power Smash" icon="attack" cd={0} cdMax={0} />
                {hud.mech.abilities.map((a) => (
                  <SkillSlot
                    key={a.key}
                    keyLabel={a.key}
                    name={a.name}
                    icon={a.icon}
                    cd={a.cd}
                    cdMax={a.cdMax}
                    accent
                  />
                ))}
              </>
            ) : (
              <>
                <Icon name={WEAPON_ICON[hud.weapon]} size={22} />
                <span className="rpg-actionbar-hint">{COMBAT_KEY_LEGEND}</span>
              </>
            )}
          </div>

          <div {...applyBind(bindOf(edit, "stats"), "rpg-stats")}>
            <span className="now-playing" title="Currently playing animation">
              ▶ {hud.clip || "idle"}
            </span>
            <span>
              <em>Targets</em> {hud.targetsAlive}
            </span>
            <span className={`spar-diff diff-${hud.difficulty}`}>
              <em>Spar</em> {hud.difficulty}
            </span>
            {hud.blocking && <span className="spar-block">▣ Block</span>}
            <span>
              <em>Jumps</em> {hud.jumpsLeft}
            </span>
            <span className="dim">{hud.fps} fps</span>
          </div>
        </>
      )}

      {/* CSS for new combat animations */}
      <style>{`
        @keyframes combat-crit-pulse {
          from { opacity: 1; }
          to   { opacity: 0.55; }
        }
        @keyframes combat-flash-in {
          from { opacity: 0; transform: translateX(-50%) scale(0.82); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        @keyframes mode-banner-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.92); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .mode-banner {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 22;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          pointer-events: none;
          animation: mode-banner-in 0.28s ease-out;
          font-family: Rajdhani, system-ui, sans-serif;
        }
        .mode-banner-inner {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 200px;
          padding: 8px 16px 8px 10px;
          border-radius: 10px;
          background-color: rgba(6, 10, 18, 0.88);
          background-size: 100% 100%;
          background-repeat: no-repeat;
          border: 1px solid color-mix(in srgb, var(--mode-color) 55%, transparent);
          box-shadow:
            0 6px 24px rgba(0, 0, 0, 0.5),
            0 0 18px color-mix(in srgb, var(--mode-color) 22%, transparent);
          backdrop-filter: blur(8px);
        }
        .mode-banner-icon {
          width: 36px;
          height: 36px;
          object-fit: contain;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid color-mix(in srgb, var(--mode-color) 40%, transparent);
          box-shadow: 0 0 10px color-mix(in srgb, var(--mode-color) 25%, transparent);
          image-rendering: auto;
        }
        .mode-banner-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 88px;
        }
        .mode-banner-label {
          font-weight: 900;
          letter-spacing: 0.16em;
          font-size: 14px;
          color: var(--mode-color);
          text-shadow: 0 0 10px color-mix(in srgb, var(--mode-color) 40%, transparent);
        }
        .mode-banner-tool {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #9aa4c0;
          font-weight: 600;
        }
        .mode-banner-hint {
          margin-left: auto;
          font-size: 9px;
          letter-spacing: 0.1em;
          color: #5e6688;
          font-weight: 700;
          text-transform: uppercase;
        }
        .mode-banner-rail {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .mode-rail-dot {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          opacity: 0.35;
          border: 1px solid transparent;
          display: grid;
          place-items: center;
          background: rgba(6, 10, 18, 0.7);
          transition: opacity 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .mode-rail-dot img {
          width: 14px;
          height: 14px;
          object-fit: contain;
        }
        .mode-rail-dot.on {
          opacity: 1;
          border-color: color-mix(in srgb, var(--dot-color) 70%, transparent);
          box-shadow: 0 0 10px color-mix(in srgb, var(--dot-color) 35%, transparent);
        }
        .combat-key-legend {
          position: absolute;
          left: 14px;
          bottom: 118px;
          z-index: 11;
          font-size: 9px;
          color: #6a7390;
          letter-spacing: 0.06em;
          max-width: 220px;
          line-height: 1.35;
          pointer-events: none;
          text-shadow: 0 1px 2px #000;
        }
        /* Craftpix shortcut frame on action slots */
        .act-slot.act-compact .act-icon {
          background-image: url(/ui/craftpix/part3/ab2_shurtcut_frame_small.png);
          background-size: 100% 100%;
          background-repeat: no-repeat;
          background-color: rgba(4, 8, 16, 0.65);
          border-radius: 6px;
        }
        .act-slot .act-icon img,
        .act-slot .act-icon .icon-img {
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
        }
        .vital-poise .vital-fill {
          transition: width 0.25s, background 0.3s;
        }
      `}</style>
    </>
  );
}

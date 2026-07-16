import type { CSSProperties } from "react";
import type { HudSnapshot, SlotBinding } from "../three/types";
import { WEAPON_ICON } from "../three/icons";
import { resolveSlotIconUrl, resolveSlotLocalName } from "../three/skillIcons";
import { Icon } from "./Icon";
import type { HudEditApi, HudPanelBinding } from "../hud/useHudEditor";
import type { HudPanelId } from "../hud/hudConfig";
import { RadialMenu } from "./RadialMenu";
import { MODE_COLOR, MODE_LABEL } from "../three/playerMode";
import { UnitFrame } from "./hud/UnitFrame";
import { portraitOnError } from "../lib/characterPortrait";

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

/** Utility / defense options flanking the avatar (right wing of 6). */
const UTILITY_SLOTS: {
  key: string;
  name: string;
  icon: string;
  cdKey?: "skyfall";
}[] = [
  { key: "X", name: "Dodge", icon: "dodge" },
  { key: "C", name: "Parry", icon: "parry" },
  { key: "R", name: "Heavy", icon: "heavy", cdKey: "skyfall" },
  { key: "V", name: "Kick", icon: "kick" },
  { key: "J", name: "Potion", icon: "potion" },
  { key: "H", name: "Bomb", icon: "bomb" },
];

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
        top: "28%",
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

export function Hud({
  hud,
  edit,
  onArenaRetry,
  onArenaReturn,
  onRadialSelect,
  onRadialCancel,
  onOpenProduction,
}: Props) {
  if (!hud) return null;

  const slotByName = (slot: string): SlotBinding | undefined => hud.slots.find((s) => s.slot === slot);
  const primary = slotByName("primary");
  const fskill = slotByName("fskill");
  const sigs = (["sig1", "sig2", "sig3", "sig4"] as const)
    .map((id) => slotByName(id))
    .filter((s): s is SlotBinding => !!s);

  const mode = hud.activityMode ?? "combat";
  const modeColor = MODE_COLOR[mode];
  const modeLabel = MODE_LABEL[mode];

  return (
    <>
      {/* Fire-tinted pulsing rim while the Striker hovers */}
      {hud.hovering && <div className="hover-vignette" />}

      {/* Activity mode chip — Q cycles Combat / Harvest / Build */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 16,
          zIndex: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(6,10,18,0.78)",
            border: `1px solid ${modeColor}66`,
            boxShadow: `0 0 16px ${modeColor}22`,
            fontFamily: "Rajdhani, system-ui, sans-serif",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: modeColor,
              boxShadow: `0 0 8px ${modeColor}`,
            }}
          />
          <span style={{ fontWeight: 800, letterSpacing: "0.14em", fontSize: 12, color: modeColor }}>
            {modeLabel}
          </span>
          <span style={{ fontSize: 10, color: "#8a94b0", letterSpacing: "0.04em" }}>
            {(hud.activityTool ?? "").toUpperCase()}
          </span>
          <span style={{ fontSize: 9, color: "#5e6688", marginLeft: 4 }}>Q · mode</span>
        </div>
        {(mode === "harvest" || mode === "build") && onOpenProduction && (
          <button
            type="button"
            onClick={onOpenProduction}
            style={{
              pointerEvents: "auto",
              alignSelf: "flex-start",
              padding: "7px 12px",
              borderRadius: 10,
              border: `1px solid ${modeColor}88`,
              background: "rgba(8,14,12,0.88)",
              color: modeColor,
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: "0.08em",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ⛏ PRODUCTION UI · P
          </button>
        )}
        <div
          style={{
            fontSize: 9,
            color: "#6a7390",
            letterSpacing: "0.06em",
            paddingLeft: 4,
          }}
        >
          X dodge · hold Tab radial · C parry · P production
        </div>
      </div>

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
        threejs-rapier combat HUD cluster:
          [6 skill wing]  [UnitFrame portrait + HP/SP]  [6 utility wing]
        Portrait uses account/race art; slots mirror keyboard combat kit.
      */}
      <div {...applyBind(bindOf(edit, "vitals"), "rpg-combat-cluster uf-panel uf-panel-player")}>
        {/* LEFT: 6 combat skills (2×3) */}
        <div className="rpg-slot-wing rpg-slot-wing-left" aria-label="Combat skills">
          {hud.mech ? (
            <>
              <SkillSlot compact keyLabel="LMB" name="Power Smash" icon="attack" cd={0} cdMax={0} />
              {hud.mech.abilities.map((a) => (
                <SkillSlot
                  compact
                  key={a.key}
                  keyLabel={a.key}
                  name={a.name}
                  icon={a.icon}
                  cd={a.cd}
                  cdMax={a.cdMax}
                  accent
                />
              ))}
              {/* pad to 6 if mech has fewer abilities */}
              {Array.from({ length: Math.max(0, 5 - hud.mech.abilities.length) }).map((_, i) => (
                <div key={`pad-m-${i}`} className="act-slot act-compact act-empty" />
              ))}
            </>
          ) : (
            <>
              {primary && (
                <SkillSlot
                  compact
                  keyLabel={primary.key}
                  name={primary.label}
                  icon={primary.icon || resolveSlotLocalName("primary", hud.weapon)}
                  iconUrl={primary.iconUrl || resolveSlotIconUrl("primary", hud.weapon)}
                  cd={0}
                  cdMax={0}
                />
              )}
              {fskill && (
                <SkillSlot
                  compact
                  keyLabel={fskill.key}
                  name={hud.skillName}
                  icon={fskill.icon || resolveSlotLocalName("fskill", hud.weapon)}
                  iconUrl={fskill.iconUrl || resolveSlotIconUrl("fskill", hud.weapon)}
                  cd={hud.skillCooldown}
                  cdMax={hud.skillCooldownMax}
                />
              )}
              {sigs.map((s, i) => {
                const sigCd = hud.sigCooldowns[i] ?? 0;
                const sigCdMax = hud.sigCooldownMaxes[i] ?? 0;
                const cd = sigCdMax > 0 ? sigCd : hud.skillCooldown;
                const cdMax = sigCdMax > 0 ? sigCdMax : hud.skillCooldownMax;
                return (
                  <SkillSlot
                    compact
                    key={s.slot}
                    keyLabel={s.key}
                    name={s.label}
                    icon={
                      s.icon ||
                      resolveSlotLocalName(
                        `sig${i + 1}` as "sig1" | "sig2" | "sig3" | "sig4",
                        hud.weapon,
                      )
                    }
                    iconUrl={
                      s.iconUrl ||
                      resolveSlotIconUrl(
                        `sig${i + 1}` as "sig1" | "sig2" | "sig3" | "sig4",
                        hud.weapon,
                      )
                    }
                    cd={cd}
                    cdMax={cdMax}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* CENTER: ornate UnitFrame with avatar portrait */}
        <div className="rpg-unitframe-wrap">
          <UnitFrame
            side="left"
            variant="player"
            name={hud.character}
            sub={hud.weaponLabel}
            hp={{ value: hud.health, max: hud.maxHealth }}
            energy={{ value: hud.stamina, max: hud.maxStamina }}
            badge={
              <span title={`Lv ${hud.level ?? 1}`}>{hud.level ?? 1}</span>
            }
            portrait={
              hud.portraitUrl ? (
                <img
                  className="uf-portrait-img"
                  src={hud.portraitUrl}
                  alt={hud.character}
                  draggable={false}
                  onError={(e) =>
                    portraitOnError(e.currentTarget, hud.portraitCandidates ?? [])
                  }
                />
              ) : (
                <span className="uf-portrait-letter">
                  {(hud.character || "?").slice(0, 1).toUpperCase()}
                </span>
              )
            }
          />
          <div className="rpg-poise-under">
            <PoiseBar value={hud.poise} max={hud.maxPoise} crit={hud.critWindow > 0} />
            <CombatStateChip state={hud.combatState} critWindow={hud.critWindow} />
          </div>
        </div>

        {/* RIGHT: 6 utility / defense options */}
        <div className="rpg-slot-wing rpg-slot-wing-right" aria-label="Utility options">
          {UTILITY_SLOTS.map((u) => (
            <SkillSlot
              compact
              key={u.key}
              keyLabel={u.key}
              name={u.name}
              icon={u.icon}
              iconUrl={
                u.cdKey === "skyfall"
                  ? resolveSlotIconUrl("heavy", hud.weapon)
                  : undefined
              }
              cd={u.cdKey === "skyfall" ? hud.skyfallCooldown : 0}
              cdMax={u.cdKey === "skyfall" ? hud.skyfallCooldownMax : 0}
              accent={u.key === "X" || u.key === "C"}
            />
          ))}
        </div>
      </div>

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

      {/* Bottom center action bar kept for mech / wide skill read — secondary */}
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
            <span className="rpg-actionbar-hint">
              Skills · wings beside avatar · Q mode · hold Tab radial
            </span>
          </>
        )}
      </div>

      {/* Combat readout */}
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
        .vital-poise .vital-fill {
          transition: width 0.25s, background 0.3s;
        }
      `}</style>
    </>
  );
}

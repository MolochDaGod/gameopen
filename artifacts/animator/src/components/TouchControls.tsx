/**
 * Mobile / tablet combat pad for open.grudge-studio.com
 *
 * Layout (thumb zones):
 *   LEFT  — move stick + quarter-circle Jump / Block / Parry
 *           + row above: Sprint · Crouch · Harvest|Combat toggle
 *   RIGHT — skill stick (N/E/S/W abilities) · press = RMB focus
 *   BOTTOM — compact action bar (hold to expand & pick slot)
 *   EDGES  — pull-out tabs for bag / systems / mode
 *
 * Multitouch via pointerId. Real CDN icons (assets.grudge-studio.com).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { HARVEST_TOOLS } from "../game/inventory/harvestTools";
import type { PlayerActivityMode } from "../three/playerMode";
import { MODE_ICON, MODE_LABEL } from "../three/playerMode";
import "./touchControls.css";

const CDN = "https://assets.grudge-studio.com";

function iconUrl(path: string): string {
  if (!path) return `${CDN}/icons/pack/misc/Effect.png`;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${CDN}${path}`;
  return `${CDN}/${path}`;
}

/** Engine touch hooks the controls drive (thin slice of Studio). */
export interface TouchApi {
  touchMoveInput(x: number, y: number): void;
  touchLook(dx: number, dy: number): void;
  touchLookEnd(): void;
  setTouchSprint(on: boolean): void;
  touchJump(): void;
  touchAttack(): void;
  touchSkill(index?: number): void;
  touchSkyfall(): void;
  /** Hold guard / block */
  touchGuard?(on: boolean): void;
  touchParry?(): void;
  touchFocus?(): void;
  setTouchCrouch?(on: boolean): void;
  touchSetActivityMode?(mode: PlayerActivityMode): void;
  touchCycleActivityMode?(): void;
  touchActivityTool?(toolId: string): void;
  touchDodge?(): void;
  getActivityMode?(): PlayerActivityMode;
}

const STICK_R = 56;
const SKILL_STICK_R = 64;
/** Deadzone before skill stick commits a cardinal skill (0–1). */
const SKILL_DEAD = 0.42;

type Cardinal = "up" | "right" | "down" | "left";

const COMBAT_CARDINALS: Record<Cardinal, { label: string; skillIndex?: number; heavy?: boolean; icon: string }> = {
  up: { label: "Skill 1", skillIndex: 0, icon: `${CDN}/icons/pack/weapons/Sword_01.png` },
  right: { label: "Skill 2", skillIndex: 1, icon: `${CDN}/icons/pack/weapons/Axe_01.png` },
  down: { label: "Heavy", heavy: true, icon: `${CDN}/icons/pack/weapons/Hammer_01.png` },
  left: { label: "Skill 3", skillIndex: 2, icon: `${CDN}/icons/pack/weapons/Spear_01.png` },
};

const HARVEST_CARDINALS: Record<Cardinal, { label: string; toolId: string; icon: string }> = {
  up: {
    label: HARVEST_TOOLS[0]?.name ?? "Hatchet",
    toolId: HARVEST_TOOLS[0]?.activityTool ?? "axe",
    icon: iconUrl(HARVEST_TOOLS[0]?.icon ?? "/icons/pack/weapons/Axe_01.png"),
  },
  right: {
    label: HARVEST_TOOLS[1]?.name ?? "Pickaxe",
    toolId: HARVEST_TOOLS[1]?.activityTool ?? "pick",
    icon: iconUrl(HARVEST_TOOLS[1]?.icon ?? "/icons/pack/weapons/Hammer_01.png"),
  },
  down: {
    label: HARVEST_TOOLS[2]?.name ?? "Sickle",
    toolId: HARVEST_TOOLS[2]?.activityTool ?? "sickle",
    icon: iconUrl(HARVEST_TOOLS[2]?.icon ?? "/icons/pack/misc/Slash_07.png"),
  },
  left: {
    label: HARVEST_TOOLS[3]?.name ?? "Knife",
    toolId: HARVEST_TOOLS[3]?.activityTool ?? "knife",
    icon: iconUrl(HARVEST_TOOLS[3]?.icon ?? "/icons/pack/weapons/Dagger_01.png"),
  },
};

function cardinalFromStick(nx: number, ny: number): Cardinal | null {
  const len = Math.hypot(nx, ny);
  if (len < SKILL_DEAD) return null;
  // Screen: +x right, +y down → invert y for world-forward up
  const ang = Math.atan2(nx, -ny); // -π..π, 0 = up
  const deg = (ang * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return "up";
  if (deg >= 45 && deg < 135) return "right";
  if (deg >= -135 && deg < -45) return "left";
  return "down";
}

export function TouchControls({
  api,
  activityMode: activityProp,
  onOpenBag,
  onOpenSystems,
}: {
  api: TouchApi;
  activityMode?: PlayerActivityMode;
  onOpenBag?: () => void;
  onOpenSystems?: () => void;
}) {
  const [mode, setMode] = useState<PlayerActivityMode>(activityProp ?? "combat");
  const [sprintOn, setSprintOn] = useState(false);
  const [crouchOn, setCrouchOn] = useState(false);
  const [barExpanded, setBarExpanded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [leftDrawer, setLeftDrawer] = useState(false);
  const [rightDrawer, setRightDrawer] = useState(false);
  const [skillHint, setSkillHint] = useState<string | null>(null);

  const moveBase = useRef<HTMLDivElement>(null);
  const moveThumb = useRef<HTMLDivElement>(null);
  const skillBase = useRef<HTMLDivElement>(null);
  const skillThumb = useRef<HTMLDivElement>(null);
  const moveId = useRef<number | null>(null);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const skillId = useRef<number | null>(null);
  const skillOrigin = useRef({ x: 0, y: 0 });
  const skillArmed = useRef(false);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const barHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    if (activityProp) setMode(activityProp);
  }, [activityProp]);

  // Poll engine mode occasionally (Q key changes from desktop overlay)
  useEffect(() => {
    const t = window.setInterval(() => {
      const m = apiRef.current.getActivityMode?.();
      if (m && m !== mode) setMode(m);
    }, 800);
    return () => clearInterval(t);
  }, [mode]);

  const setMoveThumb = (dx: number, dy: number) => {
    if (moveThumb.current) moveThumb.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const setSkillThumb = (dx: number, dy: number) => {
    if (skillThumb.current) skillThumb.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  // ── Move stick ──────────────────────────────────────────────
  const onMoveDown = (e: React.PointerEvent) => {
    if (moveId.current !== null) return;
    moveId.current = e.pointerId;
    const r = moveBase.current!.getBoundingClientRect();
    moveOrigin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMoveMove = (e: React.PointerEvent) => {
    if (e.pointerId !== moveId.current) return;
    let dx = e.clientX - moveOrigin.current.x;
    let dy = e.clientY - moveOrigin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    setMoveThumb(dx, dy);
    apiRef.current.touchMoveInput(dx / STICK_R, -dy / STICK_R);
  };
  const onMoveUp = (e: React.PointerEvent) => {
    if (e.pointerId !== moveId.current) return;
    moveId.current = null;
    setMoveThumb(0, 0);
    apiRef.current.touchMoveInput(0, 0);
  };

  // ── Skill stick (right) ─────────────────────────────────────
  const fireCardinal = useCallback(
    (c: Cardinal) => {
      const a = apiRef.current;
      if (mode === "harvest") {
        const h = HARVEST_CARDINALS[c];
        a.touchActivityTool?.(h.toolId);
        setSkillHint(h.label);
      } else {
        const k = COMBAT_CARDINALS[c];
        if (k.heavy) a.touchSkyfall();
        else if (k.skillIndex !== undefined) a.touchSkill(k.skillIndex);
        setSkillHint(k.label);
      }
      window.setTimeout(() => setSkillHint(null), 700);
    },
    [mode],
  );

  const onSkillDown = (e: React.PointerEvent) => {
    if (skillId.current !== null) return;
    skillId.current = e.pointerId;
    skillArmed.current = false;
    const r = skillBase.current!.getBoundingClientRect();
    skillOrigin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onSkillMove = (e: React.PointerEvent) => {
    if (e.pointerId !== skillId.current) return;
    let dx = e.clientX - skillOrigin.current.x;
    let dy = e.clientY - skillOrigin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > SKILL_STICK_R) {
      dx = (dx / len) * SKILL_STICK_R;
      dy = (dy / len) * SKILL_STICK_R;
    }
    setSkillThumb(dx, dy);
    const nx = dx / SKILL_STICK_R;
    const ny = dy / SKILL_STICK_R;
    const c = cardinalFromStick(nx, ny);
    if (c) {
      skillArmed.current = true;
      // Light camera look when dragging skill stick on empty right half? skip — lookpad handles aim
    }
  };
  const onSkillUp = (e: React.PointerEvent) => {
    if (e.pointerId !== skillId.current) return;
    let dx = e.clientX - skillOrigin.current.x;
    let dy = e.clientY - skillOrigin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > SKILL_STICK_R) {
      dx = (dx / len) * SKILL_STICK_R;
      dy = (dy / len) * SKILL_STICK_R;
    }
    const nx = dx / SKILL_STICK_R;
    const ny = dy / SKILL_STICK_R;
    const c = cardinalFromStick(nx, ny);
    skillId.current = null;
    setSkillThumb(0, 0);
    if (c) {
      fireCardinal(c);
    } else {
      // Press center = RMB focus toggle
      apiRef.current.touchFocus?.();
      setSkillHint("FOCUS");
      window.setTimeout(() => setSkillHint(null), 600);
    }
  };

  // ── Look pad (upper-right, behind skill stick) ──────────────
  const onLookDown = (e: React.PointerEvent) => {
    if (lookId.current !== null || skillId.current !== null) return;
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onLookMove = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    apiRef.current.touchLook(dx, dy);
  };
  const onLookUp = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current) return;
    lookId.current = null;
    apiRef.current.touchLookEnd();
  };

  useEffect(
    () => () => {
      const a = apiRef.current;
      a.touchMoveInput(0, 0);
      a.touchLookEnd();
      a.setTouchSprint(false);
      a.touchGuard?.(false);
      a.setTouchCrouch?.(false);
      if (barHoldTimer.current) clearTimeout(barHoldTimer.current);
    },
    [],
  );

  const toggleSprint = () => {
    const next = !sprintOn;
    setSprintOn(next);
    if (next) {
      setCrouchOn(false);
      api.setTouchCrouch?.(false);
    }
    api.setTouchSprint(next);
  };

  const toggleCrouch = () => {
    const next = !crouchOn;
    setCrouchOn(next);
    if (next) {
      setSprintOn(false);
      api.setTouchSprint(false);
    }
    api.setTouchCrouch?.(next);
  };

  const setActivity = (m: PlayerActivityMode) => {
    setMode(m);
    api.touchSetActivityMode?.(m);
  };

  const harvest = mode === "harvest";
  const cards = harvest ? HARVEST_CARDINALS : COMBAT_CARDINALS;

  // Action bar slots (combat skills or harvest tools)
  const barSlots = harvest
    ? HARVEST_TOOLS.slice(0, 6).map((t, i) => ({
        id: t.id,
        label: t.name,
        icon: iconUrl(t.icon),
        onPick: () => {
          setSelectedSlot(i);
          api.touchActivityTool?.(t.activityTool);
        },
      }))
    : [0, 1, 2, 3].map((i) => ({
        id: `sig${i}`,
        label: `Skill ${i + 1}`,
        icon: COMBAT_CARDINALS[["up", "right", "left", "down"][i] as Cardinal].icon,
        onPick: () => {
          setSelectedSlot(i);
          api.touchSkill(i);
        },
      }));

  return (
    <div className={`mtouch ${harvest ? "mtouch--harvest" : "mtouch--combat"}`} data-mode={mode}>
      {/* Ambient look pad — upper-right, under skill stick */}
      <div
        className="mtouch-lookpad"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      {/* ── LEFT: move stick + quarter ring + toggles ── */}
      <div className="mtouch-left">
        <div className="mtouch-toggles">
          <button
            type="button"
            className={`mtouch-tog ${sprintOn ? "on" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              toggleSprint();
            }}
            aria-pressed={sprintOn}
          >
            <img src={`${CDN}/icons/pack/misc/Flow.png`} alt="" className="mtouch-ico" onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }} />
            <span>Sprint</span>
          </button>
          <button
            type="button"
            className={`mtouch-tog ${crouchOn ? "on" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              toggleCrouch();
            }}
            aria-pressed={crouchOn}
          >
            <span className="mtouch-glyph">⬇</span>
            <span>Crouch</span>
          </button>
          <button
            type="button"
            className={`mtouch-tog mtouch-mode ${harvest ? "harvest" : "combat"}`}
            onPointerDown={(e) => {
              e.preventDefault();
              setActivity(harvest ? "combat" : "harvest");
            }}
          >
            <img
              src={iconUrl(MODE_ICON[harvest ? "combat" : "harvest"])}
              alt=""
              className="mtouch-ico"
              onError={(ev) => {
                (ev.target as HTMLImageElement).src = `${CDN}/icons/pack/weapons/Sword_01.png`;
              }}
            />
            <span>{harvest ? "Combat" : "Harvest"}</span>
          </button>
        </div>

        <div className="mtouch-move-wrap">
          {/* Quarter-circle: Jump (NE), Block (E), Parry (SE) */}
          <div className="mtouch-ring">
            <button
              type="button"
              className="mtouch-ring-btn mtouch-jump"
              style={{ "--ang": "-35deg" } as React.CSSProperties}
              onPointerDown={(e) => {
                e.preventDefault();
                api.touchJump();
              }}
            >
              JMP
            </button>
            <button
              type="button"
              className="mtouch-ring-btn mtouch-block"
              style={{ "--ang": "0deg" } as React.CSSProperties}
              onPointerDown={(e) => {
                e.preventDefault();
                api.touchGuard?.(true);
              }}
              onPointerUp={() => api.touchGuard?.(false)}
              onPointerCancel={() => api.touchGuard?.(false)}
            >
              BLK
            </button>
            <button
              type="button"
              className="mtouch-ring-btn mtouch-parry"
              style={{ "--ang": "40deg" } as React.CSSProperties}
              onPointerDown={(e) => {
                e.preventDefault();
                api.touchParry?.();
              }}
            >
              PRY
            </button>
            <button
              type="button"
              className="mtouch-ring-btn mtouch-dodge"
              style={{ "--ang": "80deg" } as React.CSSProperties}
              onPointerDown={(e) => {
                e.preventDefault();
                api.touchDodge?.();
              }}
            >
              X
            </button>
          </div>

          <div
            className="mtouch-stick mtouch-move"
            ref={moveBase}
            onPointerDown={onMoveDown}
            onPointerMove={onMoveMove}
            onPointerUp={onMoveUp}
            onPointerCancel={onMoveUp}
          >
            <div className="mtouch-stick-ring" />
            <div className="mtouch-stick-thumb" ref={moveThumb} />
            <span className="mtouch-stick-label">MOVE</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: skill stick ── */}
      <div className="mtouch-right">
        <div className="mtouch-skill-cardinals" aria-hidden>
          {(["up", "right", "down", "left"] as Cardinal[]).map((c) => (
            <div key={c} className={`mtouch-card mtouch-card--${c}`}>
              <img src={cards[c].icon} alt="" onError={(ev) => { (ev.target as HTMLImageElement).style.opacity = "0.3"; }} />
            </div>
          ))}
        </div>
        <div
          className="mtouch-stick mtouch-skill"
          ref={skillBase}
          onPointerDown={onSkillDown}
          onPointerMove={onSkillMove}
          onPointerUp={onSkillUp}
          onPointerCancel={onSkillUp}
        >
          <div className="mtouch-stick-ring skill" />
          <div className="mtouch-stick-thumb skill" ref={skillThumb} />
          <span className="mtouch-stick-label">{harvest ? "TOOL" : "SKILL"}</span>
          <span className="mtouch-stick-hint">tap = focus</span>
        </div>
        {skillHint && <div className="mtouch-skill-toast">{skillHint}</div>}
      </div>

      {/* ── Action bar (minimized / expand on hold) ── */}
      <div
        className={`mtouch-bar ${barExpanded ? "expanded" : "mini"}`}
        onPointerDown={() => {
          if (barHoldTimer.current) clearTimeout(barHoldTimer.current);
          barHoldTimer.current = setTimeout(() => setBarExpanded(true), 220);
        }}
        onPointerUp={() => {
          if (barHoldTimer.current) {
            clearTimeout(barHoldTimer.current);
            barHoldTimer.current = null;
          }
        }}
        onPointerLeave={() => {
          if (barHoldTimer.current) {
            clearTimeout(barHoldTimer.current);
            barHoldTimer.current = null;
          }
        }}
      >
        <button
          type="button"
          className="mtouch-bar-toggle"
          onClick={() => setBarExpanded((v) => !v)}
          aria-expanded={barExpanded}
        >
          {barExpanded ? "▾" : "▴"} {MODE_LABEL[mode]}
        </button>
        <div className="mtouch-bar-slots">
          {barSlots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`mtouch-slot ${selectedSlot === i ? "sel" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                s.onPick();
              }}
            >
              <img src={s.icon} alt={s.label} />
              {barExpanded && <span>{s.label}</span>}
            </button>
          ))}
          {!harvest && (
            <button
              type="button"
              className="mtouch-slot atk"
              onPointerDown={(e) => {
                e.preventDefault();
                api.touchAttack();
              }}
            >
              <img src={`${CDN}/icons/pack/weapons/Sword_10.png`} alt="Attack" />
              {barExpanded && <span>Attack</span>}
            </button>
          )}
        </div>
      </div>

      {/* ── Pull-out tabs ── */}
      <button
        type="button"
        className={`mtouch-tab mtouch-tab-left ${leftDrawer ? "open" : ""}`}
        onClick={() => setLeftDrawer((v) => !v)}
        aria-label="Open bag panel"
      >
        {leftDrawer ? "‹" : "›"}
      </button>
      <aside className={`mtouch-drawer mtouch-drawer-left ${leftDrawer ? "open" : ""}`}>
        <h4>Quick</h4>
        <button type="button" onClick={() => { onOpenBag?.(); setLeftDrawer(false); }}>
          Bag / Equip
        </button>
        <button type="button" onClick={() => { setActivity("build"); setLeftDrawer(false); }}>
          Build mode
        </button>
        <button type="button" onClick={() => { api.touchCycleActivityMode?.(); setLeftDrawer(false); }}>
          Cycle mode (Q)
        </button>
      </aside>

      <button
        type="button"
        className={`mtouch-tab mtouch-tab-right ${rightDrawer ? "open" : ""}`}
        onClick={() => setRightDrawer((v) => !v)}
        aria-label="Open systems panel"
      >
        {rightDrawer ? "›" : "‹"}
      </button>
      <aside className={`mtouch-drawer mtouch-drawer-right ${rightDrawer ? "open" : ""}`}>
        <h4>Systems</h4>
        <button type="button" onClick={() => { onOpenSystems?.(); setRightDrawer(false); }}>
          Skills / Tree
        </button>
        <button
          type="button"
          onClick={() => {
            api.touchFocus?.();
            setRightDrawer(false);
          }}
        >
          Toggle focus
        </button>
        <p className="mtouch-drawer-note">
          Skill stick: drag N/E/S/W for abilities · tap center for focus (RMB)
        </p>
      </aside>
    </div>
  );
}

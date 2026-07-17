/**
 * Upper UI: class skills on Shift+1…5 + passive buff icons with tooltips.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  classAccent,
  ensureClassTreesCached,
  getActiveClassId,
  resolveClassSkillSlots,
  resolvePassiveBuffs,
  type ClassSkillSlot,
  type PassiveBuffIcon,
} from "../lib/classSkillBar";
import type { SkillTree } from "../game/harvestCatalog";
import "./classSkillBar.css";

type Props = {
  characterId?: string | null;
  /** Engine cast hook */
  onCast?: (slot: ClassSkillSlot) => void;
  /** Hide when loadout/systems overlay open */
  visible?: boolean;
};

export function ClassSkillBar({ characterId, onCast, visible = true }: Props) {
  const [trees, setTrees] = useState<SkillTree[]>([]);
  const [classId, setClassId] = useState<string | null>(() => getActiveClassId(characterId));
  const [cds, setCds] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    title: string;
    body: string;
    sub?: string;
  } | null>(null);
  const raf = useRef(0);

  // Refresh class + trees
  useEffect(() => {
    setClassId(getActiveClassId(characterId));
    void ensureClassTreesCached().then(setTrees);
    const onStorage = () => setClassId(getActiveClassId(characterId));
    window.addEventListener("storage", onStorage);
    const onClass = () => {
      setClassId(getActiveClassId(characterId));
      void ensureClassTreesCached().then(setTrees);
    };
    window.addEventListener("grudge:class-selected", onClass);
    // Same-tab unlocks: poll lightly while visible
    const t = window.setInterval(() => {
      setClassId(getActiveClassId(characterId));
    }, 1500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("grudge:class-selected", onClass);
      window.clearInterval(t);
    };
  }, [characterId]);

  // CD tick — real wall-clock dt (not 1/60 per frame; was 2× fast at 120 Hz)
  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      setCds((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k]! > 0) {
            next[k] = Math.max(0, next[k]! - dt);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const slots = useMemo(
    () => resolveClassSkillSlots(trees, classId),
    [trees, classId],
  );
  const passives = useMemo(
    () => resolvePassiveBuffs(trees, classId),
    [trees, classId],
  );
  const accent = classAccent(classId);

  const castSlot = useCallback(
    (slot: ClassSkillSlot) => {
      if (slot.empty || !slot.id) return;
      if ((cds[slot.id] ?? 0) > 0) return;
      setCds((c) => ({ ...c, [slot.id]: slot.cooldownSec }));
      setFlash(slot.id);
      window.setTimeout(() => setFlash((f) => (f === slot.id ? null : f)), 220);
      onCast?.(slot);
    },
    [cds, onCast],
  );

  // Shift+1…5
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const map: Record<string, number> = {
        Digit1: 1,
        Digit2: 2,
        Digit3: 3,
        Digit4: 4,
        Digit5: 5,
        Numpad1: 1,
        Numpad2: 2,
        Numpad3: 3,
        Numpad4: 4,
        Numpad5: 5,
      };
      const n = map[e.code];
      if (!n) return;
      e.preventDefault();
      e.stopPropagation();
      const slot = slots.find((s) => s.slot === n);
      if (slot) castSlot(slot);
    };
    // Capture so Shift+1 is not eaten by Studio Digit1 weapon skills
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible, slots, castSlot]);

  if (!visible) return null;

  const showTip = (
    e: React.MouseEvent,
    title: string,
    body: string,
    sub?: string,
  ) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Keep tooltip on-screen (clamp horizontal)
    const x = Math.min(window.innerWidth - 24, Math.max(24, r.left + r.width / 2));
    const y = Math.min(window.innerHeight - 12, r.bottom + 10);
    setTip({
      x,
      y,
      title,
      body: body || "No description.",
      sub,
    });
  };

  return (
    <div className="csb-root" style={{ ["--csb-accent" as string]: accent }}>
      {/* Passive buffs — upper left of class bar */}
      <div className="csb-passives" aria-label="Class passives">
        {passives.length === 0 ? (
          <span className="csb-passives-empty" title="Unlock passives on the class skill Path">
            Passives
          </span>
        ) : (
          passives.map((p: PassiveBuffIcon) => (
            <button
              key={p.id}
              type="button"
              className="csb-buff"
              style={{ borderColor: `${p.color}88`, color: p.color }}
              onMouseEnter={(e) =>
                showTip(e, p.name, p.desc, p.bonusLine || `${p.kind} · passive`)
              }
              onMouseLeave={() => setTip(null)}
              onFocus={(e) =>
                showTip(e as unknown as React.MouseEvent, p.name, p.desc, p.bonusLine)
              }
              onBlur={() => setTip(null)}
              aria-label={`${p.name}: ${p.desc}`}
            >
              {p.iconUrl ? (
                <img
                  className="csb-buff-img"
                  src={p.iconUrl}
                  alt=""
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const g = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (g) g.style.display = "";
                  }}
                />
              ) : null}
              <span
                className="csb-buff-glyph"
                style={p.iconUrl ? { display: "none" } : undefined}
              >
                {p.glyph}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Class skill bar Shift+1–5 */}
      <div className="csb-bar" role="toolbar" aria-label="Class skills Shift 1 to 5">
        <span className="csb-label">
          {classId ? classId.toUpperCase() : "CLASS"}
          <em>⇧1–5</em>
        </span>
        {slots.map((s) => {
          const cd = cds[s.id] ?? 0;
          const onCd = cd > 0 && !s.empty;
          const frac = onCd && s.cooldownSec > 0 ? cd / s.cooldownSec : 0;
          return (
            <button
              key={s.slot}
              type="button"
              className={
                "csb-slot" +
                (s.empty ? " is-empty" : "") +
                (onCd ? " is-cd" : "") +
                (flash === s.id ? " is-flash" : "")
              }
              disabled={!!s.empty || onCd}
              onClick={() => castSlot(s)}
              onMouseEnter={(e) =>
                showTip(
                  e,
                  s.empty ? "Empty class skill" : s.name,
                  s.empty
                    ? "Unlock actives on the Class Path (K → Class). L0 passives appear as buffs above."
                    : s.desc || "Class skill — Shift + number to cast.",
                  s.empty
                    ? "K · Class Path"
                    : `${(s.kind || "active").toUpperCase()} · CD ${s.cooldownSec}s · ${s.key}`,
                )
              }
              onMouseLeave={() => setTip(null)}
            >
              <span className="csb-key">{s.key}</span>
              {s.iconUrl && !s.empty ? (
                <img
                  className="csb-slot-icon"
                  src={s.iconUrl}
                  alt=""
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
              <span className="csb-name">{s.empty ? "·" : s.name}</span>
              {onCd && (
                <span
                  className="csb-cd-sweep"
                  style={{
                    background: `conic-gradient(rgba(0,0,0,0.72) ${frac * 360}deg, transparent 0deg)`,
                  }}
                />
              )}
              {onCd && <span className="csb-cd-num">{cd.toFixed(1)}</span>}
            </button>
          );
        })}
      </div>

      {tip && (
        <div
          className="csb-tooltip"
          style={{ left: tip.x, top: tip.y }}
          role="tooltip"
        >
          <div className="csb-tip-title">{tip.title}</div>
          <div className="csb-tip-body">{tip.body}</div>
          {tip.sub && <div className="csb-tip-sub">{tip.sub}</div>}
        </div>
      )}
    </div>
  );
}

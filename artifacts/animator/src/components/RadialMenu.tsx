/**
 * Hold-to-open radial options wheel — mode-aware combat / harvest / build tools.
 * Pointer angle picks a wedge; release commits the selection.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerActivityMode, RadialOption } from "../three/playerMode";
import { MODE_COLOR, MODE_LABEL, RADIAL_BY_MODE } from "../three/playerMode";
import "./radialMenu.css";

export interface RadialMenuProps {
  open: boolean;
  mode: PlayerActivityMode;
  /** Currently selected tool id (persists after close). */
  selectedId: string;
  /** Live hover index while open (−1 = none). */
  onHover?: (id: string | null) => void;
  /** Commit selection (release / click). */
  onSelect: (id: string) => void;
  /** Cancel without change. */
  onCancel?: () => void;
  /** Center screen label */
  hint?: string;
}

function angleToIndex(deg: number, n: number): number {
  // 0° = right, screen coords: 0 at +X, clockwise positive for atan2 y,x with inverted y
  const slice = 360 / n;
  // Rotate so first wedge is top-center
  let a = (deg + 90 + 360) % 360;
  return Math.floor(a / slice) % n;
}

export function RadialMenu({
  open,
  mode,
  selectedId,
  onHover,
  onSelect,
  onCancel,
  hint,
}: RadialMenuProps) {
  const options = RADIAL_BY_MODE[mode];
  const n = options.length;
  const [hover, setHover] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setHover(-1);
      return;
    }
    // Start on currently selected tool
    const idx = options.findIndex((o) => o.id === selectedId);
    setHover(idx >= 0 ? idx : 0);
  }, [open, selectedId, mode, options]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!open || !rootRef.current) return;
      const r = rootRef.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 28) {
        setHover(-1);
        onHover?.(null);
        return;
      }
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const i = angleToIndex(deg, n);
      setHover(i);
      onHover?.(options[i]?.id ?? null);
    },
    [open, n, options, onHover],
  );

  const commit = useCallback(() => {
    if (hover >= 0 && options[hover]) onSelect(options[hover]!.id);
  }, [hover, options, onSelect]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
      // Number keys 1–8 pick wedges
      if (e.code.startsWith("Digit")) {
        const d = Number(e.code.slice(5));
        if (d >= 1 && d <= n) {
          e.preventDefault();
          onSelect(options[d - 1]!.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, n, options, onSelect, onCancel]);

  const wedges = useMemo(() => {
    const slice = 360 / n;
    return options.map((opt, i) => {
      const start = -90 + i * slice;
      const end = start + slice;
      const mid = ((start + end) / 2) * (Math.PI / 180);
      const r = 108;
      const lx = 50 + (Math.cos(mid) * r) / 2.4;
      const ly = 50 + (Math.sin(mid) * r) / 2.4;
      const active = hover === i || (hover < 0 && opt.id === selectedId);
      return { opt, i, start, end, slice, lx, ly, active };
    });
  }, [options, n, hover, selectedId]);

  if (!open) return null;

  const accent = MODE_COLOR[mode];
  const focus = hover >= 0 ? options[hover] : options.find((o) => o.id === selectedId) ?? options[0];

  return (
    <div
      className="radial-root"
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerUp={commit}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
      aria-label={`${MODE_LABEL[mode]} options`}
    >
      <div className="radial-backdrop" />
      <div className="radial-wheel" style={{ ["--radial-accent" as string]: accent }}>
        <svg className="radial-svg" viewBox="0 0 100 100">
          {wedges.map(({ opt, i, start, slice, active }) => {
            const a0 = (start * Math.PI) / 180;
            const a1 = ((start + slice) * Math.PI) / 180;
            const r0 = 22;
            const r1 = 48;
            const x0 = 50 + r0 * Math.cos(a0);
            const y0 = 50 + r0 * Math.sin(a0);
            const x1 = 50 + r1 * Math.cos(a0);
            const y1 = 50 + r1 * Math.sin(a0);
            const x2 = 50 + r1 * Math.cos(a1);
            const y2 = 50 + r1 * Math.sin(a1);
            const x3 = 50 + r0 * Math.cos(a1);
            const y3 = 50 + r0 * Math.sin(a1);
            const large = slice > 180 ? 1 : 0;
            const d = [
              `M ${x0} ${y0}`,
              `L ${x1} ${y1}`,
              `A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2}`,
              `L ${x3} ${y3}`,
              `A ${r0} ${r0} 0 ${large} 0 ${x0} ${y0}`,
              "Z",
            ].join(" ");
            return (
              <path
                key={opt.id}
                d={d}
                className={"radial-wedge" + (active ? " is-active" : "")}
                style={{ fill: active ? opt.color + "55" : "rgba(12,16,28,0.82)", stroke: active ? opt.color : "rgba(120,140,200,0.25)" }}
                onPointerEnter={() => {
                  setHover(i);
                  onHover?.(opt.id);
                }}
              />
            );
          })}
          <circle cx="50" cy="50" r="20" className="radial-hub" />
        </svg>
        {wedges.map(({ opt, lx, ly, active }) => (
          <div
            key={opt.id + "-lab"}
            className={"radial-label" + (active ? " is-active" : "")}
            style={{ left: `${lx}%`, top: `${ly}%`, color: active ? opt.color : "#c8d0e8" }}
          >
            <span className="radial-glyph">{opt.glyph}</span>
            <span className="radial-name">{opt.label}</span>
            {opt.hint && <span className="radial-hint">{opt.hint}</span>}
          </div>
        ))}
        <div className="radial-center">
          <span className="radial-mode" style={{ color: accent }}>
            {MODE_LABEL[mode]}
          </span>
          <span className="radial-focus">{focus?.glyph} {focus?.label}</span>
          <span className="radial-tip">{hint ?? "Release to select · Esc cancel · 1–8 quick"}</span>
        </div>
      </div>
    </div>
  );
}

export type { RadialOption, PlayerActivityMode };

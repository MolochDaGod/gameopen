import type { ReticleShape } from "../three/aim/reticleProfiles";

interface Props {
  visible: boolean;
  /**
   * Extra gap (px) added between the centre of the **crosshair** ticks and the
   * free-aim origin. Driven by movement + recoil bloom.
   */
  spread?: number;
  /** First-person reticle variant (tighter, brighter) vs the third-person one. */
  firstPerson?: boolean;
  /** Rising on a confirmed hit; pulses the hit-marker. Compare by identity/number. */
  hitMarker?: number;
  /**
   * Focused enemy's position relative to Optimal Weapon Range — draws a colored
   * distance ring: green = optimal, yellow = too far, red = too close, none = no ring.
   */
  rangeState?: "close" | "optimal" | "far" | "none";
  /**
   * Free-aim offset from screen centre (NDC-ish, ~[-0.55, 0.55]).
   * 0,0 = crosshair sits on the fixed centre **dot**.
   */
  aimNdcX?: number;
  aimNdcY?: number;
  /** Soft vs hard focus — soft shows a slightly larger reticle. */
  focusLocked?: boolean;
  /**
   * Activity / loco variant for best-UX reticle colours:
   * combat | harvest | build | swim | climb | free
   */
  variant?: "combat" | "harvest" | "build" | "swim" | "climb" | "free";
  /** Free-mouse play: dim the fixed centre dot (OS cursor is the aim). */
  freeMouse?: boolean;
  /**
   * Weapon-specific shape:
   *   dot   — swords / melee
   *   x     — bows
   *   cross — guns / crossbows
   *   ring  — staffs (pulses; expands for AoE)
   */
  shape?: ReticleShape;
  /** Staff ring pulse 0–1 phase (host drives with time). */
  pulse?: number;
  /**
   * AoE cast expand scale (1 = idle ring; >1 = ability radius indicator).
   * Only applies to `ring` shape.
   */
  aoeScale?: number;
  /** Optional HUD-editor binding (layout vars + drag/select when editing). */
  editBind?: {
    "data-hud-panel": string;
    className: string;
    style: React.CSSProperties;
    onPointerDown?: (e: React.PointerEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
  };
}

/**
 * Weapon-aware dual reticle:
 *  - Melee: fixed centre **dot**
 *  - Bow: **X** free-aim mark
 *  - Gun: classic **+** ticks + centre pip
 *  - Staff: breathing **ring** that becomes the AoE telegraph when casting
 */
export function Crosshair({
  visible,
  spread = 0,
  firstPerson = false,
  hitMarker = 0,
  rangeState = "none",
  aimNdcX = 0,
  aimNdcY = 0,
  focusLocked = false,
  variant = "combat",
  freeMouse = false,
  shape = "cross",
  pulse = 0,
  aoeScale = 1,
  editBind,
}: Props) {
  const editing = !!editBind && editBind.className.includes("hud-editable");
  if (!visible && !editing) return null;

  const gap = Math.max(0, Math.min(32, spread));
  const leftPct = 50 + aimNdcX * 50;
  const topPct = 50 - aimNdcY * 50;

  // Staff breathe: 1 ± amp * sin(phase)
  const pulseScale =
    shape === "ring" ? 1 + 0.14 * Math.sin(pulse * Math.PI * 2) : 1;
  const ringScale = Math.max(0.5, aoeScale) * pulseScale;

  const chStyle = {
    ["--ch-gap" as string]: `${gap}px`,
    ["--ch-ring-scale" as string]: String(ringScale),
    left: `${leftPct}%`,
    top: `${topPct}%`,
    ...editBind?.style,
  } as React.CSSProperties;

  const variantClass =
    variant === "harvest"
      ? "crosshair-harvest"
      : variant === "build"
        ? "crosshair-build"
        : variant === "swim"
          ? "crosshair-swim"
          : variant === "climb"
            ? "crosshair-climb"
            : variant === "free"
              ? "crosshair-free"
              : "";

  const shapeClass = `crosshair-shape-${shape}`;
  const aoeLive = shape === "ring" && aoeScale > 1.08;

  // Melee: only the centre dot (no free-aim ticks)
  if (shape === "dot") {
    return (
      <>
        <div
          data-hud-panel={editBind?.["data-hud-panel"]}
          className={[
            "aim-center-dot",
            "aim-center-dot-melee",
            freeMouse ? "aim-center-dot-free" : "",
            focusLocked ? "aim-dot-focus" : "",
            editBind ? editBind.className : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            ...editBind?.style,
          }}
          onPointerDown={editBind?.onPointerDown}
          onContextMenu={editBind?.onContextMenu}
          aria-hidden
        />
        {hitMarker > 0 && (
          <div className="crosshair crosshair-hit-only" style={chStyle} aria-hidden>
            <span key={hitMarker} className="ch-hit">
              <span className="ch-hit-line ch-hit-tl" />
              <span className="ch-hit-line ch-hit-tr" />
              <span className="ch-hit-line ch-hit-bl" />
              <span className="ch-hit-line ch-hit-br" />
            </span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Fixed centre reference — hidden for bow X (the X is the aim) */}
      {shape !== "x" && (
        <div
          className={`aim-center-dot${freeMouse ? " aim-center-dot-free" : ""}`}
          aria-hidden
        />
      )}
      <div
        data-hud-panel={editBind?.["data-hud-panel"]}
        className={[
          "crosshair",
          shapeClass,
          firstPerson ? "crosshair-fp" : "",
          focusLocked ? "crosshair-focus" : "crosshair-soft",
          freeMouse ? "crosshair-freemouse" : "",
          aoeLive ? "crosshair-aoe-live" : "",
          variantClass,
          editBind ? editBind.className : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={chStyle}
        onPointerDown={editBind?.onPointerDown}
        onContextMenu={editBind?.onContextMenu}
        aria-hidden
      >
        {rangeState !== "none" && shape !== "ring" && (
          <span className={`ch-range ch-range-${rangeState}`} />
        )}

        {/* ── shape bodies ─────────────────────────────────────────── */}
        {shape === "cross" && (
          <>
            <span className="ch-dot" />
            <span className="ch-line ch-top" />
            <span className="ch-line ch-bottom" />
            <span className="ch-line ch-left" />
            <span className="ch-line ch-right" />
          </>
        )}

        {shape === "x" && (
          <>
            <span className="ch-x ch-x-a" />
            <span className="ch-x ch-x-b" />
            <span className="ch-x-gap" />
          </>
        )}

        {shape === "ring" && (
          <>
            <span className="ch-ring ch-ring-outer" />
            <span className="ch-ring ch-ring-inner" />
            <span className="ch-dot ch-ring-pip" />
            {aoeLive && <span className="ch-aoe-label">AoE</span>}
          </>
        )}

        {hitMarker > 0 && (
          <span key={hitMarker} className="ch-hit">
            <span className="ch-hit-line ch-hit-tl" />
            <span className="ch-hit-line ch-hit-tr" />
            <span className="ch-hit-line ch-hit-bl" />
            <span className="ch-hit-line ch-hit-br" />
          </span>
        )}
      </div>
    </>
  );
}

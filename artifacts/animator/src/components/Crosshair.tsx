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
 * Dual reticle:
 *  - Fixed **centre dot** at screen middle (always — body/camera reference).
 *  - Free-aim **crosshair** (ticks) that tracks aimNdc offset; attacks + select
 *    use the ray through this crosshair. RMB snaps offset to 0 (crosshair on dot).
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
  editBind,
}: Props) {
  // `visible` stays authoritative for normal play; only force the reticle on
  // while actively editing the HUD (so it can be arranged even with panels open).
  const editing = !!editBind && editBind.className.includes("hud-editable");
  if (!visible && !editing) return null;
  const gap = Math.max(0, Math.min(28, spread));
  // Map NDC offset → % of viewport (0.5 NDC ≈ 25% of half-screen from centre)
  const leftPct = 50 + aimNdcX * 50;
  const topPct = 50 - aimNdcY * 50;
  const chStyle = {
    ["--ch-gap" as string]: `${gap}px`,
    left: `${leftPct}%`,
    top: `${topPct}%`,
    ...editBind?.style,
  } as React.CSSProperties;

  return (
    <>
      {/* Fixed centre reference — simple dot, never moves with free-aim */}
      <div className="aim-center-dot" aria-hidden />
      <div
        data-hud-panel={editBind?.["data-hud-panel"]}
        className={[
          "crosshair",
          firstPerson ? "crosshair-fp" : "",
          focusLocked ? "crosshair-focus" : "crosshair-soft",
          editBind ? editBind.className : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={chStyle}
        onPointerDown={editBind?.onPointerDown}
        onContextMenu={editBind?.onContextMenu}
        aria-hidden
      >
        {rangeState !== "none" && <span className={`ch-range ch-range-${rangeState}`} />}
        <span className="ch-dot" />
        <span className="ch-line ch-top" />
        <span className="ch-line ch-bottom" />
        <span className="ch-line ch-left" />
        <span className="ch-line ch-right" />
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

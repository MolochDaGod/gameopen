interface Props {
  visible: boolean;
  /**
   * Extra gap (px) added between the centre dot and each tick, on top of the base
   * gap. Driven by movement + recoil bloom so the reticle "blooms" when your shots
   * are less accurate. 0 = tightest.
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
  /** Optional HUD-editor binding (layout vars + drag/select when editing). */
  editBind?: {
    "data-hud-panel": string;
    className: string;
    style: React.CSSProperties;
    onPointerDown?: (e: React.PointerEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
  };
}

export function Crosshair({
  visible,
  spread = 0,
  firstPerson = false,
  hitMarker = 0,
  rangeState = "none",
  editBind,
}: Props) {
  // `visible` stays authoritative for normal play; only force the reticle on
  // while actively editing the HUD (so it can be arranged even with panels open).
  const editing = !!editBind && editBind.className.includes("hud-editable");
  if (!visible && !editing) return null;
  const gap = Math.max(0, Math.min(28, spread));
  // The tick lines push outward from the centre by the bloom gap; merge in any
  // editor layout vars (offset / scale) supplied via editBind.
  const style = { ["--ch-gap" as string]: `${gap}px`, ...editBind?.style } as React.CSSProperties;
  return (
    <div
      data-hud-panel={editBind?.["data-hud-panel"]}
      className={`crosshair${firstPerson ? " crosshair-fp" : ""}${editBind ? ` ${editBind.className}` : ""}`}
      style={style}
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
  );
}

/**
 * Debug / AI overlay: 12×12 HYDRA canvas + named views.
 * pointer-events: none — never steals combat input.
 */
import { useEffect, useState } from "react";
import type { HudLayoutId } from "../../hud/hudConfig";
import {
  HUD_DESIGN,
  HUD_VIEW_CONTRACT,
  fitHudCanvas,
  viewRect,
  viewsForLayout,
  type HudCanvasFit,
} from "../../hud/viewGrid";
import "./hudViewGrid.css";

interface Props {
  layout: HudLayoutId;
}

function readSize(): { w: number; h: number } {
  return { w: window.innerWidth, h: window.innerHeight };
}

export function HudViewGrid({ layout }: Props) {
  const [vp, setVp] = useState(readSize);
  useEffect(() => {
    const on = () => setVp(readSize());
    window.addEventListener("resize", on);
    (window as unknown as { __GRUDGE_HUD_VIEW_GRID?: typeof HUD_VIEW_CONTRACT }).__GRUDGE_HUD_VIEW_GRID =
      HUD_VIEW_CONTRACT;
    return () => {
      window.removeEventListener("resize", on);
    };
  }, []);

  const fit: HudCanvasFit = fitHudCanvas(vp.w, vp.h);
  const views = viewsForLayout(layout);

  return (
    <div className="hud-view-grid" aria-hidden>
      <div
        className="hud-view-canvas"
        style={{
          left: fit.x,
          top: fit.y,
          width: fit.w,
          height: fit.h,
        }}
      >
        <div
          className="hud-view-cells"
          style={{
            gridTemplateColumns: `repeat(${HUD_DESIGN.cols}, 1fr)`,
            gridTemplateRows: `repeat(${HUD_DESIGN.rows}, 1fr)`,
          }}
        >
          {Array.from({ length: HUD_DESIGN.cols * HUD_DESIGN.rows }, (_, i) => (
            <span key={i} className="hud-view-cell" />
          ))}
        </div>
        {views.map((v) => {
          const r = viewRect(v);
          return (
            <div
              key={v.id}
              className={`hud-view-slot hud-view-role-${v.role}`}
              data-view={v.id}
              data-hydra={v.hydra}
              data-hud-panel={v.panel ?? ""}
              style={{
                left: `${(r.x / HUD_DESIGN.w) * 100}%`,
                top: `${(r.y / HUD_DESIGN.h) * 100}%`,
                width: `${(r.w / HUD_DESIGN.w) * 100}%`,
                height: `${(r.h / HUD_DESIGN.h) * 100}%`,
                zIndex: v.z,
              }}
            >
              <span className="hud-view-label">
                {v.id}
                <em>{v.hydra}</em>
              </span>
            </div>
          );
        })}
      </div>
      <div className="hud-view-legend">
        1920×1080 · 12×12 · {layout} · letterbox · window.__GRUDGE_HUD_VIEW_GRID
      </div>
    </div>
  );
}

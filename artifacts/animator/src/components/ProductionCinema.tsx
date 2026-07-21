/**
 * Production cinema shell — letterbox, captions, skip / continue, Three.js stage.
 * Used for doors ambient, intro→characters handoff, lobby/sector establish, etc.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCinema,
  ProductionCinemaScene,
  type CinemaTimelineState,
} from "../three/cinema";
import "./productionCinema.css";

export type ProductionCinemaProps = {
  /** Catalog id e.g. intro_doors | intro_to_characters | char_select_establish */
  cinemaId: string;
  /** Full-viewport interactive flow vs passive backdrop under UI */
  mode?: "backdrop" | "flow";
  /** Show letterbox + captions */
  showHud?: boolean;
  /** Called when linear cinema finishes or is skipped */
  onComplete?: (transitionTo: string | null | undefined) => void;
  /** Extra class on root */
  className?: string;
  /** z-index layer (backdrop under doors UI uses low z) */
  zIndex?: number;
};

export function ProductionCinema({
  cinemaId,
  mode = "backdrop",
  showHud = true,
  onComplete,
  className = "",
  zIndex,
}: ProductionCinemaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<ProductionCinemaScene | null>(null);
  const [state, setState] = useState<CinemaTimelineState | null>(null);
  const manifest = getCinema(cinemaId);

  const finish = useCallback(() => {
    onComplete?.(manifest?.transitionTo ?? null);
  }, [manifest?.transitionTo, onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !manifest) return;
    let scene: ProductionCinemaScene | null = null;
    try {
      scene = new ProductionCinemaScene(canvas, manifest, {
        onState: (s) => setState(s),
        onComplete: () => finish(),
      });
      sceneRef.current = scene;
    } catch (err) {
      console.warn("[ProductionCinema] init failed", cinemaId, err);
      if (!manifest.loop) finish();
    }
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [cinemaId, manifest, finish]);

  if (!manifest) {
    console.warn("[ProductionCinema] unknown id", cinemaId);
    return null;
  }

  const isFlow = mode === "flow";
  const showSkip = isFlow && (state?.canSkip ?? false) && !state?.finished;
  const caption = state?.caption || (isFlow ? manifest.title : "");
  const sub = state?.sub || "";

  return (
    <div
      className={`prod-cinema ${isFlow ? "prod-cinema--flow" : "prod-cinema--backdrop"} ${className}`}
      style={zIndex != null ? { zIndex } : undefined}
      aria-hidden={!isFlow}
    >
      <canvas ref={canvasRef} className="prod-cinema-canvas" />
      {showHud && (
        <>
          <div className="prod-cinema-letterbox prod-cinema-letterbox--top" />
          <div className="prod-cinema-letterbox prod-cinema-letterbox--bot" />
          {(caption || sub) && (
            <div className="prod-cinema-captions">
              {caption ? <div className="prod-cinema-title">{caption}</div> : null}
              {sub ? <div className="prod-cinema-sub">{sub}</div> : null}
            </div>
          )}
          {isFlow && (
            <div className="prod-cinema-controls">
              {showSkip && (
                <button
                  type="button"
                  className="prod-cinema-btn"
                  onClick={() => sceneRef.current?.skip()}
                >
                  Skip
                </button>
              )}
              {manifest.transitionTo === "characters" && (
                <button
                  type="button"
                  className="prod-cinema-btn prod-cinema-btn--primary"
                  onClick={() => {
                    sceneRef.current?.skip();
                    finish();
                  }}
                >
                  Enter roster
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

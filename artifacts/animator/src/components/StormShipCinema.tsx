/**
 * Landing / intro cinema — Production Open · island-3d Storm Ship Attack.
 */
import { useEffect, useRef, useState } from "react";
import { StormShipAttackScene } from "../three/cinema/StormShipAttackScene";
import "./productionCinema.css";
import "./stormShipCinema.css";

type Props = {
  /** When true, show skip + Enter CTA */
  interactive?: boolean;
  onComplete?: () => void;
  className?: string;
};

export function StormShipCinema({
  interactive = true,
  onComplete,
  className = "",
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<StormShipAttackScene | null>(null);
  const [caption, setCaption] = useState("PRODUCTION OPEN · ISLAND-3D");
  const [sub, setSub] = useState("Storm Ship Attack");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let scene: StormShipAttackScene | null = null;
    try {
      scene = new StormShipAttackScene(canvas, {
        onCaption: (c, s) => {
          setCaption(c);
          setSub(s);
        },
        onComplete: () => onComplete?.(),
      });
      sceneRef.current = scene;
    } catch (err) {
      console.warn("[StormShipCinema] init failed", err);
      onComplete?.();
    }
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [onComplete]);

  return (
    <div className={`storm-ship-cinema ${className}`} aria-hidden={!interactive}>
      <canvas ref={ref} className="storm-ship-canvas" />
      <div className="prod-cinema-letterbox prod-cinema-letterbox--top" />
      <div className="prod-cinema-letterbox prod-cinema-letterbox--bot" />
      <div className="prod-cinema-captions storm-ship-captions">
        <div className="prod-cinema-title">{caption}</div>
        {sub ? <div className="prod-cinema-sub">{sub}</div> : null}
      </div>
      {interactive && (
        <div className="prod-cinema-controls storm-ship-controls">
          <button
            type="button"
            className="prod-cinema-btn"
            onClick={() => sceneRef.current?.skip()}
          >
            Skip
          </button>
          <button
            type="button"
            className="prod-cinema-btn prod-cinema-btn--primary"
            onClick={() => {
              sceneRef.current?.skip();
              onComplete?.();
            }}
          >
            Enter Open
          </button>
        </div>
      )}
    </div>
  );
}

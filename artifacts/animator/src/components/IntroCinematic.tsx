import { useEffect, useRef } from "react";
import { IntroScene } from "../three/intro/IntroScene";

/**
 * Full-viewport cinematic backdrop for the door-select landing. Owns a WebGL
 * canvas driving {@link IntroScene}; fails silently (renders nothing) if WebGL
 * is unavailable so the door UI always stays usable.
 */
export function IntroCinematic() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let scene: IntroScene | null = null;
    try {
      scene = new IntroScene(canvas);
    } catch (err) {
      console.warn("[intro] cinematic init failed", err);
    }
    return () => scene?.dispose();
  }, []);

  return (
    <div className="intro-cinematic" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}

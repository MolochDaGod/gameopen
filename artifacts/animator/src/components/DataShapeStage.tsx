/**
 * GRUDOX zones presentation stage — spline graph + “Another shape of data” GLB.
 * Lightweight WebGL canvas (no full Studio). Improves /zones visual language.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createDataShapeSplineStage } from "../three/fx/splineVfx";

export function DataShapeStage({ height = 220 }: { height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);
    scene.fog = new THREE.Fog(0x060a12, 6, 18);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    camera.position.set(0, 2.4, 7.2);
    camera.lookAt(0, 0.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xaaccff, 0x1a1020, 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 8, 3);
    scene.add(key);
    const rim = new THREE.PointLight(0x5fe0ff, 2.2, 20);
    rim.position.set(-2, 2, 2);
    scene.add(rim);

    let handle: Awaited<ReturnType<typeof createDataShapeSplineStage>> | null = null;
    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const resize = () => {
      const w = el.clientWidth || 320;
      const h = el.clientHeight || height;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    void createDataShapeSplineStage({ nodeCount: 10, radius: 2.8, loadShape: true }).then(
      (h) => {
        if (disposed) {
          h.dispose();
          return;
        }
        handle = h;
        scene.add(h.group);
      },
    );

    const loop = () => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      handle?.update(dt);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      handle?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, [height]);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(95,224,255,0.25)",
        boxShadow: "0 0 28px rgba(95,224,255,0.12)",
        background: "#060a12",
      }}
      aria-hidden
    />
  );
}

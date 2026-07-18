/**
 * Full-viewport load / intro overlay using helpers.glb:
 * circle pad, character in the middle, orbit + zoom camera (upper focus).
 * Used while Danger Room / arena assets warm up.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadGltfFirst } from "../three/assets";
import { sharedGltfLoader } from "../three/loaders/gltf";
import {
  HELPERS_FORGE_PATHS,
  centerXZ,
  findHelpersCharacter,
  fitForgeScene,
  makeIntroCircle,
  makeIntroRing,
  plantOnGround,
  prepHelperMeshes,
} from "../three/helpersForge";
import "./helpersLoadScreen.css";

interface Props {
  /** 0..1 progress; when omitted, indeterminate pulse. */
  progress?: number;
  label?: string;
  visible?: boolean;
}

export function HelpersLoadScreen({
  progress,
  label = "LOADING",
  visible = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let raf = 0;
    const clock = new THREE.Clock();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05080f, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05080f, 0.032);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 160);
    camera.position.set(4.5, 2.6, 5.2);

    scene.add(new THREE.HemisphereLight(0xc0d8ff, 0x121018, 0.75));
    const key = new THREE.DirectionalLight(0xfff2e0, 1.55);
    key.position.set(5, 11, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x5ab8ff, 0.9);
    fill.position.set(-6, 4, -3);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    const circle = makeIntroCircle(3.1, 0x2f7fff);
    const ring = makeIntroRing(3.25, 0x9ad8ff);
    root.add(circle, ring);

    let focus = new THREE.Vector3(0, 1.3, 0);
    let orbitR = 4.8;
    let hero: THREE.Object3D | null = null;
    let heroY = 0;
    let ready = false;

    void (async () => {
      try {
        const { scene: pack } = await loadGltfFirst([...HELPERS_FORGE_PATHS], sharedGltfLoader(), {
          prepMaterials: true,
        });
        if (disposed) return;
        prepHelperMeshes(pack, true);
        const character = findHelpersCharacter(pack);
        if (character) {
          character.parent?.remove(character);
          fitForgeScene(pack, { maxXZ: 12 });
          // Dim environment slightly so character reads as hero
          pack.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) {
              if (mat && "emissiveIntensity" in mat) {
                (mat as THREE.MeshStandardMaterial).emissiveIntensity =
                  ((mat as THREE.MeshStandardMaterial).emissiveIntensity ?? 0) * 0.6;
              }
            }
          });
          root.add(pack);
          plantOnGround(character, 1.85);
          centerXZ(character);
          character.position.set(0, character.position.y, 0);
          root.add(character);
          hero = character;
          heroY = character.position.y;
          const box = new THREE.Box3().setFromObject(character);
          const size = box.getSize(new THREE.Vector3());
          focus.set(0, box.min.y + size.y * 0.75, 0);
          orbitR = Math.max(3.6, size.y * 2.35);
        } else {
          fitForgeScene(pack, { maxXZ: 11 });
          root.add(pack);
          const box = new THREE.Box3().setFromObject(pack);
          const size = box.getSize(new THREE.Vector3());
          focus.set(0, size.y * 0.5, 0);
          orbitR = 5.2;
        }
        ready = true;
      } catch (err) {
        console.warn("[HelpersLoadScreen]", err);
      }
    })();

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      if (hero) {
        hero.position.y = heroY + Math.sin(t * 1.1) * 0.03;
        hero.rotation.y = Math.PI + t * 0.16;
      }

      const pulse = 1 + Math.sin(t * 1.1) * 0.03;
      circle.scale.setScalar(pulse);
      ring.scale.setScalar(pulse);

      const orbit = t * 0.24;
      const zoom = ready ? 0.9 + Math.sin(t * 0.28) * 0.14 : 1.2;
      const radius = orbitR * zoom;
      const y = focus.y + 0.45 + Math.sin(t * 0.3) * 0.5;
      camera.position.set(Math.cos(orbit) * radius, y, Math.sin(orbit) * radius);
      camera.lookAt(focus);
      camera.fov = 33 + Math.sin(t * 0.2) * 2.2;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
    };
  }, [visible]);

  if (!visible) return null;

  const pct =
    progress != null && Number.isFinite(progress)
      ? Math.round(Math.max(0, Math.min(1, progress)) * 100)
      : null;

  return (
    <div className="helpers-load" role="status" aria-live="polite" aria-label={label}>
      <canvas ref={canvasRef} className="helpers-load-canvas" />
      <div className="helpers-load-vignette" aria-hidden />
      <div className="helpers-load-ui">
        <div className="helpers-load-title">{label}</div>
        <div className="helpers-load-bar-track">
          <div
            className="helpers-load-bar-fill"
            style={{
              width: pct != null ? `${pct}%` : undefined,
              animation: pct == null ? "helpers-load-indeterminate 1.4s ease-in-out infinite" : undefined,
            }}
          />
        </div>
        <div className="helpers-load-pct">{pct != null ? `${pct}%` : "…"}</div>
      </div>
    </div>
  );
}

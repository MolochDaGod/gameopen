import * as THREE from "three";
import {
  BloomEffect,
  BlendFunction,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  KernelSize,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";

/**
 * Reusable post-processing stack (pmndrs `postprocessing`) tuned for the
 * mystical purple/green/black-night look used by the opening cinematic and the
 * game-scene backdrops:
 *
 *   HDR mipmap Bloom (ethereal glow) → Hue/Saturation grade (colour lift) →
 *   Chromatic aberration (dreamy edges) → dark Vignette (night framing) →
 *   film Noise (atmosphere) → ACES tone-map.
 *
 * Why pmndrs over three's `examples/jsm` passes: effects are merged into a
 * single fullscreen pass (one draw instead of one-per-effect), bloom uses
 * mipmap blur (cheaper + softer), and it ships an HDR pipeline. pmndrs owns
 * tone mapping, so the renderer's own `toneMapping` is switched to
 * `NoToneMapping` here and the in-composer {@link ToneMappingEffect} applies
 * ACES — avoiding a double tone-map. A HalfFloat frame buffer gives bloom real
 * HDR range.
 */
export interface MysticalFxOptions {
  /** Bloom strength (ethereal glow). */
  bloomIntensity?: number;
  /** Luminance above which pixels bloom (lower = more glow). */
  bloomThreshold?: number;
  /** Mipmap-bloom spread radius, 0..1. */
  bloomRadius?: number;
  /** Additive saturation lift, -1..1. */
  saturation?: number;
  /** Hue rotation in radians (nudge toward the purple/green grade). */
  hue?: number;
  /** Vignette darkness, 0..1. */
  vignetteDarkness?: number;
  /** Chromatic-aberration offset (per axis). */
  chromatic?: number;
  /** Film-grain opacity, 0..1. */
  grain?: number;
}

export interface MysticalComposer {
  composer: EffectComposer;
  /** Render one frame (optional `dt` drives time-based effects like noise). */
  render: (dt?: number) => void;
  setSize: (w: number, h: number) => void;
  dispose: () => void;
}

/** Build the mystical composer for `scene`/`camera` on `renderer`. */
export function createMysticalComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: MysticalFxOptions = {},
): MysticalComposer {
  // pmndrs applies tone mapping in-composer; disable the renderer's own so the
  // frame isn't tone-mapped twice.
  renderer.toneMapping = THREE.NoToneMapping;

  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
  });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: opts.bloomIntensity ?? 1.1,
    luminanceThreshold: opts.bloomThreshold ?? 0.18,
    luminanceSmoothing: 0.5,
    mipmapBlur: true,
    radius: opts.bloomRadius ?? 0.72,
    kernelSize: KernelSize.LARGE,
  });
  const grade = new HueSaturationEffect({
    hue: opts.hue ?? 0,
    saturation: opts.saturation ?? 0.16,
  });
  const chroma = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(opts.chromatic ?? 0.0009, opts.chromatic ?? 0.0009),
    radialModulation: true,
    modulationOffset: 0.4,
  });
  const vignette = new VignetteEffect({
    offset: 0.28,
    darkness: opts.vignetteDarkness ?? 0.62,
  });
  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY });
  noise.blendMode.opacity.value = opts.grain ?? 0.06;
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

  // One merged fullscreen pass for the whole stack.
  composer.addPass(new EffectPass(camera, bloom, grade, chroma, vignette, noise, tone));

  return {
    composer,
    render: (dt?: number) => composer.render(dt),
    setSize: (w: number, h: number) => composer.setSize(w, h),
    dispose: () => composer.dispose(),
  };
}

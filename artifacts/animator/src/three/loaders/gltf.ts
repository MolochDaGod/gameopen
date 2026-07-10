import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * Optimized glTF/GLB loading for the whole app.
 *
 * A single factory wires the three decoder extensions modern art pipelines rely
 * on so compressed assets "just load":
 *  - **Draco** — quantized/compressed geometry,
 *  - **Meshopt** — compressed geometry + animation buffers,
 *  - **KTX2 / Basis Universal** — GPU-compressed (transcoded) textures, wired
 *    only when a live renderer is supplied (it needs GPU support detection).
 *
 * A plain, uncompressed glTF/GLB still loads exactly as before — a decoder only
 * activates for an asset that declares its extension — so swapping
 * `new GLTFLoader()` for {@link sharedGltfLoader}/{@link makeGltfLoader} is a
 * zero-risk capability upgrade that also routes every load through one shared
 * {@link THREE.LoadingManager} (single progress/error surface).
 *
 * Decoders are loaded from stable CDNs pinned to this app's `three` version;
 * they can be self-hosted under `public/` later without touching call sites.
 */

/** Google-hosted Draco decoder (WASM + JS glue). */
const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/v1/decoders/";
/** Basis Universal transcoder for KTX2, pinned to the installed three version. */
const KTX2_TRANSCODER_PATH =
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/basis/";

/** Shared progress/error surface for every optimized load. */
export const gltfManager = new THREE.LoadingManager();

/** Draco decoder is process-wide (its worker pool is expensive to recreate). */
let sharedDraco: DRACOLoader | null = null;
function draco(): DRACOLoader {
  if (!sharedDraco) {
    sharedDraco = new DRACOLoader(gltfManager);
    sharedDraco.setDecoderPath(DRACO_DECODER_PATH);
  }
  return sharedDraco;
}

export interface GltfLoaderOptions {
  /** Override the shared LoadingManager for a scoped load surface. */
  manager?: THREE.LoadingManager;
  /** Supply a live renderer to enable KTX2 (needs GPU support detection). */
  renderer?: THREE.WebGLRenderer;
}

/** Build a decoder-optimized {@link GLTFLoader} (Draco + Meshopt, KTX2 opt-in). */
export function makeGltfLoader(opts: GltfLoaderOptions = {}): GLTFLoader {
  const manager = opts.manager ?? gltfManager;
  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(draco());
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (opts.renderer) {
    const ktx2 = new KTX2Loader(manager)
      .setTranscoderPath(KTX2_TRANSCODER_PATH)
      .detectSupport(opts.renderer);
    loader.setKTX2Loader(ktx2);
  }
  return loader;
}

/**
 * A shared decoder-optimized loader (Draco + Meshopt). No KTX2 — there is no
 * renderer at module scope; a scene that needs transcoded textures builds its
 * own via {@link makeGltfLoader} with `{ renderer }`.
 */
let shared: GLTFLoader | null = null;
export function sharedGltfLoader(): GLTFLoader {
  if (!shared) shared = makeGltfLoader();
  return shared;
}

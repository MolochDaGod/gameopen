import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { DangerRoom } from "../DangerRoom";
import { VoxelCharacter } from "../explorer/rig";
import { DEFAULT_LOOK, loadSkeletonSource } from "../explorer/loader";
import {
  buildAnimationClip,
  deleteStoredClip,
  getStoredClip,
  listStoredClips,
  saveStoredClip,
  totalDuration,
  type ClipFrame,
  type QuatTuple,
} from "./clipStore";
import { POSABLE_BONES } from "./posableBones";

const IDENTITY: QuatTuple = [0, 0, 0, 1];
const DEFAULT_FRAME_DURATION = 0.4;
const HANDLE_RADIUS = 0.045;
const HANDLE_COLOR = 0x6ea8ff;
const HANDLE_SELECTED = 0xffd24d;

/** A bone the UI can list + select. */
export interface BoneInfo {
  name: string;
  label: string;
}

/** Per-frame summary for the timeline UI. */
export interface FrameInfo {
  duration: number;
}

/** Snapshot the React shell renders from. */
export interface AnimEditorState {
  ready: boolean;
  bones: BoneInfo[];
  selectedBone: string | null;
  frames: FrameInfo[];
  activeFrame: number;
  playing: boolean;
  scrubTime: number;
  duration: number;
  canUndo: boolean;
  gizmoSpace: "local" | "world";
  savedClips: string[];
}

/** Turn a sanitised Mixamo bone name into a friendly label. */
function boneLabel(name: string): string {
  return name.replace(/^mixamorig/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * The Danger Room Animation Creator: a self-contained, disposable three.js tool
 * for authoring frame-based clips. A single procedural (Mixamo-skeleton)
 * character stands on the Danger Room stage; the author selects a bone (click a
 * handle), rotates it with a {@link TransformControls} gizmo to pose the active
 * frame, builds a timeline of frames (add/delete/duplicate/reorder, per-frame
 * duration), scrubs/previews interpolated playback, and saves the clip to a
 * versioned localStorage store so the combat room can list, bind, and play it.
 *
 * Camera is an {@link OrbitControls} rig; the gizmo disables orbit while
 * dragging. No `@workspace/*` imports — this artifact is liftable on its own.
 */
export class AnimEditor {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private room: DangerRoom;
  private orbit: OrbitControls;
  private gizmo: TransformControls;
  private gizmoHelper: THREE.Object3D;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private raf = 0;
  private disposed = false;

  // Character + posing state (populated once the skeleton loads).
  private character: VoxelCharacter | null = null;
  private boneList: string[] = [];
  private bindPose: Record<string, QuatTuple> = {};
  private handleGeo = new THREE.SphereGeometry(HANDLE_RADIUS, 12, 12);
  private handles = new Map<string, THREE.Mesh>();
  private handleGroup = new THREE.Group();

  // Timeline.
  private frames: ClipFrame[] = [];
  private activeFrame = 0;
  private selectedBone: string | null = null;
  private gizmoSpace: "local" | "world" = "local";

  // Preview playback.
  private mixer: THREE.AnimationMixer | null = null;
  private action: THREE.AnimationAction | null = null;
  private playing = false;
  private previewTime = 0;
  private emitAccum = 0;

  // Single-level undo (the pose of the active frame before the last edit).
  private undoSnapshot: { frame: number; pose: Record<string, QuatTuple> } | null = null;

  // Scratch quaternions for interpolation (avoid per-frame allocs).
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private vTmp = new THREE.Vector3();
  /** The hips' bind-pose local position — the origin for baked root motion. */
  private bindHips = new THREE.Vector3();

  // Pointer click-vs-drag tracking (for handle picking through OrbitControls).
  private downX = 0;
  private downY = 0;

  onState: ((s: AnimEditorState) => void) | null = null;
  onReady: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";

    const { clientWidth: w, clientHeight: h } = container;
    this.renderer.setSize(w || 1, h || 1, false);
    this.camera = new THREE.PerspectiveCamera(50, (w || 1) / (h || 1), 0.1, 500);
    this.camera.position.set(2.6, 1.7, 3.4);

    this.scene.background = new THREE.Color(0x05070c);
    this.scene.fog = new THREE.Fog(0x05070c, 30, 90);

    const ambient = new THREE.AmbientLight(0x7088b0, 0.75);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xbfd4ff, 1.15);
    key.position.set(6, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 8;
    sc.bottom = -8;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x4060a0, 0.4);
    fill.position.set(-8, 6, -8);
    this.scene.add(fill);

    this.room = new DangerRoom();
    this.room.setGridVisible(true);
    this.scene.add(this.room.group);
    this.scene.add(this.handleGroup);

    // Orbit camera around the character's chest.
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.target.set(0, 1.1, 0);
    this.orbit.minDistance = 1.4;
    this.orbit.maxDistance = 18;
    this.orbit.maxPolarAngle = Math.PI * 0.92;

    // Rotation gizmo for posing the selected bone.
    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setMode("rotate");
    this.gizmo.setSpace("local");
    this.gizmo.setSize(0.9);
    this.gizmo.addEventListener("dragging-changed", this.onGizmoDragging);
    this.gizmo.addEventListener("objectChange", this.onGizmoChange);
    this.gizmoHelper = this.gizmo.getHelper();
    this.gizmoHelper.visible = false;
    this.scene.add(this.gizmoHelper);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("resize", this.onResize);

    this.loop();
    void this.init();
  }

  // ── async boot ────────────────────────────────────────────────────────────

  private async init(): Promise<void> {
    let source: THREE.Object3D;
    try {
      source = await loadSkeletonSource();
    } catch (err) {
      console.error("[AnimEditor] failed to load skeleton", err);
      return;
    }
    if (this.disposed) return;

    const character = new VoxelCharacter(source, { ...DEFAULT_LOOK }, 1.8);
    character.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
    this.scene.add(character.root);
    this.character = character;

    // Only keep bones the rig actually has, and snapshot the bind pose.
    this.boneList = POSABLE_BONES.filter((n) => !!character.getBone(n));
    for (const name of this.boneList) {
      const b = character.getBone(name)!;
      this.bindPose[name] = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
      const mat = new THREE.MeshBasicMaterial({
        color: HANDLE_COLOR,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      });
      const handle = new THREE.Mesh(this.handleGeo, mat);
      handle.renderOrder = 999;
      handle.userData.bone = name;
      this.handles.set(name, handle);
      this.handleGroup.add(handle);
    }

    // Snapshot the hips' bind position — the origin baked root motion travels from.
    const hips = character.getBone("mixamorigHips");
    if (hips) this.bindHips.copy(hips.position);

    // Start with a single bind-pose frame.
    this.frames = [{ duration: DEFAULT_FRAME_DURATION, pose: this.capturePose() }];
    this.activeFrame = 0;

    this.onReady?.();
    this.emitState();
  }

  // ── pose helpers ────────────────────────────────────────────────────────────

  /** Read every posable bone's current local quaternion into a pose. */
  private capturePose(): Record<string, QuatTuple> {
    const pose: Record<string, QuatTuple> = {};
    for (const name of this.boneList) {
      const b = this.character?.getBone(name);
      pose[name] = b
        ? [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]
        : [...(this.bindPose[name] ?? IDENTITY)];
    }
    return pose;
  }

  /** Write a pose onto the rig's bones and refresh world matrices/handles. */
  private applyPose(pose: Record<string, QuatTuple>): void {
    if (!this.character) return;
    for (const name of this.boneList) {
      const b = this.character.getBone(name);
      const q = pose[name];
      if (b && q) b.quaternion.set(q[0], q[1], q[2], q[3]);
    }
    this.character.root.updateMatrixWorld(true);
  }

  /** Interpolate two poses (per-bone slerp) into a fresh pose. */
  private lerpPose(
    a: Record<string, QuatTuple>,
    b: Record<string, QuatTuple>,
    t: number,
  ): Record<string, QuatTuple> {
    const out: Record<string, QuatTuple> = {};
    for (const name of this.boneList) {
      const qa = a[name] ?? IDENTITY;
      const qb = b[name] ?? IDENTITY;
      this.qa.set(qa[0], qa[1], qa[2], qa[3]);
      this.qb.set(qb[0], qb[1], qb[2], qb[3]);
      this.qa.slerp(this.qb, t);
      out[name] = [this.qa.x, this.qa.y, this.qa.z, this.qa.w];
    }
    return out;
  }

  /** Sample the timeline at an absolute time (seconds) into a pose. */
  private sampleAt(time: number): Record<string, QuatTuple> {
    const f = this.frames;
    if (f.length === 0) return {};
    if (f.length === 1) return f[0].pose;
    let start = 0;
    for (let i = 0; i < f.length - 1; i++) {
      const dur = Math.max(0.0001, f[i].duration);
      if (time < start + dur) {
        return this.lerpPose(f[i].pose, f[i + 1].pose, (time - start) / dur);
      }
      start += dur;
    }
    return f[f.length - 1].pose; // hold final pose
  }

  // ── root motion ─────────────────────────────────────────────────────────────

  /** The hips' bind position as a plain tuple. */
  private bindHipsTuple(): [number, number, number] {
    return [this.bindHips.x, this.bindHips.y, this.bindHips.z];
  }

  /** Write a hips position onto the rig (or restore the bind position if absent). */
  private applyRoot(root?: [number, number, number]): void {
    const hips = this.character?.getBone("mixamorigHips");
    if (!hips) return;
    if (root) hips.position.set(root[0], root[1], root[2]);
    else hips.position.copy(this.bindHips);
    this.character?.root.updateMatrixWorld(true);
  }

  /** Sample the baked hips position at an absolute time, or undefined if none. */
  private sampleRootAt(time: number): [number, number, number] | undefined {
    const f = this.frames;
    if (f.length === 0 || !f.some((fr) => fr.root)) return undefined;
    const rootOf = (i: number): [number, number, number] => f[i].root ?? this.bindHipsTuple();
    if (f.length === 1) return rootOf(0);
    let start = 0;
    for (let i = 0; i < f.length - 1; i++) {
      const dur = Math.max(0.0001, f[i].duration);
      if (time < start + dur) {
        const t = (time - start) / dur;
        const a = rootOf(i);
        const b = rootOf(i + 1);
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
      start += dur;
    }
    return rootOf(f.length - 1);
  }

  /**
   * Bake real, mocap-style locomotion onto the current (in-place) clip from a
   * requested TIME (seconds), DISTANCE (world units) and DIRECTION (degrees,
   * 0 = forward/+Z, clockwise). The AI authors a clean rotation-only cycle; this
   * (1) scales every frame duration so the timeline lasts exactly `time`,
   * (2) composes a body-facing yaw onto the hips so the character turns to face
   *     the travel heading, and (3) bakes a per-frame hips position so the body
   *     physically travels `distance` along that heading. distance 0 → in-place;
   *     empty/zero time → keep the AI's authored durations.
   */
  applyMotion(req: { time: number; distance: number; direction: number }): void {
    if (!this.character || this.frames.length === 0) return;
    if (this.playing) this.stop();

    const time = Number.isFinite(req.time) && req.time > 0 ? req.time : 0;
    const distance = Number.isFinite(req.distance) && req.distance > 0 ? req.distance : 0;
    const h = ((Number.isFinite(req.direction) ? req.direction : 0) * Math.PI) / 180;

    // 1. Scale durations so the whole clip lasts exactly `time` (if requested).
    if (time > 0) {
      const total = totalDuration(this.frames);
      const scale = total > 0 ? time / total : 1;
      for (const f of this.frames) {
        f.duration = Math.max(0.05, Math.min(5, f.duration * scale));
      }
    }

    // 2. Compose a facing yaw onto the hips so the body faces the travel heading.
    if (Math.abs(h) > 1e-4) {
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h);
      const aiHips = new THREE.Quaternion();
      const composed = new THREE.Quaternion();
      for (const f of this.frames) {
        const q = f.pose["mixamorigHips"] ?? [0, 0, 0, 1];
        aiHips.set(q[0], q[1], q[2], q[3]);
        composed.copy(yaw).multiply(aiHips);
        f.pose["mixamorigHips"] = [composed.x, composed.y, composed.z, composed.w];
      }
    }

    // 3. Bake per-frame hips travel = bindHips + heading * (distance * frac).
    if (distance > 0) {
      const dir = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
      const n = this.frames.length;
      for (let i = 0; i < n; i++) {
        // Endpoints span 0→distance across the timeline; a single-frame clip is
        // a static pose with no travel, so it stays at the origin (frac 0).
        const frac = n > 1 ? i / (n - 1) : 0;
        const travel = distance * frac;
        this.frames[i].root = [
          this.bindHips.x + dir.x * travel,
          this.bindHips.y,
          this.bindHips.z + dir.z * travel,
        ];
      }
    } else {
      // In-place: drop any stale baked root so the body stays put.
      for (const f of this.frames) delete f.root;
    }

    this.activeFrame = 0;
    this.previewTime = 0;
    this.applyPose(this.frames[0].pose);
    this.applyRoot(this.frames[0].root);
    this.emitState();
  }

  // ── gizmo handlers ──────────────────────────────────────────────────────────

  private onGizmoDragging = (e: { value: unknown }) => {
    const dragging = e.value === true;
    this.orbit.enabled = !dragging;
    if (dragging) {
      // Begin an edit: snapshot the active frame for single-level undo.
      this.undoSnapshot = { frame: this.activeFrame, pose: this.clonePose(this.frames[this.activeFrame].pose) };
    } else {
      this.emitState();
    }
  };

  private onGizmoChange = () => {
    if (!this.selectedBone || this.playing) return;
    const b = this.character?.getBone(this.selectedBone);
    const frame = this.frames[this.activeFrame];
    if (!b || !frame) return;
    frame.pose[this.selectedBone] = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
    this.character?.root.updateMatrixWorld(true);
  };

  private clonePose(pose: Record<string, QuatTuple>): Record<string, QuatTuple> {
    const out: Record<string, QuatTuple> = {};
    for (const k of Object.keys(pose)) out[k] = [...pose[k]];
    return out;
  }

  // ── pointer picking ─────────────────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent) => {
    this.downX = e.clientX;
    this.downY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    // Ignore drags (camera orbit) and gizmo interactions.
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (moved > 5) return;
    if (this.gizmo.dragging || this.gizmo.axis) return;
    if (!this.character) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.handles.values()], false);
    if (hits.length) {
      this.selectBone(hits[0].object.userData.bone as string);
    } else {
      this.selectBone(null);
    }
  };

  // ── public API (called from the React shell) ──────────────────────────────────

  getState(): AnimEditorState {
    return {
      ready: !!this.character,
      bones: this.boneList.map((name) => ({ name, label: boneLabel(name) })),
      selectedBone: this.selectedBone,
      frames: this.frames.map((f) => ({ duration: f.duration })),
      activeFrame: this.activeFrame,
      playing: this.playing,
      scrubTime: this.previewTime,
      duration: totalDuration(this.frames),
      canUndo: !!this.undoSnapshot,
      gizmoSpace: this.gizmoSpace,
      savedClips: listStoredClips().map((c) => c.name),
    };
  }

  private emitState(): void {
    this.onState?.(this.getState());
  }

  selectBone(name: string | null): void {
    if (this.playing) this.stop();
    this.selectedBone = name;
    for (const [bn, mesh] of this.handles) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const on = bn === name;
      mat.color.setHex(on ? HANDLE_SELECTED : HANDLE_COLOR);
      mesh.scale.setScalar(on ? 1.6 : 1);
    }
    const bone = name ? this.character?.getBone(name) : null;
    if (bone) {
      this.gizmo.attach(bone);
      this.gizmoHelper.visible = true;
    } else {
      this.gizmo.detach();
      this.gizmoHelper.visible = false;
    }
    this.emitState();
  }

  setGizmoSpace(space: "local" | "world"): void {
    this.gizmoSpace = space;
    this.gizmo.setSpace(space);
    this.emitState();
  }

  setActiveFrame(index: number): void {
    if (this.playing) this.stop();
    if (index < 0 || index >= this.frames.length) return;
    this.activeFrame = index;
    this.previewTime = this.frameStart(index);
    this.applyPose(this.frames[index].pose);
    this.applyRoot(this.frames[index].root);
    this.emitState();
  }

  /** Insert a new frame (a copy of the active frame's pose) after the active one. */
  addFrame(): void {
    if (this.playing) this.stop();
    const pose = this.clonePose(this.frames[this.activeFrame]?.pose ?? this.capturePose());
    const at = this.activeFrame + 1;
    const frame: ClipFrame = { duration: DEFAULT_FRAME_DURATION, pose };
    if (this.frames[this.activeFrame]?.root) {
      const r = this.frames[this.activeFrame].root!;
      frame.root = [r[0], r[1], r[2]];
    }
    this.frames.splice(at, 0, frame);
    this.activeFrame = at;
    this.applyPose(pose);
    this.applyRoot(frame.root);
    this.undoSnapshot = null;
    this.emitState();
  }

  duplicateFrame(index: number): void {
    if (this.playing) this.stop();
    const src = this.frames[index];
    if (!src) return;
    const copy: ClipFrame = { duration: src.duration, pose: this.clonePose(src.pose) };
    if (src.root) copy.root = [src.root[0], src.root[1], src.root[2]];
    this.frames.splice(index + 1, 0, copy);
    this.activeFrame = index + 1;
    this.applyPose(copy.pose);
    this.applyRoot(copy.root);
    this.undoSnapshot = null;
    this.emitState();
  }

  deleteFrame(index: number): void {
    if (this.playing) this.stop();
    if (this.frames.length <= 1) return; // keep at least one frame
    this.frames.splice(index, 1);
    this.activeFrame = Math.min(this.activeFrame, this.frames.length - 1);
    this.applyPose(this.frames[this.activeFrame].pose);
    this.applyRoot(this.frames[this.activeFrame].root);
    this.undoSnapshot = null;
    this.emitState();
  }

  moveFrame(index: number, dir: -1 | 1): void {
    if (this.playing) this.stop();
    const to = index + dir;
    if (to < 0 || to >= this.frames.length) return;
    const [f] = this.frames.splice(index, 1);
    this.frames.splice(to, 0, f);
    this.activeFrame = to;
    this.emitState();
  }

  setFrameDuration(index: number, seconds: number): void {
    const f = this.frames[index];
    if (!f) return;
    f.duration = Math.max(0.05, Math.min(5, seconds));
    this.emitState();
  }

  /** Reset the selected bone in the active frame back to its bind pose. */
  resetBone(): void {
    if (!this.selectedBone) return;
    if (this.playing) this.stop();
    const frame = this.frames[this.activeFrame];
    this.undoSnapshot = { frame: this.activeFrame, pose: this.clonePose(frame.pose) };
    frame.pose[this.selectedBone] = [...(this.bindPose[this.selectedBone] ?? IDENTITY)];
    this.applyPose(frame.pose);
    this.emitState();
  }

  /** Reset the whole active frame back to the bind pose. */
  resetFrame(): void {
    if (this.playing) this.stop();
    const frame = this.frames[this.activeFrame];
    this.undoSnapshot = { frame: this.activeFrame, pose: this.clonePose(frame.pose) };
    frame.pose = this.clonePose(this.bindPose);
    delete frame.root;
    this.applyPose(frame.pose);
    this.applyRoot(frame.root);
    this.emitState();
  }

  undo(): void {
    if (!this.undoSnapshot) return;
    if (this.playing) this.stop();
    const { frame, pose } = this.undoSnapshot;
    if (frame < this.frames.length) {
      this.frames[frame].pose = pose;
      this.activeFrame = frame;
      this.applyPose(pose);
      this.applyRoot(this.frames[frame].root);
    }
    this.undoSnapshot = null;
    this.emitState();
  }

  togglePlay(): void {
    if (this.playing) this.stop();
    else this.play();
  }

  private play(): void {
    if (this.frames.length < 2) return; // nothing to interpolate
    const stored = {
      name: "__preview__",
      version: 1,
      bones: this.boneList,
      frames: this.frames,
      duration: totalDuration(this.frames),
      updatedAt: 0,
    };
    const clip = buildAnimationClip(stored);
    if (!clip || !this.character) return;
    this.gizmo.detach();
    this.gizmoHelper.visible = false;
    this.mixer = new THREE.AnimationMixer(this.character.skeletonRoot);
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(THREE.LoopRepeat, Infinity);
    this.action.play();
    this.playing = true;
    this.previewTime = 0;
    this.emitState();
  }

  stop(): void {
    if (this.action) this.action.stop();
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
    }
    this.action = null;
    this.mixer = null;
    if (!this.playing) return;
    this.playing = false;
    this.applyPose(this.frames[this.activeFrame].pose);
    this.applyRoot(this.frames[this.activeFrame].root);
    if (this.selectedBone) {
      const bone = this.character?.getBone(this.selectedBone);
      if (bone) {
        this.gizmo.attach(bone);
        this.gizmoHelper.visible = true;
      }
    }
    this.emitState();
  }

  /** Scrub to an absolute time (seconds) and apply the interpolated pose. */
  setScrub(time: number): void {
    if (this.playing) this.stop();
    this.previewTime = Math.max(0, Math.min(totalDuration(this.frames), time));
    this.applyPose(this.sampleAt(this.previewTime));
    this.applyRoot(this.sampleRootAt(this.previewTime));
    this.emitState();
  }

  /** Save the current timeline as a named clip in the library. */
  save(name: string): boolean {
    const clean = name.trim();
    if (!clean) return false;
    saveStoredClip({ name: clean, bones: this.boneList, frames: this.frames });
    this.emitState();
    return true;
  }

  /**
   * Current timeline as a bare clip payload (bones + frames), e.g. to hand to
   * the AI "edit" endpoint or to save to the cloud library.
   */
  getClip(): { bones: string[]; frames: ClipFrame[] } {
    return {
      bones: [...this.boneList],
      frames: this.frames.map((f) => ({
        duration: f.duration,
        pose: this.clonePose(f.pose),
        ...(f.root ? { root: [f.root[0], f.root[1], f.root[2]] as [number, number, number] } : {}),
      })),
    };
  }

  /**
   * Replace the whole timeline with an arbitrary frame set (e.g. AI output).
   * Every frame is seeded from the bind pose and then overlaid with the provided
   * poses, filtered to bones the live rig actually has — so an injected clip can
   * never address a bone that isn't there. Durations are clamped defensively.
   * Returns false if the rig isn't ready or the frame set is empty.
   */
  loadFrames(
    frames: Array<{ duration: number; pose: Record<string, QuatTuple>; root?: [number, number, number] }>,
  ): boolean {
    if (!this.character || frames.length === 0) return false;
    if (this.playing) this.stop();
    const live = new Set(this.boneList);
    this.frames = frames.map((f) => {
      const pose = this.clonePose(this.bindPose);
      for (const [bone, q] of Object.entries(f.pose)) {
        if (live.has(bone) && Array.isArray(q) && q.length === 4) {
          pose[bone] = [q[0], q[1], q[2], q[3]];
        }
      }
      const duration = Math.max(0.05, Math.min(5, Number(f.duration) || DEFAULT_FRAME_DURATION));
      const frame: ClipFrame = { duration, pose };
      if (Array.isArray(f.root) && f.root.length === 3 && f.root.every((n) => Number.isFinite(n))) {
        frame.root = [f.root[0], f.root[1], f.root[2]];
      }
      return frame;
    });
    this.activeFrame = 0;
    this.previewTime = 0;
    this.undoSnapshot = null;
    this.selectedBone = null;
    this.gizmo.detach();
    this.gizmoHelper.visible = false;
    this.applyPose(this.frames[0].pose);
    this.applyRoot(this.frames[0].root);
    this.emitState();
    return true;
  }

  /** Load a saved clip into the editor for further editing. */
  loadClip(name: string): void {
    const stored = getStoredClip(name);
    if (!stored) return;
    if (this.playing) this.stop();
    this.frames = stored.frames.map((f) => {
      const frame: ClipFrame = { duration: f.duration, pose: this.clonePose(f.pose) };
      if (f.root) frame.root = [f.root[0], f.root[1], f.root[2]];
      return frame;
    });
    this.activeFrame = 0;
    this.previewTime = 0;
    this.undoSnapshot = null;
    this.applyPose(this.frames[0].pose);
    this.applyRoot(this.frames[0].root);
    this.emitState();
  }

  /** Delete a saved clip from the library. */
  deleteSaved(name: string): void {
    deleteStoredClip(name);
    this.emitState();
  }

  /** Reset to a fresh single bind-pose frame. */
  newClip(): void {
    if (this.playing) this.stop();
    this.frames = [{ duration: DEFAULT_FRAME_DURATION, pose: this.clonePose(this.bindPose) }];
    this.activeFrame = 0;
    this.previewTime = 0;
    this.undoSnapshot = null;
    this.applyPose(this.frames[0].pose);
    this.applyRoot(undefined);
    this.emitState();
  }

  // ── internals ────────────────────────────────────────────────────────────────

  /** Absolute start time of a frame on the timeline. */
  private frameStart(index: number): number {
    let t = 0;
    for (let i = 0; i < index && i < this.frames.length; i++) t += Math.max(0, this.frames[i].duration);
    return t;
  }

  private onResize = () => {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.orbit.update();
    this.room.update(this.clock.elapsedTime);

    if (this.playing && this.mixer) {
      this.mixer.update(dt);
      this.previewTime = (this.previewTime + dt) % totalDuration(this.frames);
      this.emitAccum += dt;
      if (this.emitAccum > 0.066) {
        this.emitAccum = 0;
        this.emitState();
      }
    }

    // Keep bone handles glued to their bones' world positions.
    if (this.character) {
      for (const [name, mesh] of this.handles) {
        const bone = this.character.getBone(name);
        if (bone) {
          bone.getWorldPosition(this.vTmp);
          mesh.position.copy(this.vTmp);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);

    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("resize", this.onResize);

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.gizmo.removeEventListener("dragging-changed", this.onGizmoDragging);
    this.gizmo.removeEventListener("objectChange", this.onGizmoChange);
    this.gizmo.detach();
    this.scene.remove(this.gizmoHelper);
    this.gizmo.dispose();
    this.orbit.dispose();

    for (const mesh of this.handles.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    this.handles.clear();
    this.handleGeo.dispose();

    this.character?.dispose();
    this.character = null;
    this.room.dispose();

    this.renderer.dispose();
    if (el.parentElement === this.container) this.container.removeChild(el);
  }
}

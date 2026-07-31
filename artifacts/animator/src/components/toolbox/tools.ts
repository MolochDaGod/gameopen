/**
 * Toolbox registry:
 *  1) 25 gold tool icons (sheet order) → live launch actions in Open
 *  2) Three.js / Rapier / R3F best-practice stacks (systems, scripts, tools, helpers)
 *  3) Create tab → Grok Builder deep links for games / modes / edits
 *
 * Every button does something real — mode switch, dock panel, HUD, external builder, or docs.
 * Production URL SSOT: `lib/productionTools.ts` · docs/PRODUCTION_TOOLS.md
 */
import type { IconName } from "../../three/icons";
import {
  PRODUCTION_SURFACES,
  grokBuilderUrl,
} from "../../lib/productionTools";

/** Mirrors App's `Mode` union (kept local to avoid a component import cycle). */
export type ToolMode =
  | "doors"
  | "danger"
  | "voxel"
  | "play"
  | "editor"
  | "lobby"
  | "ledmask"
  | "avatar"
  | "anim"
  | "anim-ai"
  | "ui";

/** Danger Room dock panel ids (App's DANGER_PANEL_METAS). */
export type DangerPanelId = "admin" | "editor" | "anim" | "animdbg";

/** Dressing Room dock panel ids (EditorMode's PANEL_METAS). */
export type DressingPanelId =
  | "hierarchy"
  | "wardrobe"
  | "anim"
  | "arsenal"
  | "vfx"
  | "playground";

export type ToolAction =
  | { kind: "mode"; mode: ToolMode }
  | { kind: "danger-panel"; id: DangerPanelId }
  | { kind: "danger-equip" }
  | { kind: "hud-edit" }
  | { kind: "dressing-panel"; id: DressingPanelId }
  /** Open external fleet surface (Grok Builder, Forge, docs). */
  | { kind: "external"; url: string; newTab?: boolean };

export interface ToolDef {
  icon: IconName;
  label: string;
  hint: string;
  action: ToolAction;
  /** Optional stack category for non-sheet tools. */
  stack?: "three" | "rapier" | "r3f" | "create";
}

/** @deprecated Prefer PRODUCTION_SURFACES / grokBuilderUrl — kept for external importers. */
export const GROK_BUILDER = PRODUCTION_SURFACES.grokBuilder;
export const FORGE_URL = PRODUCTION_SURFACES.forge;
export const UI_STUDIO_URL = PRODUCTION_SURFACES.uiStudio;
export const THREE_DOCS = PRODUCTION_SURFACES.threeDocs;
export const RAPIER_DOCS = PRODUCTION_SURFACES.rapierDocs;
export const R3F_DOCS = PRODUCTION_SURFACES.r3fDocs;

function gb(params?: Record<string, string>): string {
  return grokBuilderUrl(params);
}

/** All 25 tools in sprite-sheet (row-major) order — live Open launchers. */
export const TOOLBOX_TOOLS: ToolDef[] = [
  {
    icon: "animator",
    label: "Animator",
    hint: "Danger anim panel — clip overrides, gait blend, one-shots",
    action: { kind: "danger-panel", id: "anim" },
  },
  {
    icon: "skill-vfx-lab",
    label: "Skill VFX Lab",
    hint: "Dressing Room VFX — skill FX, trails, impact presets",
    action: { kind: "dressing-panel", id: "vfx" },
  },
  {
    icon: "parkour",
    label: "Parkour",
    hint: "Danger Room — run, dash, vault, combat movement",
    action: { kind: "mode", mode: "danger" },
  },
  {
    icon: "physics",
    label: "Physics",
    hint: "Danger editor dock — physics feel, fire FX, colliders",
    action: { kind: "danger-panel", id: "editor" },
  },
  {
    icon: "foot-planting",
    label: "Foot Planting",
    hint: "Admin dock — grounding, hip height, studio feel (SI 1.8 m)",
    action: { kind: "danger-panel", id: "admin" },
  },
  {
    icon: "anim-test",
    label: "Anim Test",
    hint: "Live animation debugger — mixer, tracks, retarget",
    action: { kind: "danger-panel", id: "animdbg" },
  },
  {
    icon: "gear-trial",
    label: "Gear Trial",
    hint: "Wardrobe — modular grudge6 skins, gear, race kit",
    action: { kind: "dressing-panel", id: "wardrobe" },
  },
  {
    icon: "camera",
    label: "Camera",
    hint: "Admin — third-person camera, orbit, controller feel",
    action: { kind: "danger-panel", id: "admin" },
  },
  {
    icon: "ai-worker",
    label: "AI Worker",
    hint: "LED Mask AI companion surface",
    action: { kind: "mode", mode: "ledmask" },
  },
  {
    icon: "movement-pad",
    label: "Movement Pad",
    hint: "Touch-friendly combat sandbox (Danger Room)",
    action: { kind: "mode", mode: "danger" },
  },
  {
    icon: "action-bar",
    label: "Action Bar",
    hint: "HUD edit — arrange action bar slots",
    action: { kind: "hud-edit" },
  },
  {
    icon: "hud-settings",
    label: "Create UI",
    hint: "ui.grudge-studio.com — HUD, menus, settings, fleet packs + AI wiring",
    action: { kind: "mode", mode: "ui" },
  },
  {
    icon: "building-kit",
    label: "Building Kit",
    hint: "Voxel worldbuilder — Kenney snap, blocks, maps",
    action: { kind: "mode", mode: "voxel" },
  },
  {
    icon: "weapon-mesh",
    label: "Weapon Mesh",
    hint: "Arsenal — weapon fit, hand bones, colliders",
    action: { kind: "dressing-panel", id: "arsenal" },
  },
  {
    icon: "animation-editor",
    label: "Animation Editor",
    hint: "Dressing Room anim — clips, retiming, packs",
    action: { kind: "dressing-panel", id: "anim" },
  },
  {
    icon: "vfx-editor",
    label: "VFX Editor",
    hint: "Author & test VFX presets (orbs, slash, strike)",
    action: { kind: "dressing-panel", id: "vfx" },
  },
  {
    icon: "draggable-dock",
    label: "Draggable Dock",
    hint: "Hierarchy dock — scene tree, select, frame",
    action: { kind: "dressing-panel", id: "hierarchy" },
  },
  {
    icon: "resizable-panel",
    label: "Dressing Room",
    hint: "Full character dressing workspace",
    action: { kind: "mode", mode: "editor" },
  },
  {
    icon: "skill-slot",
    label: "Skill Slot",
    hint: "HUD edit — place skill slots & cooldowns",
    action: { kind: "hud-edit" },
  },
  {
    icon: "combat-pad",
    label: "Combat Pad",
    hint: "Danger Room combat sandbox — spar, skills, AI",
    action: { kind: "mode", mode: "danger" },
  },
  {
    icon: "loadout-card",
    label: "Loadout Card",
    hint: "Equipment loadout overlay (weapon packs)",
    action: { kind: "danger-equip" },
  },
  {
    icon: "world-editor",
    label: "World Editor",
    hint: "Build & test voxel maps → play",
    action: { kind: "mode", mode: "voxel" },
  },
  {
    icon: "clip-library",
    label: "Clip Library",
    hint: "Browse baked Bip001 / Mixamo clip library",
    action: { kind: "dressing-panel", id: "anim" },
  },
  {
    icon: "asset-manager",
    label: "Asset Manager",
    hint: "Import models & assets (Dressing Room)",
    action: { kind: "mode", mode: "editor" },
  },
  {
    icon: "scriptable-skills",
    label: "Scriptable Skills",
    hint: "Skill Lab playground — author abilities live",
    action: { kind: "dressing-panel", id: "playground" },
  },
];

/**
 * Three.js best-practice systems / scripts / tools / helpers.
 * Opens Grok Builder with focused stacks or official docs.
 */
export const THREEJS_STACK_TOOLS: ToolDef[] = [
  {
    icon: "world-editor",
    label: "Scene + SI Scale",
    hint: "SI metres, 1.8 m human, dispose, color management r185+",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "scene" }) },
  },
  {
    icon: "camera",
    label: "Cameras & Controls",
    hint: "Orbit / Map / Fly / TransformControls arbitration",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "camera" }) },
  },
  {
    icon: "animator",
    label: "Animation System",
    hint: "AnimationMixer, SkeletonUtils.clone, cross-fade, one-shots",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "animation" }) },
  },
  {
    icon: "asset-manager",
    label: "Loaders & I/O",
    hint: "GLTF/Draco/meshopt/KTX2 — fleet CDN + ObjectStore index",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "assets", focus: "loaders" }) },
  },
  {
    icon: "vfx-editor",
    label: "Materials & TSL",
    hint: "PBR, ShaderMaterial, TSL nodes, WebGPU path",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "materials" }) },
  },
  {
    icon: "skill-vfx-lab",
    label: "Post & Cinema",
    hint: "EffectComposer, bloom, cinema beats, letterbox",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "cinema" }) },
  },
  {
    icon: "building-kit",
    label: "Instancing & LOD",
    hint: "InstancedMesh, frustum cull, grass/trees/VFX batches",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "instancing" }) },
  },
  {
    icon: "foot-planting",
    label: "Helpers",
    hint: "AxesHelper, Box3Helper, Grid, SkeletonHelper, light helpers",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "helpers", helpers: "1" }) },
  },
  {
    icon: "scriptable-skills",
    label: "Scripts & Beats",
    hint: "Gameplay scripts, timeline beats, event bus patterns",
    stack: "three",
    action: { kind: "external", url: gb({ stack: "three", panel: "modes", focus: "scripts" }) },
  },
  {
    icon: "clip-library",
    label: "Three.js Docs",
    hint: "Official three.js documentation",
    stack: "three",
    action: { kind: "external", url: THREE_DOCS, newTab: true },
  },
];

/** Rapier physics best-practice systems / tools / helpers. */
export const RAPIER_STACK_TOOLS: ToolDef[] = [
  {
    icon: "physics",
    label: "World + Step",
    hint: "Fixed 1/60 step, SI gravity −9.81, world snapshot",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "world", physics: "1" }) },
  },
  {
    icon: "parkour",
    label: "Character CCT",
    hint: "Kinematic character controller — slide, climb, snap",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "cct", mode: "parkour" }) },
  },
  {
    icon: "weapon-mesh",
    label: "Colliders",
    hint: "Cuboid / ball / capsule / trimesh / convex hull",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "colliders", mode: "physics-lab" }) },
  },
  {
    icon: "combat-pad",
    label: "Joints & Ragdoll",
    hint: "Fixed/spherical/revolute joints, chains, ragdolls",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "joints", mode: "physics-lab" }) },
  },
  {
    icon: "movement-pad",
    label: "Scene Queries",
    hint: "Raycast, shape cast, intersection, proximity",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "queries" }) },
  },
  {
    icon: "loadout-card",
    label: "Collision Layers",
    hint: "Default / Terrain / Player / NPC / Item / Projectile / Trigger",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "layers" }) },
  },
  {
    icon: "anim-test",
    label: "Debug Draw",
    hint: "Rapier debug colliders + contact viz",
    stack: "rapier",
    action: {
      kind: "external",
      url: gb({ stack: "rapier", panel: "modes", focus: "debug", physics: "1", physDebug: "1" }),
    },
  },
  {
    icon: "building-kit",
    label: "Instanced Bodies",
    hint: "Crowd dynamics, debris, harvest fragments",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "instances", mode: "physics-lab" }) },
  },
  {
    icon: "scriptable-skills",
    label: "Triggers & Events",
    hint: "Sensor volumes, collision events, win zones",
    stack: "rapier",
    action: { kind: "external", url: gb({ stack: "rapier", panel: "modes", focus: "triggers", mode: "arena" }) },
  },
  {
    icon: "clip-library",
    label: "Rapier Docs",
    hint: "Official Rapier JavaScript user guide",
    stack: "rapier",
    action: { kind: "external", url: RAPIER_DOCS, newTab: true },
  },
];

/** React Three Fiber best-practice systems / tools / helpers. */
export const R3F_STACK_TOOLS: ToolDef[] = [
  {
    icon: "resizable-panel",
    label: "Canvas Shell",
    hint: "Canvas, dpr, shadows, AdaptiveDpr, color space, tone map",
    stack: "r3f",
    action: { kind: "external", url: gb({ stack: "r3f", panel: "modes", focus: "canvas" }) },
  },
  {
    icon: "draggable-dock",
    label: "Hooks & Store",
    hint: "useFrame, useThree, zustand scene store, imperatives",
    stack: "r3f",
    action: { kind: "external", url: gb({ stack: "r3f", panel: "modes", focus: "hooks" }) },
  },
  {
    icon: "camera",
    label: "Drei Controls",
    hint: "OrbitControls, TransformControls, Html, Environment",
    stack: "r3f",
    action: { kind: "external", url: gb({ stack: "r3f", panel: "modes", focus: "drei" }) },
  },
  {
    icon: "physics",
    label: "R3F + Rapier",
    hint: "@react-three/rapier Physics, RigidBody, Collider",
    stack: "r3f",
    action: {
      kind: "external",
      url: gb({ stack: "r3f", panel: "modes", focus: "rapier-bridge", physics: "1" }),
    },
  },
  {
    icon: "animator",
    label: "useAnimations",
    hint: "drei useAnimations, shared skeleton crowds, DetachedBindMode",
    stack: "r3f",
    action: { kind: "external", url: gb({ stack: "r3f", panel: "modes", focus: "useAnimations" }) },
  },
  {
    icon: "asset-manager",
    label: "Suspense Assets",
    hint: "useGLTF, useTexture, preload, dispose on unmount",
    stack: "r3f",
    action: { kind: "external", url: gb({ stack: "r3f", panel: "assets", focus: "suspense" }) },
  },
  {
    icon: "skill-vfx-lab",
    label: "HTML Overlays",
    hint: "CSS2D damage/heal floats, blood, building + enter/exit chips (Danger)",
    stack: "r3f",
    action: { kind: "external", url: gb({ stack: "r3f", panel: "modes", focus: "html" }) },
  },
  {
    icon: "building-kit",
    label: "Performance",
    hint: "AdaptiveEvents, instances, BVH, frame budget",
    stack: "r3f",
    action: { kind: "external", url: gb({ stack: "r3f", panel: "modes", focus: "perf", stats: "1" }) },
  },
  {
    icon: "world-editor",
    label: "Forge Editor",
    hint: "Production Forge — full R3F map/scene editor",
    stack: "r3f",
    action: { kind: "external", url: FORGE_URL, newTab: true },
  },
  {
    icon: "clip-library",
    label: "R3F Docs",
    hint: "Official React Three Fiber documentation",
    stack: "r3f",
    action: { kind: "external", url: R3F_DOCS, newTab: true },
  },
];

/** Create games / modes / edits — deep Grok Builder creative surface. */
export const CREATE_STACK_TOOLS: ToolDef[] = [
  {
    icon: "world-editor",
    label: "Grok Builder",
    hint: "Full agentic editor — games, modes, edits, fleet assets",
    stack: "create",
    action: { kind: "external", url: gb({ panel: "modes" }) },
  },
  {
    icon: "combat-pad",
    label: "New Arena Mode",
    hint: "Sparring arena template + triggers + loadout pad",
    stack: "create",
    action: { kind: "external", url: gb({ mode: "arena", panel: "agent" }) },
  },
  {
    icon: "parkour",
    label: "New Parkour Mode",
    hint: "Platform course + CCT movement sandbox",
    stack: "create",
    action: { kind: "external", url: gb({ mode: "parkour", panel: "agent" }) },
  },
  {
    icon: "building-kit",
    label: "Pirate Lobby",
    hint: "Fleet pirate-islands lobby mesh + open-world pad",
    stack: "create",
    action: { kind: "external", url: gb({ mode: "pirate-lobby", panel: "agent" }) },
  },
  {
    icon: "physics",
    label: "Physics Lab Mode",
    hint: "Dynamic bodies, joints playground, debug draw",
    stack: "create",
    action: { kind: "external", url: gb({ mode: "physics-lab", panel: "modes", physDebug: "1" }) },
  },
  {
    icon: "harvest" as IconName,
    label: "Survival Mode",
    hint: "Harvest pads, resource nodes, day-cycle ready",
    stack: "create",
    action: { kind: "external", url: gb({ mode: "survival", panel: "agent" }) },
  },
  {
    icon: "siege" as IconName,
    label: "RTS Skirmish",
    hint: "Top-down pad, unit placeholders, command feel",
    stack: "create",
    action: { kind: "external", url: gb({ mode: "rts-skirmish", panel: "agent" }) },
  },
  {
    icon: "scriptable-skills",
    label: "Creative Sandbox",
    hint: "Empty SI ground + agent — invent any mode",
    stack: "create",
    action: { kind: "external", url: gb({ mode: "sandbox", panel: "agent" }) },
  },
  {
    icon: "vfx-editor",
    label: "Edit Scene JSON",
    hint: "Import/export scene + game package for fleet",
    stack: "create",
    action: { kind: "external", url: gb({ panel: "modes", focus: "export" }) },
  },
  {
    icon: "ai-worker",
    label: "Ask Grok to Build",
    hint: "Agent chat — describe a game, modes, edits",
    stack: "create",
    action: { kind: "external", url: gb({ panel: "agent" }) },
  },
];

export type ToolboxTabId = "tools" | "three" | "rapier" | "r3f" | "create" | "music";

export function toolsForTab(tab: ToolboxTabId): ToolDef[] {
  switch (tab) {
    case "three":
      return THREEJS_STACK_TOOLS;
    case "rapier":
      return RAPIER_STACK_TOOLS;
    case "r3f":
      return R3F_STACK_TOOLS;
    case "create":
      return CREATE_STACK_TOOLS;
    case "tools":
    default:
      return TOOLBOX_TOOLS;
  }
}

/* ------------------------------------------------------------------------ *
 * Dressing Room panel request bus.
 *
 * The Toolbox lives in the app shell while the Dressing Room dock lives
 * inside EditorMode. A request made BEFORE the mode switch is buffered until
 * EditorMode mounts and subscribes; a request made while it's already mounted
 * is delivered immediately.
 * ------------------------------------------------------------------------ */
let pendingDressing: DressingPanelId | null = null;
const dressingListeners = new Set<(id: DressingPanelId) => void>();

/** Ask the Dressing Room (mounted or not) to surface a dock panel. */
export function requestDressingPanel(id: DressingPanelId): void {
  if (dressingListeners.size > 0) {
    dressingListeners.forEach((l) => l(id));
  } else {
    pendingDressing = id;
  }
}

/** Subscribe (EditorMode). Any buffered request is delivered immediately. */
export function onDressingPanelRequest(cb: (id: DressingPanelId) => void): () => void {
  dressingListeners.add(cb);
  const pending = pendingDressing;
  pendingDressing = null;
  if (pending) cb(pending);
  return () => {
    dressingListeners.delete(cb);
  };
}

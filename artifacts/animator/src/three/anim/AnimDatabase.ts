/**
 * AnimDatabase — SSOT API over content/anims/database.json + states.json.
 *
 * Resolves clips for combat, locomotion, harvest, swim, climb, mantle/vertical
 * grab from one registry so weapon skills, SurfaceLocomotion, and directors share
 * the same role → bake path map.
 *
 * Production bake path: /anims/baked/{bakeRel}.json (Bip001).
 * Source FBX under public/anim/* is Mixamo (Vercel-stripped); status=placeholder
 * until bake lands.
 */

import type { SurfaceLocomotionMode } from "@workspace/grudge-physics";
import { animPackForWeapon, type AnimPack } from "../grudge/anims";
/** Runtime embed — keep in sync with content/anims/*.json (SSOT). */
import databaseJson from "./data/database.json";
import statesJson from "./data/states.json";

// ── Types ────────────────────────────────────────────────────────────────────

export type AnimClipStatus = "ready" | "placeholder" | "missing" | "banned";
export type AnimSource = "baked" | "mixamo_fbx" | "explosive" | "procedural" | "external";
export type AnimLayer = "loco" | "action" | "overlay" | "traversal" | "activity";
export type PlayerActivity = "combat" | "harvest" | "build" | "any";

/** Extended surface including mantle (ledge grab) for anim only. */
export type AnimSurface =
  | SurfaceLocomotionMode
  | "mantle";

export interface AnimClipEntry {
  id: string;
  pack: string;
  role: string;
  bakeRel?: string;
  sourceRel?: string;
  source: AnimSource;
  status: AnimClipStatus;
  loop?: boolean;
  states?: string[];
  surfaces?: string[];
  weapons?: string[];
  priority?: number;
  lockSec?: number;
  tags?: string[];
  note?: string;
}

export interface AnimStateDef {
  id: string;
  layer: AnimLayer;
  defaultRole: string;
  surfaceModes?: string[];
  activityModes?: string[];
  interruptible?: boolean;
  priority?: number;
  description?: string;
}

export interface AnimPackMeta {
  label: string;
  skeleton: string;
  sources: string[];
  fallbackPack?: string | null;
  note?: string;
}

export interface AnimResolveQuery {
  /** Preferred state id (e.g. loco.walk, combat.attack, traversal.mantle). */
  stateId?: string;
  /** Logical role if state unknown. */
  role?: string;
  /** Weapon id for pack preference. */
  weaponId?: string | null;
  /** Explicit anim pack override. */
  pack?: string | null;
  /** Surface locomotion mode (+ mantle). */
  surface?: AnimSurface;
  /** Player activity (combat / harvest / build). */
  activity?: PlayerActivity;
  /** Movement speed 0..1 for loco role pick. */
  speed?: number;
  /** Prefer ready clips only. */
  readyOnly?: boolean;
}

export interface AnimResolveResult {
  clip: AnimClipEntry;
  state: AnimStateDef | null;
  bakeRel: string | null;
  sourceRel: string | null;
  /** Effective pack after fallback. */
  pack: string;
  /** True if used a lower-priority / fallback clip. */
  degraded: boolean;
}

// ── Load embedded SSOT ───────────────────────────────────────────────────────

type DbShape = {
  version: number;
  packs: Record<string, AnimPackMeta>;
  clips: AnimClipEntry[];
  bannedBakeRels?: string[];
};

type StatesShape = {
  version: number;
  states: AnimStateDef[];
};

const DB = databaseJson as DbShape;
const STATES = statesJson as StatesShape;

// ── Database ─────────────────────────────────────────────────────────────────

export class AnimDatabase {
  private readonly byId = new Map<string, AnimClipEntry>();
  private readonly byRole = new Map<string, AnimClipEntry[]>();
  private readonly byState = new Map<string, AnimClipEntry[]>();
  private readonly states = new Map<string, AnimStateDef>();
  private readonly banned: Set<string>;

  constructor(
    db: DbShape = DB,
    statesDoc: StatesShape = STATES,
  ) {
    this.banned = new Set(db.bannedBakeRels ?? []);
    for (const s of statesDoc.states) this.states.set(s.id, s);
    for (const c of db.clips) {
      this.byId.set(c.id, c);
      const list = this.byRole.get(c.role) ?? [];
      list.push(c);
      this.byRole.set(c.role, list);
      for (const st of c.states ?? []) {
        const sl = this.byState.get(st) ?? [];
        sl.push(c);
        this.byState.set(st, sl);
      }
    }
    // Higher priority first
    for (const [k, list] of this.byRole) {
      list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.byRole.set(k, list);
    }
    for (const [k, list] of this.byState) {
      list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.byState.set(k, list);
    }
  }

  get version(): number {
    return DB.version;
  }

  getClip(id: string): AnimClipEntry | undefined {
    return this.byId.get(id);
  }

  getState(id: string): AnimStateDef | undefined {
    return this.states.get(id);
  }

  listClips(): AnimClipEntry[] {
    return [...this.byId.values()];
  }

  listStates(): AnimStateDef[] {
    return [...this.states.values()];
  }

  listPacks(): Record<string, AnimPackMeta> {
    return { ...DB.packs };
  }

  /** Readiness counts for CI / Systems panel. */
  readiness(): {
    total: number;
    ready: number;
    placeholder: number;
    missing: number;
    banned: number;
    byPack: Record<string, { ready: number; total: number }>;
  } {
    const byPack: Record<string, { ready: number; total: number }> = {};
    let ready = 0;
    let placeholder = 0;
    let missing = 0;
    let banned = 0;
    for (const c of this.byId.values()) {
      const p = byPack[c.pack] ?? { ready: 0, total: 0 };
      p.total++;
      if (c.status === "ready") {
        ready++;
        p.ready++;
      } else if (c.status === "placeholder") placeholder++;
      else if (c.status === "missing") missing++;
      else if (c.status === "banned") banned++;
      byPack[c.pack] = p;
    }
    return {
      total: this.byId.size,
      ready,
      placeholder,
      missing,
      banned,
      byPack,
    };
  }

  isBannedBake(rel: string): boolean {
    return this.banned.has(rel);
  }

  /**
   * Prefer weapon → pack, then surface+activity → state → role → clip.
   */
  resolve(query: AnimResolveQuery): AnimResolveResult | null {
    const packHint =
      query.pack ||
      (query.weaponId != null ? animPackForWeapon(query.weaponId) : null) ||
      null;

    let state: AnimStateDef | null = null;
    let role = query.role;

    if (query.stateId) {
      state = this.states.get(query.stateId) ?? null;
      if (!role && state) role = state.defaultRole;
    }

    // Infer loco state from surface + speed when no explicit state
    if (!state && !role) {
      const inferred = this.inferStateId(query);
      if (inferred) {
        state = this.states.get(inferred) ?? null;
        role = state?.defaultRole ?? role;
      }
    }

    if (!role) return null;

    const candidates = this.collectCandidates(role, state?.id, query);
    if (candidates.length === 0) return null;

    // Score: pack match, surface match, weapon match, status ready, priority
    let best: AnimClipEntry | null = null;
    let bestScore = -1e9;
    let degraded = false;

    for (const c of candidates) {
      if (query.readyOnly && c.status !== "ready") continue;
      if (c.bakeRel && this.banned.has(c.bakeRel)) continue;

      let score = c.priority ?? 0;
      if (packHint && c.pack === packHint) score += 200;
      else if (packHint && c.pack === (DB.packs[packHint]?.fallbackPack ?? "")) {
        score += 80;
        degraded = true;
      }
      if (query.surface && c.surfaces?.includes(query.surface)) score += 100;
      if (query.surface && !c.surfaces?.length) score += 10;
      if (query.weaponId && weaponMatches(c.weapons, query.weaponId)) score += 50;
      if (c.weapons?.includes("*")) score += 5;
      if (c.status === "ready") score += 40;
      else if (c.status === "placeholder") score += 10;
      else if (c.status === "missing") score -= 50;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (!best) return null;

    // Fallback pack if preferred pack missing entirely
    if (
      packHint &&
      best.pack !== packHint &&
      DB.packs[packHint]?.fallbackPack
    ) {
      degraded = true;
    }

    return {
      clip: best,
      state,
      bakeRel: best.bakeRel && !this.banned.has(best.bakeRel) ? best.bakeRel : null,
      sourceRel: best.sourceRel ?? null,
      pack: best.pack,
      degraded,
    };
  }

  /**
   * Map SurfaceLocomotion + activity + speed → primary state id.
   */
  inferStateId(query: AnimResolveQuery): string | null {
    const surface = query.surface ?? "ground";
    const activity = query.activity ?? "combat";
    const speed = query.speed ?? 0;

    if (surface === "swim") return speed > 0.08 ? "loco.swim" : "loco.tread";
    if (surface === "climb") return "traversal.climb";
    if (surface === "wallRun") return "traversal.wallRun";
    if (surface === "mantle") return "traversal.mantle";
    if (activity === "harvest" && speed < 0.08) return "activity.harvest";
    if (activity === "build" && speed < 0.08) return "activity.build";

    if (speed > 0.72) return "loco.run";
    if (speed > 0.08) return "loco.walk";
    return "loco.idle";
  }

  /**
   * Locomotion set map for PlayerAnimationDirector / pack loaders.
   */
  locomotionSetForPack(pack: string): Record<string, string> {
    const roles = ["idle", "walk", "run", "sprint", "jump", "dodge"];
    const out: Record<string, string> = {};
    for (const role of roles) {
      const r = this.resolve({ pack, role, surface: "ground" });
      if (r?.clip.role) out[role] = r.clip.role;
    }
    return out;
  }

  /**
   * Bake relative paths to load for a weapon pack (grudge6 combat rig).
   */
  bakeRelsForWeaponPack(pack: AnimPack | string): string[] {
    const set = new Set<string>();
    const roles = [
      "idle",
      "walk",
      "run",
      "attack",
      "skill1",
      "skill2",
      "skill3",
      "skill4",
      "jump",
      "dodge",
      "dodgeL",
      "dodgeR",
      "dodgeF",
    ];
    for (const role of roles) {
      const r = this.resolve({ pack, role, surface: "ground", readyOnly: false });
      if (r?.bakeRel) set.add(r.bakeRel);
    }
    // Always include shared traversal ready bakes
    for (const role of ["jump", "dodge", "dodgeL", "dodgeR", "dodgeF"]) {
      const r = this.resolve({ pack: "traversal", role, surface: "ground" });
      if (r?.bakeRel) set.add(r.bakeRel);
    }
    return [...set];
  }

  private collectCandidates(
    role: string,
    stateId: string | undefined,
    query: AnimResolveQuery,
  ): AnimClipEntry[] {
    const out: AnimClipEntry[] = [];
    const seen = new Set<string>();
    const push = (list?: AnimClipEntry[]) => {
      if (!list) return;
      for (const c of list) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
    };
    if (stateId) push(this.byState.get(stateId));
    push(this.byRole.get(role));
    // Role aliases
    if (role === "sprint") push(this.byRole.get("run"));
    if (role === "harvest") {
      push(this.byRole.get("harvestChop"));
      push(this.byRole.get("attack"));
    }
    if (role === "mantle") {
      push(this.byRole.get("climbUp"));
      push(this.byRole.get("jump"));
    }
    if (query.surface === "swim" && role === "idle") push(this.byRole.get("tread"));
    return out;
  }
}

function weaponMatches(list: string[] | undefined, weaponId: string): boolean {
  if (!list || list.length === 0) return false;
  if (list.includes("*")) return true;
  const w = weaponId.toLowerCase();
  return list.some((x) => {
    const xl = x.toLowerCase();
    return xl === w || (xl === "none" && (w === "none" || w === "unarmed" || w === ""));
  });
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _db: AnimDatabase | null = null;

/** Process-wide AnimDatabase (embedded content SSOT). */
export function getAnimDatabase(): AnimDatabase {
  if (!_db) _db = new AnimDatabase();
  return _db;
}

/** Bake URL path for loaders (no domain). */
export function bakePathFromRel(bakeRel: string): string {
  return `anims/baked/${bakeRel}.json`;
}

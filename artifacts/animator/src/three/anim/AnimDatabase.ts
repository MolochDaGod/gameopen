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
import databaseJson from "./data/database.json";
import statesJson from "./data/states.json";

export type AnimClipStatus = "ready" | "placeholder" | "missing" | "banned";
export type AnimSource = "baked" | "mixamo_fbx" | "explosive" | "procedural" | "external";
export type AnimLayer = "loco" | "action" | "overlay" | "traversal" | "activity";
export type PlayerActivity = "combat" | "harvest" | "build" | "any";
export type AnimSurface = SurfaceLocomotionMode | "mantle";

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
  stateId?: string;
  role?: string;
  weaponId?: string | null;
  pack?: string | null;
  surface?: AnimSurface;
  activity?: PlayerActivity;
  speed?: number;
  readyOnly?: boolean;
}

export interface AnimResolveResult {
  clip: AnimClipEntry;
  state: AnimStateDef | null;
  bakeRel: string | null;
  sourceRel: string | null;
  pack: string;
  degraded: boolean;
}

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

export class AnimDatabase {
  private readonly byId = new Map<string, AnimClipEntry>();
  private readonly byRole = new Map<string, AnimClipEntry[]>();
  private readonly byState = new Map<string, AnimClipEntry[]>();
  private readonly states = new Map<string, AnimStateDef>();
  private readonly banned: Set<string>;

  constructor(db: DbShape = DB, statesDoc: StatesShape = STATES) {
    this.banned = new Set(db.bannedBakeRels ?? []);
    for (const state of statesDoc.states) this.states.set(state.id, state);
    for (const clip of db.clips) {
      this.byId.set(clip.id, clip);
      const roleClips = this.byRole.get(clip.role) ?? [];
      roleClips.push(clip);
      this.byRole.set(clip.role, roleClips);
      for (const stateId of clip.states ?? []) {
        const stateClips = this.byState.get(stateId) ?? [];
        stateClips.push(clip);
        this.byState.set(stateId, stateClips);
      }
    }
    for (const [role, clips] of this.byRole) {
      clips.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.byRole.set(role, clips);
    }
    for (const [stateId, clips] of this.byState) {
      clips.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.byState.set(stateId, clips);
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
    for (const clip of this.byId.values()) {
      const pack = byPack[clip.pack] ?? { ready: 0, total: 0 };
      pack.total++;
      if (clip.status === "ready") {
        ready++;
        pack.ready++;
      } else if (clip.status === "placeholder") placeholder++;
      else if (clip.status === "missing") missing++;
      else if (clip.status === "banned") banned++;
      byPack[clip.pack] = pack;
    }
    return { total: this.byId.size, ready, placeholder, missing, banned, byPack };
  }

  isBannedBake(rel: string): boolean {
    return this.banned.has(rel);
  }

  resolve(query: AnimResolveQuery): AnimResolveResult | null {
    const packHint = query.pack || (query.weaponId != null ? animPackForWeapon(query.weaponId) : null) || null;
    let state: AnimStateDef | null = null;
    let role = query.role;

    if (query.stateId) {
      state = this.states.get(query.stateId) ?? null;
      if (!role && state) role = state.defaultRole;
    }
    if (!state && !role) {
      const inferred = this.inferStateId(query);
      if (inferred) {
        state = this.states.get(inferred) ?? null;
        role = state?.defaultRole ?? role;
      }
    }
    if (!role) return null;

    const candidates = this.collectCandidates(role, state?.id, query);
    if (!candidates.length) return null;

    let best: AnimClipEntry | null = null;
    let bestScore = -Infinity;
    let degraded = false;
    for (const clip of candidates) {
      if (query.readyOnly && clip.status !== "ready") continue;
      if (clip.bakeRel && this.banned.has(clip.bakeRel)) continue;
      let score = clip.priority ?? 0;
      if (packHint && clip.pack === packHint) score += 200;
      else if (packHint && clip.pack === (DB.packs[packHint]?.fallbackPack ?? "")) {
        score += 80;
        degraded = true;
      }
      if (query.surface && clip.surfaces?.includes(query.surface)) score += 100;
      if (query.surface && !clip.surfaces?.length) score += 10;
      if (query.weaponId && weaponMatches(clip.weapons, query.weaponId)) score += 50;
      if (clip.weapons?.includes("*")) score += 5;
      if (clip.status === "ready") score += 40;
      else if (clip.status === "placeholder") score += 10;
      else if (clip.status === "missing") score -= 50;
      if (score > bestScore) {
        bestScore = score;
        best = clip;
      }
    }
    if (!best) return null;
    if (packHint && best.pack !== packHint && DB.packs[packHint]?.fallbackPack) degraded = true;
    return {
      clip: best,
      state,
      bakeRel: best.bakeRel && !this.banned.has(best.bakeRel) ? best.bakeRel : null,
      sourceRel: best.sourceRel ?? null,
      pack: best.pack,
      degraded,
    };
  }

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

  locomotionSetForPack(pack: string): Record<string, string> {
    const roles = ["idle", "walk", "run", "sprint", "jump", "dodge"];
    const result: Record<string, string> = {};
    for (const role of roles) {
      const resolved = this.resolve({ pack, role, surface: "ground" });
      if (resolved?.clip.role) result[role] = resolved.clip.role;
    }
    return result;
  }

  bakeRelsForWeaponPack(pack: AnimPack | string): string[] {
    const bakeRels = new Set<string>();
    const roles = ["idle", "walk", "run", "attack", "skill1", "skill2", "skill3", "skill4", "jump", "dodge", "dodgeL", "dodgeR", "dodgeF"];
    for (const role of roles) {
      const resolved = this.resolve({ pack, role, surface: "ground", readyOnly: false });
      if (resolved?.bakeRel) bakeRels.add(resolved.bakeRel);
    }
    for (const role of ["jump", "dodge", "dodgeL", "dodgeR", "dodgeF"]) {
      const resolved = this.resolve({ pack: "traversal", role, surface: "ground" });
      if (resolved?.bakeRel) bakeRels.add(resolved.bakeRel);
    }
    return [...bakeRels];
  }

  private collectCandidates(role: string, stateId: string | undefined, query: AnimResolveQuery): AnimClipEntry[] {
    const candidates: AnimClipEntry[] = [];
    const seen = new Set<string>();
    const push = (clips?: AnimClipEntry[]) => {
      if (!clips) return;
      for (const clip of clips) {
        if (seen.has(clip.id)) continue;
        seen.add(clip.id);
        candidates.push(clip);
      }
    };
    if (stateId) push(this.byState.get(stateId));
    push(this.byRole.get(role));
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
    return candidates;
  }
}

function weaponMatches(list: string[] | undefined, weaponId: string): boolean {
  if (!list?.length) return false;
  if (list.includes("*")) return true;
  const normalizedWeaponId = weaponId.toLowerCase();
  return list.some((entry) => {
    const normalizedEntry = entry.toLowerCase();
    return normalizedEntry === normalizedWeaponId || (normalizedEntry === "none" && (normalizedWeaponId === "none" || normalizedWeaponId === "unarmed" || normalizedWeaponId === ""));
  });
}

let database: AnimDatabase | null = null;

export function getAnimDatabase(): AnimDatabase {
  if (!database) database = new AnimDatabase();
  return database;
}

export function bakePathFromRel(bakeRel: string): string {
  return `anims/baked/${bakeRel}.json`;
}

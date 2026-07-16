/**
 * Danger Room AI tool catalog — combat sandbox master + skill/anim/movement.
 * Tools map to live Studio / App callbacks. No silent no-ops.
 */
import { CHARACTERS, WEAPONS } from "../three/assets";
import type { Difficulty, EditorParams, Faction, WeaponId } from "../three/types";
import { resolveSlotIconUrl } from "../three/skillIcons";
import type { AiTool } from "./types";

const WEAPON_IDS = WEAPONS.map((w) => w.id);
const CHARACTER_IDS = CHARACTERS.map((c) => c.id);
const DIFFICULTIES: Difficulty[] = ["passive", "easy", "medium", "hard"];
const FACTIONS: Faction[] = ["enemy", "ally"];

const PARAM_FIELDS: { key: keyof EditorParams; min: number; max: number; label: string }[] = [
  { key: "moveSpeed", min: 0.5, max: 14, label: "move speed" },
  { key: "sprintMultiplier", min: 1, max: 4, label: "sprint multiplier" },
  { key: "jumpHeight", min: 0.3, max: 8, label: "jump height" },
  { key: "gravity", min: 4, max: 60, label: "gravity" },
  { key: "cameraDistance", min: 1.5, max: 14, label: "camera distance" },
  { key: "cameraHeight", min: 0.4, max: 5, label: "camera height" },
  { key: "mouseSensitivity", min: 0.1, max: 4, label: "mouse sensitivity" },
  { key: "fov", min: 30, max: 110, label: "field of view" },
  { key: "turnResponsiveness", min: 1, max: 30, label: "turn responsiveness" },
  { key: "blendTime", min: 0, max: 1, label: "animation blend time" },
  { key: "modelYaw", min: -Math.PI, max: Math.PI, label: "model yaw" },
  { key: "dashDistance", min: 1, max: 18, label: "dash / MM lunge distance" },
  { key: "aoeRadius", min: 0.5, max: 12, label: "AoE radius" },
  { key: "skillForce", min: 0, max: 48, label: "skill knockback / pushback force" },
  { key: "skyfallBolts", min: 1, max: 24, label: "skyfall bolts" },
];

const TOGGLE_FIELDS: { key: keyof EditorParams; label: string }[] = [
  { key: "showSkeleton", label: "skeleton overlay" },
  { key: "invertY", label: "invert vertical look" },
];

export interface DangerHandlers {
  onCharacter: (id: string) => void;
  onWeapon: (id: WeaponId) => void;
  onDifficulty: (d: Difficulty) => void;
  onSpawn: (weaponId: WeaponId, faction: Faction) => void;
  onSpawnBoss: (weaponId: WeaponId) => void;
  onClearNpcs: () => void;
  onParam: (patch: Partial<EditorParams>) => void;
  /** Optional AAA combat / anim / movement hooks (Studio). */
  onHitstop?: (seconds?: number) => void;
  onDash?: (dirX: number, dirZ: number, distance?: number) => boolean;
  onAnimPreview?: (clip: string, withEffect?: boolean) => boolean;
  onListClips?: () => string[];
  onTimeScale?: (scale: number) => void;
  onParry?: () => void;
  onDodge?: () => void;
  getWeaponId?: () => WeaponId;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Build the Danger Room tool registry bound to live App callbacks. */
export function buildDangerTools(handlers: DangerHandlers): AiTool[] {
  const tools: AiTool[] = [
    {
      name: "set_player_character",
      description: "Switch the player to a different character rig.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", enum: CHARACTER_IDS } },
        required: ["id"],
      },
      execute: (args) => {
        const id = String(args.id);
        if (!CHARACTER_IDS.includes(id)) throw new Error(`Unknown character "${id}".`);
        handlers.onCharacter(id);
        return `Player: ${id}`;
      },
    },
    {
      name: "set_player_weapon",
      description: "Equip a weapon class (updates skill bar icons from R2 pack art).",
      parameters: {
        type: "object",
        properties: { id: { type: "string", enum: WEAPON_IDS } },
        required: ["id"],
      },
      execute: (args) => {
        const id = args.id as WeaponId;
        if (!WEAPON_IDS.includes(id)) throw new Error(`Unknown weapon "${id}".`);
        handlers.onWeapon(id);
        const icon = resolveSlotIconUrl("primary", id);
        return `Weapon: ${id} · skill icon ${icon}`;
      },
    },
    {
      name: "set_difficulty",
      description: "Set sparring difficulty for spawned opponents.",
      parameters: {
        type: "object",
        properties: { difficulty: { type: "string", enum: DIFFICULTIES } },
        required: ["difficulty"],
      },
      execute: (args) => {
        const d = args.difficulty as Difficulty;
        if (!DIFFICULTIES.includes(d)) throw new Error(`Unknown difficulty "${d}".`);
        handlers.onDifficulty(d);
        return `Difficulty: ${d}`;
      },
    },
    {
      name: "spawn_npc",
      description: "Spawn sparring NPCs (enemy or ally) with a weapon.",
      parameters: {
        type: "object",
        properties: {
          weapon: { type: "string", enum: WEAPON_IDS },
          faction: { type: "string", enum: FACTIONS },
          count: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["weapon", "faction"],
      },
      execute: (args) => {
        const weapon = args.weapon as WeaponId;
        if (!WEAPON_IDS.includes(weapon)) throw new Error(`Unknown weapon "${weapon}".`);
        const faction = args.faction as Faction;
        if (!FACTIONS.includes(faction)) throw new Error(`Unknown faction "${faction}".`);
        const count = Math.max(1, Math.min(10, Math.round(Number(args.count ?? 1))));
        for (let i = 0; i < count; i++) handlers.onSpawn(weapon, faction);
        return `Spawned ${count} ${faction} ${weapon}${count === 1 ? "" : "s"}`;
      },
    },
    {
      name: "spawn_boss",
      description: "Spawn a tougher boss NPC.",
      parameters: {
        type: "object",
        properties: { weapon: { type: "string", enum: WEAPON_IDS } },
        required: ["weapon"],
      },
      execute: (args) => {
        const weapon = args.weapon as WeaponId;
        if (!WEAPON_IDS.includes(weapon)) throw new Error(`Unknown weapon "${weapon}".`);
        handlers.onSpawnBoss(weapon);
        return `Spawned a ${weapon} boss`;
      },
    },
    {
      name: "clear_npcs",
      description: "Remove all spawned NPCs.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        handlers.onClearNpcs();
        return "Cleared all NPCs";
      },
    },
    {
      name: "set_param",
      description:
        "Tune movement, camera, combat (dashDistance=MM lunge, skillForce=pushback, blendTime=anim blend).",
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: [...PARAM_FIELDS.map((f) => f.key), ...TOGGLE_FIELDS.map((f) => f.key)],
          },
          value: { type: "number" },
          enabled: { type: "boolean" },
        },
        required: ["field"],
      },
      execute: (args) => {
        const field = String(args.field) as keyof EditorParams;
        const toggle = TOGGLE_FIELDS.find((f) => f.key === field);
        if (toggle) {
          if (typeof args.enabled !== "boolean")
            throw new Error(`"${toggle.label}" needs enabled true/false.`);
          handlers.onParam({ [field]: args.enabled } as Partial<EditorParams>);
          return `${toggle.label}: ${args.enabled ? "on" : "off"}`;
        }
        const spec = PARAM_FIELDS.find((f) => f.key === field);
        if (!spec) throw new Error(`Unknown parameter "${field}".`);
        if (typeof args.value !== "number" || !Number.isFinite(args.value))
          throw new Error(`"${spec.label}" needs a numeric value.`);
        const v = clamp(args.value, spec.min, spec.max);
        handlers.onParam({ [field]: v } as Partial<EditorParams>);
        return `${spec.label}: ${v}`;
      },
    },
    {
      name: "aaa_combat_feel",
      description:
        "Apply a combat feel preset: snappy (hitstop+fast blend), weighty (strong pushback+lunge), defensive (parry-friendly params), or balanced.",
      parameters: {
        type: "object",
        properties: {
          preset: { type: "string", enum: ["snappy", "weighty", "defensive", "balanced"] },
        },
        required: ["preset"],
      },
      execute: (args) => {
        const p = String(args.preset);
        if (p === "snappy") {
          handlers.onParam({ blendTime: 0.08, turnResponsiveness: 18, dashDistance: 4.5, skillForce: 14 });
          handlers.onHitstop?.(0.06);
          return "Combat feel: snappy (fast blend, hitstop, responsive turns)";
        }
        if (p === "weighty") {
          handlers.onParam({ blendTime: 0.18, dashDistance: 7, skillForce: 28, moveSpeed: 4.2 });
          return "Combat feel: weighty (strong MM lunge + pushback)";
        }
        if (p === "defensive") {
          handlers.onParam({ blendTime: 0.12, skillForce: 16, dashDistance: 5, turnResponsiveness: 14 });
          return "Combat feel: defensive (stable block/parry window tuning)";
        }
        handlers.onParam({ blendTime: 0.12, dashDistance: 5.5, skillForce: 18, turnResponsiveness: 12 });
        return "Combat feel: balanced defaults";
      },
    },
    {
      name: "audit_skill_icons",
      description:
        "Report skill bar icon URLs for the current (or given) weapon — R2 pack art + local fallbacks.",
      parameters: {
        type: "object",
        properties: { weapon: { type: "string", enum: WEAPON_IDS } },
      },
      execute: (args) => {
        const w = (args.weapon as WeaponId) || handlers.getWeaponId?.() || "sword";
        const roles = ["primary", "fskill", "sig1", "sig2", "sig3", "sig4", "heavy"] as const;
        const lines = roles.map((r) => `${r}: ${resolveSlotIconUrl(r, w)}`);
        return `Icons for ${w}:\n${lines.join("\n")}\nCDN base: assets.grudge-studio.com/icons/pack/`;
      },
    },
    {
      name: "preview_animation",
      description:
        "Play/preview an animation clip on the player with optional impact VFX (edit/generate feel). Use list_animations first.",
      parameters: {
        type: "object",
        properties: {
          clip: { type: "string" },
          withEffect: { type: "boolean" },
        },
        required: ["clip"],
      },
      execute: (args) => {
        if (!handlers.onAnimPreview) throw new Error("Animation preview not wired.");
        const clip = String(args.clip);
        const ok = handlers.onAnimPreview(clip, args.withEffect !== false);
        if (!ok) throw new Error(`Clip not found: "${clip}". Call list_animations.`);
        return `Previewing "${clip}"${args.withEffect === false ? "" : " + VFX"}`;
      },
    },
    {
      name: "list_animations",
      description: "List animation clips on the current character (for create/edit/preview).",
      parameters: { type: "object", properties: {} },
      execute: () => {
        const clips = handlers.onListClips?.() ?? [];
        if (!clips.length) return "No clips loaded yet — wait for character load.";
        return `Clips (${clips.length}): ${clips.slice(0, 40).join(", ")}${clips.length > 40 ? "…" : ""}`;
      },
    },
    {
      name: "unique_movement",
      description:
        "Request a unique movement: dash forward/back/left/right, or custom dirX/dirZ vector. Uses MM lunge / Controller.dash.",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["forward", "back", "left", "right", "custom"],
          },
          dirX: { type: "number" },
          dirZ: { type: "number" },
          distance: { type: "number" },
        },
        required: ["direction"],
      },
      execute: (args) => {
        if (!handlers.onDash) throw new Error("Movement request not wired.");
        const dir = String(args.direction);
        let x = 0;
        let z = 1;
        if (dir === "forward") {
          x = 0;
          z = 1;
        } else if (dir === "back") {
          x = 0;
          z = -1;
        } else if (dir === "left") {
          x = -1;
          z = 0;
        } else if (dir === "right") {
          x = 1;
          z = 0;
        } else {
          x = Number(args.dirX ?? 0);
          z = Number(args.dirZ ?? 1);
        }
        const dist = typeof args.distance === "number" ? args.distance : undefined;
        const ok = handlers.onDash(x, z, dist);
        if (!ok) throw new Error("Dash failed (no controller).");
        return `Movement: dash ${dir}${dist != null ? ` dist=${dist}` : ""}`;
      },
    },
    {
      name: "set_time_scale",
      description: "Set global combat time scale (slow-mo / speed). 1=normal, 0.3=bullet time.",
      parameters: {
        type: "object",
        properties: { scale: { type: "number", minimum: 0.05, maximum: 4 } },
        required: ["scale"],
      },
      execute: (args) => {
        if (!handlers.onTimeScale) throw new Error("Time scale not wired.");
        const scale = clamp(Number(args.scale), 0.05, 4);
        handlers.onTimeScale(scale);
        return `Time scale: ${scale}`;
      },
    },
    {
      name: "trigger_hitstop",
      description: "Fire a brief AAA hitstop (impact freeze) for combat feel testing.",
      parameters: {
        type: "object",
        properties: { seconds: { type: "number" } },
      },
      execute: (args) => {
        if (!handlers.onHitstop) throw new Error("Hitstop not wired.");
        const s = typeof args.seconds === "number" ? args.seconds : 0.08;
        handlers.onHitstop(s);
        return `Hitstop ${s}s`;
      },
    },
  ];

  return tools;
}

export interface DangerState {
  characterId: string;
  weaponId: WeaponId;
  difficulty: Difficulty;
  params: EditorParams;
}

/** Compact system prompt for Danger Room Master (bottom-right chat). */
export function dangerSystemPrompt(state: DangerState): string {
  const params = PARAM_FIELDS.map((f) => `${String(f.key)}=${state.params[f.key]}`).join(", ");
  const toggles = TOGGLE_FIELDS.map((f) => `${String(f.key)}=${state.params[f.key]}`).join(", ");
  const icon = resolveSlotIconUrl("primary", state.weaponId);
  return [
    "You are the Danger Room Master — AI combat director for Grudge Open (open.grudge-studio.com/danger).",
    "You help FIX combat feel, CREATE/EDIT/PREVIEW animations with effects, request UNIQUE MOVEMENT (MM lunges/dashes), and tune blocking/parry/pushback.",
    "Act only through tools. After tools, reply in one short natural sentence.",
    "",
    "Combat systems (wired):",
    "- MM (Maneuver Motion): dashDistance + Controller.dash / skill lunge; tool unique_movement",
    "- Block: RMB hold; pushback via skillForce + guard bounce",
    "- Parry: Q; perfect parry flash + hitstop",
    "- Hitstop: trigger_hitstop / auto on hits",
    "- Skill icons: R2 pack art (assets.grudge-studio.com/icons/pack/*) with local fallback",
    "",
    "Asset/API SSOT:",
    "- Icons CDN: https://assets.grudge-studio.com/icons/pack/",
    "- Master skills: https://info.grudge-studio.com/api/v1/master-weaponSkills.json",
    "- Content API: /api/content/skills · /api/content/weapons",
    "- Docs: docs/DANGER_ROOM.md",
    "",
    `Characters: ${CHARACTER_IDS.join(", ")}.`,
    `Weapons: ${WEAPON_IDS.join(", ")}.`,
    `Difficulties: ${DIFFICULTIES.join(", ")}.`,
    "",
    `Current: character=${state.characterId}, weapon=${state.weaponId}, difficulty=${state.difficulty}.`,
    `Primary icon: ${icon}`,
    `Parameters: ${params}.`,
    `Toggles: ${toggles}.`,
  ].join("\n");
}

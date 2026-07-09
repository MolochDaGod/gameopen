#!/usr/bin/env node
/**
 * Build Forge-compatible SceneData (.gfscene.json) for every gameopen scene.
 * Format matches @workspace/scene-schema used by forge.grudge-studio.com
 * (entities + environment). Open via:
 *   https://forge.grudge-studio.com/editor?scene=<absolute-url>
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "content", "scenes");
const CONTENT = join(ROOT, "content");

const CDN = "https://assets.grudge-studio.com";
const GAMEOPEN_CDN = `${CDN}/gameopen`;
const GAMEOPEN_API =
  process.env.GAMEOPEN_API_PUBLIC ||
  "https://gameopen-production.up.railway.app";
const FORGE = "https://forge.grudge-studio.com";

const DEFAULT_ENV = {
  skyColor: "#0a0a14",
  groundColor: "#1a1a2e",
  ambientIntensity: 0.4,
  sunIntensity: 1.2,
  gravity: [0, -9.81, 0],
  cameraMode: "editor",
  cameraTargetEntityId: null,
  playerMoveSpeed: 6,
  mouseSensitivity: 0.0025,
};

let counter = 0;
let scope = "go";
const id = () => `${scope}-${(counter++).toString(36).padStart(4, "0")}`;

function withScope(s, fn) {
  const prevC = counter;
  const prevS = scope;
  counter = 0;
  scope = s;
  try {
    return fn();
  } finally {
    counter = prevC;
    scope = prevS;
  }
}

function ent(o) {
  const e = {
    id: id(),
    name: o.name,
    type: o.type,
    transform: {
      position: o.position ?? [0, 0, 0],
      rotation: o.rotation ?? [0, 0, 0],
      scale: o.scale ?? [1, 1, 1],
    },
    parentId: o.parentId ?? null,
  };
  if (o.color || o.emissive) {
    e.material = {
      color: o.color,
      emissive: o.emissive,
      metalness: o.metalness ?? 0.1,
      roughness: o.roughness ?? 0.65,
    };
  }
  if (o.light) e.light = o.light;
  if (o.modelUrl) e.model = { url: o.modelUrl, label: o.label, clip: o.clip };
  if (o.behavior) e.behavior = o.behavior;
  if (o.controllerKind) e.controllerKind = o.controllerKind;
  if (o.npcLine) e.npcLine = o.npcLine;
  if (o.layer) e.layer = o.layer;
  if (
    !o.noPhysics &&
    o.type !== "light" &&
    o.type !== "camera" &&
    o.type !== "empty"
  ) {
    e.physics = o.fixed
      ? {
          bodyType: "fixed",
          colliderType: "cuboid",
          mass: 0,
          restitution: 0.2,
          friction: 1,
        }
      : {
          bodyType: "dynamic",
          colliderType: o.type === "sphere" ? "ball" : "cuboid",
          mass: 1,
          restitution: 0.35,
          friction: 0.6,
        };
  }
  return e;
}

function loadWeapons() {
  const dir = join(CONTENT, "weapons");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

function loadSkills() {
  const dir = join(CONTENT, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

/** Ground + lights shared by all gameopen scenes. */
function baseStage(entities, opts = {}) {
  entities.push(
    ent({
      name: "Ground",
      type: "plane",
      rotation: [-Math.PI / 2, 0, 0],
      scale: [opts.groundSize ?? 40, opts.groundSize ?? 40, 1],
      color: "#141822",
      roughness: 0.92,
      fixed: true,
      layer: "Terrain",
    }),
  );
  entities.push(
    ent({
      name: "Key Light",
      type: "light",
      position: [6, 10, 4],
      light: {
        kind: "directional",
        color: "#fff2d6",
        intensity: opts.sun ?? 1.4,
      },
      noPhysics: true,
    }),
  );
  entities.push(
    ent({
      name: "Fill Light",
      type: "light",
      position: [-5, 4, -3],
      light: {
        kind: "point",
        color: "#6a9fff",
        intensity: 8,
        distance: 28,
      },
      noPhysics: true,
    }),
  );
  entities.push(
    ent({
      name: "Rim Light",
      type: "light",
      position: [0, 3, -8],
      light: {
        kind: "point",
        color: "#d4a84b",
        intensity: 5,
        distance: 20,
      },
      noPhysics: true,
    }),
  );
}

/**
 * Weapon Lab — gold-standard sword + skill markers for AI / inspector.
 * Player third-person, interactable dummies.
 */
function weaponLabScene() {
  return withScope("wlab", () => {
    const entities = [];
    baseStage(entities, { groundSize: 32 });

    const playerId = id();
    entities.push({
      id: playerId,
      name: "Player",
      type: "model",
      model: {
        url: "builtin:char-survivor-male",
        label: "You",
        clip: "idle",
      },
      transform: {
        position: [0, 0, 4],
        rotation: [0, Math.PI, 0],
        scale: [1, 1, 1],
      },
      parentId: null,
      controllerKind: "thirdPerson",
      behavior: "player-rpg",
      layer: "Player",
      physics: {
        bodyType: "kinematicPosition",
        colliderType: "cuboid",
        mass: 1,
        restitution: 0,
        friction: 0.8,
      },
    });

    // Gold-standard weapon (parented to player hand approx)
    entities.push({
      id: id(),
      name: "IronLongsword",
      type: "model",
      model: {
        // Prefer gameopen CDN voxel stand-in until dedicated GLB ships
        url: `${GAMEOPEN_CDN}/models/weapons/voxel/00.obj`,
        label: "wpn_sword_iron_01",
      },
      transform: {
        position: [0.28, 1.15, 0.22],
        rotation: [0, Math.PI / 2, 0],
        scale: [0.85, 0.85, 0.85],
      },
      parentId: playerId,
    });

    // Skill target dummies in a row
    const skills = loadSkills().filter((s) => s.weaponFamily === "sword");
    skills.forEach((sk, i) => {
      const x = (i - (skills.length - 1) / 2) * 2.4;
      entities.push(
        ent({
          name: `Dummy_${sk.id}`,
          type: "cylinder",
          position: [x, 0.9, -4],
          scale: [0.45, 0.9, 0.45],
          color: "#8b3a3a",
          fixed: true,
          layer: "NPC",
        }),
      );
      entities.push({
        id: id(),
        name: `SkillMarker_${sk.id}`,
        type: "empty",
        transform: {
          position: [x, 2.2, -4],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        parentId: null,
        behavior: "npc-dialog",
        npcLine: `${sk.label} · ${sk.id} · power ${sk.power} · anim ${sk.animKey} · ${GAMEOPEN_API}/api/content/skills/${encodeURIComponent(sk.id)}`,
      });
    });

    // Catalog hub entity for AI context
    entities.push({
      id: id(),
      name: "GameOpenCatalog",
      type: "empty",
      transform: {
        position: [0, 0.1, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      parentId: null,
      npcLine: JSON.stringify({
        game: "gameopen",
        playUrl: "https://gameopen.vercel.app/",
        contentApi: `${GAMEOPEN_API}/api/content`,
        goldWeapon: "wpn_sword_iron_01",
        docs: "content/docs/WEAPON_PREFAB.md",
      }),
    });

    // Practice crates
    for (let i = 0; i < 5; i++) {
      entities.push(
        ent({
          name: `Crate_${i}`,
          type: "box",
          position: [-6 + i * 0.9, 0.4, -1.5],
          scale: [0.7, 0.7, 0.7],
          color: "#6b5344",
          roughness: 0.85,
        }),
      );
    }

    return {
      entities,
      environment: {
        ...DEFAULT_ENV,
        skyColor: "#080c14",
        groundColor: "#141822",
        ambientIntensity: 0.45,
        sunIntensity: 1.1,
        cameraMode: "editor",
      },
      _gameopen: {
        sceneKey: "weapon-lab",
        title: "GameOpen Weapon Lab",
        description:
          "Gold-standard sword prefab lab. Edit in Forge AI; play at gameopen.vercel.app.",
      },
    };
  });
}

/** Combat sandbox — map + player + enemies + catalog. */
function combatSandboxScene() {
  return withScope("csbx", () => {
    const entities = [];

    entities.push({
      id: id(),
      name: "Map",
      type: "model",
      model: { url: "builtin:map-encampment" },
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [0.55, 0.55, 0.55],
      },
      parentId: null,
    });

    entities.push(
      ent({
        name: "Ground",
        type: "plane",
        rotation: [-Math.PI / 2, 0, 0],
        scale: [60, 60, 1],
        color: "#1a1a1a",
        fixed: true,
        layer: "Terrain",
      }),
    );

    entities.push(
      ent({
        name: "Sun",
        type: "light",
        position: [8, 14, 6],
        light: { kind: "directional", color: "#ffe8c0", intensity: 1.5 },
        noPhysics: true,
      }),
    );
    entities.push(
      ent({
        name: "Warm Fill",
        type: "light",
        position: [-4, 3, 2],
        light: {
          kind: "point",
          color: "#ff9a4a",
          intensity: 10,
          distance: 24,
        },
        noPhysics: true,
      }),
    );

    entities.push({
      id: id(),
      name: "Player",
      type: "model",
      model: {
        url: "builtin:char-survivor-male",
        label: "Player",
      },
      transform: {
        position: [0, 0, 6],
        rotation: [0, Math.PI, 0],
        scale: [1, 1, 1],
      },
      parentId: null,
      controllerKind: "thirdPerson",
      behavior: "player-rpg",
      layer: "Player",
      physics: {
        bodyType: "kinematicPosition",
        colliderType: "cuboid",
        mass: 1,
        restitution: 0,
        friction: 0.8,
      },
    });

    const enemySpawns = [
      [4, 0, -3],
      [-4, 0, -2],
      [0, 0, -6],
      [7, 0, 1],
    ];
    enemySpawns.forEach((pos, i) => {
      entities.push({
        id: id(),
        name: `Enemy_${i}`,
        type: "model",
        model: {
          url: i % 2 === 0 ? "builtin:char-skeleton-sword" : "builtin:char-bandit",
          label: `Hostile ${i + 1}`,
        },
        transform: {
          position: pos,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        parentId: null,
        behavior: "enemy-rpg",
        layer: "NPC",
        physics: {
          bodyType: "dynamic",
          colliderType: "cuboid",
          mass: 1,
          restitution: 0.1,
          friction: 0.7,
        },
      });
    });

    entities.push({
      id: id(),
      name: "GameOpenHub",
      type: "empty",
      transform: {
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      parentId: null,
      behavior: "npc-dialog",
      npcLine:
        "Grudge Open combat sandbox · https://gameopen.vercel.app/ · content API /api/content · AI: ask Forge to equip wpn_sword_iron_01 skills",
    });

    // Campfire VFX
    entities.push({
      id: id(),
      name: "Campfire",
      type: "model",
      model: { url: "builtin:vfx-fire-anim" },
      transform: {
        position: [2.5, 0, 2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      parentId: null,
    });

    return {
      entities,
      environment: {
        ...DEFAULT_ENV,
        skyColor: "#0c1018",
        groundColor: "#1a1a1a",
        ambientIntensity: 0.4,
        sunIntensity: 1.0,
        cameraMode: "editor",
      },
      _gameopen: {
        sceneKey: "combat-sandbox",
        title: "GameOpen Combat Sandbox",
        description:
          "Encampment map, player, hostiles, fire VFX. Open in Forge to edit + AI; play live on gameopen.vercel.app.",
      },
    };
  });
}

/** Catalog plaza — one pedestal per weapon in content/weapons. */
function catalogPlazaScene() {
  return withScope("cata", () => {
    const entities = [];
    baseStage(entities, { groundSize: 48, sun: 1.2 });

    const weapons = loadWeapons();
    weapons.forEach((w, i) => {
      const angle = (i / Math.max(weapons.length, 1)) * Math.PI * 2;
      const r = 6;
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;

      entities.push(
        ent({
          name: `Pedestal_${w.id}`,
          type: "cylinder",
          position: [x, 0.35, z],
          scale: [0.7, 0.35, 0.7],
          color: "#2a3344",
          metalness: 0.4,
          roughness: 0.5,
          fixed: true,
        }),
      );

      const meshUrl = w.mesh?.path
        ? w.mesh.path.startsWith("http")
          ? w.mesh.path
          : `${GAMEOPEN_CDN}/${w.mesh.path.replace(/^models\//, "models/")}`
        : "builtin:prop-toon-weapons";

      entities.push({
        id: id(),
        name: w.id,
        type: "model",
        model: {
          url: meshUrl.includes("://")
            ? meshUrl
            : `${GAMEOPEN_CDN}/${w.mesh.path}`,
          label: w.id,
        },
        transform: {
          position: [x, 1.1, z],
          rotation: [0, -angle + Math.PI, 0],
          scale: [1.2, 1.2, 1.2],
        },
        parentId: null,
      });

      entities.push({
        id: id(),
        name: `Info_${w.id}`,
        type: "empty",
        transform: {
          position: [x, 2.0, z],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        parentId: null,
        behavior: "npc-dialog",
        npcLine: `${w.id} · family ${w.family} · dmg ${w.baseDamage} · skills ${
          (w.skills || []).join(", ")
        } · ${GAMEOPEN_API}/api/content/weapons/${w.id}`,
      });
    });

    entities.push({
      id: id(),
      name: "Player",
      type: "model",
      model: { url: "builtin:char-survivor-male", label: "Editor" },
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      parentId: null,
      controllerKind: "thirdPerson",
      behavior: "player-rpg",
      layer: "Player",
      physics: {
        bodyType: "kinematicPosition",
        colliderType: "cuboid",
        mass: 1,
        restitution: 0,
        friction: 0.8,
      },
    });

    return {
      entities,
      environment: {
        ...DEFAULT_ENV,
        skyColor: "#0a0e18",
        ambientIntensity: 0.5,
        cameraMode: "editor",
      },
      _gameopen: {
        sceneKey: "catalog-plaza",
        title: "GameOpen Weapon Catalog Plaza",
        description:
          "One pedestal per content/weapons entry. Walk up and inspect via AI / dialog.",
      },
    };
  });
}

const BUILDERS = {
  "weapon-lab": weaponLabScene,
  "combat-sandbox": combatSandboxScene,
  "catalog-plaza": catalogPlazaScene,
};

function stripMeta(scene) {
  const { _gameopen, ...rest } = scene;
  return { scene: rest, meta: _gameopen };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    forgeEditor: `${FORGE}/editor`,
    gameopenPlay: "https://gameopen.vercel.app/",
    contentApi: `${GAMEOPEN_API}/api/content`,
    scenes: [],
  };

  for (const [key, build] of Object.entries(BUILDERS)) {
    const raw = build();
    const { scene, meta } = stripMeta(raw);
    // Forge expects pure SceneData (entities + environment)
    const gfscene = {
      entities: scene.entities,
      environment: scene.environment,
    };
    const file = join(OUT, `${key}.gfscene.json`);
    writeFileSync(file, JSON.stringify(gfscene, null, 2) + "\n");

    const publicUrl = `${GAMEOPEN_API}/api/content/scenes/${key}`;
    const forgeUrl = `${FORGE}/editor?scene=${encodeURIComponent(publicUrl)}`;
    // edit-friendly: open without auto-play if forge supports it later
    const forgeEditUrl = `${FORGE}/editor?scene=${encodeURIComponent(publicUrl)}&edit=1`;

    index.scenes.push({
      key,
      title: meta?.title || key,
      description: meta?.description || "",
      entityCount: gfscene.entities.length,
      file: `content/scenes/${key}.gfscene.json`,
      urls: {
        json: publicUrl,
        forge: forgeUrl,
        forgeEdit: forgeEditUrl,
        play: "https://gameopen.vercel.app/",
      },
    });
    console.log(`wrote ${key} (${gfscene.entities.length} entities)`);
  }

  writeFileSync(
    join(OUT, "index.json"),
    JSON.stringify(index, null, 2) + "\n",
  );
  console.log(`index → content/scenes/index.json (${index.scenes.length} scenes)`);
}

main();

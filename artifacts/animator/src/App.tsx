import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Studio } from "./three/Studio";
import { AppShell } from "./components/AppShell";
import type { AssistantConfig } from "./ai/AssistantSurface";
import { appGuideSystemPrompt } from "./ai/companionPrompt";
import { buildDangerTools, dangerSystemPrompt } from "./ai/dangerTools";
import { buildVoxelAiTools, voxelWorldbuilderSystemPrompt } from "./ai/voxelAiTools";
import { VoxelEditor } from "./three/voxel/VoxelEditor";
import {
  type ActionSlot,
  type Difficulty,
  type AleCameraMode,
  type ReplayFrequency,
  type EditorParams,
  type Faction,
  type HudSnapshot,
  type SlotBinding,
  type StatusId,
  type WeaponId,
} from "./three/types";
import { loadFireFx, saveFireFx, type FireFxParams } from "./three/fxSettings";
import { loadControls } from "./three/controlsSettings";
import { ROOM_PRESETS, ROOM_PRESET_LIST, asRoomPresetId, loadRoomPreset, saveRoomPreset, type RoomPresetId } from "./three/RoomPresets";
import {
  loadTestWorldId,
  type TestWorldId,
} from "./three/testWorlds";
import { loadSound, type SoundSettings } from "./three/soundSettings";
import { SoundMixer, type SoundChannel } from "./components/SoundMixer";
import { DjStationBody, DjStationPanel } from "./components/DjStationPanel";
import { useAppMusic } from "./hooks/useAppMusic";
import {
  requestDressingPanel,
  type ToolDef,
} from "./components/toolbox/tools";
import type {
  BrushState,
  DeployableNode,
  EditorStats,
  GizmoMode,
  VoxelMap,
} from "./three/voxel/types";
import { colorForBlockType, DEFAULT_BLOCK_TYPE } from "@workspace/voxel-canonical";
import { Crosshair } from "./components/Crosshair";
import { CursorManager } from "./components/CursorManager";
import {
  setFreeMouseSticky,
  setPlayPointerCtx,
  setPointerLayer,
} from "@workspace/grudge-physics";
import { Hud } from "./components/Hud";
import { DangerStartScreen } from "./components/DangerStartScreen";
import { HarvestProductionUI } from "./components/HarvestProductionUI";
import { MechHud } from "./components/MechHud";
import { loadoutRaceFromFleet } from "./components/EquipmentScreen";
import { ExplorerCharacterPage } from "./components/characterPage";
import { GrudgeSystemsPanel } from "./components/GrudgeSystemsPanel";
import { CampClaimFlagPanel } from "./components/CampClaimFlagPanel";
import { CharacterBagPanel } from "./components/hud/CharacterBagPanel";
import { ClassSkillBar } from "./components/ClassSkillBar";
import {
  loadCharacterBag,
  resolveDepositContext,
  type DepositContext,
  harvestIntoBag,
  applyDeathBagDrop,
  DEFAULT_BAG_SLOTS,
} from "./game/inventory";
import { AdminPanel } from "./components/AdminPanel";
import { EnvThumb } from "./components/EnvThumb";
import { EditorPanel } from "./components/EditorPanel";
import { AnimationsPanel } from "./components/AnimationsPanel";
import { TouchControls } from "./components/TouchControls";
import { StatusBar } from "./components/StatusBar";
import { StatusDock } from "./components/StatusDock";
import { DoorSelect } from "./components/DoorSelect";
import { IntroCinematic } from "./components/IntroCinematic";
import { CinemaFlowGate } from "./components/CinemaFlowGate";
import { EditorMode } from "./components/editor/EditorMode";
import { Lobby } from "./components/Lobby";
import { FleetBar } from "./components/FleetBar";
import { AccountPanel } from "./components/AccountPanel";
import { ThreeBrawler } from "./components/ThreeBrawler";
import { ThreeVoxBattle } from "./components/ThreeVoxBattle";
import { GrudoxZones } from "./components/GrudoxZones";
import { InAppGameCanvas } from "./components/InAppGameCanvas";
import { MimicDungeon } from "./components/MimicDungeon";
import { VoxGrudgeNative } from "./components/VoxGrudgeNative";
import {
  buildWarlordGenesisUrl,
  WARLORD_GENESIS_ENTRY,
} from "./lib/warlordGenesisLaunch";
import type { InAppEmbedSession } from "./lib/inAppLaunch";
import { nativeModeForZone } from "./lib/inAppLaunch";
import { assetUrl } from "./lib/fleet";
import { bootstrapProductionMedia } from "./lib/productionMedia";
import { gameSession } from "./game/GameSession";
import {
  buildGenesisHeroOptions,
  type GenesisHeroOption,
} from "./lib/grudoxRoster";
import { resolveRaceModel } from "./lib/raceModel";
import { LedMaskMode } from "./components/LedMaskMode";
import { LandingPage } from "./components/LandingPage";
import { HelpersLoadScreen } from "./components/HelpersLoadScreen";
import { AvatarEditMode } from "./components/AvatarEditMode";
import { CampfireLobby } from "./components/CampfireLobby";
import { MineGrudgeEditorMode } from "./components/MineGrudgeEditorMode";
import { RealmsSurface } from "./components/RealmsSurface";
import { CollectionHealth } from "./components/CollectionHealth";
import { VoxelEditorUI } from "./components/VoxelEditorUI";
import { VoxelMapsPanel } from "./components/VoxelMapsPanel";
import { VoxelTemplatePicker } from "./components/VoxelTemplatePicker";
import type { MapTemplate } from "./three/voxel/templates";
import {
  deleteMap,
  exportMap,
  importMap,
  listMaps,
  loadMap,
  saveMap,
  type StoredMapMeta,
} from "./three/voxel/mapStore";
import type { CreatePostPayload } from "@workspace/api-client-react";
import type { SceneDescriptor } from "./three/editor/types";
import { DangerClient } from "./net/DangerClient";
import { useDevice } from "./hooks/useDevice";
import { DockSurface, ToolMenubar, Tip, TipProvider, useDockLayout } from "./components/dock";
import type { DockPanelDef, DockPanelMeta, ToolMenu } from "./components/dock";
import { DoorOpen, ShieldHalf, SlidersHorizontal, Film, RotateCcw, LayoutDashboard, Swords, BookOpen, Flag } from "lucide-react";
import { HudEditor } from "./components/hud/HudEditor";
import { useHudEditor } from "./hud/useHudEditor";
import { resolveHudVars } from "./hud/hudConfig";
import {
  type AppMode,
  resolveModeFromLocation,
  syncUrlToMode,
} from "./lib/openRoutes";
import "./index.css";
import "./components/dock/dock.css";

/** Engine surface modes — URL map lives in `lib/openRoutes.ts`. */
type Mode = AppMode;

/** Resolve initial mode from path slug / arcade deep-link / query. */
function initialMode(): Mode {
  return resolveModeFromLocation();
}

/**
 * Warlord Genesis entry from Open / charactersgrudox.
 * Shows the GRUDOX 4-slot heroes (campfire roster), then hands off SSO +
 * characterId/baseId/raceId to warlord-genesis.vercel.app.
 */
function GenesisExternalLaunch({
  onStay,
  onOpenInApp,
}: {
  onStay: () => void;
  onOpenInApp: (session: InAppEmbedSession) => void;
}) {
  const [heroes, setHeroes] = useState<GenesisHeroOption[]>(() =>
    buildGenesisHeroOptions(gameSession.snapshot.characters, gameSession.snapshot.selectedCharacterId),
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const preferred = gameSession.snapshot.selectedCharacterId;
    const opts = buildGenesisHeroOptions(
      gameSession.snapshot.characters,
      preferred,
    );
    if (preferred && opts.some((h) => h.id === preferred)) return preferred;
    return opts[0]?.id ?? null;
  });
  const [ready, setReady] = useState(gameSession.snapshot.ready);

  useEffect(() => {
    const unsub = gameSession.subscribe(() => {
      const snap = gameSession.snapshot;
      setReady(snap.ready);
      const opts = buildGenesisHeroOptions(snap.characters, snap.selectedCharacterId);
      setHeroes(opts);
      setSelectedId((prev) => {
        if (prev && opts.some((h) => h.id === prev)) return prev;
        if (snap.selectedCharacterId && opts.some((h) => h.id === snap.selectedCharacterId)) {
          return snap.selectedCharacterId;
        }
        return opts[0]?.id ?? null;
      });
    });
    // Ensure roster is loaded (fleet + grudox 4-slots)
    if (!gameSession.snapshot.ready) {
      void gameSession.boot().catch(() => undefined);
    } else {
      void gameSession.refreshCharacters().catch(() => undefined);
    }
    return unsub;
  }, []);

  const selected = heroes.find((h) => h.id === selectedId) ?? heroes[0] ?? null;

  const launchOpts = () => {
    if (selected) {
      gameSession.selectCharacter(selected.id);
      // Ensure session has a GrudgeCharacter row for this slot
      if (!gameSession.snapshot.characters.some((c) => c.id === selected.id)) {
        gameSession.upsertLocalCharacter({
          id: selected.id,
          name: selected.name,
          raceId: selected.raceKey === "high_elf" ? "elf" : selected.raceKey,
          classId: "warrior",
          level: 1,
          config: { baseId: selected.baseId, source: "charactersgrudox", slot: selected.slot },
        });
      }
    }
    let from: string | null = null;
    try {
      from = sessionStorage.getItem("grudge.open.handoffFrom");
    } catch {
      /* */
    }
    return {
      characterId: selected?.id ?? null,
      baseId: selected?.baseId ?? null,
      characterName: selected?.name ?? null,
      raceId:
        selected?.raceKey === "high_elf" ? "elf" : selected?.raceKey ?? null,
      from: from || "charactersgrudox",
    };
  };

  const launchUrl = selected
    ? buildWarlordGenesisUrl(launchOpts())
    : WARLORD_GENESIS_ENTRY;

  const raceColors: Record<string, string> = {
    human: "#4f9bff",
    orc: "#7cff3a",
    undead: "#c45cff",
    barbarian: "#ff7a3a",
    dwarf: "#ffd24d",
    elf: "#5fe0ff",
    high_elf: "#5fe0ff",
  };

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "70vh",
        padding: 32,
        color: "#e8eef8",
        textAlign: "center",
        gap: 18,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color: "#ffd24d" }}>Warlord Genesis</div>
      <p style={{ maxWidth: 480, opacity: 0.85, lineHeight: 1.5, margin: 0 }}>
        Choose one of your <b>Characters GRUDOX</b> heroes (up to 4 campfire slots), then launch
        the 3-lane MOBA / RTS with that character.
      </p>
      {!ready && (
        <div style={{ fontSize: 13, opacity: 0.7 }}>Loading roster…</div>
      )}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 720,
        }}
      >
        {heroes.map((h) => {
          const accent = raceColors[h.raceKey] || "#ffd24d";
          const active = h.id === selectedId;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setSelectedId(h.id);
                gameSession.selectCharacter(h.id);
              }}
              style={{
                width: 150,
                padding: "14px 12px",
                borderRadius: 12,
                border: `2px solid ${active ? accent : "rgba(255,210,77,0.22)"}`,
                background: active ? `${accent}22` : "rgba(6,9,16,0.78)",
                boxShadow: active ? `0 0 16px ${accent}55` : "none",
                color: "#e8eef8",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 10, opacity: 0.65, letterSpacing: 1 }}>
                SLOT {h.slot + 1} · {h.source === "grudox" ? "GRUDOX" : "FLEET"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: accent, marginTop: 4 }}>
                {h.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{h.raceLabel}</div>
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6, wordBreak: "break-all" }}>
                {h.baseId}
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{ fontSize: 13, color: "#8ec3ff" }}>
          Selected: <b>{selected.name}</b> · {selected.raceLabel}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          className="gl-btn primary large"
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "1px solid #ffd24d88",
            background: "#ffd24d22",
            color: "#ffd24d",
            fontWeight: 700,
            cursor: selected ? "pointer" : "default",
            opacity: selected ? 1 : 0.45,
          }}
          disabled={!selected}
          onClick={() => {
            const url = buildWarlordGenesisUrl(launchOpts()) || WARLORD_GENESIS_ENTRY;
            onOpenInApp({
              url,
              title: "Warlord Genesis",
              tone: "#ffd24d",
              poster: assetUrl("rooms/genesis-scene.png"),
              id: "warlord-genesis",
              returnMode: "doors",
            });
          }}
        >
          Play in app
        </button>
        <button
          type="button"
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "1px solid #ffffff33",
            background: "transparent",
            color: "#c8d0dc",
            cursor: selected ? "pointer" : "default",
            opacity: selected ? 1 : 0.45,
          }}
          disabled={!selected}
          onClick={() => {
            const url = buildWarlordGenesisUrl({ ...launchOpts() }) || WARLORD_GENESIS_ENTRY;
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          Pop out ↗
        </button>
        <button
          type="button"
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "1px solid #ffffff22",
            background: "transparent",
            color: "#8a93a3",
            cursor: "pointer",
          }}
          onClick={onStay}
        >
          Back to library
        </button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.45, maxWidth: 420 }}>
        Handoff includes characterId, baseId, raceId + Grudge SSO. Empty slots fill from fleet
        roster when you have fewer than 4 GRUDOX heroes.
      </div>
      {/* Keep URL for debugging handoff shape */}
      {import.meta.env.DEV && selected && (
        <code style={{ fontSize: 10, opacity: 0.4, wordBreak: "break-all", maxWidth: 520 }}>
          {launchUrl}
        </code>
      )}
    </div>
  );
}

const DEFAULT_BRUSH: BrushState = {
  tool: "block",
  shape: "block",
  blockType: DEFAULT_BLOCK_TYPE,
  color: colorForBlockType(DEFAULT_BLOCK_TYPE),
  deployKind: "npc",
  weapon: "sword",
  difficulty: "normal",
  prop: "brewingStand",
  rotation: 0,
};

// Danger Room dockable panels — all hidden until summoned (hotkey / menu).
const DANGER_PANEL_METAS: DockPanelMeta[] = [
  { id: "admin", home: "left", defaultVisible: false },
  { id: "editor", home: "right", defaultVisible: false },
  { id: "anim", home: "right", defaultVisible: false },
];
type DangerPanelId = "admin" | "editor" | "anim";

export default function App() {
  const [mode, setMode] = useState<Mode>(initialMode);
  /** Fleet game running inside Open (iframe canvas) — not a new browser page. */
  const [inAppEmbed, setInAppEmbed] = useState<InAppEmbedSession | null>(null);
  const urlBootRef = useRef(true);
  // Production media (master-items / icons / equipment catalogs) — once at shell boot.
  useEffect(() => {
    bootstrapProductionMedia();
  }, []);
  // Keep URL path in sync with mode (shareable /danger, /voxel, /brawl, …).
  // In-app embeds keep the host mode (e.g. /zones) so back returns to the catalog.
  useEffect(() => {
    if (inAppEmbed) return;
    syncUrlToMode(mode, { replace: urlBootRef.current });
    urlBootRef.current = false;
  }, [mode, inAppEmbed]);
  // Browser back/forward → restore mode from path (also closes embed).
  useEffect(() => {
    const onPop = () => {
      setInAppEmbed(null);
      setMode(resolveModeFromLocation());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const mountRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  /** Full harvest/build production shell (ops, craft, codex, maps, trees, avatars). */
  const [harvestUiOpen, setHarvestUiOpen] = useState(false);
  const harvestUiOpenRef = useRef(false);
  harvestUiOpenRef.current = harvestUiOpen;
  const [equipOpen, setEquipOpen] = useState(false);
  const equipOpenRef = useRef(false);
  equipOpenRef.current = equipOpen;
  /** Creator mainTabBar skillbook / systems panel (Character · Class · Wpn Skills · …). */
  const [systemsOpen, setSystemsOpen] = useState(false);
  const systemsOpenRef = useRef(false);
  systemsOpenRef.current = systemsOpen;
  /** Camp claim flag hub (units / buildings / farm / tame / defensives / upgrades). */
  const [claimFlagOpen, setClaimFlagOpen] = useState(false);
  const claimFlagOpenRef = useRef(false);
  claimFlagOpenRef.current = claimFlagOpen;
  /** Character 3×3 bag (harvest HUD far-right · Key I in harvest/build). */
  const [bagOpen, setBagOpen] = useState(false);
  const bagOpenRef = useRef(false);
  bagOpenRef.current = bagOpen;
  /**
   * Danger start gate (sample three.js boot): overlay until ENTER → pointer lock.
   * Resets each time the player enters danger mode.
   */
  const [dangerStartOpen, setDangerStartOpen] = useState(true);
  const dangerStartOpenRef = useRef(true);
  dangerStartOpenRef.current = dangerStartOpen;
  /**
   * Sticky free-mouse (F8 / \): OS cursor in world, no auto pointer-lock.
   * F9 / ' re-locks aim. Panels force free mouse until closed.
   */
  const [freeMouse, setFreeMouse] = useState(false);
  const freeMouseRef = useRef(false);
  freeMouseRef.current = freeMouse;
  const [depositCtx, setDepositCtx] = useState<DepositContext>({
    zone: "none",
    canDeposit: false,
    label: "Deposit (need claim / camp / boat)",
  });
  const [bagOccupied, setBagOccupied] = useState(0);
  // Never carry the loadout overlay across surfaces (doors/editor/play/danger).
  useEffect(() => {
    setEquipOpen(false);
    setSystemsOpen(false);
    setClaimFlagOpen(false);
    setBagOpen(false);
  }, [mode]);

  /** Creator-class systems / skillbook panel (K). Defined early for key handlers. */
  const openSystems = useCallback(() => {
    setSystemsOpen(true);
    setEquipOpen(false);
    setClaimFlagOpen(false);
    document.exitPointerLock?.();
  }, []);

  const toggleSystems = useCallback(() => {
    setSystemsOpen((v) => {
      const next = !v;
      if (next) {
        setEquipOpen(false);
        setClaimFlagOpen(false);
        document.exitPointerLock?.();
      }
      return next;
    });
  }, []);

  /** Claim flag camp hub (B) — build rights UI, not quick-craft. */
  const openClaimFlag = useCallback(() => {
    setClaimFlagOpen(true);
    setEquipOpen(false);
    setSystemsOpen(false);
    setHarvestUiOpen(false);
    document.exitPointerLock?.();
  }, []);

  const toggleClaimFlag = useCallback(() => {
    setClaimFlagOpen((v) => {
      const next = !v;
      if (next) {
        setEquipOpen(false);
        setSystemsOpen(false);
        setHarvestUiOpen(false);
        document.exitPointerLock?.();
      }
      return next;
    });
  }, []);
  const [characterId, setCharacterId] = useState("explorer");
  const activeCharacterId =
    gameSession.snapshot.selectedCharacterId || characterId || "local";

  const refreshBagMeta = useCallback(() => {
    const b = loadCharacterBag(activeCharacterId);
    setBagOccupied(b.slots.filter((s) => s.item).length);
  }, [activeCharacterId]);

  const refreshDeposit = useCallback(() => {
    const probe = studioRef.current?.getDepositProbe?.() ?? {
      insideClaim: false,
      nearCamp: false,
      onBoat: false,
    };
    setDepositCtx(resolveDepositContext(probe));
  }, []);

  useEffect(() => {
    try {
      (window as unknown as { __grudgeCharId?: string }).__grudgeCharId = activeCharacterId;
    } catch {
      /* ignore */
    }
    refreshBagMeta();
    const t = window.setInterval(() => {
      refreshDeposit();
      refreshBagMeta();
    }, 800);
    return () => window.clearInterval(t);
  }, [refreshBagMeta, refreshDeposit, mode, activeCharacterId]);

  // Drive avatar + equipment from signed-in Warlords hero (Railway / campfire roster).
  // Production path: race kit + atlas + mesh_ids (uMMORPG main panel) — not catalog GLBs.
  // IMPORTANT: re-apply when Studio mounts (danger/play) — loadout often resolves
  // before studioRef exists; that race caused wrong mesh/scale/equip.
  const applyFleetLoadoutRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const applyAvatarAndLoadout = () => {
      // Annihilate deep-link owns avatar/equip; do not let session updates clobber it.
      try {
        const q = new URLSearchParams(window.location.search);
        if (q.get("hero") || q.get("character")) return;
      } catch {
        /* ignore */
      }
      const ch = gameSession.selectedCharacter();
      if (!ch) return;
      const { avatarId: raceAvatar } = resolveRaceModel(ch);
      void Promise.all([
        import("./lib/characterLoadout"),
        import("./lib/characterEquipmentMesh"),
        import("./lib/characterPortrait"),
      ]).then(
        ([
          { loadoutFromCharacter },
          { resolveCharacterEquipmentVisual },
          { isVoxelCharacter },
        ]) => {
          const loadout = loadoutFromCharacter(ch);
          // Explorer (cube + Avatar face) when user chose explorer, voxel head, or
          // avatarId=explorer — Mine-Loader style playable box controller path.
          // Otherwise fleet grudge6 race kit (mesh_ids + atlas).
          const preferExplorer =
            loadout.avatarId === "explorer" ||
            loadout.avatarId?.startsWith("avatar-") ||
            isVoxelCharacter(ch);
          const avatarId = preferExplorer ? "explorer" : loadout.avatarId || raceAvatar;
          setCharacterId((prev) => (prev === avatarId ? prev : avatarId));
          // Resolve mesh_ids (equipment bag / gear preset / class default) then spawn
          void resolveCharacterEquipmentVisual(ch).then((vis) => {
            const studio = studioRef.current;
            if (!studio) {
              // Studio not mounted yet — characterId/weapon state still updated;
              // danger/play mount effect will re-call applyFleetLoadoutRef.
              return;
            }
            if (preferExplorer) {
              // Mine-Loader tier tints on procedural body (chest/legs/boots).
              const tierHex: Record<string, number> = {
                leather: 0x8a5a33,
                wood: 0x8a6b3f,
                iron: 0xc8ccd4,
                gold: 0xe8c53a,
                diamond: 0x59d6d0,
              };
              // Optional bag fields if present on open save
              const bag = (ch.saveData?.open as { armorTier?: Record<string, string> }) || {};
              const at = bag.armorTier || {};
              studio.setExplorerEquipmentTints({
                shirt: tierHex[at.chest || "iron"] ?? tierHex.iron,
                pants: tierHex[at.legs || "iron"] ?? tierHex.iron,
                boot: tierHex[at.boots || "leather"] ?? tierHex.leather,
              });
              studio.setEquipmentMeshIds(null);
              studio.setCharacter("explorer");
              studio.refreshExplorerHead();
            } else {
              // Class gear preset + account mesh_ids → Toon RTS kit visibility
              studio.setEquipmentMeshIds(vis.meshIds);
              studio.setCharacter(avatarId);
            }
            console.info(
              "[Open] account character visual",
              ch.name,
              preferExplorer ? "explorer+avatarFace" : vis.source,
              vis.raceId,
              vis.presetId,
              preferExplorer ? "procedural" : `meshes=${vis.meshIds.length}`,
              vis.gearPresetId || "",
            );
          });
          // Apply saved weapons so logged-in play uses the character's gear
          // (Explorer mounts arsenal GLB; grudge6 uses kit handheld meshes).
          if (loadout.weaponId) {
            setWeaponId(loadout.weaponId);
            studioRef.current?.setWeapon(loadout.weaponId);
          }
          setOffHandState(loadout.offHand);
          studioRef.current?.setOffHand(loadout.offHand);
        },
      );
    };
    applyFleetLoadoutRef.current = applyAvatarAndLoadout;
    applyAvatarAndLoadout();
    return gameSession.subscribe(applyAvatarAndLoadout);
  }, []);
  const [weaponId, setWeaponId] = useState<WeaponId>("sword");
  const [offHand, setOffHandState] = useState<WeaponId | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  // Hydrate from persisted controls so the saved controller/camera/mouse feel
  // is the source of truth on mount — Studio also loads these, and pushing this
  // matching state via setParams keeps both sides in sync instead of clobbering
  // the saved values back to DEFAULT_EDITOR.
  const [params, setParams] = useState<EditorParams>(() => loadControls());
  const [timeScale, setTimeScale] = useState(1);
  const [fireFx, setFireFx] = useState<FireFxParams>(() => loadFireFx());
  const { layout: dangerLayout, controls: dangerDock } = useDockLayout("animator.danger.dock.v1", DANGER_PANEL_METAS);
  const [clips, setClips] = useState<string[]>([]);
  const [slots, setSlots] = useState<SlotBinding[]>([]);
  const [webglError, setWebglError] = useState(false);
  /** helpers.glb intro orbit while Danger Room / arena boots. */
  const [helpersLoad, setHelpersLoad] = useState<{
    visible: boolean;
    label: string;
    progress?: number;
  }>({ visible: false, label: "LOADING" });
  const [dockOpen, setDockOpen] = useState(false);
  const [sound, setSound] = useState<SoundSettings>(() => loadSound());
  /** CPT RAC + radio — boots on mount; first gesture unlocks (controll parity). */
  const { panelProps: djPanelProps } = useAppMusic(sound);
  const [roomPreset, setRoomPreset] = useState<RoomPresetId>(() => loadRoomPreset());
  const [testWorldId, setTestWorldId] = useState<TestWorldId>(() => loadTestWorldId());
  const [hudEditing, setHudEditing] = useState(false);
  const hudEditor = useHudEditor();
  // The api passed to the HUD: applies persisted layout always, drag/select only while editing.
  const hudEdit = hudEditor.api(hudEditing);
  const themeVars = resolveHudVars(hudEditor.config) as React.CSSProperties;
  // The full-screen "doors / Dressing Room / Lobby" screens return before the
  // main `.studio` wrapper, so they normally get neither the theme tokens nor
  // the `hud-themed` gating class. When a non-default theme is active, wrap them
  // in a matching `.studio.hud-themed` host (carrying `themeVars`) so the bold
  // theme reaches them too. When no theme is active we render them bare, so the
  // stock look stays byte-identical.
  const themeActive = hudEditor.config.theme !== "default";
  const withScreenTheme = (node: React.ReactNode) =>
    themeActive ? (
      <div className="studio hud-themed" style={themeVars}>
        {node}
      </div>
    ) : (
      node
    );
  // Drive on-screen touch controls off real input capability (so iPads get them
  // and a small mouse-driven window does not), not just viewport width.
  const { touchUI: isMobile } = useDevice();

  // Voxel editor state.
  const voxelRef = useRef<VoxelEditor | null>(null);
  const [brush, setBrush] = useState<BrushState>({ ...DEFAULT_BRUSH });
  const [veStats, setVeStats] = useState<EditorStats | null>(null);
  const [veTree, setVeTree] = useState<DeployableNode[]>([]);
  const [veSel, setVeSel] = useState<string | null>(null);
  const [veGizmo, setVeGizmo] = useState<GizmoMode>("translate");
  const [veSnap, setVeSnap] = useState(true);
  const [dungeon, setDungeon] = useState(false);
  /** The map handed to the play session, restored into the editor on exit. */
  const playMapRef = useRef<VoxelMap | null>(null);
  // A gallery map queued to load when the voxel editor next mounts.
  const pendingMapRef = useRef<VoxelMap | null>(null);
  // A gallery scene queued to load when the Scene Editor next mounts.
  const pendingSceneRef = useRef<SceneDescriptor | null>(null);
  /** Set when returning to the editor from a play session (re-loads the map). */
  const cameFromPlayRef = useRef(false);

  // Multi-map persistence state.
  const [mapsOpen, setMapsOpen] = useState(false);
  // Starting-map template picker (shown on a fresh editor entry + via "New").
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [maps, setMaps] = useState<StoredMapMeta[]>([]);
  const [mapName, setMapName] = useState("");
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);

  const hudRef = useRef<(h: HudSnapshot) => void>(() => {});
  hudRef.current = setHud;

  // Multiplayer relay: a single client lives in the Lobby and is handed to the
  // Studio so the session survives the lobby → Danger Room transition.
  const netRef = useRef<DangerClient | null>(null);
  const getNet = useCallback(() => {
    if (!netRef.current) netRef.current = new DangerClient();
    return netRef.current;
  }, []);
  /** True while the active Danger Room session is a networked multiplayer room. */
  const inRoomRef = useRef(false);
  /** The resolved room content map (null = built-in arena), set on room entry. */
  const roomMapRef = useRef<VoxelMap | null>(null);
  /**
   * The networked room's chosen environment preset, set on room entry. Overrides
   * the joiner's own local default so everyone in the room sees the same arena.
   * Null when the room carried no (or an unknown) preset.
   */
  const roomPresetRef = useRef<RoomPresetId | null>(null);

  const refreshAnim = useCallback(() => {
    const s = studioRef.current;
    if (!s) return;
    setClips(s.clipNames());
    setSlots(s.getSlotBindings());
  }, []);

  // Show/hide a Danger Room dock panel, mirroring the old hotkey side effects
  // (release pointer-lock when surfacing a panel; refresh clips for the anim panel).
  const toggleDangerPanel = useCallback(
    (id: DangerPanelId) => {
      if (!dangerDock.isVisible(id)) {
        document.exitPointerLock?.();
        studioRef.current?.setFreeMouseMode(true);
        if (id === "anim") refreshAnim();
      }
      dangerDock.togglePanel(id);
    },
    [dangerDock, refreshAnim],
  );

  /** Enter free-mouse (UI / inspect) or re-lock aim for combat. */
  const applyFreeMouse = useCallback((on: boolean) => {
    setFreeMouse(on);
    freeMouseRef.current = on;
    setFreeMouseSticky(on);
    studioRef.current?.setFreeMouseMode(on);
    if (on) {
      document.exitPointerLock?.();
      setPointerLayer("play-free");
    } else {
      setPointerLayer("play-locked");
      const canvas = mountRef.current?.querySelector("canvas");
      canvas?.requestPointerLock?.();
    }
  }, []);

  // Helpers.glb cinematic load screen when entering Danger Room or Worldbuilder Play.
  useEffect(() => {
    if (mode !== "danger" && mode !== "play") {
      setHelpersLoad((s) => ({ ...s, visible: false }));
      return;
    }
    const enterLabel = mode === "play" ? "ENTERING MAP PLAY" : "ENTERING DANGER ROOM";
    setHelpersLoad({ visible: true, label: enterLabel, progress: 0.12 });
    const t1 = window.setTimeout(
      () => setHelpersLoad({ visible: true, label: "LOADING FORGE", progress: 0.55 }),
      700,
    );
    const t2 = window.setTimeout(
      () => setHelpersLoad({ visible: true, label: "READY", progress: 0.92 }),
      1600,
    );
    const t3 = window.setTimeout(
      () => setHelpersLoad({ visible: false, label: "LOADING", progress: 1 }),
      2400,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [mode]);

  // Mount the Danger Room engine while in combat mode.
  useEffect(() => {
    if (mode !== "danger" || !mountRef.current) return;
    // Fresh gate every danger entry (pointer lock only after ENTER)
    setDangerStartOpen(true);
    dangerStartOpenRef.current = true;
    const roomMap = inRoomRef.current ? roomMapRef.current : null;
    let studio: Studio | null = null;
    try {
      studio = new Studio(mountRef.current, characterId, (h) => hudRef.current(h));
      studio.onCharacterLoaded = () => {
        refreshAnim();
        // A networked room with a chosen map loads it once the rig is ready.
        if (roomMap) void studioRef.current?.enterArena(roomMap);
        setHelpersLoad((s) =>
          s.visible ? { ...s, progress: Math.max(s.progress ?? 0, 0.85), label: "CHARACTER READY" } : s,
        );
      };
      studio.setFireParams(loadFireFx());
      // Re-read persisted controls at every mount so engine-only mutations
      // (e.g. wheel-zoom cameraDistance, saved on the previous teardown) win on
      // re-entry, and sync them back into React state so the settings sliders
      // and the engine never diverge. Stale React state must not clobber them.
      const persistedControls = loadControls();
      setParams(persistedControls);
      studio.setParams(persistedControls);
      studio.setTimeScale(timeScale);
      // A networked room dictates its environment preset; apply it over the
      // engine's local default so every joiner sees the same arena. This adopts
      // the room's current preset, so don't re-broadcast it back to the relay.
      if (inRoomRef.current && roomPresetRef.current) {
        studio.setRoomPreset(roomPresetRef.current, { propagate: false });
      }
      // The host may swap the arena mid-session; mirror that into our React state
      // so the menubar selection tracks the arena every joiner is now in.
      studio.onRoomPresetChanged = (id) => {
        roomPresetRef.current = id;
        setRoomPreset(id);
      };
      studioRef.current = studio;
      studio.setTouchMode(isMobile);
      // Death: empty 3×3 carry; keep 2×2 loadout (main/side/mount/boat).
      studio.onPlayerDefeat = () => {
        const charId =
          gameSession.snapshot.selectedCharacterId || characterId || "local";
        const res = applyDeathBagDrop(charId);
        studio?.flashMessage?.(res.message, 2.2);
        refreshBagMeta();
      };
      // Hand the live relay client to the engine for multiplayer rooms.
      if (inRoomRef.current && netRef.current) studio.attachNet(netRef.current);
      // Annihilate-demo (?hero=) wins over fleet loadout so async equip cannot
      // overwrite grudge:race:preset + mesh_ids after boot.
      void import("./lib/annihilateHero").then(({ heroFromLocation, applyAnnihilateHeroToStudio }) => {
        const s = studioRef.current;
        if (!s) return;
        const spec = heroFromLocation();
        if (spec) {
          setCharacterId(spec.studioAvatarId);
          applyAnnihilateHeroToStudio(s, spec);
          if (spec.weaponId && spec.weaponId !== "none") {
            setWeaponId(spec.weaponId as WeaponId);
          }
          const prev = s.onCharacterLoaded;
          s.onCharacterLoaded = (id) => {
            prev?.(id);
            try {
              const report = s.reportHandSockets();
              if (report) console.info("[annihilate-demo] sockets", report);
            } catch {
              /* ignore */
            }
          };
        } else {
          // Normal Danger entry: fleet mesh_ids / weapon after Studio exists.
          applyFleetLoadoutRef.current();
        }
        refreshAnim();
      });
      refreshAnim();
    } catch (err) {
      console.error("[Animator] failed to start renderer", err);
      setWebglError(true);
    }
    return () => {
      studio?.dispose();
      studioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Worldbuilder Play: same Studio as Danger Room (camera/loco/weapons/skills/FX/anims).
  // No admin/editor docks — pure player combat UX on the authored map.
  useEffect(() => {
    if (mode !== "play" || !mountRef.current) return;
    const map = playMapRef.current;
    if (!map) {
      setMode("voxel");
      return;
    }
    // Same ENTER gate + pointer-lock flow as Danger Room.
    // Force-close any leftover Danger admin/editor/anim docks — Play is player-only.
    dangerDock.hidePanel("admin");
    dangerDock.hidePanel("editor");
    dangerDock.hidePanel("anim");
    setDangerStartOpen(true);
    dangerStartOpenRef.current = true;
    let studio: Studio | null = null;
    try {
      studio = new Studio(mountRef.current, characterId, (h) => hudRef.current(h));
      studio.onCharacterLoaded = () => {
        refreshAnim();
        void studioRef.current?.enterArena(map);
        setHelpersLoad((s) =>
          s.visible ? { ...s, progress: Math.max(s.progress ?? 0, 0.85), label: "CHARACTER READY" } : s,
        );
      };
      studio.setFireParams(loadFireFx());
      // Re-read persisted controls at every mount so engine-only mutations
      // (e.g. wheel-zoom cameraDistance, saved on the previous teardown) win on
      // re-entry, and sync them back into React state so the settings sliders
      // and the engine never diverge. Stale React state must not clobber them.
      const persistedControls = loadControls();
      setParams(persistedControls);
      studio.setParams(persistedControls);
      studio.setTimeScale(timeScale);
      studioRef.current = studio;
      studio.setTouchMode(isMobile);
      studio.onPlayerDefeat = () => {
        const charId =
          gameSession.snapshot.selectedCharacterId || characterId || "local";
        const res = applyDeathBagDrop(charId);
        studio?.flashMessage?.(res.message, 2.2);
        refreshBagMeta();
      };
      applyFleetLoadoutRef.current();
      refreshAnim();
    } catch (err) {
      console.error("[Animator] failed to start play session", err);
      setWebglError(true);
    }
    return () => {
      studio?.dispose();
      studioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Mount the Voxel Editor engine while in editor mode.
  useEffect(() => {
    if (mode !== "voxel" || !mountRef.current) return;
    let editor: VoxelEditor | null = null;
    try {
      editor = new VoxelEditor(mountRef.current);
      editor.onStats = (s) => setVeStats(s);
      editor.onTree = (t) => setVeTree(t);
      editor.onSelect = (id) => setVeSel(id);
      editor.onGizmoMode = (m) => setVeGizmo(m);
      editor.setBrush(DEFAULT_BRUSH);
      editor.setSnap(veSnap);
      voxelRef.current = editor;
      setBrush({ ...DEFAULT_BRUSH });
      setVeSel(null);
      setVeTree([]);
      setMaps(listMaps());
      // A gallery map was queued for loading from the Lobby.
      if (pendingMapRef.current) {
        editor.load(pendingMapRef.current);
        setDungeon(!!pendingMapRef.current.dungeon);
        setCurrentMapId(null);
        setMapName("");
        pendingMapRef.current = null;
        setTemplatesOpen(false);
      } else if (cameFromPlayRef.current && playMapRef.current) {
        // Returning from a play session: restore the map that was being tested.
        editor.load(playMapRef.current);
        setDungeon(playMapRef.current.dungeon);
        setTemplatesOpen(false);
      } else {
        // Fresh entry on an empty pad — offer the starting-map templates.
        setDungeon(false);
        setCurrentMapId(null);
        setMapName("");
        setTemplatesOpen(true);
      }
      cameFromPlayRef.current = false;
    } catch (err) {
      console.error("[Animator] failed to start voxel editor", err);
      setWebglError(true);
    }
    return () => {
      editor?.dispose();
      voxelRef.current = null;
      setVeStats(null);
      setVeTree([]);
      setVeSel(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Engine-side keyboard shortcuts (jump / skills) + panel toggles. Danger only.
  useEffect(() => {
    if (mode !== "danger") return;
    const onKey = (e: KeyboardEvent) => {
      // Esc closes loadout / systems / claim / bag overlays even while inputs are focused.
      if (
        e.code === "Escape" &&
        (equipOpenRef.current ||
          systemsOpenRef.current ||
          claimFlagOpenRef.current ||
          bagOpenRef.current ||
          harvestUiOpenRef.current)
      ) {
        setEquipOpen(false);
        setSystemsOpen(false);
        setClaimFlagOpen(false);
        setBagOpen(false);
        setHarvestUiOpen(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      if (e.code === "KeyI") {
        e.preventDefault();
        // Harvest/build: character bag · Combat: full equipment paperdoll
        const harvestMode =
          hud?.activityMode === "harvest" || hud?.activityMode === "build";
        if (harvestMode || bagOpenRef.current) {
          const next = !bagOpenRef.current;
          setBagOpen(next);
          if (next) {
            setEquipOpen(false);
            setSystemsOpen(false);
            setClaimFlagOpen(false);
            document.exitPointerLock?.();
            refreshDeposit();
            refreshBagMeta();
          }
        } else {
          const next = !equipOpenRef.current;
          setEquipOpen(next);
          if (next) {
            setSystemsOpen(false);
            setClaimFlagOpen(false);
            setBagOpen(false);
            document.exitPointerLock?.();
          }
        }
        return;
      }
      // K = grudge6 Creator systems / skillbook tabs
      if (e.code === "KeyK") {
        e.preventDefault();
        toggleSystems();
        return;
      }
      // B = camp claim flag hub (units / buildings / farm / tame / upgrades)
      // Alt+B = Fantasy VFX Sandbox Moon Beam preview (do not steal).
      if (e.code === "KeyB" && !e.altKey) {
        e.preventDefault();
        toggleClaimFlag();
        return;
      }
      // P = open full harvest production UI (craft / codex / maps / skill trees)
      if (e.code === "KeyP") {
        e.preventDefault();
        setHarvestUiOpen((v) => {
          const next = !v;
          if (next) {
            setClaimFlagOpen(false);
            document.exitPointerLock?.();
          }
          return next;
        });
        return;
      }
      if (e.code === "Tab") {
        // Shift+Tab = ally cycle. Tab hold = radial wheel; quick release = enemy cycle.
        e.preventDefault();
        if (e.shiftKey) {
          studioRef.current?.cycleAllyTarget();
          return;
        }
        // Fall through to studio.handleKey for hold-to-radial arming.
      }
      if (e.code === "Backquote") {
        // Admin panel hotkey (moved off Tab).
        e.preventDefault();
        toggleDangerPanel("admin");
        return;
      }
      // Free mouse vs locked aim (does not steal admin Backquote)
      if (e.code === "F8" || e.code === "Backslash") {
        e.preventDefault();
        applyFreeMouse(true);
        studioRef.current?.flashMessage?.("FREE MOUSE · F9 / ' re-lock aim", 1.4);
        return;
      }
      if (e.code === "F9" || e.code === "Quote") {
        e.preventDefault();
        const uiBlock =
          dangerDock.isVisible("admin") ||
          dangerDock.isVisible("editor") ||
          dangerDock.isVisible("anim") ||
          equipOpenRef.current ||
          systemsOpenRef.current ||
          bagOpenRef.current ||
          harvestUiOpenRef.current;
        if (uiBlock) {
          studioRef.current?.flashMessage?.("Close panels first (Esc)", 1.2);
          return;
        }
        applyFreeMouse(false);
        studioRef.current?.flashMessage?.("AIM LOCK · crosshair on", 1.2);
        return;
      }
      if (e.code === "KeyE") {
        // The door portal claims E first when standing at an interactable.
        if (studioRef.current?.tryEnterDoor()) {
          e.preventDefault();
          return;
        }
        // While the canvas has pointer-lock (in-game), E is the Block action.
        // Only toggle the editor panel when we're NOT in pointer-lock.
        if (!document.pointerLockElement) {
          toggleDangerPanel("editor");
          return;
        }
        // In pointer-lock: fall through so studio.handleKey("KeyE") fires below.
      }
      if (e.code === "KeyC") {
        // In-game: C = parry. Out of lock: open clips panel.
        if (!document.pointerLockElement) {
          toggleDangerPanel("anim");
          return;
        }
      }
      studioRef.current?.handleKey(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      // Tab radial release is handled here (Studio also listens for F hold-charge).
      if (e.code === "Tab") studioRef.current?.handleKeyUp(e.code);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    mode,
    refreshAnim,
    toggleDangerPanel,
    toggleSystems,
    toggleClaimFlag,
    hud?.activityMode,
    refreshDeposit,
    refreshBagMeta,
    applyFreeMouse,
    dangerDock,
  ]);

  // Play/test mode: combat keys + lock-on only (no editor/admin/clips panels).
  useEffect(() => {
    if (mode !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === "Escape" &&
        (equipOpenRef.current ||
          systemsOpenRef.current ||
          claimFlagOpenRef.current ||
          bagOpenRef.current ||
          harvestUiOpenRef.current)
      ) {
        setEquipOpen(false);
        setSystemsOpen(false);
        setClaimFlagOpen(false);
        setBagOpen(false);
        setHarvestUiOpen(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      if (e.code === "KeyI") {
        e.preventDefault();
        const harvestMode =
          hud?.activityMode === "harvest" || hud?.activityMode === "build";
        if (harvestMode || bagOpenRef.current) {
          const next = !bagOpenRef.current;
          setBagOpen(next);
          if (next) {
            setEquipOpen(false);
            setSystemsOpen(false);
            setClaimFlagOpen(false);
            document.exitPointerLock?.();
            refreshDeposit();
            refreshBagMeta();
          }
        } else {
          const next = !equipOpenRef.current;
          setEquipOpen(next);
          if (next) {
            setSystemsOpen(false);
            setClaimFlagOpen(false);
            setBagOpen(false);
            document.exitPointerLock?.();
          }
        }
        return;
      }
      if (e.code === "KeyK") {
        e.preventDefault();
        toggleSystems();
        return;
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        toggleClaimFlag();
        return;
      }
      if (e.code === "KeyP") {
        e.preventDefault();
        setHarvestUiOpen((v) => {
          const next = !v;
          if (next) {
            setClaimFlagOpen(false);
            document.exitPointerLock?.();
          }
          return next;
        });
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          studioRef.current?.cycleAllyTarget();
          return;
        }
        // Fall through → hold Tab radial / release cycle (studio).
      }
      if (e.code === "F8" || e.code === "Backslash") {
        e.preventDefault();
        applyFreeMouse(true);
        studioRef.current?.flashMessage?.("FREE MOUSE · F9 / ' re-lock aim", 1.4);
        return;
      }
      if (e.code === "F9" || e.code === "Quote") {
        e.preventDefault();
        if (
          equipOpenRef.current ||
          systemsOpenRef.current ||
          bagOpenRef.current ||
          harvestUiOpenRef.current
        ) {
          studioRef.current?.flashMessage?.("Close panels first (Esc)", 1.2);
          return;
        }
        applyFreeMouse(false);
        studioRef.current?.flashMessage?.("AIM LOCK · crosshair on", 1.2);
        return;
      }
      studioRef.current?.handleKey(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "Tab") studioRef.current?.handleKeyUp(e.code);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode, toggleSystems, toggleClaimFlag, applyFreeMouse]);

  // Touch devices: tell the engine to skip pointer-lock-on-tap so the on-screen
  // joystick/look-pad own input. Re-applies whenever the breakpoint flips.
  useEffect(() => {
    studioRef.current?.setTouchMode(isMobile);
  }, [isMobile]);

  // Avatar Edit "Save to Character" → live Explorer face refresh (Mine-Loader parity).
  useEffect(() => {
    const onSaved = () => {
      studioRef.current?.refreshExplorerHead();
    };
    window.addEventListener("avatarHead:saved", onSaved);
    return () => window.removeEventListener("avatarHead:saved", onSaved);
  }, []);

  const onCharacter = useCallback((id: string) => {
    setCharacterId(id);
    studioRef.current?.setCharacter(id);
  }, []);

  const onWeapon = useCallback((id: WeaponId) => {
    setWeaponId(id);
    studioRef.current?.setWeapon(id);
    // Persist equip to fleet character (logged-in only; debounced)
    const ch = gameSession.selectedCharacter();
    const charId = gameSession.snapshot.selectedCharacterId;
    if (ch && charId) {
      void import("./lib/characterLoadout").then(({ scheduleCharacterLoadoutSave }) => {
        scheduleCharacterLoadoutSave(charId, ch, { weaponId: id }, (saveData) => {
          gameSession.patchCharacter(charId, { saveData });
        });
      });
    }
  }, []);

  const onOffHand = useCallback((id: WeaponId | null) => {
    setOffHandState(id);
    studioRef.current?.setOffHand(id);
    const ch = gameSession.selectedCharacter();
    const charId = gameSession.snapshot.selectedCharacterId;
    if (ch && charId) {
      void import("./lib/characterLoadout").then(({ scheduleCharacterLoadoutSave }) => {
        scheduleCharacterLoadoutSave(charId, ch, { offHand: id }, (saveData) => {
          gameSession.patchCharacter(charId, { saveData });
        });
      });
    }
  }, []);

  // Open the in-play loadout overlay (release pointer-lock so the cursor is free).
  const openEquip = useCallback(() => {
    setEquipOpen(true);
    setSystemsOpen(false);
    setClaimFlagOpen(false);
    document.exitPointerLock?.();
  }, []);

  const onDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d);
    studioRef.current?.setDifficulty(d);
  }, []);

  const onSpawn = useCallback((id: WeaponId, faction: Faction) => {
    studioRef.current?.spawnNpc(id, faction);
  }, []);

  const onSpawnBoss = useCallback((id: WeaponId) => {
    studioRef.current?.spawnBoss(id);
  }, []);

  const onClearNpcs = useCallback(() => {
    studioRef.current?.clearNpcs();
  }, []);

  const onStartDuel = useCallback((teamSize: number) => {
    studioRef.current?.startDuel(teamSize);
  }, []);

  const onStopDuel = useCallback(() => {
    studioRef.current?.stopDuel();
  }, []);

  const onStartArenaMatch = useCallback((arenaMode: "1v1" | "2v2" | "ffa4" = "1v1") => {
    setHelpersLoad({
      visible: true,
      label:
        arenaMode === "1v1"
          ? "ARENA 1v1"
          : arenaMode === "2v2"
            ? "ARENA 2v2"
            : "ASSASSINATION FFA",
      progress: 0.2,
    });
    const ok = studioRef.current?.startArenaMatch(arenaMode);
    window.setTimeout(
      () =>
        setHelpersLoad({
          visible: true,
          label: "FORGE FLOOR",
          progress: 0.75,
        }),
      500,
    );
    window.setTimeout(
      () => setHelpersLoad({ visible: false, label: "LOADING", progress: 1 }),
      ok === false ? 400 : 1800,
    );
  }, []);

  const onArenaRetry = useCallback(() => {
    studioRef.current?.arenaRetry();
  }, []);

  const onArenaReturn = useCallback(() => {
    studioRef.current?.arenaReturn();
  }, []);

  const onDuelCamera = useCallback((mode: AleCameraMode) => {
    studioRef.current?.setDuelCamera(mode);
  }, []);

  const onToggleDiagnostics = useCallback(() => {
    studioRef.current?.toggleDuelDiagnostics();
  }, []);

  const onStartReplay = useCallback(() => {
    studioRef.current?.startReplay();
  }, []);

  const onReplayPause = useCallback((paused: boolean) => {
    studioRef.current?.setReplayPaused(paused);
  }, []);

  const onReplaySpeed = useCallback((speed: number) => {
    studioRef.current?.setReplaySpeed(speed);
  }, []);

  const onReplaySeek = useCallback((progress: number) => {
    studioRef.current?.seekReplay(progress);
  }, []);

  const onReplayCamera = useCallback((mode: AleCameraMode) => {
    studioRef.current?.setReplayCamera(mode);
  }, []);

  const onStopReplay = useCallback(() => {
    studioRef.current?.stopReplay();
  }, []);

  const onSetReplayFrequency = useCallback((freq: ReplayFrequency) => {
    studioRef.current?.setReplayFrequency(freq);
  }, []);

  const getMapPayload = useCallback(
    (): CreatePostPayload | null =>
      (voxelRef.current?.serialize() ?? null) as CreatePostPayload | null,
    [],
  );

  const onParam = useCallback((patch: Partial<EditorParams>) => {
    setParams((p) => {
      const next = { ...p, ...patch };
      studioRef.current?.setParams(patch);
      return next;
    });
  }, []);

  const onTimeScale = useCallback((scale: number) => {
    setTimeScale(scale);
    studioRef.current?.setTimeScale(scale);
  }, []);

  // Whitelisted AI tool surface for the Danger Room — combat + anim + movement.
  const dangerAiTools = useMemo(
    () =>
      buildDangerTools({
        onCharacter,
        onWeapon,
        onDifficulty,
        onSpawn,
        onSpawnBoss,
        onClearNpcs,
        onParam,
        onHitstop: (s) => studioRef.current?.triggerHitstop(s ?? 0.08, 0.12),
        onDash: (x, z, d) => studioRef.current?.requestDash(x, z, d) ?? false,
        onAnimPreview: (clip, fx) => studioRef.current?.requestAnimPreview(clip, fx) ?? false,
        onListClips: () => studioRef.current?.listAnimClips() ?? [],
        onTimeScale,
        getWeaponId: () => weaponId,
      }),
    [onCharacter, onWeapon, onDifficulty, onSpawn, onSpawnBoss, onClearNpcs, onParam, onTimeScale, weaponId],
  );

  const onTestWorld = useCallback((id: TestWorldId) => {
    setTestWorldId(id);
    void studioRef.current?.setTestWorld(id);
  }, []);

  const onRoomPreset = useCallback((id: RoomPresetId) => {
    setRoomPreset(id);
    saveRoomPreset(id);
    studioRef.current?.setRoomPreset(id);
  }, []);

  const onToggleMute = useCallback(() => {
    setSound((s) => {
      const next = !s.muted;
      studioRef.current?.setMuted(next);
      return { ...s, muted: next };
    });
  }, []);

  const onSoundLevel = useCallback((channel: SoundChannel, value: number) => {
    studioRef.current?.setSoundLevel(channel, value);
    setSound((s) => ({ ...s, [channel]: value }));
  }, []);

  const onFireFx = useCallback((patch: Partial<FireFxParams>) => {
    setFireFx((p) => {
      const next = { ...p, ...patch };
      studioRef.current?.setFireParams(next);
      saveFireFx(next);
      return next;
    });
  }, []);

  const onImpactTest = useCallback(() => {
    studioRef.current?.testImpactExplode();
  }, []);

  const onPreview = useCallback((clip: string) => {
    studioRef.current?.previewClip(clip);
  }, []);

  const onAssign = useCallback((slot: ActionSlot, clip: string | null) => {
    studioRef.current?.setSlotAssignment(slot, clip);
    setSlots(studioRef.current?.getSlotBindings() ?? []);
  }, []);

  // ── Voxel editor handlers ──────────────────────────────────────────────────
  const onBrush = useCallback((patch: Partial<BrushState>) => {
    setBrush((b) => {
      const next = { ...b, ...patch };
      // Keep solid color in sync when picking a canonical block type.
      if (patch.blockType && patch.color === undefined) {
        next.color = colorForBlockType(patch.blockType);
      }
      voxelRef.current?.setBrush(next);
      return next;
    });
  }, []);

  const onDungeon = useCallback((on: boolean) => {
    setDungeon(on);
    voxelRef.current?.setDungeon(on);
  }, []);

  // ── Select tool / hierarchy handlers ───────────────────────────────────────
  const onVeSelect = useCallback((id: string | null) => {
    voxelRef.current?.select(id);
  }, []);

  const onVeGizmoMode = useCallback((m: GizmoMode) => {
    voxelRef.current?.setGizmoMode(m);
  }, []);

  const onVeSnap = useCallback((on: boolean) => {
    setVeSnap(on);
    voxelRef.current?.setSnap(on);
  }, []);

  const onVeDeleteSelected = useCallback(() => {
    voxelRef.current?.deleteSelected();
  }, []);

  const onVeDuplicateSelected = useCallback(() => {
    voxelRef.current?.duplicateSelected();
  }, []);

  const onVeFocusSelected = useCallback(() => {
    voxelRef.current?.focusSelected();
  }, []);

  const onClearMap = useCallback(() => {
    voxelRef.current?.clearAll();
  }, []);

  // Load a starting-map template into the editor (from the template picker).
  const onPickTemplate = useCallback((template: MapTemplate) => {
    const ed = voxelRef.current;
    if (!ed) return;
    const map = template.build();
    ed.load(map);
    setDungeon(!!map.dungeon);
    setCurrentMapId(null);
    setMapName(template.label);
    setTemplatesOpen(false);
  }, []);

  // ── Multi-map persistence handlers ─────────────────────────────────────────
  const onSaveMap = useCallback(() => {
    const ed = voxelRef.current;
    if (!ed) return;
    const meta = saveMap(mapName, ed.serialize(), currentMapId ?? undefined);
    if (!meta) return;
    setCurrentMapId(meta.id);
    setMapName(meta.name);
    setMaps(listMaps());
  }, [mapName, currentMapId]);

  const onLoadMap = useCallback((id: string) => {
    const ed = voxelRef.current;
    if (!ed) return;
    const map = loadMap(id);
    if (!map) return;
    ed.load(map);
    setDungeon(!!map.dungeon);
    setCurrentMapId(id);
    setMapName(maps.find((m) => m.id === id)?.name ?? "");
  }, [maps]);

  const onDeleteMap = useCallback((id: string) => {
    deleteMap(id);
    setMaps(listMaps());
    setCurrentMapId((cur) => (cur === id ? null : cur));
  }, []);

  const onExportMap = useCallback(() => {
    const ed = voxelRef.current;
    return ed ? exportMap(ed.serialize()) : "";
  }, []);

  const onImportMap = useCallback((json: string) => {
    const ed = voxelRef.current;
    if (!ed) return false;
    const map = importMap(json);
    if (!map) return false;
    ed.load(map);
    setDungeon(!!map.dungeon);
    setCurrentMapId(null);
    return true;
  }, []);

  // Serialize the current map and launch a play session.
  const onTestMap = useCallback(() => {
    const ed = voxelRef.current;
    if (!ed) return;
    const map = ed.serialize();
    if (!map.deployables.some((d) => d.kind === "start")) return;
    playMapRef.current = map;
    setMode("play");
  }, []);

  // Leave the play session and return to the editor with the map intact.
  const onExitPlay = useCallback(() => {
    cameFromPlayRef.current = true;
    setMode("voxel");
  }, []);

  // Load a map chosen in the Lobby into the Voxel Editor.
  const onLoadPost = useCallback((map: VoxelMap) => {
    pendingMapRef.current = map;
    setMode("voxel");
  }, []);

  // Launch a map chosen in the Lobby straight into a play session.
  const onPlayPost = useCallback((map: VoxelMap) => {
    playMapRef.current = map;
    setMode("play");
  }, []);

  // Reopen a scene chosen in the Lobby in the Scene Editor.
  const onLoadScenePost = useCallback((scene: SceneDescriptor) => {
    pendingSceneRef.current = scene;
    setMode("editor");
  }, []);

  // A multiplayer room was joined/created in the Lobby: keep the relay client
  // live, stash the resolved content map, and switch into the Danger Room.
  const onEnterRoom = useCallback((map: VoxelMap | null, preset?: string) => {
    inRoomRef.current = true;
    roomMapRef.current = map;
    // The room dictates the environment for every joiner; fall back to the
    // player's own default when the room carried no (or an unknown) preset.
    const p = asRoomPresetId(preset);
    roomPresetRef.current = p;
    if (p) setRoomPreset(p);
    setMode("danger");
  }, []);

  // Leave the Danger Room; if it was a multiplayer room, leave the relay too.
  const onLeaveDanger = useCallback(() => {
    if (inRoomRef.current) {
      netRef.current?.leave();
      inRoomRef.current = false;
      roomMapRef.current = null;
      roomPresetRef.current = null;
    }
    setMode("doors");
  }, []);

  // Unified system switch for the persistent shell launcher. Leaving a
  // multiplayer Danger Room drops the relay so we don't linger in the room.
  // URL path is synced by the mode effect (openRoutes.syncUrlToMode).
  const openInApp = useCallback((session: InAppEmbedSession) => {
    setInAppEmbed({
      ...session,
      returnMode: session.returnMode ?? mode,
    });
  }, [mode]);

  const closeInApp = useCallback(() => {
    setInAppEmbed((prev) => {
      const ret = prev?.returnMode;
      if (ret) setMode(ret);
      return null;
    });
  }, []);

  const navigate = useCallback((next: Mode) => {
    setInAppEmbed(null);
    setMode((prev) => {
      if (next === prev) return prev;
      if (prev === "danger" && inRoomRef.current && next !== "danger") {
        netRef.current?.leave();
        inRoomRef.current = false;
        roomMapRef.current = null;
        roomPresetRef.current = null;
      }
      return next;
    });
    // Library recents (Steam-style) — any real surface, not hub.
    if (next !== "doors" && next !== "play") {
      void import("./lib/recentLibrary").then(({ recordRecentPlay }) => recordRecentPlay(next));
    }
    // Remember last mode on the fleet character (logged-in saves).
    if (next !== "doors") {
      const ch = gameSession.selectedCharacter();
      const charId = gameSession.snapshot.selectedCharacterId;
      if (ch && charId) {
        void import("./lib/characterLoadout").then(({ scheduleCharacterLoadoutSave }) => {
          scheduleCharacterLoadoutSave(charId, ch, { lastMode: next }, (saveData) => {
            gameSession.patchCharacter(charId, { saveData });
          });
        });
      }
    }
  }, []);

  // Worldbuilder Forge AI — tools bound to live VoxelEditor + brush state.
  const voxelAiTools = useMemo(
    () =>
      buildVoxelAiTools({
        getEditor: () => voxelRef.current,
        getBrush: () => brush,
        setBrush: onBrush,
        getSelectedId: () => veSel,
        getTree: () => veTree,
        getStats: () => veStats,
        select: onVeSelect,
        clearMap: onClearMap,
        playMap: onTestMap,
        focusSelected: onVeFocusSelected,
        deleteSelected: onVeDeleteSelected,
      }),
    // brush / tree / stats re-bind tools each change so the model sees fresh state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brush, veSel, veTree, veStats],
  );

  /** Toolbox grid launcher — same actions as controll lab (mode / dock / HUD / equip). */
  const onToolLaunch = useCallback(
    (tool: ToolDef) => {
      const { action } = tool;
      switch (action.kind) {
        case "mode": {
          const m = action.mode;
          if (m === "avatar") {
            navigate("avatar" as Mode);
          } else {
            navigate(m as Mode);
          }
          break;
        }
        case "danger-panel":
          navigate("danger");
          // Open after mode mounts (dock layout is danger-local).
          queueMicrotask(() => {
            const id = action.id === "animdbg" ? "anim" : action.id;
            dangerDock.showPanel(id);
          });
          break;
        case "danger-equip":
          navigate("danger");
          void Promise.resolve().then(() => setEquipOpen(true));
          break;
        case "hud-edit":
          navigate("danger");
          void Promise.resolve().then(() => setHudEditing(true));
          break;
        case "dressing-panel":
          navigate("editor");
          requestDressingPanel(action.id);
          break;
        default:
          break;
      }
    },
    [navigate, dangerDock],
  );

  const toolboxMusic = useMemo(
    () => (
      <>
        <div className="toolbox-music-title">CPT RAC Station</div>
        <DjStationBody {...djPanelProps} />
        <div className="toolbox-music-title">Volume mixer</div>
        <div className="toolbox-music-mixer">
          {(["master", "music", "combat", "ambient", "klaxon"] as SoundChannel[]).map((id) => {
            const labels: Record<SoundChannel, string> = {
              master: "Master volume",
              music: "Music",
              combat: "Combat hits",
              ambient: "Ambient bed",
              klaxon: "Warning klaxon",
            };
            const pct = Math.round(sound[id] * 100);
            return (
              <label className="slider sound-slider" key={id}>
                <span className="slider-label">
                  {labels[id]}
                  <em>{sound.muted ? "muted" : `${pct}%`}</em>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pct}
                  disabled={sound.muted}
                  onChange={(e) => onSoundLevel(id, Number(e.target.value) / 100)}
                />
              </label>
            );
          })}
        </div>
      </>
    ),
    [djPanelProps, sound, onSoundLevel],
  );

  // Per-surface config for the ONE global AI dock the shell hosts. Danger/play
  // get the Danger Room master (live tools); Worldbuilder gets Forge AI tools;
  // calm "guide" covers doors/lobby; Dressing Room registers via context.
  const shellAssistant: AssistantConfig | null = useMemo(() => {
    if (mode === "danger" || mode === "play") {
      return {
        surface: "danger",
        title: "Danger Room Master",
        tools: dangerAiTools,
        getSystemPrompt: () => dangerSystemPrompt({ characterId, weaponId, difficulty, params }),
        placeholder: "Fix combat feel, preview anim, dash forward, audit icons…",
      };
    }
    if (mode === "voxel") {
      return {
        surface: "worldbuilder",
        title: "Worldbuilder Forge",
        tools: voxelAiTools,
        getSystemPrompt: () =>
          voxelWorldbuilderSystemPrompt({
            brush,
            stats: veStats,
            selectedId: veSel,
          }),
        placeholder: "Set stone walls, assign NPC patrol AI, list props…",
      };
    }
    if (
      mode === "doors" ||
      mode === "lobby" ||
      mode === "zones" ||
      mode === "genesis" ||
      mode === "voxgrudge-native" ||
      mode === "account" ||
      mode === "brawl" ||
      mode === "survival" ||
      mode === "vox-battle"
    ) {
      return {
        surface: "guide",
        title: "Companion",
        tools: [],
        getSystemPrompt: appGuideSystemPrompt,
        placeholder: "Ask how to use any system…",
      };
    }
    return null;
  }, [
    mode,
    dangerAiTools,
    voxelAiTools,
    characterId,
    weaponId,
    difficulty,
    params,
    brush,
    veStats,
    veSel,
  ]);

  // Wrap any mode's content in the persistent shell (launcher + toolbox + AI).
  const shell = (content: React.ReactNode) => (
    <AppShell
      mode={mode}
      onNavigate={navigate}
      assistant={shellAssistant}
      hideAssistant={mode === "ledmask"}
      onToolLaunch={onToolLaunch}
      music={toolboxMusic}
    >
      {/* Library hub owns its own Steam chrome + account strip */}
      {mode !== "doors" && <FleetBar />}
      {content}
    </AppShell>
  );

  const panelsOpen =
    dangerDock.isVisible("admin") || dangerDock.isVisible("editor") || dangerDock.isVisible("anim");

  const uiOverlayOpen =
    panelsOpen ||
    equipOpen ||
    systemsOpen ||
    bagOpen ||
    harvestUiOpen ||
    claimFlagOpen ||
    dangerStartOpen;

  // Pointer presence: UI panels vs play locked vs free-mouse sticky
  useEffect(() => {
    if (mode !== "danger" && mode !== "play") {
      setPointerLayer("shell");
      setPlayPointerCtx("default");
      return;
    }
    if (uiOverlayOpen) {
      setPointerLayer("ui");
      document.exitPointerLock?.();
      studioRef.current?.setFreeMouseMode(true);
    } else if (freeMouse) {
      setPointerLayer("play-free");
      studioRef.current?.setFreeMouseMode(true);
    } else {
      setPointerLayer("play-locked");
      studioRef.current?.setFreeMouseMode(false);
      // After closing panels, restore aim lock if user wasn't free-mouse sticky
      if (
        !dangerStartOpen &&
        (mode === "danger" || mode === "play") &&
        !document.pointerLockElement
      ) {
        const canvas = mountRef.current?.querySelector("canvas");
        // Defer one frame so overlay unmount doesn't steal the gesture
        requestAnimationFrame(() => canvas?.requestPointerLock?.());
      }
    }
    // Play context from HUD (activity + loco + soft/hard focus)
    if (hud?.locoCam === "swim") setPlayPointerCtx("swim");
    else if (hud?.locoCam === "climb") setPlayPointerCtx("climb");
    else if (hud?.activityMode === "harvest") setPlayPointerCtx("harvest");
    else if (hud?.activityMode === "build") setPlayPointerCtx("build");
    else if (hud?.focusLocked) setPlayPointerCtx("combat-hard");
    else setPlayPointerCtx("combat-soft");
  }, [
    mode,
    uiOverlayOpen,
    freeMouse,
    hud?.activityMode,
    hud?.focusLocked,
    hud?.locoCam,
  ]);

  const crosshairVariant = ((): "combat" | "harvest" | "build" | "swim" | "climb" | "free" => {
    if (freeMouse) return "free";
    if (hud?.locoCam === "swim") return "swim";
    if (hud?.locoCam === "climb") return "climb";
    if (hud?.activityMode === "harvest") return "harvest";
    if (hud?.activityMode === "build") return "build";
    return "combat";
  })();

  // Stable touch API bridging the on-screen controls to the live engine
  // (mobile dual-stick + harvest/combat pad on open.grudge-studio.com).
  const touchApi = useRef({
    touchMoveInput: (x: number, y: number) => studioRef.current?.touchMoveInput(x, y),
    touchLook: (dx: number, dy: number) => studioRef.current?.touchLook(dx, dy),
    touchLookEnd: () => studioRef.current?.touchLookEnd(),
    setTouchSprint: (on: boolean) => studioRef.current?.setTouchSprint(on),
    touchJump: () => studioRef.current?.touchJump(),
    touchAttack: () => studioRef.current?.touchAttack(),
    touchSkill: (i?: number) => studioRef.current?.touchSkill(i),
    touchSkyfall: () => studioRef.current?.touchSkyfall(),
    touchGuard: (on: boolean) => studioRef.current?.touchGuard(on),
    touchParry: () => studioRef.current?.touchParry(),
    touchFocus: () => studioRef.current?.touchFocus(),
    setTouchCrouch: (on: boolean) => studioRef.current?.setTouchCrouch(on),
    touchSetActivityMode: (m: "combat" | "harvest" | "build") =>
      studioRef.current?.touchSetActivityMode(m),
    touchCycleActivityMode: () => studioRef.current?.touchCycleActivityMode(),
    touchActivityTool: (id: string) => studioRef.current?.touchActivityTool(id),
    touchDodge: () => studioRef.current?.touchDodge(),
    getActivityMode: () => studioRef.current?.getActivityMode?.() ?? "combat",
  }).current;

  const onApplyStatus = useCallback((id: StatusId, aoe?: boolean) => {
    studioRef.current?.applyStatus(id, aoe);
  }, []);

  // Fleet game canvas — stays inside Open (no new browser page).
  if (inAppEmbed) {
    return shell(
      <InAppGameCanvas
        {...inAppEmbed}
        onClose={closeInApp}
        onPopOut={(url) => window.open(url, "_blank", "noopener,noreferrer")}
      />,
    );
  }

  if (mode === "landing") {
    // Front door: Grudge ID (no shell chrome).
    // Enter → production cinema handoff → character select (campfire create/select).
    return (
      <LandingPage
        onEnter={() => {
          try {
            sessionStorage.setItem("grudge.cinema.play", "intro_to_characters");
          } catch {
            /* ignore */
          }
          navigate("characters");
        }}
      />
    );
  }

  if (mode === "account") {
    return shell(
      withScreenTheme(
        <AccountPanel
          onPlayRace={(id) => {
            setCharacterId(id);
            studioRef.current?.setCharacter(id);
            navigate("danger");
          }}
          onEnterGame={(m) => navigate(m)}
          onOpenInApp={openInApp}
        />,
      ),
    );
  }

  if (mode === "doors") {
    return shell(
      withScreenTheme(
        <div className="doors-cinematic">
          <IntroCinematic />
          <DoorSelect onEnter={navigate} />
        </div>,
      ),
    );
  }

  if (mode === "editor") {
    const initialScene = pendingSceneRef.current;
    pendingSceneRef.current = null;
    return shell(
      withScreenTheme(
        <EditorMode initialScene={initialScene} onExit={() => setMode("doors")} />,
      ),
    );
  }

  if (mode === "ledmask") {
    return shell(<LedMaskMode onExit={() => setMode("doors")} onNavigate={navigate} />);
  }

  if (mode === "avatar") {
    return shell(
      withScreenTheme(<AvatarEditMode onExit={() => setMode("doors")} />),
    );
  }

  if (mode === "characters") {
    // Production cinema → Ethereal Falls campfire (character select / create).
    // Landing may request intro_to_characters once; otherwise short establish.
    let gateId = "char_select_establish";
    try {
      const play = sessionStorage.getItem("grudge.cinema.play");
      if (play === "intro_to_characters") {
        gateId = "intro_to_characters";
        sessionStorage.removeItem("grudge.cinema.play");
      }
    } catch {
      /* ignore */
    }
    return shell(
      withScreenTheme(
        <CinemaFlowGate cinemaId={gateId} force={gateId === "intro_to_characters"}>
        <CampfireLobby
          onExit={() => setMode("doors")}
          onNavigate={(m) => {
            // charactersgrudox wooden-sign → Open collection modes
            if (m === "lobbyWorld") navigate("realms");
            else if (m === "voxgrudge-native") navigate("voxgrudge-native");
            else if (m === "home" || m === "hub") navigate("doors");
            else navigate(m as Mode);
          }}
          onAvatarEdit={() => navigate("avatar")}
          onPlayDanger={(hero) => {
            gameSession.selectCharacter(hero.id);
            const animId =
              hero.baseId === "explorer" || !hero.baseId
                ? "explorer"
                : hero.baseId.startsWith("race-") || hero.baseId.startsWith("grudge-")
                  ? hero.baseId
                  : `race-${hero.raceKey === "elf" ? "high-elf" : hero.raceKey}`;
            setCharacterId(animId === "human" ? "race-human" : animId);
            studioRef.current?.setCharacter(
              animId === "explorer" ? "explorer" : animId.startsWith("race-") ? animId : "explorer",
            );
            navigate("danger");
          }}
        />
        </CinemaFlowGate>,
      ),
    );
  }

  if (mode === "realms") {
    // Collection path /realms — Mine-Loader in-app (SSO canvas)
    return shell(
      <RealmsSurface onExit={() => navigate("doors")} surface="lobby" />,
    );
  }

  if (mode === "minegrudge") {
    return shell(
      withScreenTheme(
        <MineGrudgeEditorMode
          onExit={() => setMode("doors")}
          surface="lobby"
          onOpenInApp={openInApp}
          onEnterRealms={() => navigate("realms")}
        />,
      ),
    );
  }

  if (mode === "lobby") {
    return shell(
      withScreenTheme(
        <CinemaFlowGate cinemaId="lobby_establish">
          <Lobby
            onLoad={onLoadPost}
            onPlay={onPlayPost}
            onLoadScene={onLoadScenePost}
            onExit={() => setMode("doors")}
            net={getNet()}
            onEnterRoom={onEnterRoom}
          />
        </CinemaFlowGate>,
      ),
    );
  }

  if (mode === "zones") {
    return shell(
      withScreenTheme(
        <>
          <div style={{ padding: "0 16px" }}>
            <CollectionHealth />
          </div>
          <GrudoxZones
            onEnterNative={(id) => {
              const native = nativeModeForZone(id);
              if (native) navigate(native);
            }}
            onOpenInApp={openInApp}
            onExit={() => navigate("doors")}
          />
        </>,
      ),
    );
  }

  if (mode === "brawl") {
    return shell(<ThreeBrawler variant="brawl" onExit={() => navigate("doors")} />);
  }

  if (mode === "vox-battle") {
    return shell(<ThreeVoxBattle onExit={() => navigate("doors")} />);
  }

  if (mode === "survival") {
    return shell(
      <ThreeBrawler variant="survival" onExit={() => navigate("doors")} />,
    );
  }

  if (mode === "mimic") {
    return shell(<MimicDungeon onExit={() => navigate("doors")} />);
  }

  if (mode === "genesis") {
    // Product SSOT is warlord-genesis.vercel.app — open inside InAppGameCanvas.
    return shell(
      <GenesisExternalLaunch
        onStay={() => navigate("doors")}
        onOpenInApp={openInApp}
      />,
    );
  }

  if (mode === "voxgrudge-native") {
    return shell(<VoxGrudgeNative onExit={() => navigate("doors")} />);
  }

  const dangerPanels: DockPanelDef[] = [
    {
      id: "admin",
      title: "Admin",
      icon: <ShieldHalf size={13} />,
      home: "left",
      render: () => (
        <div className="dock-pad">
          <AdminPanel
            chrome={false}
            open
            characterId={characterId}
            weaponId={weaponId}
            difficulty={difficulty}
            onCharacter={onCharacter}
            onWeapon={onWeapon}
            onDifficulty={onDifficulty}
            onSpawn={onSpawn}
            onSpawnBoss={onSpawnBoss}
            onClearNpcs={onClearNpcs}
            duel={hud?.duel ?? null}
            onStartDuel={onStartDuel}
            onStopDuel={onStopDuel}
            onStartArenaMatch={onStartArenaMatch}
            roomPreset={roomPreset}
            testWorldId={testWorldId}
            onTestWorld={onTestWorld}
            ale={hud?.ale ?? null}
            onDuelCamera={onDuelCamera}
            onToggleDiagnostics={onToggleDiagnostics}
            onStartReplay={onStartReplay}
            onReplayPause={onReplayPause}
            onReplaySpeed={onReplaySpeed}
            onReplaySeek={onReplaySeek}
            onReplayCamera={onReplayCamera}
            onStopReplay={onStopReplay}
            onSetReplayFrequency={onSetReplayFrequency}
            onClose={() => dangerDock.hidePanel("admin")}
          />
        </div>
      ),
    },
    {
      id: "editor",
      title: "Settings",
      icon: <SlidersHorizontal size={13} />,
      home: "right",
      render: () => (
        <div className="dock-pad">
          <EditorPanel
            chrome={false}
            open
            params={params}
            onChange={onParam}
            timeScale={timeScale}
            onTimeScale={onTimeScale}
            fireFx={fireFx}
            onFireFx={onFireFx}
            onImpactTest={onImpactTest}
            onClose={() => dangerDock.hidePanel("editor")}
          />
        </div>
      ),
    },
    {
      id: "anim",
      title: "Clips",
      icon: <Film size={13} />,
      home: "right",
      render: () => (
        <div className="dock-pad">
          <AnimationsPanel
            chrome={false}
            open
            clips={clips}
            slots={slots}
            currentClip={hud?.clip ?? ""}
            onPreview={onPreview}
            onAssign={onAssign}
            onClose={() => dangerDock.hidePanel("anim")}
          />
        </div>
      ),
    },
  ];

  const dangerMenus: ToolMenu[] = [
    {
      label: "Environment",
      entries: [
        { kind: "label", label: "Training environment" },
        ...ROOM_PRESET_LIST.map((preset) => ({
          kind: "check" as const,
          label: preset.name,
          subtitle: preset.blurb,
          thumbnail: <EnvThumb preset={preset} />,
          checked: roomPreset === preset.id,
          onSelect: () => onRoomPreset(preset.id),
        })),
      ],
    },
    {
      label: "Panels",
      entries: [
        { kind: "label", label: "Toggle panels" },
        {
          kind: "check",
          label: "Admin",
          icon: <ShieldHalf size={13} />,
          checked: dangerDock.isVisible("admin"),
          onSelect: () => toggleDangerPanel("admin"),
        },
        {
          kind: "check",
          label: "Settings",
          icon: <SlidersHorizontal size={13} />,
          checked: dangerDock.isVisible("editor"),
          onSelect: () => toggleDangerPanel("editor"),
        },
        {
          kind: "check",
          label: "Clips",
          icon: <Film size={13} />,
          checked: dangerDock.isVisible("anim"),
          onSelect: () => toggleDangerPanel("anim"),
        },
        { kind: "sep" },
        {
          kind: "check",
          label: "Edit HUD",
          icon: <LayoutDashboard size={13} />,
          checked: hudEditing,
          onSelect: () => setHudEditing((v) => !v),
        },
        { kind: "item", label: "Reset layout", icon: <RotateCcw size={13} />, onSelect: () => dangerDock.resetLayout() },
      ],
    },
  ];

  return shell(
    <CursorManager>
    <div
      className={`studio ${isMobile ? "touch" : ""}${
        hudEditor.config.theme !== "default" ? " hud-themed" : ""
      }`}
      style={themeVars}
    >
      <div
        className={`canvas-mount${
          (mode === "danger" || mode === "play") && !panelsOpen && !equipOpen && !systemsOpen
            ? " immersive"
            : ""
        }${
          (mode === "danger" || mode === "play") && (freeMouse || uiOverlayOpen)
            ? " free-mouse"
            : ""
        }`}
        ref={mountRef}
      />

      {webglError && (
        <div className="webgl-error">
          <h2>WebGL unavailable</h2>
          <p>This device or browser couldn't create a 3D context. Try a hardware-accelerated browser.</p>
        </div>
      )}

      {/* helpers.glb intro: circle + orbit/zoom on character (load / arena) */}
      <HelpersLoadScreen
        visible={helpersLoad.visible}
        label={helpersLoad.label}
        progress={helpersLoad.progress}
      />

      {mode === "voxel" && (
        <>
          <VoxelEditorUI
            brush={brush}
            stats={veStats}
            dungeon={dungeon}
            mapsOpen={mapsOpen}
            onBrush={onBrush}
            onDungeon={onDungeon}
            onToggleMaps={() => setMapsOpen((v) => !v)}
            onNew={() => {
              setMapsOpen(false);
              setTemplatesOpen(true);
            }}
            onClear={onClearMap}
            onTest={onTestMap}
            onExit={() => setMode("doors")}
            getMapPayload={getMapPayload}
            tree={veTree}
            selectedId={veSel}
            gizmoMode={veGizmo}
            snap={veSnap}
            onSelect={onVeSelect}
            onGizmoMode={onVeGizmoMode}
            onSnap={onVeSnap}
            onDeleteSelected={onVeDeleteSelected}
            onDuplicateSelected={onVeDuplicateSelected}
            onFocusSelected={onVeFocusSelected}
          />
          {templatesOpen && (
            <VoxelTemplatePicker
              onPick={onPickTemplate}
              onBlank={() => {
                voxelRef.current?.clearAll();
                setDungeon(false);
                voxelRef.current?.setDungeon(false);
                setCurrentMapId(null);
                setMapName("");
                setTemplatesOpen(false);
              }}
              onClose={() => setTemplatesOpen(false)}
            />
          )}
          {mapsOpen && (
            <VoxelMapsPanel
              maps={maps}
              currentId={currentMapId}
              name={mapName}
              onName={setMapName}
              onSave={onSaveMap}
              onLoad={onLoadMap}
              onDelete={onDeleteMap}
              onExport={onExportMap}
              onImport={onImportMap}
              onClose={() => setMapsOpen(false)}
            />
          )}
        </>
      )}

      {/* Worldbuilder Play = Danger Room player UX only (camera/loco/skills/FX/anims). No admin/editor docks. */}
      {mode === "play" && (
        <>
          <Crosshair
            visible={!uiOverlayOpen}
            firstPerson={hud?.firstPerson ?? false}
            spread={hud?.aimSpread ?? 0}
            hitMarker={hud?.hitMarker ?? 0}
            rangeState={hud?.owrRange ?? "none"}
            aimNdcX={hud?.aimNdcX ?? 0}
            aimNdcY={hud?.aimNdcY ?? 0}
            focusLocked={hud?.focusLocked ?? false}
            variant={crosshairVariant}
            freeMouse={freeMouse}
            shape={hud?.reticleShape ?? "cross"}
            pulse={hud?.reticlePulse ?? 0}
            aoeScale={hud?.reticleAoeScale ?? 1}
            editBind={hudEdit.bind("reticle")}
          />
          <Hud
            hud={hud}
            edit={hudEdit}
            onArenaRetry={onArenaRetry}
            onArenaReturn={onArenaReturn}
            onRadialSelect={(id) => studioRef.current?.selectActivityTool(id)}
            onRadialCancel={() => studioRef.current?.cancelRadial()}
            onOpenProduction={() => {
              setHarvestUiOpen(true);
              document.exitPointerLock?.();
              studioRef.current?.setFreeMouseMode(true);
            }}
            onOpenBag={() => {
              setBagOpen(true);
              setEquipOpen(false);
              document.exitPointerLock?.();
              studioRef.current?.setFreeMouseMode(true);
              refreshDeposit();
              refreshBagMeta();
            }}
            canDeposit={depositCtx.canDeposit}
            bagOccupied={bagOccupied}
            bagCapacity={DEFAULT_BAG_SLOTS}
          />
          <CharacterBagPanel
            open={bagOpen}
            characterId={activeCharacterId}
            deposit={depositCtx}
            onClose={() => setBagOpen(false)}
            onBagChange={() => refreshBagMeta()}
            onFlash={(msg) => studioRef.current?.flashMessage?.(msg, 1.6)}
            onConsume={(heal, stamina, name) => {
              studioRef.current?.flashMessage?.(`${name} · +${heal}HP +${stamina}SP`, 1.4);
            }}
          />
          <ClassSkillBar
            characterId={gameSession.snapshot.selectedCharacterId || characterId}
            visible={
              !equipOpen &&
              !systemsOpen &&
              !harvestUiOpen &&
              !claimFlagOpen &&
              !bagOpen &&
              !dangerStartOpen
            }
            onCast={(slot) => {
              studioRef.current?.fireClassSkill({
                id: slot.id,
                name: slot.name,
                kind: slot.kind,
              });
            }}
          />
          <HarvestProductionUI
            open={harvestUiOpen}
            activityMode={hud?.activityMode ?? "combat"}
            activityTool={hud?.activityTool ?? "attack"}
            onClose={() => setHarvestUiOpen(false)}
            onSelectTool={(id) => studioRef.current?.selectActivityTool(id)}
            onImportCharacter={(id) => {
              if (id === "explorer" || id.startsWith("avatar-")) {
                studioRef.current?.setCharacter("explorer");
                studioRef.current?.refreshExplorerHead();
                setCharacterId("explorer");
              } else {
                studioRef.current?.setCharacter(id);
                setCharacterId(id);
              }
              setHarvestUiOpen(false);
            }}
            onOpenRealms={() => setMode("realms")}
            onOpenVoxel={() => {
              setHarvestUiOpen(false);
              setMode("voxel");
            }}
          />
          <CampClaimFlagPanel
            open={claimFlagOpen}
            characterId={gameSession.snapshot.selectedCharacterId || characterId}
            onClose={() => setClaimFlagOpen(false)}
            onBeginPlace={(id) => {
              setClaimFlagOpen(false);
              studioRef.current?.beginPlacePlaceable(id);
            }}
          />
          {hud?.mech && <MechHud hud={hud} edit={hudEdit} />}
          <StatusBar statuses={hud?.statuses ?? []} editBind={hudEdit.bind("status")} />

          {/* Combat chrome only — same feel as Danger Room, no Admin/Editor/Clips docks */}
          <TipProvider>
            <div className="ed-menubar-wrap">
              <ToolMenubar
                brand={
                  <span className="brand">
                    MAP<span className="brand-accent">PLAY</span>
                  </span>
                }
                menus={[]}
                right={
                  <>
                    <SoundMixer sound={sound} onToggleMute={onToggleMute} onLevel={onSoundLevel} />
                    <DjStationPanel variant="menubar" {...djPanelProps} />
                    <Tip label="Loadout (I) — weapons for combat">
                      <button
                        className={`tm-btn eq-open-btn ${equipOpen ? "live" : ""}`}
                        onClick={openEquip}
                      >
                        <Swords size={14} />
                        <span>Loadout</span>
                      </button>
                    </Tip>
                    <Tip label="Back to Worldbuilder editor">
                      <button className="tm-btn" onClick={onExitPlay}>
                        <DoorOpen size={14} />
                        <span>Editor</span>
                      </button>
                    </Tip>
                  </>
                }
              />
            </div>
          </TipProvider>

          {/* Same ENTER → pointer-lock gate as Danger Room */}
          {dangerStartOpen && !isMobile && (
            <DangerStartScreen
              characterLabel={hud?.character ?? characterId}
              weaponLabel={hud?.weapon ?? weaponId}
              ready={!!hud || helpersLoad.progress >= 0.85}
              onEnter={() => {
                setDangerStartOpen(false);
                if (freeMouseRef.current) {
                  applyFreeMouse(true);
                  studioRef.current?.flashMessage?.(
                    "MAP PLAY · FREE MOUSE · F9 lock aim",
                    2.0,
                  );
                  return;
                }
                applyFreeMouse(false);
                const canvas = mountRef.current?.querySelector("canvas");
                if (canvas) {
                  canvas.requestPointerLock?.();
                } else {
                  document.body.requestPointerLock?.();
                }
                studioRef.current?.flashMessage?.(
                  "MAP PLAY · F8 free mouse · same combat stack · no admin",
                  2.0,
                );
              }}
            />
          )}

          {!isMobile &&
            !dangerStartOpen &&
            !hud?.locked &&
            !freeMouse &&
            !equipOpen &&
            !systemsOpen &&
            !claimFlagOpen && (
              <div className="click-hint">
                <p>Click canvas to re-lock · or F8 free mouse</p>
                <p className="dim">
                  AA/DD dash · X roll · LMB select · RMB focus · Space wall jump
                </p>
              </div>
            )}

          {isMobile && !dangerStartOpen && (
            <TouchControls
              api={touchApi}
              onOpenBag={() => setEquipOpen(true)}
              onOpenSystems={() => setSystemsOpen(true)}
            />
          )}

          {!dangerStartOpen && (
            <>
              <button className={`fx-toggle ${dockOpen ? "on" : ""}`} onClick={() => setDockOpen((v) => !v)}>
                FX
              </button>
              {dockOpen && <StatusDock onApply={onApplyStatus} />}
            </>
          )}

          {equipOpen && (
            <ExplorerCharacterPage
              characterName={hud?.character ?? characterId}
              characterId={activeCharacterId}
              race={loadoutRaceFromFleet(gameSession.selectedCharacter()?.raceId)}
              currentWeapon={hud?.weapon ?? weaponId}
              currentOffHand={offHand}
              onEquip={onWeapon}
              onEquipOff={onOffHand}
              onClose={() => setEquipOpen(false)}
              onOpenAvatarEdit={() => {
                setEquipOpen(false);
                navigate("avatar");
              }}
              onOpenCrafting={() => {
                setEquipOpen(false);
                setHarvestUiOpen(true);
              }}
            />
          )}
        </>
      )}

      {mode === "danger" && (
        <>
          <Crosshair
            visible={!uiOverlayOpen}
            firstPerson={hud?.firstPerson ?? false}
            spread={hud?.aimSpread ?? 0}
            hitMarker={hud?.hitMarker ?? 0}
            rangeState={hud?.owrRange ?? "none"}
            aimNdcX={hud?.aimNdcX ?? 0}
            aimNdcY={hud?.aimNdcY ?? 0}
            focusLocked={hud?.focusLocked ?? false}
            variant={crosshairVariant}
            freeMouse={freeMouse}
            shape={hud?.reticleShape ?? "cross"}
            pulse={hud?.reticlePulse ?? 0}
            aoeScale={hud?.reticleAoeScale ?? 1}
            editBind={hudEdit.bind("reticle")}
          />
          <Hud
            hud={hud}
            edit={hudEdit}
            onArenaRetry={onArenaRetry}
            onArenaReturn={onArenaReturn}
            onRadialSelect={(id) => studioRef.current?.selectActivityTool(id)}
            onRadialCancel={() => studioRef.current?.cancelRadial()}
            onOpenProduction={() => {
              setHarvestUiOpen(true);
              document.exitPointerLock?.();
              studioRef.current?.setFreeMouseMode(true);
            }}
            onOpenBag={() => {
              setBagOpen(true);
              setEquipOpen(false);
              document.exitPointerLock?.();
              studioRef.current?.setFreeMouseMode(true);
              refreshDeposit();
              refreshBagMeta();
            }}
            canDeposit={depositCtx.canDeposit}
            bagOccupied={bagOccupied}
            bagCapacity={DEFAULT_BAG_SLOTS}
          />
          <CharacterBagPanel
            open={bagOpen}
            characterId={activeCharacterId}
            deposit={depositCtx}
            onClose={() => setBagOpen(false)}
            onBagChange={() => refreshBagMeta()}
            onFlash={(msg) => studioRef.current?.flashMessage?.(msg, 1.6)}
            onConsume={(heal, stamina, name) => {
              studioRef.current?.flashMessage?.(`${name} · +${heal}HP +${stamina}SP`, 1.4);
            }}
          />
          <ClassSkillBar
            characterId={gameSession.snapshot.selectedCharacterId || characterId}
            visible={!equipOpen && !systemsOpen && !harvestUiOpen && !panelsOpen && !claimFlagOpen && !bagOpen}
            onCast={(slot) => {
              studioRef.current?.fireClassSkill({
                id: slot.id,
                name: slot.name,
                kind: slot.kind,
              });
            }}
          />
          <HarvestProductionUI
            open={harvestUiOpen}
            activityMode={hud?.activityMode ?? "combat"}
            activityTool={hud?.activityTool ?? "attack"}
            onClose={() => setHarvestUiOpen(false)}
            onSelectTool={(id) => studioRef.current?.selectActivityTool(id)}
            onImportCharacter={(id) => {
              if (id === "explorer" || id.startsWith("avatar-")) {
                studioRef.current?.setCharacter("explorer");
                studioRef.current?.refreshExplorerHead();
                setCharacterId("explorer");
              } else {
                studioRef.current?.setCharacter(id);
                setCharacterId(id);
              }
              setHarvestUiOpen(false);
            }}
            onOpenRealms={() => setMode("realms")}
            onOpenVoxel={() => {
              setHarvestUiOpen(false);
              setMode("voxel");
            }}
          />
          <CampClaimFlagPanel
            open={claimFlagOpen}
            characterId={gameSession.snapshot.selectedCharacterId || characterId}
            onClose={() => setClaimFlagOpen(false)}
            onBeginPlace={(id) => {
              setClaimFlagOpen(false);
              studioRef.current?.beginPlacePlaceable(id);
            }}
          />
          {hud?.mech && <MechHud hud={hud} edit={hudEdit} />}
          <StatusBar statuses={hud?.statuses ?? []} editBind={hudEdit.bind("status")} />

          {hudEditing && <HudEditor controls={hudEditor} onClose={() => setHudEditing(false)} />}

          <TipProvider>
            <div className="ed-menubar-wrap">
              <ToolMenubar
                brand={
                  <span className="brand">
                    DANGER<span className="brand-accent">ROOM</span>
                  </span>
                }
                menus={dangerMenus}
                right={
                  <>
                    <SoundMixer sound={sound} onToggleMute={onToggleMute} onLevel={onSoundLevel} />
                    <DjStationPanel variant="menubar" {...djPanelProps} />
                    <Tip label="Camp claim flag (B) — units, buildings, farm, tame">
                      <button
                        className={`tm-btn eq-open-btn ${claimFlagOpen ? "live" : ""}`}
                        onClick={openClaimFlag}
                      >
                        <Flag size={14} />
                        <span>Camp</span>
                      </button>
                    </Tip>
                    <Tip label="Systems / skillbook (K) — Creator tabs">
                      <button
                        className={`tm-btn eq-open-btn ${systemsOpen ? "live" : ""}`}
                        onClick={openSystems}
                      >
                        <BookOpen size={14} />
                        <span>Systems</span>
                      </button>
                    </Tip>
                    <Tip label="Loadout (I)">
                      <button
                        className={`tm-btn eq-open-btn ${equipOpen ? "live" : ""}`}
                        onClick={openEquip}
                      >
                        <Swords size={14} />
                        <span>Loadout</span>
                      </button>
                    </Tip>
                    <Tip label="Back to door select">
                      <button className="tm-btn" onClick={onLeaveDanger}>
                        <DoorOpen size={14} />
                        <span>Doors</span>
                      </button>
                    </Tip>
                  </>
                }
              />
            </div>
            <DockSurface layout={dangerLayout} controls={dangerDock} panels={dangerPanels} />
          </TipProvider>

          {/* Sample-style start gate: ENTER → pointer lock (blocks canvas until ready) */}
          {dangerStartOpen && !isMobile && (
            <DangerStartScreen
              characterLabel={hud?.character ?? characterId}
              weaponLabel={hud?.weapon ?? weaponId}
              ready={!!hud || helpersLoad.progress >= 0.85}
              onEnter={() => {
                setDangerStartOpen(false);
                if (freeMouseRef.current) {
                  applyFreeMouse(true);
                  studioRef.current?.flashMessage?.(
                    "FREE MOUSE · F9 lock aim · RMB focus",
                    1.8,
                  );
                  return;
                }
                applyFreeMouse(false);
                // Prefer canvas lock (engine InputState binds to renderer.domElement)
                const canvas = mountRef.current?.querySelector("canvas");
                if (canvas) {
                  canvas.requestPointerLock?.();
                } else {
                  document.body.requestPointerLock?.();
                }
                studioRef.current?.flashMessage?.(
                  "DANGER · F8 free mouse · RMB focus · soft lock",
                  1.8,
                );
              }}
            />
          )}

          {!isMobile &&
            !dangerStartOpen &&
            !hud?.locked &&
            !freeMouse &&
            !panelsOpen &&
            !equipOpen &&
            !systemsOpen &&
            !claimFlagOpen && (
              <div className="click-hint">
                <p>Click canvas to re-lock · or F8 free mouse</p>
                <p className="dim">
                  AA/DD dash · X roll · LMB select · RMB focus · Space wall jump
                </p>
              </div>
            )}

          {isMobile && !panelsOpen && (
            <TouchControls
              api={touchApi}
              onOpenBag={() => setEquipOpen(true)}
              onOpenSystems={() => setSystemsOpen(true)}
            />
          )}

          {!panelsOpen && !dangerStartOpen && (
            <>
              <button className={`fx-toggle ${dockOpen ? "on" : ""}`} onClick={() => setDockOpen((v) => !v)}>
                FX
              </button>
              {dockOpen && <StatusDock onApply={onApplyStatus} />}
            </>
          )}

          {equipOpen && (
            <ExplorerCharacterPage
              characterName={hud?.character ?? characterId}
              characterId={activeCharacterId}
              race={loadoutRaceFromFleet(gameSession.selectedCharacter()?.raceId)}
              currentWeapon={hud?.weapon ?? weaponId}
              currentOffHand={offHand}
              onEquip={onWeapon}
              onEquipOff={onOffHand}
              onClose={() => setEquipOpen(false)}
              onOpenAvatarEdit={() => {
                setEquipOpen(false);
                navigate("avatar");
              }}
              onOpenCrafting={() => {
                setEquipOpen(false);
                setHarvestUiOpen(true);
              }}
            />
          )}
          {systemsOpen && (
            <GrudgeSystemsPanel
              characterName={hud?.character ?? characterId}
              characterId={gameSession.snapshot.selectedCharacterId || characterId}
              weapon={hud?.weapon ?? weaponId}
              hud={hud}
              onClose={() => setSystemsOpen(false)}
              onOpenEquipment={() => {
                setSystemsOpen(false);
                setEquipOpen(true);
              }}
              onOpenCrafting={() => {
                setSystemsOpen(false);
                setHarvestUiOpen(true);
              }}
              onPlayPve={() => {
                setSystemsOpen(false);
                /* already in danger — just close panel for solo PvE */
              }}
              onOpenLobby={() => {
                setSystemsOpen(false);
                navigate("lobby");
              }}
              onLaunchFleet={(id) => {
                setSystemsOpen(false);
                if (id === "carrier") window.open("https://carrier.grudge-studio.com/", "_blank", "noopener");
                else if (id === "grudox") window.open("https://grudox.grudge-studio.com/", "_blank", "noopener");
                else window.open("https://grudgewarlords.com/", "_blank", "noopener");
              }}
            />
          )}
        </>
      )}
    </div>
    </CursorManager>
  );
}

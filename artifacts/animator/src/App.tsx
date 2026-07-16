import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Studio } from "./three/Studio";
import { AppShell } from "./components/AppShell";
import type { AssistantConfig } from "./ai/AssistantSurface";
import { appGuideSystemPrompt } from "./ai/companionPrompt";
import { buildDangerTools, dangerSystemPrompt } from "./ai/dangerTools";
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
import { loadSound, type SoundSettings } from "./three/soundSettings";
import { SoundMixer, type SoundChannel } from "./components/SoundMixer";
import type {
  BrushState,
  DeployableNode,
  EditorStats,
  GizmoMode,
  VoxelMap,
} from "./three/voxel/types";
import { colorForBlockType, DEFAULT_BLOCK_TYPE } from "@workspace/voxel-canonical";
import { Crosshair } from "./components/Crosshair";
import { Hud } from "./components/Hud";
import { MechHud } from "./components/MechHud";
import { EquipmentScreen, loadoutRaceFromFleet } from "./components/EquipmentScreen";
import { AdminPanel } from "./components/AdminPanel";
import { EnvThumb } from "./components/EnvThumb";
import { EditorPanel } from "./components/EditorPanel";
import { AnimationsPanel } from "./components/AnimationsPanel";
import { TouchControls } from "./components/TouchControls";
import { StatusBar } from "./components/StatusBar";
import { StatusDock } from "./components/StatusDock";
import { DoorSelect } from "./components/DoorSelect";
import { IntroCinematic } from "./components/IntroCinematic";
import { EditorMode } from "./components/editor/EditorMode";
import { Lobby } from "./components/Lobby";
import { FleetBar } from "./components/FleetBar";
import { AccountPanel } from "./components/AccountPanel";
import { ThreeBrawler } from "./components/ThreeBrawler";
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
import { gameSession } from "./game/GameSession";
import {
  buildGenesisHeroOptions,
  type GenesisHeroOption,
} from "./lib/grudoxRoster";
import { resolveRaceModel } from "./lib/raceModel";
import { LedMaskMode } from "./components/LedMaskMode";
import { LandingPage } from "./components/LandingPage";
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
import { DoorOpen, ShieldHalf, SlidersHorizontal, Film, RotateCcw, LayoutDashboard, Swords } from "lucide-react";
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
  const [equipOpen, setEquipOpen] = useState(false);
  const equipOpenRef = useRef(false);
  equipOpenRef.current = equipOpen;
  // Never carry the loadout overlay across surfaces (doors/editor/play/danger).
  useEffect(() => {
    setEquipOpen(false);
  }, [mode]);
  const [characterId, setCharacterId] = useState("explorer");
  // Drive avatar + equipment from signed-in fleet character (GrudaChain / Railway).
  // Production path: race kit + atlas texture + mesh_ids from account equipment /
  // ObjectStore gear_presets (main panel SSOT) — not untextured catalog GLBs.
  useEffect(() => {
    const applyAvatarAndLoadout = () => {
      const ch = gameSession.selectedCharacter();
      if (!ch) return;
      const { avatarId: raceAvatar } = resolveRaceModel(ch);
      void Promise.all([
        import("./lib/characterLoadout"),
        import("./lib/characterEquipmentMesh"),
      ]).then(([{ loadoutFromCharacter }, { resolveCharacterEquipmentVisual }]) => {
        const loadout = loadoutFromCharacter(ch);
        const avatarId = loadout.avatarId || raceAvatar;
        setCharacterId((prev) => (prev === avatarId ? prev : avatarId));
        // Resolve mesh_ids (equipment bag / gear preset / class default) then spawn
        void resolveCharacterEquipmentVisual(ch).then((vis) => {
          const studio = studioRef.current;
          if (!studio) return;
          studio.setEquipmentMeshIds(vis.meshIds);
          studio.setCharacter(avatarId);
          console.info(
            "[Open] account character visual",
            ch.name,
            vis.source,
            vis.raceId,
            vis.presetId,
            `meshes=${vis.meshIds.length}`,
            vis.gearPresetId || "",
          );
        });
        // Apply saved weapons so logged-in play uses the character's gear
        if (loadout.weaponId) {
          setWeaponId(loadout.weaponId);
          studioRef.current?.setWeapon(loadout.weaponId);
        }
        setOffHandState(loadout.offHand);
        studioRef.current?.setOffHand(loadout.offHand);
      });
    };
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
  const [dockOpen, setDockOpen] = useState(false);
  const [sound, setSound] = useState<SoundSettings>(() => loadSound());
  const [roomPreset, setRoomPreset] = useState<RoomPresetId>(() => loadRoomPreset());
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
        if (id === "anim") refreshAnim();
      }
      dangerDock.togglePanel(id);
    },
    [dangerDock, refreshAnim],
  );

  // Mount the Danger Room engine while in combat mode.
  useEffect(() => {
    if (mode !== "danger" || !mountRef.current) return;
    const roomMap = inRoomRef.current ? roomMapRef.current : null;
    let studio: Studio | null = null;
    try {
      studio = new Studio(mountRef.current, characterId, (h) => hudRef.current(h));
      studio.onCharacterLoaded = () => {
        refreshAnim();
        // A networked room with a chosen map loads it once the rig is ready.
        if (roomMap) void studioRef.current?.enterArena(roomMap);
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
      // Hand the live relay client to the engine for multiplayer rooms.
      if (inRoomRef.current && netRef.current) studio.attachNet(netRef.current);
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

  // Mount a fresh Danger Room and load the authored map into it (play/test mode).
  useEffect(() => {
    if (mode !== "play" || !mountRef.current) return;
    const map = playMapRef.current;
    if (!map) {
      setMode("voxel");
      return;
    }
    let studio: Studio | null = null;
    try {
      studio = new Studio(mountRef.current, characterId, (h) => hudRef.current(h));
      studio.onCharacterLoaded = () => {
        refreshAnim();
        void studioRef.current?.enterArena(map);
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
      // Esc closes the loadout overlay even while its search box is focused, so
      // handle it BEFORE the input-target guard below.
      if (e.code === "Escape" && equipOpenRef.current) {
        setEquipOpen(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      if (e.code === "KeyI") {
        e.preventDefault();
        const next = !equipOpenRef.current;
        setEquipOpen(next);
        if (next) document.exitPointerLock?.();
        return;
      }
      if (e.code === "Tab") {
        // Tab = lock-on / cycle the selected enemy; Shift+Tab rotates the ally.
        e.preventDefault();
        if (e.shiftKey) studioRef.current?.cycleAllyTarget();
        else studioRef.current?.cycleTarget();
        return;
      }
      if (e.code === "Backquote") {
        // Admin panel hotkey (moved off Tab).
        e.preventDefault();
        toggleDangerPanel("admin");
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
        toggleDangerPanel("anim");
        return;
      }
      studioRef.current?.handleKey(e.code);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, refreshAnim, toggleDangerPanel]);

  // Play/test mode: combat keys + lock-on only (no editor/admin/clips panels).
  useEffect(() => {
    if (mode !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      // Esc closes the loadout overlay even while its search box is focused, so
      // handle it BEFORE the input-target guard below.
      if (e.code === "Escape" && equipOpenRef.current) {
        setEquipOpen(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      if (e.code === "KeyI") {
        e.preventDefault();
        const next = !equipOpenRef.current;
        setEquipOpen(next);
        if (next) document.exitPointerLock?.();
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
        if (e.shiftKey) studioRef.current?.cycleAllyTarget();
        else studioRef.current?.cycleTarget();
        return;
      }
      studioRef.current?.handleKey(e.code);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // Touch devices: tell the engine to skip pointer-lock-on-tap so the on-screen
  // joystick/look-pad own input. Re-applies whenever the breakpoint flips.
  useEffect(() => {
    studioRef.current?.setTouchMode(isMobile);
  }, [isMobile]);

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

  const onStartArenaMatch = useCallback(() => {
    studioRef.current?.startArenaMatch();
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

  // Per-surface config for the ONE global AI dock the shell hosts. Danger/play
  // get the Danger Room master (live tools); the calm "guide" companion covers
  // doors/voxel/lobby; the Dressing Room registers its own config via context
  // (it owns the engine), and LED Mask runs its own embedded face chat.
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
    if (
      mode === "doors" ||
      mode === "voxel" ||
      mode === "lobby" ||
      mode === "zones" ||
      mode === "genesis" ||
      mode === "voxgrudge-native" ||
      mode === "account" ||
      mode === "brawl" ||
      mode === "survival"
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
  }, [mode, dangerAiTools, characterId, weaponId, difficulty, params]);

  // Wrap any mode's content in the persistent shell (launcher + global AI dock).
  const shell = (content: React.ReactNode) => (
    <AppShell
      mode={mode}
      onNavigate={navigate}
      assistant={shellAssistant}
      hideAssistant={mode === "ledmask"}
    >
      {/* Library hub owns its own Steam chrome + account strip */}
      {mode !== "doors" && <FleetBar />}
      {content}
    </AppShell>
  );

  const panelsOpen =
    dangerDock.isVisible("admin") || dangerDock.isVisible("editor") || dangerDock.isVisible("anim");

  // Stable touch API bridging the on-screen controls to the live engine.
  const touchApi = useRef({
    touchMoveInput: (x: number, y: number) => studioRef.current?.touchMoveInput(x, y),
    touchLook: (dx: number, dy: number) => studioRef.current?.touchLook(dx, dy),
    touchLookEnd: () => studioRef.current?.touchLookEnd(),
    setTouchSprint: (on: boolean) => studioRef.current?.setTouchSprint(on),
    touchJump: () => studioRef.current?.touchJump(),
    touchAttack: () => studioRef.current?.touchAttack(),
    touchSkill: (i?: number) => studioRef.current?.touchSkill(i),
    touchSkyfall: () => studioRef.current?.touchSkyfall(),
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
    // Front door: Grudge ID (no shell chrome). Enter → library hub.
    return <LandingPage onEnter={() => navigate("doors")} />;
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
    // Ethereal Falls campfire — 4-slot GRUDOX heroes + Explorer Avatar Edit system
    return shell(
      withScreenTheme(
        <CampfireLobby
          onExit={() => setMode("doors")}
          onNavigate={(m) => {
            if (m === "lobbyWorld") navigate("realms");
            else if (m === "voxgrudge-native") navigate("voxgrudge-native");
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
        />,
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
      <Lobby
        onLoad={onLoadPost}
        onPlay={onPlayPost}
        onLoadScene={onLoadScenePost}
        onExit={() => setMode("doors")}
        net={getNet()}
        onEnterRoom={onEnterRoom}
      />,
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
    <div
      className={`studio ${isMobile ? "touch" : ""}${
        hudEditor.config.theme !== "default" ? " hud-themed" : ""
      }`}
      style={themeVars}
    >
      <div
        className={`canvas-mount${
          (mode === "danger" || mode === "play") && !panelsOpen && !equipOpen ? " immersive" : ""
        }`}
        ref={mountRef}
      />

      {webglError && (
        <div className="webgl-error">
          <h2>WebGL unavailable</h2>
          <p>This device or browser couldn't create a 3D context. Try a hardware-accelerated browser.</p>
        </div>
      )}

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

      {mode === "play" && (
        <>
          <Crosshair
            visible={!panelsOpen && !equipOpen}
            firstPerson={hud?.firstPerson ?? false}
            spread={hud?.aimSpread ?? 0}
            hitMarker={hud?.hitMarker ?? 0}
            rangeState={hud?.owrRange ?? "none"}
            editBind={hudEdit.bind("reticle")}
          />
          <Hud
            hud={hud}
            edit={hudEdit}
            onArenaRetry={onArenaRetry}
            onArenaReturn={onArenaReturn}
          />
          {hud?.mech && <MechHud hud={hud} edit={hudEdit} />}
          <StatusBar statuses={hud?.statuses ?? []} editBind={hudEdit.bind("status")} />

          <div className="topbar">
            <span className="brand">
              TEST<span className="brand-accent">PLAY</span>
            </span>
            <div className="topbar-actions">
              <SoundMixer sound={sound} onToggleMute={onToggleMute} onLevel={onSoundLevel} variant="topbar" />
              <button
                className={`tab eq-open-btn ${equipOpen ? "live" : ""}`}
                onClick={openEquip}
                title="Loadout (I)"
              >
                <Swords size={13} /> Loadout
              </button>
              <button className="tab" onClick={onExitPlay}>
                ⬑ Editor
              </button>
            </div>
          </div>

          {!isMobile && !hud?.locked && !equipOpen && (
            <div className="click-hint">
              <p>Click to enter — mouse to look</p>
              <p className="dim">
                WASD move · Shift sprint · Space jump (×2) · LMB attack · Tab lock-on · Esc to release
              </p>
            </div>
          )}

          {isMobile && <TouchControls api={touchApi} />}

          {equipOpen && (
            <EquipmentScreen
              characterName={hud?.character ?? characterId}
              race={loadoutRaceFromFleet(gameSession.selectedCharacter()?.raceId)}
              currentWeapon={hud?.weapon ?? weaponId}
              currentOffHand={offHand}
              onEquip={onWeapon}
              onEquipOff={onOffHand}
              onClose={() => setEquipOpen(false)}
            />
          )}
        </>
      )}

      {mode === "danger" && (
        <>
          <Crosshair
            visible={!panelsOpen && !equipOpen}
            firstPerson={hud?.firstPerson ?? false}
            spread={hud?.aimSpread ?? 0}
            hitMarker={hud?.hitMarker ?? 0}
            rangeState={hud?.owrRange ?? "none"}
            editBind={hudEdit.bind("reticle")}
          />
          <Hud
            hud={hud}
            edit={hudEdit}
            onArenaRetry={onArenaRetry}
            onArenaReturn={onArenaReturn}
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

          {!isMobile && !hud?.locked && !panelsOpen && !equipOpen && (
            <div className="click-hint">
              <p>Click to enter — mouse to look</p>
              <p className="dim">
                WASD move · Shift sprint · Space jump (×2) · LMB attack · Q parry · E block (hold) · X dodge · R heavy · Z / T combo · V kick · G evade · F / 1-4 skills · RMB block/lock · Tab lock-on · ` admin · E editor · C clips
              </p>
            </div>
          )}

          {isMobile && !panelsOpen && <TouchControls api={touchApi} />}

          {!panelsOpen && (
            <>
              <button className={`fx-toggle ${dockOpen ? "on" : ""}`} onClick={() => setDockOpen((v) => !v)}>
                FX
              </button>
              {dockOpen && <StatusDock onApply={onApplyStatus} />}
            </>
          )}

          {equipOpen && (
            <EquipmentScreen
              characterName={hud?.character ?? characterId}
              race={loadoutRaceFromFleet(gameSession.selectedCharacter()?.raceId)}
              currentWeapon={hud?.weapon ?? weaponId}
              currentOffHand={offHand}
              onEquip={onWeapon}
              onEquipOff={onOffHand}
              onClose={() => setEquipOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

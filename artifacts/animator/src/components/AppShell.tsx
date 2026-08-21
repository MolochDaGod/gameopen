/**
 * Unified, phone-first app chrome — Steam-inspired top launcher.
 *
 * Wraps every mode's content in one persistent shell so the user can hop between
 * systems (Danger Room, Worldbuilder, Dressing Room, Lobby, LED Mask) WITHOUT a
 * doors round-trip, and so the AI companion is reachable from everywhere.
 *
 * The shell renders as an overlay fragment (it does not box the mode content —
 * each mode keeps its own fixed/absolute full-screen layout), contributing:
 *   1. a persistent top launcher + nav (bottom sheet on phones, dropdown on
 *      pointer devices), safe-area aware with touch-sized targets,
 *   2. the Toolbox pill (tools grid + music station) — same as the controll lab,
 *      available from the moment the app opens on every surface, and
 *   3. ONE global {@link AiAssistant} dock driven by the active surface's config.
 *
 * Modes that own a live engine (the Dressing Room) register their assistant via
 * {@link useRegisterAssistant}; the shell prefers that child-registered config
 * over the `assistant` base config the host passes for the active mode.
 *
 * Library hub (doors): toolbox lives IN DoorSelect's steam top bar — never a
 * fixed top-left float covering brand / logo / nav.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Grid3x3, Home, X, Download } from "lucide-react";
import { AiAssistant } from "../ai/AiAssistant";
import { AssistantSurfaceContext, type AssistantConfig } from "../ai/AssistantSurface";
import { useDevice } from "../hooks/useDevice";
import { assetUrl } from "../lib/fleet";
import { InstallAppButton } from "./InstallAppButton";
import { ToolboxOverlay } from "./toolbox/ToolboxOverlay";
import type { ToolDef } from "./toolbox/tools";
import { FleetBar } from "./FleetBar";
import { KM } from "../lib/kenneyMobile";
import "./appShell.css";
import "./toolbox/toolbox.css";

const PHONE_PLAY_MODES = new Set<ShellMode>([
  "danger",
  "play",
  "brawl",
  "survival",
  "mimic",
  "genesis",
  "voxgrudge-native",
  "vox-battle",
]);

/** Library (and any child) can open the shell Toolbox without a covering float. */
export type ShellChromeApi = {
  openToolbox: () => void;
  closeToolbox: () => void;
  toggleToolbox: () => void;
  toolboxOpen: boolean;
};

const ShellChromeContext = createContext<ShellChromeApi | null>(null);

export function useShellChrome(): ShellChromeApi | null {
  return useContext(ShellChromeContext);
}

/** King emblem for Toolbox pill — same art as controll lab (public/emblem.png). */
export function ToolboxEmblem({ size = 22 }: { size?: number }) {
  return (
    <img
      className="shell-toolbox-art"
      src={assetUrl("emblem.png")}
      alt=""
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      onError={(e) => {
        // Fallback: gold action icon if emblem 404s on a host
        const el = e.currentTarget;
        if (el.dataset.fallback) return;
        el.dataset.fallback = "1";
        el.src = assetUrl("icons/asset-manager.png");
      }}
    />
  );
}

/** Tiny themed game icon from public/icons/. Falls back to a tinted square. */
function GameIcon({ name, tone, size = 20 }: { name: string; tone: string; size?: number }) {
  return (
    <img
      src={assetUrl(`icons/${name}.png`)}
      alt=""
      draggable={false}
      width={size}
      height={size}
      style={{ objectFit: "contain", filter: `drop-shadow(0 0 4px ${tone}55)` }}
    />
  );
}

/** Every mode the shell can route to. Mirrors App's `Mode` union. */
export type ShellMode =
  | "landing"
  | "doors"
  | "danger"
  | "voxel"
  | "play"
  | "editor"
  | "lobby"
  | "rooms"
  | "ledmask"
  | "zones"
  | "brawl"
  | "survival"
  | "mimic"
  | "genesis"
  | "voxgrudge-native"
  | "vox-battle"
  | "account"
  | "realms"
  | "minegrudge"
  | "avatar"
  | "anim"
  | "anim-ai"
  | "ui"
  | "characters"
  | "equipment";

interface NavItem {
  mode: ShellMode;
  label: string;
  hint: string;
  icon: ReactNode;
  tone: string;
  group: string;
}

const NAV: NavItem[] = [
  { mode: "doors",            label: "Library",         hint: "All titles",           icon: <Home size={20} />,                                       tone: "#66c0f4", group: "Home" },
  { mode: "account",          label: "Account",         hint: "Chars, wallet, treaty",icon: <GameIcon name="inventory"       tone="#4fc3ff" />,          tone: "#4fc3ff", group: "Home" },
  { mode: "equipment",        label: "Character",       hint: "UUID · mesh bake · gear",icon: <GameIcon name="equip"         tone="#fbbf24" />,          tone: "#fbbf24", group: "Home" },
  { mode: "danger",           label: "Danger Room",     hint: "Combat sandbox",       icon: <GameIcon name="combat-pad"      tone="#ff7a7a" />,          tone: "#ff7a7a", group: "Play" },
  { mode: "genesis",          label: "Warlord Genesis", hint: "3-lane MOBA · fleet",  icon: <GameIcon name="skill-vfx-lab"   tone="#ffd24d" />,          tone: "#ffd24d", group: "Play" },
  { mode: "brawl",            label: "Ruins Brawler",   hint: "Live co-op survival",  icon: <GameIcon name="attack"          tone="#ff7a7a" />,          tone: "#ff9a7a", group: "Play" },
  { mode: "survival",         label: "Agama Survival",  hint: "Waves on Agama map",   icon: <GameIcon name="ambush"          tone="#e8a040" />,          tone: "#e8a040", group: "Play" },
  { mode: "mimic",            label: "Test Dungeon",    hint: "Mimic encounter",      icon: <GameIcon name="ambush"          tone="#9cff5a" />,          tone: "#9cff5a", group: "Play" },
  { mode: "voxel",            label: "Worldbuilder",    hint: "Map editor · Danger Play", icon: <GameIcon name="worldbuilder" tone="#7ee0a0" />,          tone: "#7ee0a0", group: "Create" },
  { mode: "voxgrudge-native", label: "VoxGrudge",       hint: "Open voxel world",     icon: <GameIcon name="explore"         tone="#5fe0ff" />,          tone: "#5fe0ff", group: "Play" },
  { mode: "editor",           label: "Dressing Room",   hint: "Equip & preview",      icon: <GameIcon name="equip"           tone="#ffb24d" />,          tone: "#ffb24d", group: "Create" },
  { mode: "ui",               label: "Create UI",       hint: "HUD · menus · packs",  icon: <GameIcon name="hud-settings"    tone="#4ade80" />,          tone: "#4ade80", group: "Create" },
  { mode: "avatar",           label: "Avatar Edit",     hint: "Cube modular head",    icon: <GameIcon name="inventory"       tone="#c9a0ff" />,          tone: "#c9a0ff", group: "Create" },
  { mode: "anim",             label: "Anim Creator",    hint: "Pose · clips",         icon: <GameIcon name="animation-editor" tone="#c79bff" />,         tone: "#c79bff", group: "Create" },
  { mode: "anim-ai",          label: "AI Animator",     hint: "Chat → motion",        icon: <GameIcon name="ai-worker"       tone="#5eead4" />,          tone: "#5eead4", group: "Create" },
  { mode: "lobby",            label: "Lobby",           hint: "4 heroes · campfire",  icon: <GameIcon name="inventory"       tone="#5fe0ff" />,          tone: "#5fe0ff", group: "Community" },
  { mode: "rooms",            label: "Rooms",           hint: "MP rooms & maps",      icon: <GameIcon name="inventory"       tone="#9d8bff" />,          tone: "#9d8bff", group: "Community" },
  { mode: "realms",           label: "Realms",          hint: "Mine-Loader worlds",   icon: <GameIcon name="explore"         tone="#7ee0a0" />,          tone: "#7ee0a0", group: "Community" },
  { mode: "zones",            label: "GRUDOX Zones",    hint: "Shared GRUDOX world",  icon: <GameIcon name="loot"            tone="#5fe0ff" />,          tone: "#5fe0ff", group: "Community" },
  { mode: "ledmask",          label: "LED Mask",        hint: "AI face companion",    icon: <GameIcon name="animation-editor" tone="#a78bff" />,         tone: "#a78bff", group: "Tools" },
];

/** The launcher pill reflects the active surface (play folds into the editor). */
function activeNav(mode: ShellMode): NavItem {
  if (mode === "play") return { ...NAV.find((n) => n.mode === "voxel")!, label: "Playtest", hint: "Testing your map" };
  if (mode === "characters") {
    return { ...NAV.find((n) => n.mode === "lobby")!, label: "Characters", hint: "4-seat campfire · all eras" };
  }
  if (mode === "landing") return NAV[0]!;
  if (mode === "vox-battle") return NAV.find((n) => n.mode === "brawl") ?? NAV[0]!;
  return NAV.find((n) => n.mode === mode) ?? NAV[0]!;
}

interface Props {
  /** Current mode (drives the launcher label + active highlight). */
  mode: ShellMode;
  /** Switch systems. The host wires in any per-mode teardown (e.g. net leave). */
  onNavigate: (mode: ShellMode) => void;
  /** Base assistant config for the active mode (null = no host-owned config). */
  assistant: AssistantConfig | null;
  /** Suppress the global dock (e.g. LED Mask runs its own embedded face chat). */
  hideAssistant?: boolean;
  /**
   * Toolbox tool click — host routes mode switches / dock panels / HUD edit /
   * loadout. Required for a working toolbox (same as controll lab).
   */
  onToolLaunch?: (tool: ToolDef) => void;
  /** Music tab content (CPT RAC Station + volume mixer). */
  music?: ReactNode;
  /**
   * When true (default), show fleet account/mode/hero strip in the header.
   * Library hub uses its own Steam chrome — pass false there via host.
   */
  showFleetStrip?: boolean;
  /** Danger Room match picker in the fleet strip (off on product hubs). */
  showModeSelect?: boolean;
  children: ReactNode;
}

export function AppShell({
  mode,
  onNavigate,
  assistant,
  hideAssistant,
  onToolLaunch,
  music,
  showFleetStrip = true,
  showModeSelect = false,
  children,
}: Props) {
  const { deviceClass } = useDevice();
  const phone = deviceClass === "phone";
  const immersivePhone = phone && PHONE_PLAY_MODES.has(mode);
  const [navOpen, setNavOpen] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  // A mode that owns its engine can override the host-provided config.
  const [override, setOverride] = useState<AssistantConfig | null>(null);

  const surfaceApi = useMemo(() => ({ set: setOverride }), []);
  const current = activeNav(mode);
  const config = override ?? assistant;
  // Hub already has full Steam library chrome — hide floating launcher there.
  // Toolbox still shows on library so music/tools work from first open.
  const hideLauncher = mode === "doors";

  const go = (next: ShellMode) => {
    setNavOpen(false);
    setToolboxOpen(false);
    if (next !== mode) onNavigate(next);
  };

  const groups = useMemo(() => {
    const order = ["Home", "Play", "Create", "Community", "Tools"];
    const map = new Map<string, NavItem[]>();
    for (const item of NAV) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return order.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, []);

  const chromeApi = useMemo<ShellChromeApi>(
    () => ({
      openToolbox: () => {
        setNavOpen(false);
        setToolboxOpen(true);
      },
      closeToolbox: () => setToolboxOpen(false),
      toggleToolbox: () => {
        setNavOpen(false);
        setToolboxOpen((v) => !v);
      },
      toolboxOpen,
    }),
    [toolboxOpen],
  );

  const toolboxBtn = (
    <button
      type="button"
      className={`shell-toolbox ${toolboxOpen ? "on" : ""}`}
      onClick={() => {
        setNavOpen(false);
        setToolboxOpen((v) => !v);
      }}
      aria-haspopup="dialog"
      aria-expanded={toolboxOpen}
      data-tip="Toolbox — tools, music & settings"
      title="Toolbox — tools, music & settings"
    >
      <ToolboxEmblem />
      <span className="shell-toolbox-label">Toolbox</span>
    </button>
  );

  // Document-scroll modes (account hubs) vs immersive canvas (danger) vs
  // library internal pane scroll (.steam-main). Wrong shell-scroll = "can't scroll".
  useEffect(() => {
    const documentScrollModes = new Set([
      "account",
      "zones",
      "realms",
      "lobby",
      "rooms",
      "characters",
      "landing",
    ]);
    // Canvas / full-screen game surfaces — body overflow hidden is correct
    const immersiveModes = new Set([
      "danger",
      "play",
      "voxel",
      "brawl",
      "survival",
      "mimic",
      "genesis",
      "voxgrudge-native",
      "editor",
      "ledmask",
      "avatar",
      "anim",
      "anim-ai",
      "ui",
      "minegrudge",
    ]);
    // Library (doors) uses fixed .steam-lib + .steam-main overflow-y:auto
    const documentScroll = documentScrollModes.has(mode);
    const immersive = immersiveModes.has(mode) || mode === "doors";
    document.documentElement.classList.toggle("shell-scroll", documentScroll);
    document.body.classList.toggle("shell-scroll", documentScroll);
    document.documentElement.classList.toggle("shell-immersive", immersive && !documentScroll);
    document.body.classList.toggle("shell-immersive", immersive && !documentScroll);
    document.documentElement.dataset.shellMode = mode;
    // Ensure library can receive wheel even if a leftover pointer-lock class stuck
    if (mode === "doors" || documentScroll) {
      document.documentElement.classList.remove("pointer-locked");
      document.body.classList.remove("ptr-ui", "ptr-free", "ptr-interact");
      try {
        document.exitPointerLock?.();
      } catch {
        /* ignore */
      }
    }
    return () => {
      document.documentElement.classList.remove("shell-scroll", "shell-immersive");
      document.body.classList.remove("shell-scroll", "shell-immersive");
      delete document.documentElement.dataset.shellMode;
    };
  }, [mode]);

  return (
    <AssistantSurfaceContext.Provider value={surfaceApi}>
      <ShellChromeContext.Provider value={chromeApi}>
        {children}

        {/*
          Library hub owns its Steam top bar — DO NOT float toolbox over brand/logo.
          DoorSelect renders the Toolbox pill via useShellChrome().
        */}
        {!hideLauncher && immersivePhone && (
          <button
            type="button"
            className="shell-phone-fab"
            onClick={() => {
              setToolboxOpen(false);
              setNavOpen(true);
            }}
            aria-label="Open menu"
          >
            <img src={KM.iconMenu} alt="" width={22} height={22} />
          </button>
        )}

        {!hideLauncher && (
          <>
            {!immersivePhone && (
            <div className="shell-steam-bar" role="banner">
              <div className="shell-steam-brand">
                <span className="shell-steam-brand-name">Grudge Open</span>
                <button
                  type="button"
                  className="shell-launcher"
                  onClick={() => {
                    setToolboxOpen(false);
                    setNavOpen((v) => !v);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={navOpen}
                  title="Switch system / app"
                >
                  <span className="shell-launcher-icon" style={{ color: current.tone }}>
                    {navOpen ? <X size={18} /> : current.mode === "doors" ? <Grid3x3 size={18} /> : current.icon}
                  </span>
                  <span className="shell-launcher-label">{current.label}</span>
                  <ChevronDown size={15} className={`shell-launcher-chev ${navOpen ? "open" : ""}`} />
                </button>
              </div>

              {showFleetStrip && (
                <div className="shell-steam-center">
                  <FleetBar variant="inline" showModeSelect={showModeSelect} />
                </div>
              )}

              <div className="shell-steam-actions">
                {toolboxBtn}
                <InstallAppButton variant="pill" />
                <button
                  type="button"
                  className="shell-library-btn"
                  onClick={() => go("doors")}
                  title="Back to library"
                >
                  <Home size={14} />
                  <span>Library</span>
                </button>
              </div>
            </div>
            )}

            <AnimatePresence>
              {navOpen && (
                <>
                  <motion.div
                    className="shell-nav-scrim"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setNavOpen(false)}
                  />
                  <motion.div
                    className={`shell-nav ${phone ? "sheet" : "popover"}`}
                    role="menu"
                    initial={phone ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.97 }}
                    animate={phone ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={phone ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  >
                    {phone && <div className="shell-nav-grip" />}
                    <div className="shell-nav-head">
                      <span>Library</span>
                      <span className="shell-nav-head-meta">
                        <Download size={12} /> Installable app
                      </span>
                    </div>
                    <div className="shell-nav-list">
                      {groups.map(({ group, items }) => (
                        <div key={group} className="shell-nav-group">
                          <div className="shell-nav-group-label">{group}</div>
                          {items.map((item) => {
                            const active = item.mode === mode || (mode === "play" && item.mode === "voxel");
                            return (
                              <button
                                key={item.mode}
                                className={`shell-nav-item ${active ? "active" : ""}`}
                                role="menuitem"
                                onClick={() => go(item.mode)}
                              >
                                <span className="shell-nav-item-icon" style={{ color: item.tone }}>
                                  {item.icon}
                                </span>
                                <span className="shell-nav-item-text">
                                  <span className="shell-nav-item-label">{item.label}</span>
                                  <span className="shell-nav-item-hint">{item.hint}</span>
                                </span>
                                {active && <span className="shell-nav-item-dot" style={{ background: item.tone }} />}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}

        <AnimatePresence>
          {toolboxOpen && onToolLaunch && (
            <ToolboxOverlay
              music={music}
              onClose={() => setToolboxOpen(false)}
              onLaunch={(tool) => {
                setToolboxOpen(false);
                onToolLaunch(tool);
              }}
            />
          )}
        </AnimatePresence>

        {config && !hideAssistant && (
          <AiAssistant
            key={config.surface}
            surface={config.surface}
            title={config.title}
            tools={config.tools}
            getSystemPrompt={config.getSystemPrompt}
            placeholder={config.placeholder}
          />
        )}
      </ShellChromeContext.Provider>
    </AssistantSurfaceContext.Provider>
  );
}

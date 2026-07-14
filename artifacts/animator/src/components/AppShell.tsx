/**
 * Unified, phone-first app chrome.
 *
 * Wraps every mode's content in one persistent shell so the user can hop between
 * systems (Danger Room, Voxel Editor, Dressing Room, Lobby, LED Mask) WITHOUT a
 * doors round-trip, and so the AI companion is reachable from everywhere.
 *
 * The shell renders as an overlay fragment (it does not box the mode content —
 * each mode keeps its own fixed/absolute full-screen layout), contributing two
 * things above the scene:
 *   1. a persistent top launcher pill + nav (bottom sheet on phones, dropdown on
 *      pointer devices), safe-area aware with touch-sized targets, and
 *   2. ONE global {@link AiAssistant} dock driven by the active surface's config.
 *
 * Modes that own a live engine (the Dressing Room) register their assistant via
 * {@link useRegisterAssistant}; the shell prefers that child-registered config
 * over the `assistant` base config the host passes for the active mode.
 */
import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Grid3x3, Home, X } from "lucide-react";
import { AiAssistant } from "../ai/AiAssistant";
import { AssistantSurfaceContext, type AssistantConfig } from "../ai/AssistantSurface";
import { useDevice } from "../hooks/useDevice";
import { assetUrl } from "../lib/fleet";
import "./appShell.css";

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
  | "doors"
  | "danger"
  | "voxel"
  | "play"
  | "editor"
  | "lobby"
  | "ledmask"
  | "zones"
  | "brawl"
  | "mimic"
  | "genesis"
  | "voxgrudge-native";

interface NavItem {
  mode: ShellMode;
  label: string;
  hint: string;
  icon: ReactNode;
  tone: string;
}

const NAV: NavItem[] = [
  { mode: "doors", label: "Home", hint: "Facility entrance", icon: <Home size={20} />, tone: "#7fb0ff" },
  { mode: "danger", label: "Danger Room", hint: "Combat sandbox", icon: <Swords size={20} />, tone: "#ff7a7a" },
  { mode: "voxel", label: "Voxel Editor", hint: "Build & test maps", icon: <Boxes size={20} />, tone: "#7ee0a0" },
  { mode: "editor", label: "Dressing Room", hint: "Dress up a rig", icon: <Shirt size={20} />, tone: "#ffb24d" },
  { mode: "lobby", label: "Lobby", hint: "Rooms & community", icon: <Users size={20} />, tone: "#9d8bff" },
  { mode: "zones", label: "GRUDOX Zones", hint: "Shared GRUDOX world", icon: <Globe size={20} />, tone: "#5fe0ff" },
  { mode: "brawl", label: "Ruins Brawler", hint: "Live co-op survival", icon: <Crosshair size={20} />, tone: "#ff7a7a" },
  { mode: "mimic", label: "Test Dungeon", hint: "Mimic encounter", icon: <Boxes size={20} />, tone: "#9cff5a" },
  { mode: "genesis", label: "Warlord Genesis", hint: "Choose race, fight waves", icon: <Swords size={20} />, tone: "#ffd24d" },
  { mode: "voxgrudge-native", label: "VoxGrudge", hint: "Open voxel world", icon: <Boxes size={20} />, tone: "#5fe0ff" },
  { mode: "ledmask", label: "LED Mask", hint: "AI face companion", icon: <ScanFace size={20} />, tone: "#5fe0ff" },
  { mode: "doors",           label: "Home",            hint: "Facility entrance",    icon: <Home size={20} />,                                       tone: "#7fb0ff" },
  { mode: "danger",          label: "Danger Room",     hint: "Combat sandbox",       icon: <GameIcon name="combat-pad"      tone="#ff7a7a" />,          tone: "#ff7a7a" },
  { mode: "genesis",         label: "Warlord Genesis", hint: "Choose race, fight",   icon: <GameIcon name="skill-vfx-lab"   tone="#ffd24d" />,          tone: "#ffd24d" },
  { mode: "brawl",           label: "Ruins Brawler",   hint: "Live co-op survival",  icon: <GameIcon name="attack"          tone="#ff7a7a" />,          tone: "#ff9a7a" },
  { mode: "mimic",           label: "Test Dungeon",    hint: "Mimic encounter",      icon: <GameIcon name="ambush"          tone="#9cff5a" />,          tone: "#9cff5a" },
  { mode: "voxel",           label: "Voxel Editor",    hint: "Build & test maps",    icon: <GameIcon name="world-editor"    tone="#7ee0a0" />,          tone: "#7ee0a0" },
  { mode: "voxgrudge-native",label: "VoxGrudge",       hint: "Open voxel world",     icon: <GameIcon name="explore"         tone="#5fe0ff" />,          tone: "#5fe0ff" },
  { mode: "editor",          label: "Dressing Room",   hint: "Equip & preview",      icon: <GameIcon name="equip"           tone="#ffb24d" />,          tone: "#ffb24d" },
  { mode: "lobby",           label: "Lobby",           hint: "Rooms & community",    icon: <GameIcon name="inventory"       tone="#9d8bff" />,          tone: "#9d8bff" },
  { mode: "zones",           label: "GRUDOX Zones",    hint: "Shared GRUDOX world",  icon: <GameIcon name="loot"            tone="#5fe0ff" />,          tone: "#5fe0ff" },
  { mode: "ledmask",         label: "LED Mask",        hint: "AI face companion",    icon: <GameIcon name="animation-editor" tone="#a78bff" />,         tone: "#a78bff" },
];

/** The launcher pill reflects the active surface (play folds into the editor). */
function activeNav(mode: ShellMode): NavItem {
  if (mode === "play") return { ...NAV[2], label: "Playtest", hint: "Testing your map" };
  return NAV.find((n) => n.mode === mode) ?? NAV[0];
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
  children: ReactNode;
}

export function AppShell({ mode, onNavigate, assistant, hideAssistant, children }: Props) {
  const { deviceClass } = useDevice();
  const phone = deviceClass === "phone";
  const [navOpen, setNavOpen] = useState(false);
  // A mode that owns its engine can override the host-provided config.
  const [override, setOverride] = useState<AssistantConfig | null>(null);

  const surfaceApi = useMemo(() => ({ set: setOverride }), []);
  const current = activeNav(mode);
  const config = override ?? assistant;

  const go = (next: ShellMode) => {
    setNavOpen(false);
    if (next !== mode) onNavigate(next);
  };

  return (
    <AssistantSurfaceContext.Provider value={surfaceApi}>
      {children}

      <button
        className="shell-launcher"
        onClick={() => setNavOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={navOpen}
        title="Switch system"
      >
        <span className="shell-launcher-icon" style={{ color: current.tone }}>
          {navOpen ? <X size={18} /> : current.mode === "doors" ? <Grid3x3 size={18} /> : current.icon}
        </span>
        <span className="shell-launcher-label">{current.label}</span>
        <ChevronDown size={15} className={`shell-launcher-chev ${navOpen ? "open" : ""}`} />
      </button>

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
              <div className="shell-nav-head">Switch system</div>
              <div className="shell-nav-list">
                {NAV.map((item) => {
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
            </motion.div>
          </>
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
    </AssistantSurfaceContext.Provider>
  );
}

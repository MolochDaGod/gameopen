/**
 * Craftpix RPG & MMO UI pack (699601) — texture paths for Open shell + HUD.
 *
 * Source zip: craftpix-net-699601-rpg-mmo-ui.zip
 * PSD masters: PSD Files/RPG & MMO 5 - HUD.psd (+ full / mobile)
 * Shipped: public/ui/mmo-ui-4/** (PNG slices only; PSDs stay authoring-only)
 *
 * Companion art:
 *  - public/hud-tight-bar.png  → threejs-rapier HUD Tight bar (HUD.psd export)
 *  - public/ui/craftpix/**     → 896711 part3/part5 harvest/skills + windows
 */

const BASE = `${import.meta.env.BASE_URL}ui/mmo-ui-4`;

/** Join base + path segments (handles spaces in folder names). */
function mmo(...parts: string[]): string {
  return `${BASE}/${parts.map((p) => p.replace(/^\/+/, "")).join("/")}`;
}

/** MMO UI 4 texture kit (production paths). */
export const MMO = {
  root: BASE,
  actionBar: {
    bg: mmo("Action Bar", "ActionBar_Background.png"),
    globeBg: mmo("Action Bar", "Globes", "ActionBar_Globe_Background.png"),
    globeFill: mmo("Action Bar", "Globes", "ActionBar_Globe_Fill.png"),
    slot: mmo("Action Bar", "Slot", "ActionBar_Slot_Frame.png"),
    btnBg: mmo("Action Bar", "Buttons", "ActionBar_Button_Background.png"),
  },
  window: {
    close: mmo("Window", "Window_CloseBtn_Background.png"),
    closeHover: mmo("Window", "Window_CloseBtn_Hover.png"),
    header: mmo("Window", "Window_Header_RedGrunge.png"),
    headerGlow: mmo("Window", "Window_Header_RedGlow.png"),
    tab: mmo("Window", "Window_Tab_Anchor.png"),
    tabGlow: mmo("Window", "Window_Tab_Glow.png"),
  },
  buttons: {
    primary: mmo("Buttons", "Rectangular", "Button_RL_Background.png"),
    primaryHover: mmo("Buttons", "Rectangular", "Button_RL_Hover.png"),
  },
  unitFrames: {
    // folder exists; specific files discovered at runtime by consumers
  },
  inventory: mmo("Inventory"),
  spellBook: mmo("Spell Book"),
  questLog: mmo("Quest Log"),
  lobby: mmo("Lobby"),
} as const;

/** threejs-rapier HUD Tight bar (exported from HUD.psd). */
export const HUD_ART = {
  tightBar: `${import.meta.env.BASE_URL}hud-tight-bar.png`,
} as const;

/** Craftpix 896711 windows (part 4 / window-PSD family). */
export const CRAFTPIX_WIN = {
  full: `${import.meta.env.BASE_URL}ui/craftpix/windows/c_full.png`,
  header: `${import.meta.env.BASE_URL}ui/craftpix/windows/c_full_header.png`,
  close: `${import.meta.env.BASE_URL}ui/craftpix/windows/c_header_close.png`,
  closeHover: `${import.meta.env.BASE_URL}ui/craftpix/windows/c_header_close-HOVER.png`,
  closePush: `${import.meta.env.BASE_URL}ui/craftpix/windows/c_header_close-PUSH.png`,
} as const;

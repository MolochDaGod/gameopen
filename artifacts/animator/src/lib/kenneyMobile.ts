/**
 * Kenney Mobile Controls 1.0 (CC0) — paths for Open TouchControls + fleet HUD.
 *
 * CDN:  https://assets.grudge-studio.com/ui/kenney/mobile-controls-1/
 * Local: public/ui/kenney/mobile-controls-1/
 *
 * Extends existing TouchControls. Do not invent TouchControls2.
 */

const CDN_ROOT = "https://assets.grudge-studio.com/ui/kenney/mobile-controls-1";
const LOCAL_ROOT = `${import.meta.env.BASE_URL}ui/kenney/mobile-controls-1`;

export const KENNEY_MOBILE_CDN = CDN_ROOT;
export const KENNEY_MOBILE_LOCAL = LOCAL_ROOT;
export const KENNEY_MOBILE_CATALOG = `${CDN_ROOT}/catalog.json`;
export const KENNEY_MOBILE_PREFABS = `${CDN_ROOT}/prefabs.json`;

export function kenneyMobileUrl(rel: string, preferCdn = false): string {
  const base = preferCdn ? CDN_ROOT : LOCAL_ROOT;
  return `${base}/${rel.replace(/^\/+/, "")}`;
}

export const KM = {
  padMove: kenneyMobileUrl("style-a/joystick_circle_pad_a.png"),
  nubMove: kenneyMobileUrl("style-a/joystick_circle_nub_a.png"),
  padSkill: kenneyMobileUrl("style-a/joystick_circle_pad_c.png"),
  nubSkill: kenneyMobileUrl("style-a/joystick_circle_nub_b.png"),
  btnCircle: kenneyMobileUrl("style-a/button_circle.png"),
  btnSquare: kenneyMobileUrl("style-a/button_square.png"),
  btnWide: kenneyMobileUrl("style-a/button_square_wide.png"),
  btnBean: kenneyMobileUrl("style-a/button_bean.png"),
  btnDiamond: kenneyMobileUrl("style-a/button_diamond.png"),
  dirLeft: kenneyMobileUrl("style-a/direction_left.png"),
  dirRight: kenneyMobileUrl("style-a/direction_right.png"),
  hiCircle: kenneyMobileUrl("highlights-a/button_circle_highlight.png"),
  hiPad: kenneyMobileUrl("highlights-a/joystick_circle_pad_highlight.png"),
  iconJump: kenneyMobileUrl("icons/icon_jump.png"),
  iconAttack: kenneyMobileUrl("icons/icon_sword.png"),
  iconBlock: kenneyMobileUrl("icons/icon_shield.png"),
  iconParry: kenneyMobileUrl("icons/icon_burst.png"),
  iconDodge: kenneyMobileUrl("icons/icon_arrow.png"),
  iconSprint: kenneyMobileUrl("icons/icon_arrow_curved.png"),
  iconCrouch: kenneyMobileUrl("icons/icon_size_smaller.png"),
  iconHarvest: kenneyMobileUrl("icons/icon_hand.png"),
  iconCombat: kenneyMobileUrl("icons/icon_sword.png"),
  iconFocus: kenneyMobileUrl("icons/icon_target.png"),
  iconBag: kenneyMobileUrl("icons/icon_key.png"),
  iconMenu: kenneyMobileUrl("icons/icon_menu.png"),
  iconSystems: kenneyMobileUrl("icons/icon_cog.png"),
  iconSkills: kenneyMobileUrl("icons/icon_star.png"),
  iconBuild: kenneyMobileUrl("icons/icon_wrench.png"),
  iconTalk: kenneyMobileUrl("icons/icon_talk.png"),
} as const;

export function kenneyMobileCssVars(): Record<string, string> {
  return {
    "--km-pad-move": `url("${KM.padMove}")`,
    "--km-nub-move": `url("${KM.nubMove}")`,
    "--km-pad-skill": `url("${KM.padSkill}")`,
    "--km-nub-skill": `url("${KM.nubSkill}")`,
    "--km-btn-circle": `url("${KM.btnCircle}")`,
    "--km-btn-square": `url("${KM.btnSquare}")`,
    "--km-btn-wide": `url("${KM.btnWide}")`,
    "--km-btn-bean": `url("${KM.btnBean}")`,
    "--km-dir-left": `url("${KM.dirLeft}")`,
    "--km-dir-right": `url("${KM.dirRight}")`,
    "--km-hi-circle": `url("${KM.hiCircle}")`,
  };
}

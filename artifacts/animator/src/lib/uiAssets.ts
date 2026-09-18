/**
 * UI.* 2D asset roots — same SSOT as ui.grudge-studio.com/ui-assets-ssot.js.
 * Prefer these over emoji / github.io / Google Fonts in production HUD.
 */

export const UI_HOST = "https://ui.grudge-studio.com";
export const ASSETS_CDN = "https://assets.grudge-studio.com";

export const UI_ASSET_ROOTS = {
  craftpixLocal: `${UI_HOST}/assets/craftpix/`,
  craftpixCss: `${ASSETS_CDN}/ui/craftpix-rpg/craftpix-rpg-ui.css`,
  iconsCdn: `${ASSETS_CDN}/game-assets/icons/`,
  professions: `${ASSETS_CDN}/game-assets/icons/professions/`,
  materials: `${ASSETS_CDN}/icons/materials/`,
  fontsCss: `${UI_HOST}/grudge-fonts.css`,
  packsIndex: `${UI_HOST}/game-ui-packs/index.json`,
  hotkeys: `${UI_HOST}/hotkeys`,
  studio: `${UI_HOST}/studio`,
  assetsPage: `${UI_HOST}/assets`,
  ssotJs: `${UI_HOST}/ui-assets-ssot.js`,
} as const;

export function craftpixUrl(rel: string): string {
  return `${UI_ASSET_ROOTS.craftpixLocal}${String(rel || "").replace(/^\/+/, "")}`;
}

export function uiPackUrl(packId: string): string {
  const id = packId.replace(/[^a-z0-9-]/gi, "") || "open";
  return `${UI_HOST}/game-ui-packs/${id}.json`;
}

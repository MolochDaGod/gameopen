// Importer for UI kits exported from ui.grudge-studio.com (the Grudge UI Kit
// editor). The editor's export / editor-state JSON carries a theme id plus
// CSS-variable maps (`baseVars` / `overrides`, `--gk-*` tokens). This module
// maps those tokens onto the animator's HudConfig theme + appearance. Pure —
// unit-testable without a DOM.

import { MAX_GLOW, MAX_RADIUS, MIN_GLOW, MIN_RADIUS, type HudAppearance } from "./hudConfig";
import { isHudThemeId, type HudThemeId } from "./hudThemes";

export interface UiKitImportResult {
  /** Closest animator HUD theme (null = keep the current one). */
  theme: HudThemeId | null;
  /** Appearance overrides extracted from the kit's tokens. */
  appearance: Partial<HudAppearance>;
  /** Human-readable notes about what was (or wasn't) mapped. */
  notes: string[];
}

/** Grudge-kit theme name → the animator theme that best matches its vibe. */
const THEME_MAP: Record<string, string> = {
  cyberpunk: "cyberpunk",
  fantasy: "fantasy",
  rpg: "rpg",
  tactical: "tactical",
  military: "tactical",
  scifi: "default",
  "sci-fi": "default",
  ember: "ember",
  inferno: "ember",
  abyss: "abyss",
  dark: "abyss",
};

/** Accept #rgb/#rrggbb directly; reject anything else (gradients, rgb(), vars). */
function asHex(v: unknown): string | null {
  return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim())
    ? v.trim()
    : null;
}

function asPxNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.trim().match(/^(-?\d+(?:\.\d+)?)(px)?$/);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Parse one exported UI-kit JSON blob. Accepts both the editor's full export
 * (`{theme, baseVars, overrides, fontScale, …}`) and the raw editor-state
 * (`{theme, overrides, frames, …}`). Unknown fields are ignored; nothing here
 * throws on hostile input — a completely unusable blob returns an error note.
 */
export function parseUiKitExport(raw: unknown): UiKitImportResult {
  const notes: string[] = [];
  const out: UiKitImportResult = { theme: null, appearance: {}, notes };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    notes.push("Not a UI-kit JSON object — nothing imported.");
    return out;
  }
  const obj = raw as {
    theme?: unknown;
    baseVars?: unknown;
    overrides?: unknown;
    fontScale?: unknown;
  };

  // Theme: map the kit's theme name onto the closest animator preset.
  if (typeof obj.theme === "string") {
    const mapped = THEME_MAP[obj.theme.toLowerCase().trim()];
    if (mapped && isHudThemeId(mapped)) {
      out.theme = mapped;
      notes.push(`Theme "${obj.theme}" → ${mapped}.`);
    } else {
      notes.push(`Theme "${obj.theme}" has no animator equivalent — theme kept.`);
    }
  }

  // Tokens: overrides win over baseVars.
  const vars: Record<string, unknown> = {};
  for (const src of [obj.baseVars, obj.overrides]) {
    if (src && typeof src === "object" && !Array.isArray(src)) Object.assign(vars, src);
  }

  const accent = asHex(vars["--gk-accent"]);
  if (accent) out.appearance.accent = accent;
  const accent2 = asHex(vars["--gk-accent-2"]);
  if (accent2) out.appearance.accent2 = accent2;
  const radius = asPxNumber(vars["--gk-radius"]);
  if (radius != null) out.appearance.radius = clamp(radius, MIN_RADIUS, MAX_RADIUS);
  const glow = asPxNumber(vars["--gk-glow"]);
  if (glow != null) out.appearance.glow = clamp(glow, MIN_GLOW, MAX_GLOW);

  const mappedCount = Object.keys(out.appearance).length;
  if (mappedCount === 0 && out.theme === null) {
    notes.push("No recognizable theme or --gk-* tokens found.");
  } else if (mappedCount > 0) {
    notes.push(`Imported ${mappedCount} appearance token${mappedCount === 1 ? "" : "s"}.`);
  }
  const skipped = ["frames", "systemConfig", "layout", "skillSet", "artPreset"].filter(
    (k) => (raw as Record<string, unknown>)[k] !== undefined,
  );
  if (skipped.length) {
    notes.push(
      `Kit sections not portable as appearance tokens (skipped): ${skipped.join(", ")}. Place widgets with hud/viewGrid.ts (HYDRA 1920×1080 · 12×12).`,
    );
  }
  return out;
}

/** True when the parse produced anything applicable. */
export function uiKitImportHasChanges(r: UiKitImportResult): boolean {
  return r.theme !== null || Object.keys(r.appearance).length > 0;
}

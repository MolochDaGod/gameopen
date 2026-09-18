/**
 * Import keybindings exported from ui.grudge-studio.com/hotkeys (Input Configurator).
 * Overlay only — does not replace Controller combat keys unless action names match.
 */

export const UI_HOTKEYS_KEY = "grudge:ui-hotkeys";

export type UiHotkeyBinding = {
  action: string;
  keys: string;
  category?: string;
};

export type UiHotkeysBlob = {
  packId?: string;
  profile?: string;
  bindings: UiHotkeyBinding[];
};

function asKeys(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 24);
  if (raw && typeof raw === "object") {
    const o = raw as { key?: unknown; code?: unknown };
    if (typeof o.key === "string" && o.key.trim()) return o.key.trim().slice(0, 24);
    if (typeof o.code === "string" && o.code.trim()) return o.code.trim().slice(0, 24);
  }
  return null;
}

/** Parse Input Configurator / pack export. Never throws. */
export function parseUiHotkeysExport(raw: unknown): UiHotkeysBlob {
  const bindings: UiHotkeyBinding[] = [];
  if (!raw || typeof raw !== "object") return { bindings };
  const obj = raw as Record<string, unknown>;
  const packId = typeof obj.packId === "string" ? obj.packId : typeof obj.id === "string" ? obj.id : undefined;
  const profile =
    typeof obj.profile === "string"
      ? obj.profile
      : typeof (obj.meta as { inputProfile?: string } | undefined)?.inputProfile === "string"
        ? (obj.meta as { inputProfile: string }).inputProfile
        : undefined;

  const list = Array.isArray(obj.bindings)
    ? obj.bindings
    : Array.isArray(obj.hotkeys)
      ? obj.hotkeys
      : null;
  if (list) {
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const action = typeof r.action === "string" ? r.action.trim() : "";
      const keys = asKeys(r.keys ?? r.key ?? r.code);
      if (!action || !keys) continue;
      bindings.push({
        action: action.slice(0, 48),
        keys,
        category: typeof r.category === "string" ? r.category : undefined,
      });
    }
  }

  const actions = obj.actions;
  if (actions && typeof actions === "object" && !Array.isArray(actions)) {
    for (const [action, v] of Object.entries(actions as Record<string, unknown>)) {
      const keys = asKeys(v);
      if (!keys) continue;
      bindings.push({ action: action.slice(0, 48), keys });
    }
  }

  return { packId, profile, bindings };
}

export function saveUiHotkeys(blob: UiHotkeysBlob): void {
  try {
    localStorage.setItem(UI_HOTKEYS_KEY, JSON.stringify(blob));
  } catch {
    /* */
  }
}

export function loadUiHotkeys(): UiHotkeysBlob {
  try {
    const raw = localStorage.getItem(UI_HOTKEYS_KEY);
    if (!raw) return { bindings: [] };
    return parseUiHotkeysExport(JSON.parse(raw));
  } catch {
    return { bindings: [] };
  }
}

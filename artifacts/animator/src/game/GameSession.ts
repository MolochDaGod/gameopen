/**
 * Lightweight session state: selected mode, fleet account, character, AI profiles.
 * No Three.js — pure data for React HUD + Studio host.
 */

import { getMode, type GameModeDef, type GameModeId } from "./modes";
import { biasForStrategy, profileForStrategy } from "./strategyProfiles";
import type { FighterBias } from "../three/ai/FighterBrain";
import type { GrudgeAccount, GrudgeCharacter } from "../lib/grudgeAuth";
import { fetchCharacters, initFleetAuth } from "../lib/grudgeAuth";
import { loadGrudoxCharacters } from "../lib/grudoxRoster";

export type GameSessionSnapshot = {
  mode: GameModeDef;
  account: GrudgeAccount | null;
  characters: GrudgeCharacter[];
  selectedCharacterId: string | null;
  enemyBias: FighterBias;
  allyBias: FighterBias;
  bossBias: FighterBias;
  ready: boolean;
  /** Auto-provisioned Crossmint custodial wallet address for this account. */
  walletAddress: string | null;
};

type Listener = () => void;

/** Session-scoped key persisting the active fleet character across surfaces. */
const SELECTED_CHAR_KEY = "grudge.open.selectedCharacterId";
/** Guest / draft characters created from charactersgrudox race kit. */
const LOCAL_CHARS_KEY = "grudge.open.localChars";

function loadLocalCharacters(): GrudgeCharacter[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHARS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as GrudgeCharacter[];
    return Array.isArray(arr) ? arr.filter((c) => c && c.id && c.name) : [];
  } catch {
    return [];
  }
}

/**
 * Hero roster SSOT for Warlords-era client.
 * Order: charactersgrudox 4-slot campfire → local drafts → Railway fleet (era=warlords).
 * Explorers / faction troops are units (see harvestCatalog.listUnitCharacters), not heroes.
 */
function mergeRoster(fleet: GrudgeCharacter[]): GrudgeCharacter[] {
  const grudox = loadGrudoxCharacters();
  const local = loadLocalCharacters();
  const seen = new Set<string>();
  const out: GrudgeCharacter[] = [];
  for (const c of [...grudox, ...local, ...fleet]) {
    if (!c?.id || seen.has(c.id)) continue;
    // Never treat procedural explorer ids as campfire heroes
    if (c.id === "explorer" || c.id.startsWith("unit-")) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

function loadSelectedCharacterId(): string | null {
  try {
    return (
      sessionStorage.getItem(SELECTED_CHAR_KEY) ||
      localStorage.getItem(SELECTED_CHAR_KEY)
    );
  } catch {
    return null;
  }
}

function storeSelectedCharacterId(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(SELECTED_CHAR_KEY, id);
      localStorage.setItem(SELECTED_CHAR_KEY, id);
    } else {
      sessionStorage.removeItem(SELECTED_CHAR_KEY);
      localStorage.removeItem(SELECTED_CHAR_KEY);
    }
  } catch {
    /* private mode */
  }
}

class GameSession {
  private modeId: GameModeId = "danger-room";
  private account: GrudgeAccount | null = null;
  private characters: GrudgeCharacter[] = [];
  private selectedCharacterId: string | null = loadSelectedCharacterId();
  private ready = false;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  get snapshot(): GameSessionSnapshot {
    const mode = getMode(this.modeId);
    // Wallet address read from sessionStorage cache (set by walletService.ensureWallet).
    let walletAddress: string | null = null;
    try {
      const raw = sessionStorage.getItem("grudge.open.wallet");
      if (raw) walletAddress = (JSON.parse(raw) as { address?: string }).address ?? null;
    } catch { /* */ }
    return {
      mode,
      account: this.account,
      characters: this.characters,
      selectedCharacterId: this.selectedCharacterId,
      enemyBias: biasForStrategy(mode.enemyStrategy),
      allyBias: biasForStrategy(mode.allyStrategy),
      bossBias: biasForStrategy(mode.bossStrategy),
      ready: this.ready,
      walletAddress,
    };
  }

  setMode(id: GameModeId) {
    this.modeId = id;
    this.emit();
  }

  selectCharacter(id: string | null) {
    this.selectedCharacterId = id;
    storeSelectedCharacterId(id);
    this.emit();
  }

  /**
   * Patch a roster character in-memory (e.g. after equipment/save write).
   * Keeps loadout apply + UI in sync without a full roster refetch.
   */
  patchCharacter(id: string, patch: Partial<GrudgeCharacter>): void {
    if (!id) return;
    const idx = this.characters.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const prev = this.characters[idx];
    this.characters[idx] = {
      ...prev,
      ...patch,
      config: patch.config ? { ...(prev.config || {}), ...patch.config } : prev.config,
      saveData: patch.saveData
        ? { ...(prev.saveData || {}), ...patch.saveData }
        : prev.saveData,
    };
    // Persist local drafts if this is a guest/local character
    if (id.startsWith("local-") || id.startsWith("draft-")) {
      try {
        const local = loadLocalCharacters().map((c) =>
          c.id === id ? this.characters[idx] : c,
        );
        if (!local.some((c) => c.id === id)) local.unshift(this.characters[idx]);
        localStorage.setItem(LOCAL_CHARS_KEY, JSON.stringify(local.slice(0, 24)));
      } catch {
        /* */
      }
    }
    this.emit();
  }

  /** The active fleet character record, or null when none is selected/loaded. */
  selectedCharacter(): GrudgeCharacter | null {
    if (!this.selectedCharacterId) return null;
    return this.characters.find((c) => c.id === this.selectedCharacterId) ?? null;
  }

  /** Clear account/character selection (logout). Keeps local guest drafts. */
  clearAuthSession(): void {
    this.account = null;
    // Drop fleet-only rows; keep local drafts for guest play
    this.characters = loadLocalCharacters();
    this.selectedCharacterId = this.characters[0]?.id ?? null;
    storeSelectedCharacterId(this.selectedCharacterId);
    this.emit();
  }

  async boot(): Promise<GameSessionSnapshot> {
    const { account, characters } = await initFleetAuth();
    this.account = account;
    this.characters = mergeRoster(characters);
    // Prefer handoff characterId (charactersgrudox / GCS) already written to storage
    const preferred = loadSelectedCharacterId();
    if (preferred && this.characters.some((c) => c.id === preferred)) {
      this.selectedCharacterId = preferred;
    } else if (this.selectedCharacterId && !this.characters.some((c) => c.id === this.selectedCharacterId)) {
      this.selectedCharacterId = null;
    }
    if (!this.selectedCharacterId && this.characters[0]) {
      this.selectedCharacterId = this.characters[0].id;
    }
    storeSelectedCharacterId(this.selectedCharacterId);
    this.ready = true;
    this.emit();
    return this.snapshot;
  }

  /**
   * Re-pull the fleet character roster from the SSOT
   * (`grudgeAuth.fetchCharacters()`) and reconcile the active selection. Used by
   * the Lobby character picker's reload action.
   */
  async refreshCharacters(): Promise<GrudgeCharacter[]> {
    const characters = await fetchCharacters();
    this.characters = mergeRoster(characters);
    if (this.selectedCharacterId && !this.characters.some((c) => c.id === this.selectedCharacterId)) {
      this.selectedCharacterId = this.characters[0]?.id ?? null;
    } else if (!this.selectedCharacterId && this.characters[0]) {
      this.selectedCharacterId = this.characters[0].id;
    }
    storeSelectedCharacterId(this.selectedCharacterId);
    this.emit();
    return this.characters;
  }

  /**
   * Upsert a draft/local character (charactersgrudox create flow) and select it.
   * Persists under localStorage; merged ahead of fleet roster on boot/refresh.
   */
  upsertLocalCharacter(ch: GrudgeCharacter): void {
    const local = loadLocalCharacters().filter((c) => c.id !== ch.id);
    local.unshift(ch);
    try {
      localStorage.setItem(LOCAL_CHARS_KEY, JSON.stringify(local.slice(0, 24)));
    } catch {
      /* */
    }
    const without = this.characters.filter((c) => c.id !== ch.id);
    this.characters = [ch, ...without];
    this.selectCharacter(ch.id);
  }

  /** Enemy AI profile for current mode (host uses for FighterBrain bias). */
  enemyProfile() {
    return profileForStrategy(getMode(this.modeId).enemyStrategy);
  }

  allyProfile() {
    return profileForStrategy(getMode(this.modeId).allyStrategy);
  }

  bossProfile() {
    return profileForStrategy(getMode(this.modeId).bossStrategy);
  }
}

export const gameSession = new GameSession();

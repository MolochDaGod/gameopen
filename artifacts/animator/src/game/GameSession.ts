/**
 * Lightweight session state: selected mode, fleet account, character, AI profiles.
 * No Three.js — pure data for React HUD + Studio host.
 */

import { getMode, type GameModeDef, type GameModeId } from "./modes";
import { biasForStrategy, profileForStrategy } from "./strategyProfiles";
import type { FighterBias } from "../three/ai/FighterBrain";
import type { GrudgeAccount, GrudgeCharacter } from "../lib/grudgeAuth";
import { initFleetAuth } from "../lib/grudgeAuth";

export type GameSessionSnapshot = {
  mode: GameModeDef;
  account: GrudgeAccount | null;
  characters: GrudgeCharacter[];
  selectedCharacterId: string | null;
  enemyBias: FighterBias;
  allyBias: FighterBias;
  bossBias: FighterBias;
  ready: boolean;
};

type Listener = () => void;

class GameSession {
  private modeId: GameModeId = "danger-room";
  private account: GrudgeAccount | null = null;
  private characters: GrudgeCharacter[] = [];
  private selectedCharacterId: string | null = null;
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
    return {
      mode,
      account: this.account,
      characters: this.characters,
      selectedCharacterId: this.selectedCharacterId,
      enemyBias: biasForStrategy(mode.enemyStrategy),
      allyBias: biasForStrategy(mode.allyStrategy),
      bossBias: biasForStrategy(mode.bossStrategy),
      ready: this.ready,
    };
  }

  setMode(id: GameModeId) {
    this.modeId = id;
    this.emit();
  }

  selectCharacter(id: string | null) {
    this.selectedCharacterId = id;
    this.emit();
  }

  async boot(): Promise<GameSessionSnapshot> {
    const { account, characters } = await initFleetAuth();
    this.account = account;
    this.characters = characters;
    if (!this.selectedCharacterId && characters[0]) {
      this.selectedCharacterId = characters[0].id;
    }
    this.ready = true;
    this.emit();
    return this.snapshot;
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

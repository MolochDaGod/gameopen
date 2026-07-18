/**
 * Last-standing match FSM for VoxGrudge Battle (pure data).
 * Host (Three scene) owns meshes; this owns win rules + countdown + placement.
 */

import type {
  BattleFighterLive,
  BattleFighterSpec,
  BattleHudSnapshot,
  BattleLoadout,
  BattleMode,
  BattlePhase,
} from "./types";
import { DEFAULT_BATTLE_HP, MAX_BATTLE_PLAYERS } from "./types";

export type MatchEvent =
  | { t: "countdown"; n: number }
  | { t: "fight" }
  | { t: "elim"; id: string; by: string | null; alive: number }
  | { t: "win"; winnerIds: string[]; winnerName: string; team: number }
  | { t: "localDown"; placement: number };

export class BattleMatch {
  phase: BattlePhase = "lobby";
  mode: BattleMode = "singles";
  fighters = new Map<string, BattleFighterLive>();
  private countdown = 0;
  private killFeed: string[] = [];
  private winnerName: string | null = null;
  private winnerTeam: number | null = null;
  private localPlacement: number | null = null;
  private elapsed = 0;
  minimapOpen = false;
  loadError: string | null = null;
  primary: BattleLoadout["primary"] = "sword";
  sidearm: BattleLoadout["sidearm"] = "pistol";
  usingSidearm = false;
  skills: BattleHudSnapshot["skills"] = [
    { slot: 1, label: "Combo", cd: 0, cdMax: 1.6, ready: true },
    { slot: 2, label: "Special", cd: 0, cdMax: 2.8, ready: true },
    { slot: 3, label: "Ranged", cd: 0, cdMax: 2.2, ready: true },
    { slot: 4, label: "Power", cd: 0, cdMax: 4.5, ready: true },
  ];

  resetLobby(mode: BattleMode, loadout: BattleLoadout) {
    this.phase = "lobby";
    this.mode = mode;
    this.fighters.clear();
    this.countdown = 0;
    this.killFeed = [];
    this.winnerName = null;
    this.winnerTeam = null;
    this.localPlacement = null;
    this.elapsed = 0;
    this.primary = loadout.primary;
    this.sidearm = loadout.sidearm;
    this.usingSidearm = false;
    this.loadError = null;
  }

  armFighters(specs: BattleFighterSpec[]) {
    this.fighters.clear();
    for (const s of specs) {
      this.fighters.set(s.id, {
        id: s.id,
        alive: true,
        hp: DEFAULT_BATTLE_HP,
        maxHp: DEFAULT_BATTLE_HP,
        x: s.spawn.x,
        y: s.spawn.y,
        z: s.spawn.z,
        yaw: s.spawn.yaw,
        kills: 0,
        team: s.team,
        name: s.name,
        isBot: s.isBot,
        isLocal: s.isLocal,
        color: s.color,
        usingSidearm: false,
      });
    }
  }

  startCountdown(sec = 5) {
    this.phase = "countdown";
    this.countdown = sec;
    this.winnerName = null;
    this.winnerTeam = null;
    this.localPlacement = null;
  }

  /** Advance match. Returns events for SFX / kill feed UI. */
  update(dt: number): MatchEvent[] {
    const events: MatchEvent[] = [];
    this.elapsed += dt;

    // skill CDs
    for (const sk of this.skills) {
      if (sk.cd > 0) {
        sk.cd = Math.max(0, sk.cd - dt);
        sk.ready = sk.cd <= 0;
      }
    }

    if (this.phase === "countdown") {
      const prev = Math.ceil(this.countdown);
      this.countdown -= dt;
      const next = Math.ceil(this.countdown);
      if (next < prev && next > 0) events.push({ t: "countdown", n: next });
      if (this.countdown <= 0) {
        this.phase = "alive";
        this.countdown = 0;
        events.push({ t: "fight" });
      }
      return events;
    }

    if (this.phase !== "alive" && this.phase !== "spectate") return events;

    const win = this.checkWin();
    if (win) {
      this.phase = "result";
      this.winnerName = win.name;
      this.winnerTeam = win.team;
      events.push({
        t: "win",
        winnerIds: win.ids,
        winnerName: win.name,
        team: win.team,
      });
    }
    return events;
  }

  applyDamage(
    targetId: string,
    amount: number,
    byId: string | null,
  ): MatchEvent[] {
    if (this.phase !== "alive" && this.phase !== "spectate") return [];
    const t = this.fighters.get(targetId);
    if (!t || !t.alive) return [];
    // friendly fire off for same team
    if (byId) {
      const atk = this.fighters.get(byId);
      if (atk && atk.team === t.team) return [];
    }
    t.hp = Math.max(0, t.hp - amount);
    if (t.hp > 0) return [];

    t.alive = false;
    t.hp = 0;
    if (byId) {
      const atk = this.fighters.get(byId);
      if (atk) atk.kills += 1;
    }
    const alive = this.aliveCount();
    const events: MatchEvent[] = [
      {
        t: "elim",
        id: targetId,
        by: byId,
        alive,
      },
    ];
    const killer = byId ? this.fighters.get(byId)?.name : null;
    this.killFeed.unshift(
      killer ? `${killer} eliminated ${t.name}` : `${t.name} was eliminated`,
    );
    if (this.killFeed.length > 8) this.killFeed.length = 8;

    if (t.isLocal) {
      this.localPlacement = alive + 1;
      this.phase = "spectate";
      events.push({ t: "localDown", placement: this.localPlacement });
    }

    const win = this.checkWin();
    if (win) {
      this.phase = "result";
      this.winnerName = win.name;
      this.winnerTeam = win.team;
      if (t.isLocal === false && win.ids.includes("local-player")) {
        this.localPlacement = 1;
      }
      events.push({
        t: "win",
        winnerIds: win.ids,
        winnerName: win.name,
        team: win.team,
      });
    }
    return events;
  }

  setPose(id: string, x: number, y: number, z: number, yaw: number) {
    const f = this.fighters.get(id);
    if (!f) return;
    f.x = x;
    f.y = y;
    f.z = z;
    f.yaw = yaw;
  }

  toggleMinimap() {
    this.minimapOpen = !this.minimapOpen;
  }

  setMinimap(open: boolean) {
    this.minimapOpen = open;
  }

  swapWeapon() {
    this.usingSidearm = !this.usingSidearm;
    const local = [...this.fighters.values()].find((f) => f.isLocal);
    if (local) local.usingSidearm = this.usingSidearm;
  }

  trySkill(slot: 1 | 2 | 3 | 4): boolean {
    const sk = this.skills.find((s) => s.slot === slot);
    if (!sk || !sk.ready || this.phase !== "alive") return false;
    sk.cd = sk.cdMax;
    sk.ready = false;
    return true;
  }

  aliveCount(): number {
    if (this.mode === "singles") {
      return [...this.fighters.values()].filter((f) => f.alive).length;
    }
    // duos: count teams with ≥1 alive
    const teams = new Set<number>();
    for (const f of this.fighters.values()) {
      if (f.alive) teams.add(f.team);
    }
    return teams.size;
  }

  private checkWin(): { ids: string[]; name: string; team: number } | null {
    if (this.mode === "singles") {
      const alive = [...this.fighters.values()].filter((f) => f.alive);
      if (alive.length === 1) {
        const w = alive[0]!;
        return { ids: [w.id], name: w.name, team: w.team };
      }
      return null;
    }
    const byTeam = new Map<number, BattleFighterLive[]>();
    for (const f of this.fighters.values()) {
      if (!f.alive) continue;
      let arr = byTeam.get(f.team);
      if (!arr) {
        arr = [];
        byTeam.set(f.team, arr);
      }
      arr.push(f);
    }
    if (byTeam.size === 1) {
      const [team, members] = [...byTeam.entries()][0]!;
      return {
        ids: members.map((m) => m.id),
        name: members.map((m) => m.name).join(" & "),
        team,
      };
    }
    return null;
  }

  snapshot(): BattleHudSnapshot {
    const local = [...this.fighters.values()].find((f) => f.isLocal);
    return {
      phase: this.phase,
      mode: this.mode,
      aliveCount: this.aliveCount(),
      maxPlayers: Math.min(MAX_BATTLE_PLAYERS, this.fighters.size || 16),
      localHp: local?.hp ?? 0,
      localMaxHp: local?.maxHp ?? DEFAULT_BATTLE_HP,
      localKills: local?.kills ?? 0,
      placement: this.localPlacement,
      countdown: Math.max(0, this.countdown),
      winnerName: this.winnerName,
      winnerTeam: this.winnerTeam,
      minimapOpen: this.minimapOpen,
      fighters: [...this.fighters.values()],
      primary: this.primary,
      sidearm: this.sidearm,
      usingSidearm: this.usingSidearm,
      skills: this.skills.map((s) => ({ ...s })),
      killFeed: [...this.killFeed],
      loadError: this.loadError,
    };
  }
}

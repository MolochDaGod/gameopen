import { describe, expect, it } from "vitest";
import { BattleMatch } from "./BattleMatch";
import { buildBattleRoster } from "./botRoster";
import { DEFAULT_BATTLE_LOADOUT } from "./weaponLoadout";

describe("BattleMatch", () => {
  it("singles ends when one fighter remains", () => {
    const m = new BattleMatch();
    m.resetLobby("singles", DEFAULT_BATTLE_LOADOUT);
    const roster = buildBattleRoster({
      mode: "singles",
      playerSlots: 4,
      seed: "test-seed",
      localName: "Hero",
      localRaceId: "human",
      localLoadout: DEFAULT_BATTLE_LOADOUT,
      spawnRadius: 40,
    });
    m.armFighters(roster);
    m.startCountdown(0.01);
    m.update(0.05);
    expect(m.phase).toBe("alive");

    const ids = roster.map((r) => r.id).filter((id) => id !== "local-player");
    for (const id of ids) {
      m.applyDamage(id, 999, "local-player");
    }
    expect(m.phase).toBe("result");
    expect(m.snapshot().winnerName).toBe("Hero");
    expect(m.snapshot().localKills).toBe(3);
  });

  it("duos win by team", () => {
    const m = new BattleMatch();
    m.resetLobby("duos", DEFAULT_BATTLE_LOADOUT);
    const roster = buildBattleRoster({
      mode: "duos",
      playerSlots: 4,
      seed: "duo-seed",
      localName: "A",
      localRaceId: "human",
      localLoadout: DEFAULT_BATTLE_LOADOUT,
      spawnRadius: 40,
    });
    m.armFighters(roster);
    m.startCountdown(0.01);
    m.update(0.05);
    // eliminate other team(s)
    for (const r of roster) {
      if (r.team !== 0) m.applyDamage(r.id, 999, "local-player");
    }
    expect(m.phase).toBe("result");
    expect(m.snapshot().winnerTeam).toBe(0);
  });
});

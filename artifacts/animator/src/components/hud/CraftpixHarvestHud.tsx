/**
 * Craftpix Part_3 harvest/build HUD — production layout.
 *
 * Left action row:
 *   Slot 1 = equipped harvest tool (hold R radial to change)
 *   Slots 2–5 = that tool's task skills (keys 1–4)
 *
 * Right action row:
 *   J / H / V = bag utility (consumables · deployables · mounts/vehicles)
 *   Smaller final slot = inventory bag + production shell entry
 */
import type { HudSnapshot } from "../../three/types";
import {
  MODE_COLOR,
  MODE_LABEL,
  RADIAL_BY_MODE,
  toolSkillsFor,
  type PlayerActivityMode,
} from "../../three/playerMode";
import { portraitOnError } from "../../lib/characterPortrait";
import { getGbux } from "../../lib/gbux";
import { loadSkillUnlocks } from "../../game/harvestCatalog";
import { opIconUrl } from "../../lib/gameMedia";
import { getItemTemplate, UTILITY_HOTKEY_KEYS, type ItemInstance } from "../../game/inventory";
import "./craftpixHud.css";

export interface CraftpixHarvestHudProps {
  hud: HudSnapshot;
  mode: PlayerActivityMode;
  onSelectTool?: (id: string) => void;
  /** Fire tool skill index 0–3 (left slots 2–5). */
  onToolSkill?: (skillIndex: number) => void;
  onOpenProduction?: () => void;
  /** Open character 3×3 bag (far-right button). */
  onOpenBag?: () => void;
  /** Illuminate bag / deposit when in claim, camp, boat. */
  canDeposit?: boolean;
  bagOccupied?: number;
  bagCapacity?: number;
  /** Live J/H/V bindings from character bag. */
  utilitySlots?: (ItemInstance | null)[];
}

/** Profession level from unlock counts (local trees until Railway professions). */
function professionLevels(unlocks: string[]): { id: string; name: string; level: number }[] {
  const groups: { id: string; name: string; prefix: string }[] = [
    { id: "harvest", name: "Harvest", prefix: "h_" },
    { id: "crafting", name: "Craft", prefix: "c_" },
    { id: "building", name: "Build", prefix: "b_" },
    { id: "survival", name: "Survive", prefix: "s_" },
    { id: "explorer", name: "Explore", prefix: "e_" },
  ];
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    level: Math.max(1, unlocks.filter((u) => u.startsWith(g.prefix)).length),
  }));
}

export function CraftpixHarvestHud({
  hud,
  mode,
  onSelectTool,
  onToolSkill,
  onOpenProduction,
  onOpenBag,
  canDeposit = false,
  bagOccupied = 0,
  bagCapacity = 9,
  utilitySlots = [null, null, null],
}: CraftpixHarvestHudProps) {
  const tools = RADIAL_BY_MODE[mode] ?? RADIAL_BY_MODE.harvest;
  const equippedId = hud.activityTool || tools[0]?.id || "gather";
  const equipped =
    tools.find((t) => t.id === equippedId) ??
    tools[0] ??
    ({ id: equippedId, label: equippedId, glyph: "⚒", color: "#7ee7a8" } as const);

  const skills = mode === "harvest" ? toolSkillsFor(equippedId) : tools.slice(1, 5);
  const unlocks = loadSkillUnlocks();
  const profs = professionLevels(unlocks);
  const gold = getGbux();
  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const spPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const mpPct = Math.max(0, Math.min(100, ((hud.mana ?? 0) / Math.max(1, hud.maxMana ?? 1)) * 100));
  const o2Pct = Math.max(0, Math.min(100, ((hud.oxygen ?? 0) / Math.max(1, hud.maxOxygen ?? 1)) * 100));
  const huPct = Math.max(0, Math.min(100, ((hud.hunger ?? 0) / Math.max(1, hud.maxHunger ?? 1)) * 100));
  const thPct = Math.max(0, Math.min(100, ((hud.thirst ?? 0) / Math.max(1, hud.maxThirst ?? 1)) * 100));
  const ar = hud.armor ?? 0;
  const xpPct = Math.min(100, unlocks.length * 6);
  const modeColor = MODE_COLOR[mode];

  const util = [0, 1, 2].map((i) => {
    const item = utilitySlots[i] ?? null;
    const tpl = item ? getItemTemplate(item.templateId) : null;
    return {
      key: UTILITY_HOTKEY_KEYS[i]!,
      item,
      tpl,
      empty: !item,
    };
  });

  return (
    <div className="cx-hud" data-mode={mode}>
      <div className="cx-harvest-bar" role="toolbar" aria-label={`${MODE_LABEL[mode]} tools`}>
        <div className="cx-ab3">
          {/* Left: HP + SP (craftpix ab3 stat frames) */}
          <div className="cx-ab3-left">
            <div className="cx-stat cx-stat-hp" title="Health">
              <div className="cx-stat-track">
                <div className="cx-stat-fill hp" style={{ height: `${hpPct}%` }} />
              </div>
              <span className="cx-stat-label">
                HP {Math.round(hud.health)}/{hud.maxHealth}
              </span>
            </div>
            <div className="cx-stat cx-stat-sp" title="Stamina">
              <div className="cx-stat-track">
                <div className="cx-stat-fill sp" style={{ height: `${spPct}%` }} />
              </div>
              <span className="cx-stat-label">
                SP {Math.round(hud.stamina)}/{hud.maxStamina}
              </span>
            </div>
            <div className="cx-stat cx-stat-mp" title="Mana">
              <div className="cx-stat-track">
                <div className="cx-stat-fill mp" style={{ height: `${mpPct}%` }} />
              </div>
              <span className="cx-stat-label">
                MP {Math.round(hud.mana ?? 0)}/{hud.maxMana ?? 0}
              </span>
            </div>
            <div className="cx-need-row" title={`Armour ${ar} · O2 ${Math.round(hud.oxygen ?? 0)} · Hunger ${Math.round(hud.hunger ?? 0)} · Thirst ${Math.round(hud.thirst ?? 0)}`}>
              <span>AR {ar}</span>
              <span>O2 {Math.round(o2Pct)}%</span>
              <span>HU {Math.round(huPct)}%</span>
              <span>TH {Math.round(thPct)}%</span>
            </div>
          </div>

          {/* Center: avatar + gold + professions + tool/skills bar */}
          <div className="cx-ab3-center">
            <div className="cx-avatar-block">
              <div className="cx-avatar-ring">
                {hud.portraitUrl ? (
                  <img
                    src={hud.portraitUrl}
                    alt={hud.character}
                    draggable={false}
                    onError={(e) =>
                      portraitOnError(e.currentTarget, hud.portraitCandidates ?? [])
                    }
                  />
                ) : (
                  <span className="cx-avatar-letter">
                    {(hud.character || "E").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="cx-meta">
                <span className="cx-name">{hud.character}</span>
                <span className="cx-mode" style={{ color: modeColor }}>
                  {MODE_LABEL[mode]} · {equipped.label || equippedId}
                </span>
                <span className="cx-gold-row" title="Gold (GBUX)">
                  <img src="/ui/craftpix/part3/resources/coin.png" alt="" />
                  {gold.toLocaleString()}
                </span>
                <div className="cx-prof-row" aria-label="Profession levels">
                  {profs.slice(0, 4).map((p) => (
                    <span key={p.id} className="cx-prof">
                      {p.name}
                      <b>L{p.level}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Slot 1 tool + slots 2–5 tool skills */}
            <div className="cx-tool-slots" aria-label="Harvest tool and skills">
              <button
                type="button"
                className="cx-tool is-equipped is-on"
                title={`${equipped.label} · hold R for tool radial`}
                onClick={() => onSelectTool?.(equipped.id)}
              >
                <span className="cx-tool-key">R</span>
                <img
                  className="cx-tool-icon"
                  src={opIconUrl(equipped.id)}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.dataset.broken = "1";
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="cx-tool-glyph" aria-hidden>
                  {equipped.glyph}
                </span>
              </button>
              {skills.slice(0, 4).map((sk, i) => (
                <button
                  key={sk.id}
                  type="button"
                  className="cx-tool is-skill"
                  title={`${sk.label} (${i + 1})`}
                  onClick={() => {
                    if (mode === "harvest") onToolSkill?.(i);
                    else onSelectTool?.(sk.id);
                  }}
                >
                  <span className="cx-tool-key">{String(i + 1)}</span>
                  <img
                    className="cx-tool-icon"
                    src={opIconUrl(sk.id)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.dataset.broken = "1";
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="cx-tool-glyph" aria-hidden>
                    {sk.glyph}
                  </span>
                </button>
              ))}
            </div>

            <div className="cx-xp" title="Profession progress">
              <div className="cx-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </div>

          {/* Right: J H V utility · smaller bag (craft / inventory) */}
          <div className="cx-ab3-right">
            <div className="cx-utility-row" aria-label="Utility slots J H V">
              {util.map((u) => (
                <button
                  key={u.key}
                  type="button"
                  className={"cx-tool cx-tool-util" + (u.empty ? " is-empty" : " is-equipped")}
                  title={
                    u.tpl
                      ? `${u.tpl.name} ×${u.item?.qty ?? 1} (${u.key})`
                      : `${u.key} · drag bag item (consumable / deploy / mount)`
                  }
                >
                  <span className="cx-tool-key">{u.key}</span>
                  {u.tpl && (
                    <img
                      className="cx-tool-icon"
                      src={u.tpl.icon || "/icons/pack/misc/Effect.png"}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.dataset.broken = "1";
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <span className="cx-tool-glyph" aria-hidden>
                    {u.empty ? "·" : u.tpl?.kind === "mount" ? "🐴" : u.tpl?.kind === "boat" ? "⛵" : "✦"}
                  </span>
                  {u.item && u.item.qty > 1 && (
                    <span className="cx-bag-badge">{u.item.qty}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="cx-bag-craft-row">
              {onOpenProduction && (
                <button
                  type="button"
                  className="cx-tool cx-tool-prod"
                  title="Production shell (P) — craft · recipes · WCS icons"
                  onClick={onOpenProduction}
                >
                  <span className="cx-tool-key">P</span>
                  <img
                    className="cx-tool-icon"
                    src="https://assets.grudge-studio.com/game-assets/icons/professions/forester_profession_game_icon.png"
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="cx-tool-glyph">⛏</span>
                </button>
              )}
              {onOpenBag && (
                <button
                  type="button"
                  className={
                    "cx-tool cx-tool-bag is-slot-6" +
                    (canDeposit ? " is-deposit-lit" : "") +
                    (bagOccupied > 0 ? " is-equipped" : "")
                  }
                  title={
                    canDeposit
                      ? `Bag (I) · ${bagOccupied}/${bagCapacity} · deposit ready`
                      : `Bag (I) · ${bagOccupied}/${bagCapacity} · craft receive`
                  }
                  onClick={onOpenBag}
                >
                  <span className="cx-tool-key">I</span>
                  <img
                    className="cx-tool-icon"
                    src="/icons/inventory.png"
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="cx-tool-glyph" aria-hidden>
                    🎒
                  </span>
                  {bagOccupied > 0 && (
                    <span className="cx-bag-badge">{bagOccupied}</span>
                  )}
                </button>
              )}
            </div>
            <span className="cx-ab3-hint">
              Hold Q mode · Hold R tools · J/H/V use · I bag · P craft
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

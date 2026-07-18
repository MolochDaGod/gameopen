/**
 * Craftpix Part_3 style harvest/build HUD.
 *
 * Layout (matches craftpix Action Bar 3 + MOBA Items & Stats):
 *  - Left: large HP / stamina
 *  - Center: avatar · name · gold · profession levels · tool slots
 *  - Slot 1 = equipped harvest/build tool (large)
 *  - Slots 2–6 = other tools (shortcuts)
 */
import type { HudSnapshot } from "../../three/types";
import { MODE_COLOR, MODE_LABEL, RADIAL_BY_MODE, type PlayerActivityMode } from "../../three/playerMode";
import { portraitOnError } from "../../lib/characterPortrait";
import { getGbux } from "../../lib/gbux";
import { loadSkillUnlocks } from "../../game/harvestCatalog";
import { opIconUrl } from "../../lib/gameMedia";
import "./craftpixHud.css";

export interface CraftpixHarvestHudProps {
  hud: HudSnapshot;
  mode: PlayerActivityMode;
  onSelectTool?: (id: string) => void;
  onOpenProduction?: () => void;
  /** Open character 3×3 bag (far-right button). */
  onOpenBag?: () => void;
  /** Illuminate bag / deposit when in claim, camp, boat. */
  canDeposit?: boolean;
  bagOccupied?: number;
  bagCapacity?: number;
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
  onOpenProduction,
  onOpenBag,
  canDeposit = false,
  bagOccupied = 0,
  bagCapacity = 9,
}: CraftpixHarvestHudProps) {
  const tools = RADIAL_BY_MODE[mode] ?? RADIAL_BY_MODE.harvest;
  const equippedId = hud.activityTool || tools[0]?.id || "gather";
  // Slot 1 = equipped first, then remaining tools up to 6
  const ordered = [
    tools.find((t) => t.id === equippedId) ?? tools[0]!,
    ...tools.filter((t) => t.id !== equippedId),
  ].slice(0, 6);

  const unlocks = loadSkillUnlocks();
  const profs = professionLevels(unlocks);
  const gold = getGbux();
  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const spPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const xpPct = Math.min(100, unlocks.length * 6);
  const modeColor = MODE_COLOR[mode];

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
          </div>

          {/* Center: avatar + gold + professions + tool bar */}
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
                  {MODE_LABEL[mode]} · {equippedId}
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

            <div className="cx-tool-slots">
              {ordered.map((tool, i) => {
                const slotNum = i + 1;
                const isEq = tool.id === equippedId;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={
                      "cx-tool" +
                      (isEq ? " is-equipped" : "") +
                      (isEq ? " is-on" : "") +
                      (slotNum === 6 ? " is-slot-6" : "")
                    }
                    title={`${tool.label} (${tool.hint || slotNum})`}
                    onClick={() => onSelectTool?.(tool.id)}
                  >
                    <span className="cx-tool-key">{String(slotNum)}</span>
                    <img
                      className="cx-tool-icon"
                      src={opIconUrl(tool.id)}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.dataset.broken = "1";
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="cx-tool-glyph" aria-hidden>
                      {tool.glyph}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="cx-xp" title="Profession progress">
              <div className="cx-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </div>

          {/* Right: production · bag (far right) */}
          <div className="cx-ab3-right">
            {onOpenProduction && (
              <button
                type="button"
                className="cx-tool cx-tool-prod is-equipped"
                title="Production shell (P) — craft, trees, maps"
                onClick={onOpenProduction}
              >
                <span className="cx-tool-key">P</span>
                <span className="cx-tool-glyph">⛏</span>
              </button>
            )}
            {onOpenBag && (
              <button
                type="button"
                className={
                  "cx-tool cx-tool-bag" +
                  (canDeposit ? " is-deposit-lit" : "") +
                  (bagOccupied > 0 ? " is-equipped" : "")
                }
                title={
                  canDeposit
                    ? `Character bag (I) · ${bagOccupied}/${bagCapacity} · Quick deposit ready`
                    : `Character bag (I) · ${bagOccupied}/${bagCapacity} · 3×3 carry`
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
            <span className="cx-ab3-hint">Q mode · 1–6 tools · I bag · P prod</span>
          </div>
        </div>
      </div>
    </div>
  );
}

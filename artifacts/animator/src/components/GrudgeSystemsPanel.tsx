/**
 * Grudge Systems Panel — production port of grudge6.grudge-studio.com/creator
 * mainTabBar (Character / Class / Wpn Skills / Professions / Mastery) + hotbar.
 *
 * Data: local GameData/StatsEngine + optional info master-weaponSkills enrich.
 * Saves: localStorage + Railway bag `grudgeSystems` when signed in.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HudSnapshot, SlotBinding, WeaponId } from "../three/types";
import {
  CLASSES,
  PROFESSIONS,
  WEAPON_TYPES,
  WEAPON_SKILLS,
  getMasteryProgress,
  openWeaponToSystemsType,
  type SkillNode as WepSkillNode,
} from "../lib/grudgeSystems/gameData";
import { loadWeaponSkillTrees } from "../lib/grudgeSystems/weaponSkillTrees";
import { resolveSkillNodeIconUrl } from "../lib/skillTreeIcons";
import {
  ATTR_KEYS,
  ATTRIBUTES,
  MAX_POINTS,
  DERIVED_SECTIONS,
  calculateDerivedStats,
  simulateCombat,
  type AttrKey,
  type AttrMap,
} from "../lib/grudgeSystems/statsEngine";
import {
  loadSystemsState,
  scheduleSystemsStateSave,
  type GrudgeSystemsState,
} from "../lib/grudgeSystems/persist";
import {
  DOMAIN_LABELS,
  SKILL_POINT_DOMAINS,
  activateNode,
  attrsWithSkillEffects,
  ensureProgressSynced,
  grantFreeNodes,
  grantPointsForLevel,
  grantPointsFromMasteryXp,
  type CharacterSkillProgress,
} from "../lib/grudgeSystems/characterSkillProgress";
import { getMasteryTier } from "../lib/grudgeSystems/gameData";
import { setActiveSkillProgress } from "../lib/grudgeSystems/skillProgressBridge";

/** Parse weapon skill bonus strings like "+5% damage, +5% crit" into bonuses map. */
function parseBonusString(bonus?: string): Record<string, number> {
  if (!bonus) return {};
  const out: Record<string, number> = {};
  const re = /\+?(\d+(?:\.\d+)?)\s*%?\s*(damage|dmg|crit|speed|hp|health|cdr)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bonus))) {
    const val = Number(m[1]);
    const key = m[2]!.toLowerCase();
    if (key === "damage" || key === "dmg") out.damagePct = (out.damagePct || 0) + val;
    else if (key === "crit") out.critPct = (out.critPct || 0) + val;
    else if (key === "speed") out.moveSpeedPct = (out.moveSpeedPct || 0) + val;
    else if (key === "hp" || key === "health") out.hp = (out.hp || 0) + val;
    else if (key === "cdr") out.cdr = (out.cdr || 0) + val;
  }
  return out;
}
import {
  resolveSlotIconUrl,
  type SlotIconRole,
} from "../three/skillIcons";
import { fetchCatalogJson } from "../lib/fleetSsot";
import {
  grantClassSelectionSkills,
  loadSkillTrees,
  type SkillTree as CatalogSkillTree,
} from "../game/harvestCatalog";
import { ClassSkillTreePanel } from "./hud/ClassSkillTreePanel";
import "./grudgeSystemsPanel.css";
import "./hud/craftpixHud.css";

export type SystemsTabId =
  | "tabEquipment"
  | "tabInventory"
  | "tabCharacter"
  | "tabClassSkills"
  | "tabWeaponSkills"
  | "tabCrafting"
  | "tabGuild"
  | "tabRooms"
  | "tabSettings"
  | "tabProfessions"
  | "tabMastery";

/** Right-side main panel tabs (production Open shell). */
const TABS: Array<{ id: SystemsTabId; label: string }> = [
  { id: "tabEquipment", label: "Equipment" },
  { id: "tabInventory", label: "Inventory" },
  { id: "tabClassSkills", label: "Skills" },
  { id: "tabWeaponSkills", label: "Wpn Skills" },
  { id: "tabCrafting", label: "Crafting" },
  { id: "tabRooms", label: "Rooms" },
  { id: "tabGuild", label: "Guild" },
  { id: "tabSettings", label: "Settings" },
  { id: "tabCharacter", label: "Stats" },
  { id: "tabProfessions", label: "Professions" },
  { id: "tabMastery", label: "Mastery" },
];

type Props = {
  characterName: string;
  characterId: string;
  weapon: WeaponId;
  hud: HudSnapshot | null;
  onClose: () => void;
  /** Optional initial tab (e.g. open on Wpn Skills from combat). */
  initialTab?: SystemsTabId;
  /** Open full equipment / paperdoll page */
  onOpenEquipment?: () => void;
  /** Open production craft UI (P) */
  onOpenCrafting?: () => void;
  /** Solo PvE Danger Room (no lobby) */
  onPlayPve?: () => void;
  /** Open multiplayer lobby for PvP/coop rooms */
  onOpenLobby?: () => void;
  /** Launch external fleet PvP surfaces */
  onLaunchFleet?: (id: "carrier" | "grudox" | "warlords") => void;
};

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function slotBinding(hud: HudSnapshot | null, name: string): SlotBinding | undefined {
  return hud?.slots?.find((s) => s.slot === name);
}

export function GrudgeSystemsPanel({
  characterName,
  characterId,
  weapon,
  hud,
  onClose,
  initialTab = "tabEquipment",
  onOpenEquipment,
  onOpenCrafting,
  onPlayPve,
  onOpenLobby,
  onLaunchFleet,
}: Props) {
  const [tab, setTab] = useState<SystemsTabId>(initialTab);
  const [state, setState] = useState<GrudgeSystemsState>(() => loadSystemsState(characterId));
  const [selectedWep, setSelectedWep] = useState<string | null>(
    () => openWeaponToSystemsType(weapon) || "sword",
  );
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [fleetWeaponNote, setFleetWeaponNote] = useState<string | null>(null);
  /** Canonical class + content skill trees (master-skillTrees + local skill-trees.json). */
  const [skillTrees, setSkillTrees] = useState<CatalogSkillTree[]>([]);
  /** Weapon trees from master-weaponSkills (original ability icons). */
  const [weaponTrees, setWeaponTrees] = useState<
    Record<string, { name: string; icon: string; cdnIcon?: string; skills: WepSkillNode[] }>
  >(WEAPON_SKILLS);

  // Reload when character changes
  useEffect(() => {
    const loaded = loadSystemsState(characterId);
    setState(loaded);
    setActiveSkillProgress(characterId, loaded.skillProgress);
  }, [characterId]);

  // Keep weapon tab selection in sync with equipped weapon
  useEffect(() => {
    const t = openWeaponToSystemsType(weapon);
    if (t) setSelectedWep(t);
  }, [weapon]);

  const persist = useCallback(
    (next: GrudgeSystemsState) => {
      // Always keep flat unlocked + bridge in sync with skillProgress
      const skillProgress = next.skillProgress;
      const synced: GrudgeSystemsState = {
        ...next,
        unlocked: skillProgress.unlocked.slice(),
        skillProgress,
      };
      setState(synced);
      setActiveSkillProgress(characterId, skillProgress);
      scheduleSystemsStateSave(characterId, synced);
    },
    [characterId],
  );

  const setSkillProgress = useCallback(
    (skillProgress: CharacterSkillProgress) => {
      persist({
        ...state,
        skillProgress,
        unlocked: skillProgress.unlocked.slice(),
      });
    },
    [persist, state],
  );

  const totalPoints = useMemo(
    () => ATTR_KEYS.reduce((s, k) => s + (state.attrs[k] || 0), 0),
    [state.attrs],
  );

  // Derived stats include skill-tree attribute bonuses
  const derived = useMemo(() => {
    const attrs = attrsWithSkillEffects(state.attrs, state.skillProgress.effects);
    const base = calculateDerivedStats(attrs, state.level);
    const fx = state.skillProgress.effects;
    if (fx.maxHp) base.maxHP = (base.maxHP || 0) + fx.maxHp;
    if (fx.maxStamina) base.maxStamina = (base.maxStamina || 0) + fx.maxStamina;
    if (fx.maxMana) base.maxMana = (base.maxMana || 0) + fx.maxMana;
    if (fx.damagePct) {
      base.meleeAttack = Math.floor((base.meleeAttack || 0) * (1 + fx.damagePct / 100));
      base.rangedAttack = Math.floor((base.rangedAttack || 0) * (1 + fx.damagePct / 100));
      base.spellPower = Math.floor((base.spellPower || 0) * (1 + fx.damagePct / 100));
    }
    if (fx.critPct) base.critChance = Math.min(75, (base.critChance || 0) + fx.critPct);
    if (fx.moveSpeedPct) {
      base.moveSpeed = +((base.moveSpeed || 0) * (1 + fx.moveSpeedPct / 100)).toFixed(2);
    }
    if (fx.harvestYieldPct) {
      base.harvestBonus = +((base.harvestBonus || 0) + fx.harvestYieldPct).toFixed(1);
    }
    if (fx.craftSpeedPct) {
      base.craftingBonus = +((base.craftingBonus || 0) + fx.craftSpeedPct).toFixed(1);
    }
    return base;
  }, [state.attrs, state.level, state.skillProgress.effects]);

  // Canonical skill trees: same sources as P production UI + character.grudge-studio.com/skills
  useEffect(() => {
    let cancelled = false;
    void loadSkillTrees().then((trees) => {
      if (cancelled) return;
      setSkillTrees(trees);
      // Sync free L0 nodes + recompute effects against full catalog
      setState((prev) => {
        let sp = ensureProgressSynced(prev.skillProgress, prev.level, trees);
        for (const t of trees) {
          if (t.id.startsWith("class-") && prev.classId && t.id === `class-${prev.classId}`) {
            sp = grantFreeNodes(sp, t);
          }
        }
        const next = {
          ...prev,
          skillProgress: sp,
          unlocked: sp.unlocked.slice(),
        };
        setActiveSkillProgress(characterId, sp);
        scheduleSystemsStateSave(characterId, next);
        return next;
      });
    });
    void loadWeaponSkillTrees().then((trees) => {
      if (cancelled) return;
      setWeaponTrees(trees);
      setFleetWeaponNote(
        "Fleet master-weaponSkills + master-skillTrees — original catalog icons on every node.",
      );
    });
    void fetchCatalogJson<Record<string, unknown>>("masterWeaponSkills").then((data) => {
      if (cancelled) return;
      if (!data) {
        setFleetWeaponNote("Weapon skill catalog offline — using local pack icons.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const preferredClassTreeId = state.classId ? `class-${state.classId}` : "class-warrior";

  const setAttr = (key: AttrKey, value: number) => {
    const next: AttrMap = { ...state.attrs, [key]: value };
    persist({ ...state, attrs: next });
  };

  const onCombatTest = () => {
    const dummyAttrs: AttrMap = {
      STR: 15,
      VIT: 15,
      END: 15,
      INT: 15,
      WIS: 15,
      DEX: 15,
      AGI: 15,
      TAC: 15,
    };
    const dummy = calculateDerivedStats(dummyAttrs, 10);
    const result = simulateCombat(derived, dummy);
    setCombatLog(result.log);
  };

  const hotbarSlots = useMemo(() => {
    const roles: Array<{ role: SlotIconRole | "block" | "dodge"; key: string; fallback: string }> = [
      { role: "primary", key: "LMB", fallback: "Attack" },
      { role: "fskill", key: "F", fallback: "Skill" },
      { role: "sig1", key: "1", fallback: "Sig 1" },
      { role: "sig2", key: "2", fallback: "Sig 2" },
      { role: "sig3", key: "3", fallback: "Sig 3" },
      { role: "sig4", key: "4", fallback: "Sig 4" },
    ];
    return roles.map((r) => {
      const bind = slotBinding(hud, r.role);
      const iconUrl =
        bind?.iconUrl ||
        (r.role !== "block" && r.role !== "dodge"
          ? resolveSlotIconUrl(r.role as SlotIconRole, weapon)
          : undefined);
      return {
        key: bind?.key || r.key,
        name:
          bind?.label ||
          (r.role === "fskill" && hud?.skillName ? hud.skillName : r.fallback),
        iconUrl,
        empty: !bind && r.role !== "primary",
      };
    });
  }, [hud, weapon]);

  const pointsClass =
    totalPoints > MAX_POINTS ? "over" : totalPoints === MAX_POINTS ? "full" : "";

  return (
    <div className="gs-panel cx-menu" role="dialog" aria-label="Main panel">
      <button type="button" className="gs-backdrop" aria-label="Close main panel" onClick={onClose} />
      <div className="gs-sheet cx-menu-sheet gs-sheet--main">
        <header className="gs-header cx-menu-header">
          <div>
            <p className="gs-kicker">Main Panel</p>
            <h2 className="gs-title">{characterName}</h2>
            <p className="gs-sub">
              Level {state.level}
              {state.classId ? ` · ${CLASSES[state.classId]?.name ?? state.classId}` : ""}
              {" · "}
              {SKILL_POINT_DOMAINS.map((d) => `${DOMAIN_LABELS[d]} ${state.skillProgress.points[d] || 0}`).join(
                " · ",
              )}
            </p>
          </div>
          <button
            type="button"
            className="gs-close cx-menu-close"
            onClick={onClose}
            title="Close (K / Esc)"
          >
            ×
          </button>
        </header>

        <nav className="gs-tabbar cx-menu-tabs gs-tabbar--scroll" id="mainTabBar" aria-label="Main panel tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`gs-tab cx-menu-tab${tab === t.id ? " active" : ""}`}
              data-tab={t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="gs-body">
          {tab === "tabEquipment" && (
            <>
              <h3>Equipment</h3>
              <p className="gs-muted">
                Paperdoll, kept loadout, and mesh stage. Opens the full explorer equip UI
                (same as key <kbd>I</kbd>).
              </p>
              <div className="gs-hotbar" style={{ marginBottom: 12 }}>
                {hotbarSlots.map((s) => (
                  <div key={s.key} className={`gs-hot-slot${s.empty ? " empty" : ""}`} title={s.name}>
                    {s.iconUrl ? (
                      <img src={s.iconUrl} alt="" className="gs-hot-icon" />
                    ) : (
                      <span className="gs-hot-fallback">{s.name.slice(0, 3)}</span>
                    )}
                    <span className="gs-hot-key">{s.key}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="gs-btn" onClick={() => onOpenEquipment?.()}>
                Open full equipment · inventory
              </button>
              <p className="gs-muted" style={{ marginTop: 10 }}>
                Weapon: <strong>{weapon}</strong>
                {hud?.offHand ? ` · Off: ${hud.offHand}` : ""}
              </p>
            </>
          )}

          {tab === "tabInventory" && (
            <>
              <h3>Inventory</h3>
              <p className="gs-muted">
                3×3 bag + kept slots live on the character page. Use equipment for drag-drop
                craft grid and bag management.
              </p>
              <button type="button" className="gs-btn" onClick={() => onOpenEquipment?.()}>
                Open inventory (I)
              </button>
              <p className="gs-muted" style={{ marginTop: 8 }}>
                Production harvest bag will sync to Railway inventory when signed in.
              </p>
            </>
          )}

          {tab === "tabCrafting" && (
            <>
              <h3>Crafting</h3>
              <p className="gs-muted">
                WCS recipes, stations, and production loops (Open Production UI).
              </p>
              <button
                type="button"
                className="gs-btn"
                onClick={() => {
                  onOpenCrafting?.();
                  onClose();
                }}
              >
                Open Production · Craft (P)
              </button>
              <button
                type="button"
                className="gs-btn gs-btn-ghost"
                style={{ marginTop: 8 }}
                onClick={() => onOpenEquipment?.()}
              >
                2×2 craft grid on character page
              </button>
            </>
          )}

          {tab === "tabRooms" && (
            <>
              <h3>Rooms · PvE · PvP</h3>
              <p className="gs-muted">
                Play Danger Room solo (PvE) or open the multiplayer lobby for coop/PvP rooms.
                Fleet arcade (Carrier / GRUDOX) uses live WebSocket rooms.
              </p>
              <div className="gs-rooms">
                <button type="button" className="gs-btn gs-btn-pve" onClick={() => onPlayPve?.()}>
                  ▶ Solo PvE · Danger Room
                </button>
                <button type="button" className="gs-btn gs-btn-pvp" onClick={() => onOpenLobby?.()}>
                  ⚔ Multiplayer lobby · create / join room
                </button>
                <button
                  type="button"
                  className="gs-btn gs-btn-ghost"
                  onClick={() => onLaunchFleet?.("carrier")}
                >
                  Carrier PvP sector
                </button>
                <button
                  type="button"
                  className="gs-btn gs-btn-ghost"
                  onClick={() => onLaunchFleet?.("grudox")}
                >
                  GRUDOX arcade hub
                </button>
                <button
                  type="button"
                  className="gs-btn gs-btn-ghost"
                  onClick={() => onLaunchFleet?.("warlords")}
                >
                  Grudge Warlords world
                </button>
              </div>
              <p className="gs-muted" style={{ marginTop: 10 }}>
                Tip: touch pad Sprint / Crouch / Harvest above left stick · skill stick N/E/S/W ·
                center press = focus.
              </p>
            </>
          )}

          {tab === "tabGuild" && (
            <>
              <h3>Guild</h3>
              <p className="gs-muted">
                Guild roster and war banners ship with Railway social APIs. Create or join from
                Account when available.
              </p>
              <div className="gs-guild-card">
                <p>
                  <strong>No guild selected</strong>
                </p>
                <p className="gs-muted">Invite code · roster · shared storage coming on account bag.</p>
                <button type="button" className="gs-btn" disabled title="Guild API pending">
                  Create guild (soon)
                </button>
              </div>
            </>
          )}

          {tab === "tabSettings" && (
            <>
              <h3>Settings</h3>
              <p className="gs-muted">Session and accessibility. Combat keys stay Danger Room SSOT.</p>
              <ul className="gs-settings-list">
                <li>
                  <strong>Q</strong> — cycle Combat / Harvest / Build
                </li>
                <li>
                  <strong>RMB</strong> — sticky focus · skill stick center on mobile
                </li>
                <li>
                  <strong>C</strong> parry · <strong>E</strong> guard · <strong>X</strong> dodge
                </li>
                <li>
                  <strong>K</strong> — this main panel · <strong>I</strong> equipment
                </li>
                <li>
                  <strong>P</strong> — production craft
                </li>
              </ul>
              <button
                type="button"
                className="gs-btn gs-btn-ghost"
                onClick={() => {
                  try {
                    localStorage.removeItem("grudge.open.hudLayout");
                  } catch {
                    /* */
                  }
                  window.location.reload();
                }}
              >
                Reset HUD layout
              </button>
            </>
          )}

          {tab === "tabCharacter" && (
            <>
              <h3>
                Attributes
                <span className={`gs-points ${pointsClass}`}>
                  {totalPoints} / {MAX_POINTS}
                </span>
              </h3>
              {ATTR_KEYS.map((key) => {
                const meta = ATTRIBUTES[key];
                return (
                  <div className="gs-attr-row" key={key}>
                    <label style={{ color: meta.color }} title={meta.desc}>
                      {meta.icon} {key}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={state.attrs[key]}
                      onChange={(e) => setAttr(key, Number(e.target.value))}
                      aria-label={meta.name}
                    />
                    <span className="val">{state.attrs[key]}</span>
                  </div>
                );
              })}

              <h3 style={{ marginTop: 14 }}>Derived Stats</h3>
              <div className="gs-stat-grid">
                {DERIVED_SECTIONS.map((sec) => (
                  <div key={sec.title} style={{ display: "contents" }}>
                    <div className="gs-section-label">{sec.title}</div>
                    {Object.entries(sec.stats).map(([k, label]) => (
                      <div className={`gs-stat-item stat-item--${sec.css}`} key={k}>
                        <span className="label">{label}</span>
                        <span className="value">{fmt(derived[k] ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <h3>Combat Test</h3>
              <button type="button" className="gs-btn" onClick={onCombatTest}>
                Attack Test Dummy
              </button>
              <div className="gs-combat-log" id="combatLog">
                {combatLog.length === 0
                  ? 'Click "Attack Test Dummy" to simulate…'
                  : combatLog.map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.includes("CRITICAL")
                            ? "crit"
                            : line.includes("BLOCK")
                              ? "block"
                              : undefined
                        }
                      >
                        {line}
                      </div>
                    ))}
              </div>
            </>
          )}

          {tab === "tabClassSkills" && (
            <>
              <h3>Class</h3>
              <p className="gs-muted">
                Fleet <code>master-skillTrees</code> + bridge nodes (L0 select · L1 · bridges · L5
                · L10 · L15 · L20). Same book as{" "}
                <a
                  href="https://character.grudge-studio.com/skills"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#6ee7b7" }}
                >
                  character skills
                </a>{" "}
                and P → Skill trees. One class from the row (Worge L0 = Bear start).
              </p>
              <div className="gs-attr-row" style={{ maxWidth: 280, marginBottom: 10 }}>
                <label title="Gates path nodes by requiredLevel; grants skill points on level-up">
                  Level
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={state.level}
                  onChange={(e) => {
                    const level = Math.max(1, Math.min(20, Number(e.target.value)));
                    const skillProgress = grantPointsForLevel(state.skillProgress, level);
                    persist({ ...state, level, skillProgress, unlocked: skillProgress.unlocked.slice() });
                  }}
                  aria-label="Character level for skill path"
                />
                <span className="val">{state.level}</span>
              </div>
              <div className="gs-points-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {SKILL_POINT_DOMAINS.map((d) => (
                  <span
                    key={d}
                    className="gs-points"
                    title={`${DOMAIN_LABELS[d]}: earned ${state.skillProgress.earned[d] || 0} · spent ${state.skillProgress.spent[d] || 0}`}
                    style={{ fontSize: "0.72rem" }}
                  >
                    {DOMAIN_LABELS[d]} {state.skillProgress.points[d] || 0}
                  </span>
                ))}
              </div>
              <div className="gs-class-row">
                {Object.entries(CLASSES).map(([id, cls]) => (
                  <button
                    key={id}
                    type="button"
                    className={`gs-class-chip${state.classId === id ? " selected" : ""}`}
                    style={
                      state.classId === id
                        ? { borderColor: cls.color, color: cls.color }
                        : undefined
                    }
                    onClick={() => {
                      // One class from the row → L0 auto skills (Worge includes Bear start)
                      grantClassSelectionSkills(id);
                      let skillProgress = state.skillProgress;
                      const classTree = skillTrees.find((t) => t.id === `class-${id}`);
                      if (classTree) skillProgress = grantFreeNodes(skillProgress, classTree);
                      persist({
                        ...state,
                        classId: id,
                        skillProgress,
                        unlocked: skillProgress.unlocked.slice(),
                      });
                      // Notify upper class skill bar (Shift+1–5) immediately
                      window.dispatchEvent(
                        new CustomEvent("grudge:class-selected", { detail: { classId: id } }),
                      );
                    }}
                  >
                    <span>{cls.icon}</span> {cls.name}
                  </button>
                ))}
              </div>
              {state.classId && CLASSES[state.classId] && (
                <p className="gs-muted">
                  {CLASSES[state.classId].desc}
                  {state.classId === "worge"
                    ? " · L0 grants Bear Form (start, free)."
                    : " · L0 granted free on select."}{" "}
                  Other nodes spend Class points.
                </p>
              )}
              {skillTrees.length ? (
                <ClassSkillTreePanel
                  trees={skillTrees}
                  playerLevel={state.level}
                  skillProgress={state.skillProgress}
                  onProgressChange={setSkillProgress}
                  preferredTreeId={
                    skillTrees.some((t) => t.id === preferredClassTreeId)
                      ? preferredClassTreeId
                      : skillTrees.find((t) => t.id.startsWith("class-"))?.id ||
                        "weapon-combat"
                  }
                  onUnlock={(nodeId, unlocks, progress) => {
                    window.dispatchEvent(
                      new CustomEvent("grudge:skill-activated", {
                        detail: { nodeId, unlocks, effects: progress.effects },
                      }),
                    );
                  }}
                />
              ) : (
                <p className="gs-muted">Loading canonical skill trees…</p>
              )}
              {state.skillProgress.effects.grantedSkills.length > 0 && (
                <p className="gs-muted" style={{ marginTop: 8 }}>
                  Active grants: {state.skillProgress.effects.grantedSkills.join(", ")}
                  {state.skillProgress.effects.damagePct
                    ? ` · +${state.skillProgress.effects.damagePct}% dmg`
                    : ""}
                  {state.skillProgress.effects.maxHp
                    ? ` · +${state.skillProgress.effects.maxHp} HP`
                    : ""}
                </p>
              )}
            </>
          )}

          {tab === "tabWeaponSkills" && (
            <>
              <h3>Weapon Type</h3>
              {fleetWeaponNote && <p className="gs-muted">{fleetWeaponNote}</p>}
              <p className="gs-muted">
                Weapon points: <strong>{state.skillProgress.points.weapon || 0}</strong> (from mastery
                tiers). Click a node to activate when level + points allow.
              </p>
              <div className="gs-wep-grid" id="weaponTypeGrid">
                {Object.entries(WEAPON_TYPES).map(([id, wep]) => (
                  <button
                    key={id}
                    type="button"
                    className={`gs-wep-btn${selectedWep === id ? " active" : ""}`}
                    data-wep={id}
                    title={wep.name}
                    onClick={() => {
                      setSelectedWep(id);
                      // Ensure T0 weapon points for this family on first view
                      const xp = state.masteryXp[id] ?? 0;
                      const sp = grantPointsFromMasteryXp(
                        state.skillProgress,
                        id,
                        xp,
                        (x) => getMasteryTier(x).tier,
                      );
                      if (sp.points.weapon !== state.skillProgress.points.weapon) {
                        persist({
                          ...state,
                          skillProgress: sp,
                          unlocked: sp.unlocked.slice(),
                        });
                      }
                    }}
                  >
                    {wep.cdnIcon ? (
                      <img src={wep.cdnIcon} alt="" loading="lazy" />
                    ) : (
                      <span className="emoji">{wep.icon}</span>
                    )}
                    {wep.name.split(" ").pop()}
                  </button>
                ))}
              </div>
              {selectedWep && (weaponTrees[selectedWep] || WEAPON_SKILLS[selectedWep]) && (
                <div className="gs-tree" id="weaponSkillTree">
                  <div className="gs-tree-header">
                    {(weaponTrees[selectedWep]?.cdnIcon || WEAPON_TYPES[selectedWep]?.cdnIcon) && (
                      <img
                        src={
                          weaponTrees[selectedWep]?.cdnIcon ||
                          WEAPON_TYPES[selectedWep]?.cdnIcon ||
                          ""
                        }
                        alt=""
                        width={22}
                        height={22}
                        style={{ verticalAlign: "middle", marginRight: 6, borderRadius: 4 }}
                        loading="lazy"
                      />
                    )}
                    {weaponTrees[selectedWep]?.icon || WEAPON_SKILLS[selectedWep]?.icon}{" "}
                    {weaponTrees[selectedWep]?.name || WEAPON_SKILLS[selectedWep]?.name} Skill Tree
                  </div>
                  <p className="gs-muted" style={{ padding: "6px 10px 0" }}>
                    Classes:{" "}
                    {(WEAPON_TYPES[selectedWep]?.classes || [])
                      .map((c) => CLASSES[c]?.name || c)
                      .join(", ")}{" "}
                    · {(WEAPON_TYPES[selectedWep]?.hand || "").toUpperCase()} · spend{" "}
                    <strong>Weapon</strong> points
                  </p>
                  {(weaponTrees[selectedWep]?.skills || WEAPON_SKILLS[selectedWep]?.skills || []).map(
                    (skill) => {
                      const ico = resolveSkillNodeIconUrl({
                        icon: skill.icon,
                        iconUrl: skill.iconUrl,
                        id: skill.id,
                        treeId: `weapon-${selectedWep}`,
                      });
                      const active = state.skillProgress.unlocked.includes(skill.id);
                      const needLv = skill.level || 1;
                      const canLv = state.level >= needLv;
                      const canPts = (state.skillProgress.points.weapon || 0) >= 1;
                      return (
                        <button
                          type="button"
                          className={`gs-skill-node${active ? " is-on" : ""}`}
                          key={skill.id}
                          disabled={active || !canLv || !canPts}
                          title={
                            active
                              ? "Active"
                              : !canLv
                                ? `Need character level ${needLv}`
                                : !canPts
                                  ? "Need 1 Weapon point"
                                  : skill.desc
                          }
                          onClick={() => {
                            if (active || !canLv || !canPts) return;
                            const result = activateNode(
                              state.skillProgress,
                              {
                                id: skill.id,
                                name: skill.name,
                                desc: skill.desc,
                                tier: Math.min(3, Math.floor((needLv - 1) / 5)),
                                requires: [],
                                cost: 1,
                                requiredLevel: needLv,
                                bonuses: parseBonusString(skill.bonus),
                              },
                              {
                                playerLevel: state.level,
                                treeId: `weapon-${selectedWep}`,
                                domain: "weapon",
                              },
                            );
                            if (result.ok) {
                              persist({
                                ...state,
                                skillProgress: result.progress,
                                unlocked: result.progress.unlocked.slice(),
                              });
                            }
                          }}
                          style={{
                            cursor: active || !canLv || !canPts ? "default" : "pointer",
                            opacity: active ? 1 : canLv && canPts ? 1 : 0.55,
                            textAlign: "left",
                            width: "100%",
                            border: active ? "1px solid #4ade80" : undefined,
                            background: "transparent",
                            color: "inherit",
                          }}
                        >
                          <img
                            className="gs-skill-icon"
                            src={ico}
                            alt=""
                            width={28}
                            height={28}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.src =
                                WEAPON_TYPES[selectedWep]?.cdnIcon ||
                                "https://assets.grudge-studio.com/icons/pack/misc/Effect.png";
                            }}
                          />
                          <span className="gs-skill-lvl">Lv{skill.level}</span>
                          <span className="gs-skill-name">{skill.name}</span>
                          <span className="gs-skill-cost" style={{ color: active ? "#4ade80" : "#8fa3c7" }}>
                            {active ? "ACTIVE" : skill.bonus || "1 pt"}
                          </span>
                          <div className="gs-skill-desc">{skill.desc}</div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </>
          )}

          {tab === "tabProfessions" && (
            <>
              <h3>Harvesting Professions</h3>
              <div id="professionsList">
                {Object.entries(PROFESSIONS).map(([id, prof]) => (
                  <div className="gs-prof-card" key={id}>
                    <div className="gs-prof-header">
                      <span>{prof.icon}</span>
                      <span style={{ color: prof.color }}>{prof.name}</span>
                      <span style={{ fontSize: "0.6rem", color: "#8fa3c7", marginLeft: "auto" }}>
                        Bonus: {prof.attr}
                      </span>
                    </div>
                    <p className="gs-muted">{prof.desc}</p>
                    {prof.tiers.map((t) => (
                      <div className="gs-prof-tier" key={t.level}>
                        <span className="tier-lvl">Lv{t.level}</span>
                        <span className="tier-name">{t.name}</span>
                        <span className="tier-res">{t.resources.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "tabMastery" && (
            <>
              <h3>Weapon Mastery</h3>
              <p className="gs-muted">XP earned per weapon type through combat use (saved on character bag).</p>
              <div id="masteryList">
                {Object.entries(WEAPON_TYPES).map(([id, wep]) => {
                  const xp = state.masteryXp[id] ?? Math.floor(id.length * 137) % 8000;
                  const { current, progress } = getMasteryProgress(xp);
                  const pct = Math.floor(progress * 100);
                  return (
                    <div className="gs-mastery-row" key={id}>
                      <div className="gs-mastery-icon">
                        {wep.cdnIcon ? <img src={wep.cdnIcon} alt="" loading="lazy" /> : wep.icon}
                      </div>
                      <div>
                        <div className="gs-mastery-name">{wep.name}</div>
                        <div className="gs-mastery-tier">
                          {current.name} — {current.bonus}
                        </div>
                        <div className="gs-mastery-bar">
                          <div className="gs-mastery-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="gs-mastery-xp">{xp} XP</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <footer className="gs-hotbar-wrap" id="hotbarDisplay">
          <div className="gs-hotbar-meta">
            <span className="wep">{weapon === "none" ? "Unarmed" : weapon}</span>
            <span style={{ color: "#8fa3c7" }}>
              {hud?.activityMode === "harvest" ? "Harvest" : "Combat"}
              {hud?.locked ? " · locked" : ""}
            </span>
            <span className="hint">K systems · I loadout · F/1–4 skills</span>
          </div>
          <div className="gs-hotbar">
            {hotbarSlots.map((s) => (
              <div key={s.key + s.name} className={`gs-hb-slot${s.empty ? " empty" : ""}`} title={s.name}>
                {s.iconUrl ? <img src={s.iconUrl} alt="" /> : <span style={{ fontSize: 14 }}>•</span>}
                <span className="key">{s.key}</span>
                <span className="name">{s.name}</span>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

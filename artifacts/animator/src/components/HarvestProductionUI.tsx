/**
 * Harvest production UI — full tabbed shell for voxel harvest/build gameplay.
 *
 * Tabs: Operations · Crafting · Recipes · Codex (Mine-Loader API) · Maps ·
 * Skill trees · Characters (fleet + user avatars + explorer) · Systems design.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  ExternalLink,
  Hammer,
  Map as MapIcon,
  Package,
  Puzzle,
  Trees,
  User,
  Users,
  X,
  Sparkles,
  Search,
} from "lucide-react";
import {
  HARVEST_TABS,
  canCraft,
  craftRecipe,
  ensureStarterBag,
  fetchCodexBlocks,
  fetchCodexDefinitions,
  fetchMineLoaderWorlds,
  listHeroCharacters,
  listUnitCharacters,
  listMapLibrary,
  listUserAvatarCharacters,
  loadHarvestRecipes,
  loadOperations,
  loadSkillTrees,
  loadSystemsDoc,
  openMineLoaderCodex,
  openMineLoaderEditor,
  openMineLoaderPlay,
  prettyMatId,
  type CharacterImportRow,
  type CraftRecipe,
  type HarvestOp,
  type HarvestTabId,
  type SkillTree,
  type SystemsDoc,
} from "../game/harvestCatalog";
import {
  flattenFactionUnits,
  loadFactionUnits,
} from "../game/campClaimCatalog";
import { GRUDOX_MAX_SLOTS } from "../lib/grudoxRoster";
import {
  buildPortalDungeonLaunchUrl,
  buildSeedWorldLaunchUrl,
  customSeedDeployment,
  downloadDeploymentJson,
  listDeployments,
  loadSeedCatalog,
  shareSeedDeployment,
  type SeedCatalog,
  type SeedWorldDeployment,
} from "../game/seedWorlds";
import { savePlayerHeadConfig } from "../three/avatar/playerHead";
import type { AvatarConfig } from "../three/avatar/catalog";
import { sanitizeConfig } from "../three/avatar/catalog";
import {
  blockIconUrl,
  hideBrokenImg,
  matIconUrl,
  opIconUrl,
  recipeItemIconUrl,
  warmGameMedia,
} from "../lib/gameMedia";
import { Icon } from "./Icon";
import { ClassSkillTreePanel } from "./hud/ClassSkillTreePanel";
import { chunkBlocks } from "../game/seedWorlds";
import {
  ENGINE_STACK,
  engineStackSnapshot,
  probeAiHub,
  type AiHubHealth,
} from "../lib/engineStack";
import {
  loadSystemsState,
  scheduleSystemsStateSave,
  type GrudgeSystemsState,
} from "../lib/grudgeSystems/persist";
import { gameSession } from "../game/GameSession";
import "./harvestProduction.css";

export interface HarvestProductionUIProps {
  open: boolean;
  activityMode: "combat" | "harvest" | "build";
  activityTool: string;
  onClose: () => void;
  onSelectTool: (id: string) => void;
  onImportCharacter?: (id: string) => void;
  onOpenRealms?: () => void;
  onOpenVoxel?: () => void;
}

const TAB_ICON: Record<HarvestTabId, ReactNode> = {
  ops: <Package size={15} />,
  crafting: <Hammer size={15} />,
  recipes: <BookOpen size={15} />,
  codex: <BookOpen size={15} />,
  maps: <MapIcon size={15} />,
  trees: <Trees size={15} />,
  characters: <Users size={15} />,
  systems: <Puzzle size={15} />,
};

export function HarvestProductionUI({
  open,
  activityMode,
  activityTool,
  onClose,
  onSelectTool,
  onImportCharacter,
  onOpenRealms,
  onOpenVoxel,
}: HarvestProductionUIProps) {
  const [tab, setTab] = useState<HarvestTabId>("ops");
  const [recipes, setRecipes] = useState<CraftRecipe[]>([]);
  const [stations, setStations] = useState<{ id: string; name: string; glyph: string }[]>([]);
  const [ops, setOps] = useState<HarvestOp[]>([]);
  const [trees, setTrees] = useState<SkillTree[]>([]);
  const [systems, setSystems] = useState<SystemsDoc | null>(null);
  const [bag, setBag] = useState<Record<string, number>>({});
  const [unitRows, setUnitRows] = useState<CharacterImportRow[]>([]);
  const [aiHealth, setAiHealth] = useState<AiHubHealth | null>(null);
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [craftNotice, setCraftNotice] = useState<string | null>(null);
  const [craftingId, setCraftingId] = useState<string | null>(null);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [codexSearch, setCodexSearch] = useState("");
  const [codexCategory, setCodexCategory] = useState("all");
  const [codex, setCodex] = useState<{
    blocks: Awaited<ReturnType<typeof fetchCodexBlocks>>;
    defs: Awaited<ReturnType<typeof fetchCodexDefinitions>>;
  } | null>(null);
  const [codexLoading, setCodexLoading] = useState(false);
  const [worlds, setWorlds] = useState<Awaited<ReturnType<typeof fetchMineLoaderWorlds>> | null>(
    null,
  );
  const [seedCatalog, setSeedCatalog] = useState<SeedCatalog | null>(null);
  const [seedDeployments, setSeedDeployments] = useState<SeedWorldDeployment[]>([]);
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [customSeedInput, setCustomSeedInput] = useState("");
  const [seedBusy, setSeedBusy] = useState(false);
  const maps = useMemo(() => listMapLibrary(), []);
  const characterId =
    gameSession.selectedCharacter()?.id ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("grudge.activeCharId") || "guest"
      : "guest");
  const [systemsState, setSystemsState] = useState<GrudgeSystemsState>(() =>
    loadSystemsState(characterId),
  );

  useEffect(() => {
    if (!open) return;
    warmGameMedia();
    setBag(ensureStarterBag());
    setSystemsState(loadSystemsState(characterId));
    void loadHarvestRecipes().then((r) => {
      setRecipes(r.recipes);
      setStations(r.stations);
    });
    void loadOperations().then(setOps);
    void loadSkillTrees().then(setTrees);
    void loadSystemsDoc().then(setSystems);
    void loadFactionUnits().then((cat) => {
      const flat = flattenFactionUnits(cat);
      setUnitRows(listUnitCharacters(flat));
    });
  }, [open, characterId]);

  useEffect(() => {
    if (!open || tab !== "codex") return;
    setCodexLoading(true);
    void Promise.all([fetchCodexBlocks(), fetchCodexDefinitions()]).then(([blocks, defs]) => {
      setCodex({ blocks, defs });
      setCodexLoading(false);
    });
  }, [open, tab]);

  useEffect(() => {
    if (!open || tab !== "systems") return;
    void probeAiHub().then(setAiHealth);
  }, [open, tab]);

  useEffect(() => {
    if (!open || tab !== "maps") return;
    void fetchMineLoaderWorlds().then(setWorlds);
    void loadSeedCatalog().then((cat) => {
      setSeedCatalog(cat);
      const deps = listDeployments(cat);
      setSeedDeployments((prev) => {
        // Keep custom-generated seeds the user already created this session.
        const customs = prev.filter((d) => d.world.id.startsWith("seed-custom-"));
        const ids = new Set(deps.map((d) => d.world.id));
        return [...deps, ...customs.filter((c) => !ids.has(c.world.id))];
      });
      setSelectedSeedId((cur) => cur ?? deps[0]?.world.id ?? null);
    });
  }, [open, tab]);

  // Prefer useful default tab when opening in harvest/build
  useEffect(() => {
    if (!open) return;
    if (activityMode === "build") setTab((t) => (t === "ops" || t === "crafting" ? t : "ops"));
  }, [activityMode, open]);

  // Esc closes shell
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const filteredRecipes = useMemo(() => {
    let list = recipes;
    if (stationFilter !== "all") list = list.filter((r) => r.station === stationFilter);
    if (recipeSearch.trim()) {
      const q = recipeSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.skill.toLowerCase().includes(q) ||
          r.output.name.toLowerCase().includes(q) ||
          r.inputs.some((i) => i.name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [recipes, stationFilter, recipeSearch]);

  const modeOps = useMemo(() => {
    if (activityMode === "combat") return ops;
    return ops.filter((o) => o.mode === activityMode);
  }, [ops, activityMode]);

  const heroChars = useMemo(() => listHeroCharacters(GRUDOX_MAX_SLOTS), [open]);
  const avatarChars = useMemo(() => listUserAvatarCharacters(), [open]);
  const units = useMemo(
    () => (unitRows.length ? unitRows : listUnitCharacters()),
    [unitRows],
  );

  const filteredBlocks = useMemo(() => {
    if (!codex?.blocks.sample) return [];
    let list = codex.blocks.sample;
    if (codexCategory !== "all") {
      list = list.filter((b) => (b.category || "General") === codexCategory);
    }
    if (codexSearch.trim()) {
      const q = codexSearch.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          (b.category || "").toLowerCase().includes(q),
      );
    }
    return list.slice(0, 48);
  }, [codex, codexCategory, codexSearch]);

  const showNotice = useCallback((msg: string) => {
    setCraftNotice(msg);
    window.setTimeout(() => setCraftNotice(null), 2400);
  }, []);

  const doCraft = useCallback(
    (r: CraftRecipe) => {
      if (craftingId) return;
      if (!canCraft(r, bag)) {
        showNotice("Missing materials");
        return;
      }
      setCraftingId(r.id);
      const delay = Math.min(Math.max(r.timeSec * 400, 400), 2800);
      window.setTimeout(() => {
        const res = craftRecipe(r, bag);
        setCraftingId(null);
        if (!res.ok) {
          showNotice(res.reason ?? "Cannot craft");
          return;
        }
        setBag(res.bag);
        showNotice(`Crafted ${r.output.name} ×${r.output.qty}`);
      }, delay);
    },
    [bag, craftingId, showNotice],
  );

  const importAvatar = useCallback(
    (row: { id: string; avatarConfig?: unknown }) => {
      if (row.avatarConfig) {
        const cfg = sanitizeConfig(row.avatarConfig);
        if (cfg) {
          savePlayerHeadConfig(cfg as AvatarConfig);
          showNotice("Avatar head saved to Explorer character");
        }
      }
      onImportCharacter?.(row.id);
    },
    [onImportCharacter, showNotice],
  );

  if (!open) return null;

  return (
    <div className="hp-root" role="dialog" aria-modal="true" aria-label="Harvest production">
      <div className="hp-shell">
        <header className="hp-head">
          <div className="hp-brand">
            <span className="hp-glyph" aria-hidden>
              ⛏
            </span>
            <div>
              <h2>Voxel Production</h2>
              <p>
                {activityMode === "build"
                  ? "Build mode"
                  : activityMode === "harvest"
                    ? "Harvest mode"
                    : "Combat (ops still browsable)"}{" "}
                · ops, craft, codex, maps, trees &amp; avatars
              </p>
            </div>
          </div>
          <div className="hp-head-actions">
            <button
              type="button"
              className="hp-btn ghost"
              onClick={() => window.open(openMineLoaderCodex(), "_blank", "noopener,noreferrer")}
            >
              <ExternalLink size={14} /> Codex live
            </button>
            <button
              type="button"
              className="hp-btn ghost"
              onClick={() => window.open(openMineLoaderEditor(), "_blank", "noopener,noreferrer")}
            >
              <ExternalLink size={14} /> World editor
            </button>
            <button
              type="button"
              className="hp-btn ghost"
              onClick={() => {
                if (onOpenRealms) onOpenRealms();
                else window.open(openMineLoaderPlay(), "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink size={14} /> Realms world
            </button>
            <button type="button" className="hp-close" onClick={onClose} aria-label="Close production UI">
              <X size={18} />
            </button>
          </div>
        </header>

        <nav className="hp-tabs" aria-label="Production sections" role="tablist">
          {HARVEST_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={"hp-tab" + (tab === t.id ? " is-on" : "")}
              onClick={() => setTab(t.id)}
              title={t.blurb}
            >
              <span className="hp-tab-ico" aria-hidden>
                {TAB_ICON[t.id]}
              </span>
              <span className="hp-tab-lab">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="hp-body" role="tabpanel">
          {tab === "ops" && (
            <section className="hp-panel">
              <h3>Operations source</h3>
              <p className="hp-lead">
                Tools drive LMB and the radial wheel in the world. Select one, close this panel, then
                use LMB (or the bound key) in harvest or build mode.
              </p>
              <div className="hp-mode-hint">
                Showing <b>{activityMode}</b> ops
                {activityMode === "combat" ? " (all — switch with Q)" : ""}
              </div>
              <div className="hp-grid ops">
                {modeOps.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    className={"hp-card" + (activityTool === op.id ? " is-on" : "")}
                    onClick={() => {
                      onSelectTool(op.id);
                      showNotice(`Tool: ${op.name}`);
                    }}
                  >
                    <span className="hp-card-glyph">
                      <img
                        src={opIconUrl(op.id)}
                        alt=""
                        width={28}
                        height={28}
                        onError={(e) => {
                          e.currentTarget.replaceWith(
                            Object.assign(document.createElement("span"), {
                              textContent: op.glyph,
                            }),
                          );
                        }}
                      />
                    </span>
                    <span className="hp-card-title">{op.name}</span>
                    <span className="hp-card-blurb">{op.blurb}</span>
                    {op.channelSec != null && (
                      <span className="hp-card-meta">Channel {op.channelSec}s</span>
                    )}
                    {op.yields && (
                      <span className="hp-card-meta">Yields: {op.yields.map(prettyMatId).join(", ")}</span>
                    )}
                  </button>
                ))}
              </div>
              {!modeOps.length && <p className="hp-muted">Loading operations…</p>}
            </section>
          )}

          {tab === "crafting" && (
            <section className="hp-panel">
              <h3>Crafting bench</h3>
              <p className="hp-lead">
                Craft tools, food, and build kits into your material bag. Stations mirror Mine-Loader
                item packs (benches, forge, loom).
              </p>
              <div className="hp-filters">
                <button
                  type="button"
                  className={"hp-chip" + (stationFilter === "all" ? " is-on" : "")}
                  onClick={() => setStationFilter("all")}
                >
                  All stations
                </button>
                {stations.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={"hp-chip" + (stationFilter === s.id ? " is-on" : "")}
                    onClick={() => setStationFilter(s.id)}
                  >
                    {s.glyph} {s.name}
                  </button>
                ))}
              </div>
              <label className="hp-search">
                <Search size={14} aria-hidden />
                <input
                  type="search"
                  placeholder="Search recipes…"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  aria-label="Search recipes"
                />
              </label>
              <div className="hp-split">
                <div className="hp-grid recipes">
                  {filteredRecipes.map((r) => {
                    const ok = canCraft(r, bag);
                    const busy = craftingId === r.id;
                    // Minecraft-style 3×3 craft grid: pad inputs into 9 cells.
                    const cells = Array.from({ length: 9 }, (_, i) => r.inputs[i] ?? null);
                    return (
                      <div key={r.id} className={"hp-recipe" + (ok ? "" : " is-locked")}>
                        <div className="hp-recipe-head">
                          <strong>{r.name}</strong>
                          <span className="hp-badge">
                            T{r.tier} · {r.station}
                          </span>
                        </div>
                        <div className="hp-craft-grid-wrap" aria-label="Crafting grid">
                          <div className="hp-craft-grid">
                            {cells.map((cell, i) => (
                              <div
                                key={i}
                                className={"hp-craft-cell" + (cell ? "" : " is-empty")}
                                title={cell ? `${cell.name} ×${cell.qty}` : "Empty"}
                              >
                                {cell ? (
                                  <>
                                    <img
                                      src={recipeItemIconUrl(cell.id)}
                                      alt=""
                                      className="hp-item-icon"
                                      onError={(e) => hideBrokenImg(e.currentTarget)}
                                    />
                                    <span className="hp-cell-qty">×{cell.qty}</span>
                                  </>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <span className="hp-craft-arrow" aria-hidden>
                            →
                          </span>
                          <div className="hp-craft-out" title={`${r.output.name} ×${r.output.qty}`}>
                            <img
                              src={recipeItemIconUrl(r.output.id)}
                              alt=""
                              className="hp-item-icon"
                              onError={(e) => hideBrokenImg(e.currentTarget)}
                            />
                            <span className="hp-cell-qty">×{r.output.qty}</span>
                          </div>
                        </div>
                        <div className="hp-recipe-out">
                          {r.output.name}
                          {r.heal ? ` · +${r.heal} HP` : ""}
                        </div>
                        <button
                          type="button"
                          className="hp-btn primary"
                          disabled={!ok || !!craftingId}
                          onClick={() => doCraft(r)}
                        >
                          {busy ? "Crafting…" : `Craft · ${r.timeSec}s`}
                        </button>
                      </div>
                    );
                  })}
                  {!filteredRecipes.length && (
                    <p className="hp-muted">No recipes match this filter.</p>
                  )}
                </div>
                <aside className="hp-bag" aria-label="Material bag">
                  <h4>Material bag</h4>
                  <ul>
                    {Object.entries(bag)
                      .filter(([, n]) => n > 0)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([id, n]) => (
                        <li key={id}>
                          <span className="hp-bag-item">
                            <img
                              src={matIconUrl(id)}
                              alt=""
                              className="hp-item-icon sm"
                              onError={(e) => hideBrokenImg(e.currentTarget)}
                            />
                            {prettyMatId(id)}
                          </span>
                          <strong>{n}</strong>
                        </li>
                      ))}
                  </ul>
                  <button
                    type="button"
                    className="hp-btn ghost"
                    onClick={() => {
                      try {
                        localStorage.removeItem("harvest:bag:v1");
                      } catch {
                        /* ignore */
                      }
                      setBag(ensureStarterBag());
                      showNotice("Starter bag reset");
                    }}
                  >
                    Reset starter bag
                  </button>
                </aside>
              </div>
              {craftNotice && <div className="hp-toast">{craftNotice}</div>}
            </section>
          )}

          {tab === "recipes" && (
            <section className="hp-panel">
              <h3>Recipe book</h3>
              <p className="hp-lead">
                Full list from content SSOT (<code>content/harvest/recipes.json</code>). Production
                expands via Mine-Loader item catalog + ObjectStore.
              </p>
              <label className="hp-search">
                <Search size={14} aria-hidden />
                <input
                  type="search"
                  placeholder="Filter recipe book…"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  aria-label="Filter recipe book"
                />
              </label>
              <div className="hp-table-wrap">
                <table className="hp-table">
                  <thead>
                    <tr>
                      <th>Recipe</th>
                      <th>Station</th>
                      <th>Skill</th>
                      <th>Tier</th>
                      <th>Output</th>
                      <th>Inputs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipes.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.station}</td>
                        <td>{r.skill}</td>
                        <td>T{r.tier}</td>
                        <td>
                          {r.output.name} ×{r.output.qty}
                          {r.heal ? ` (+${r.heal} HP)` : ""}
                        </td>
                        <td>{r.inputs.map((i) => `${i.name}×${i.qty}`).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hp-muted">{filteredRecipes.length} recipes · {stations.length} stations</p>
            </section>
          )}

          {tab === "codex" && (
            <section className="hp-panel">
              <h3>Mine-Loader Codex API</h3>
              <p className="hp-lead">
                Live block catalog &amp; mechanics definitions (
                <code>/api/blocks</code>, <code>/api/definitions</code>). Blocks place as{" "}
                <code>cat:…</code> in voxel worlds.
              </p>
              {codexLoading && <p className="hp-muted">Loading codex…</p>}
              {codex && (
                <div className="hp-codex">
                  <div className={"hp-status" + (codex.blocks.ok ? " ok" : " bad")}>
                    Blocks:{" "}
                    {codex.blocks.ok
                      ? `${codex.blocks.count} · ${codex.blocks.source}`
                      : codex.blocks.error}
                  </div>
                  <div className={"hp-status" + (codex.defs.ok ? " ok" : " bad")}>
                    Definitions:{" "}
                    {codex.defs.ok
                      ? `${codex.defs.count} · ${codex.defs.source}`
                      : "unavailable (direct Mine-Loader host used when proxy missing)"}
                  </div>

                  <div className="hp-filters">
                    <button
                      type="button"
                      className={"hp-chip" + (codexCategory === "all" ? " is-on" : "")}
                      onClick={() => setCodexCategory("all")}
                    >
                      All categories
                    </button>
                    {(codex.blocks.categories || []).slice(0, 12).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={"hp-chip" + (codexCategory === c ? " is-on" : "")}
                        onClick={() => setCodexCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <label className="hp-search">
                    <Search size={14} aria-hidden />
                    <input
                      type="search"
                      placeholder="Search blocks…"
                      value={codexSearch}
                      onChange={(e) => setCodexSearch(e.target.value)}
                      aria-label="Search codex blocks"
                    />
                  </label>

                  <h4>Blocks sample (deploy as cat:id in seed maps)</h4>
                  <div className="hp-grid mini">
                    {filteredBlocks.map((b) => (
                      <div key={b.id || b.name} className="hp-mini-card hp-block-card" title={b.id}>
                        <img
                          src={blockIconUrl(b.id || "stone")}
                          alt=""
                          className="hp-block-icon"
                          onError={(e) => hideBrokenImg(e.currentTarget)}
                        />
                        <strong>{b.name}</strong>
                        <span>{b.category || b.id}</span>
                        {b.id && <code className="hp-code">cat:{b.id}</code>}
                      </div>
                    ))}
                    {!filteredBlocks.length && !codexLoading && (
                      <p className="hp-muted">No blocks in filter — open live Codex.</p>
                    )}
                  </div>

                  {codex.defs.ok && codex.defs.sample.length > 0 && (
                    <>
                      <h4>Mechanics definitions</h4>
                      <div className="hp-grid mini">
                        {codex.defs.sample.slice(0, 16).map((d) => (
                          <div key={d.id || d.name} className="hp-mini-card">
                            <strong>{d.name}</strong>
                            {d.body && <span>{d.body}</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="hp-row-actions">
                    <button
                      type="button"
                      className="hp-btn primary"
                      onClick={() =>
                        window.open(openMineLoaderCodex(), "_blank", "noopener,noreferrer")
                      }
                    >
                      <ExternalLink size={14} /> Open full Codex UI
                    </button>
                    <button
                      type="button"
                      className="hp-btn ghost"
                      onClick={() => {
                        setCodexLoading(true);
                        void Promise.all([fetchCodexBlocks(), fetchCodexDefinitions()]).then(
                          ([blocks, defs]) => {
                            setCodex({ blocks, defs });
                            setCodexLoading(false);
                          },
                        );
                      }}
                    >
                      Refresh API
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "maps" && (
            <section className="hp-panel">
              <h3>Seed worlds · portals · maps library</h3>
              <p className="hp-lead">
                Minecraft-like <b>seed</b> open worlds deploy to Mine-Loader. Explore the overworld,
                find portals, then enter dungeons. Same seed always regenerates the same portal
                ring. Authority: Mine-Loader WorldSnapshot seed + scene.
              </p>
              {seedCatalog && (
                <div className="hp-status ok">
                  {seedCatalog.label} · {seedDeployments.length} deployments · journey:{" "}
                  {seedCatalog.journey?.slice(0, 3).join(" → ")}…
                </div>
              )}

              <h4>Seed world deployments</h4>
              <div className="hp-seed-row">
                <label className="hp-search">
                  <Search size={14} aria-hidden />
                  <input
                    type="text"
                    placeholder="Custom seed (like Minecraft)…"
                    value={customSeedInput}
                    onChange={(e) => setCustomSeedInput(e.target.value)}
                    aria-label="Custom world seed"
                  />
                </label>
                <button
                  type="button"
                  className="hp-btn primary"
                  disabled={!customSeedInput.trim()}
                  onClick={() => {
                    const dep = customSeedDeployment(customSeedInput.trim());
                    setSeedDeployments((prev) => {
                      const rest = prev.filter((d) => d.world.id !== dep.world.id);
                      return [dep, ...rest];
                    });
                    setSelectedSeedId(dep.world.id);
                    showNotice(`Seed ${dep.world.seedNumber} · ${dep.portals.length} portals`);
                  }}
                >
                  Generate portals
                </button>
              </div>

              <div className="hp-grid maps">
                {seedDeployments.map((dep) => {
                  const on = selectedSeedId === dep.world.id;
                  return (
                    <div
                      key={dep.world.id}
                      className={"hp-card" + (on ? " is-on" : "")}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSeedId(dep.world.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedSeedId(dep.world.id);
                        }
                      }}
                    >
                      <span className="hp-card-glyph">
                        {dep.world.mapChunkId ? "🗺" : "🌱"}
                      </span>
                      <span className="hp-card-title">{dep.world.name}</span>
                      <span className="hp-card-blurb">{dep.world.blurb}</span>
                      <span className="hp-card-meta">
                        seed {String(dep.world.seed)} · #{dep.world.seedNumber} · chunk{" "}
                        {dep.world.chunkIdx} ({chunkBlocks(dep.world.chunkIdx)}²) · {dep.world.biome}
                        {dep.world.mapChunkId ? ` · mapChunk ${dep.world.mapChunkId}` : ""}
                      </span>
                      {dep.world.codexBlocks?.length || dep.world.codexDefs?.length ? (
                        <span className="hp-card-meta" title="Mine-Loader Codex">
                          📘{" "}
                          {dep.world.codexBlocks?.length
                            ? `blocks: ${dep.world.codexBlocks.slice(0, 4).join(", ")}`
                            : ""}
                          {dep.world.codexBlocks?.length && dep.world.codexDefs?.length
                            ? " · "
                            : ""}
                          {dep.world.codexDefs?.length
                            ? `defs: ${dep.world.codexDefs.slice(0, 3).join(", ")}`
                            : ""}
                        </span>
                      ) : null}
                      <span className="hp-badge soft">
                        {dep.portals.length} portals → dungeons
                        {dep.world.mapChunkId ? " · map shell" : " · chunk gen"}
                        {dep.world.featured ? " · featured" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              {selectedSeedId &&
                (() => {
                  const dep = seedDeployments.find((d) => d.world.id === selectedSeedId);
                  if (!dep) return null;
                  return (
                    <div className="hp-seed-detail">
                      <h4>
                        Portals in {dep.world.name}
                        <span className="hp-tree-count">
                          find these in the open world to enter dungeons
                        </span>
                      </h4>
                      <div className="hp-grid mini">
                        {dep.portals.map((p) => (
                          <div key={p.id} className="hp-mini-card">
                            <strong>{p.name}</strong>
                            <span>
                              ({p.position.x}, {p.position.y}, {p.position.z})
                            </span>
                            <span>
                              → {p.dungeon.name} · T {p.dungeon.difficulty} · seed{" "}
                              {p.dungeon.seed}
                            </span>
                            <button
                              type="button"
                              className="hp-btn ghost"
                              style={{ marginTop: 6, width: "100%" }}
                              onClick={() => {
                                const u = buildPortalDungeonLaunchUrl(dep, p.id);
                                if (u) window.open(u, "_blank", "noopener,noreferrer");
                              }}
                            >
                              Jump dungeon (dev)
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="hp-row-actions">
                        <button
                          type="button"
                          className="hp-btn primary"
                          disabled={seedBusy}
                          onClick={() => {
                            window.open(
                              buildSeedWorldLaunchUrl(dep),
                              "_blank",
                              "noopener,noreferrer",
                            );
                            showNotice("Opening seed overworld in Realms…");
                          }}
                        >
                          <ExternalLink size={14} /> Deploy / play seed world
                        </button>
                        <button
                          type="button"
                          className="hp-btn ghost"
                          disabled={seedBusy}
                          onClick={() => {
                            setSeedBusy(true);
                            void shareSeedDeployment(dep).then((res) => {
                              setSeedBusy(false);
                              if (res.launchUrl) {
                                window.open(res.launchUrl, "_blank", "noopener,noreferrer");
                              }
                              showNotice(
                                res.ok
                                  ? `Shared world code ${res.code}`
                                  : res.error ?? "Opened with seed query",
                              );
                            });
                          }}
                        >
                          Share deploy code
                        </button>
                        <button
                          type="button"
                          className="hp-btn ghost"
                          onClick={() => {
                            downloadDeploymentJson(dep);
                            showNotice("Downloaded seed-world JSON");
                          }}
                        >
                          Export JSON
                        </button>
                        {onOpenRealms && (
                          <button
                            type="button"
                            className="hp-btn ghost"
                            onClick={() => onOpenRealms()}
                          >
                            Realms lobby
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

              <h4 style={{ marginTop: 18 }}>Assets · templates · Realms</h4>
              {worlds && (
                <div className={"hp-status" + (worlds.ok ? " ok" : " bad")}>
                  Mine-Loader worlds:{" "}
                  {worlds.ok ? `${worlds.count} · ${worlds.source}` : "list unavailable"}
                  {worlds.ok && worlds.sample.length > 0 && (
                    <span className="hp-inline-list">
                      {" "}
                      · {worlds.sample.map((w) => w.name).join(", ")}
                    </span>
                  )}
                </div>
              )}
              <div className="hp-grid maps">
                {maps.map((m) => (
                  <div key={m.id} className="hp-card static">
                    <span className="hp-card-glyph">
                      {m.kind === "island"
                        ? "🌍"
                        : m.kind === "arena"
                          ? "⚔"
                          : m.kind === "dungeon"
                            ? "🕳"
                            : m.kind === "voxel"
                              ? "🧊"
                              : m.kind === "map_chunk"
                                ? "🗺"
                                : "📐"}
                    </span>
                    <span className="hp-card-title">{m.name}</span>
                    <span className="hp-card-blurb">{m.blurb}</span>
                    <span className="hp-card-meta">{m.path}</span>
                    <span className="hp-badge soft">{m.kind}</span>
                    {m.category && (
                      <span className="hp-badge soft" title="D1 category">
                        {m.category}
                      </span>
                    )}
                    {(m.codexBlocks?.length || m.codexDefs?.length) ? (
                      <span className="hp-card-meta" title="Mine-Loader Codex links">
                        📘{" "}
                        {m.codexBlocks?.length
                          ? `blocks: ${m.codexBlocks.slice(0, 5).join(", ")}${m.codexBlocks.length > 5 ? "…" : ""}`
                          : ""}
                        {m.codexBlocks?.length && m.codexDefs?.length ? " · " : ""}
                        {m.codexDefs?.length
                          ? `defs: ${m.codexDefs.slice(0, 4).join(", ")}${m.codexDefs.length > 4 ? "…" : ""}`
                          : ""}
                      </span>
                    ) : null}
                    {m.kind === "island" && (
                      <button
                        type="button"
                        className="hp-btn primary"
                        onClick={() =>
                          onOpenRealms
                            ? onOpenRealms()
                            : window.open(openMineLoaderPlay(), "_blank", "noopener,noreferrer")
                        }
                      >
                        Enter Realms
                      </button>
                    )}
                    {(m.kind === "map_chunk" || m.codexBlocks?.length || m.codexDefs?.length) && (
                      <button
                        type="button"
                        className="hp-btn ghost"
                        title="Open Mine-Loader Codex (blocks API)"
                        onClick={() => window.open(openMineLoaderCodex(), "_blank", "noopener,noreferrer")}
                      >
                        Open Codex
                      </button>
                    )}
                    {m.kind === "voxel" && (
                      <button
                        type="button"
                        className="hp-btn ghost"
                        onClick={() => {
                          if (onOpenVoxel) onOpenVoxel();
                          else showNotice("Open Voxel Editor from the library / door");
                        }}
                      >
                        Open voxel editor
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {craftNotice && <div className="hp-toast">{craftNotice}</div>}
            </section>
          )}

          {tab === "trees" && (
            <section className="hp-panel">
              <h3>Class skill tree</h3>
              <p className="hp-lead">
                Craftpix Part 5 weapon / class skill book for production. Unlock harvest,
                crafting, building, survival, explorer, and <b>weapon combat</b> nodes.
                Weapon tree gates Danger Room slots 1–4 and ties equipped kit skills (anims +
                VFX) to progression. Progress saves to character bag when signed in; otherwise local.
              </p>
              {trees.length ? (
                <ClassSkillTreePanel
                  trees={trees}
                  preferredTreeId={
                    trees.find((t) => t.id.startsWith("class-"))?.id || "weapon-combat"
                  }
                  playerLevel={systemsState.level}
                  skillProgress={systemsState.skillProgress}
                  onProgressChange={(skillProgress) => {
                    const next: GrudgeSystemsState = {
                      ...systemsState,
                      skillProgress,
                      unlocked: skillProgress.unlocked.slice(),
                    };
                    setSystemsState(next);
                    scheduleSystemsStateSave(characterId, next);
                  }}
                  onUnlock={(nodeId) => {
                    const node = trees.flatMap((t) => t.nodes).find((n) => n.id === nodeId);
                    showNotice(node ? `Activated ${node.name}` : `Activated ${nodeId}`);
                  }}
                />
              ) : (
                <p className="hp-muted">Loading skill trees…</p>
              )}
              {craftNotice && <div className="hp-toast">{craftNotice}</div>}
            </section>
          )}

          {tab === "characters" && (
            <section className="hp-panel">
              <h3>Heroes &amp; units</h3>
              <p className="hp-lead">
                <b>Heroes</b> = your Warlords campfire roster (max {GRUDOX_MAX_SLOTS} user characters
                from Railway / GRUDOX). <b>Units</b> = explorers and faction troops — same catalog
                role for RTS, harvest, and combat labs.
              </p>
              <div className="hp-char-cols">
                <div>
                  <h4>
                    <Users size={14} /> Heroes · {GRUDOX_MAX_SLOTS}-slot scene
                  </h4>
                  <div className="hp-grid chars">
                    {heroChars.length === 0 && (
                      <p className="hp-muted">
                        Sign in with Grudge ID and create heroes on Account, or fill campfire seats
                        in Characters GRUDOX.
                      </p>
                    )}
                    {heroChars.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="hp-card"
                        onClick={() => {
                          onImportCharacter?.(c.id);
                          showNotice(`Hero ${c.name}`);
                        }}
                      >
                        <span className="hp-card-title">{c.name}</span>
                        <span className="hp-card-blurb">{c.blurb}</span>
                        <span className="hp-card-meta">hero</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>
                    <User size={14} /> Units · explorers &amp; troops
                  </h4>
                  <div className="hp-grid chars">
                    {units.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="hp-card"
                        onClick={() => {
                          onImportCharacter?.(c.id === "explorer" ? "explorer" : c.id);
                          showNotice(`Unit ${c.name}`);
                        }}
                      >
                        <span className="hp-card-glyph">
                          {c.id === "explorer" ? "🧭" : "⚔"}
                        </span>
                        <span className="hp-card-title">{c.name}</span>
                        <span className="hp-card-blurb">{c.blurb}</span>
                        <span className="hp-card-meta">
                          unit{c.unitType ? ` · ${c.unitType}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>
                    <Sparkles size={14} /> Avatar heads → explorer unit
                  </h4>
                  <div className="hp-grid chars">
                    {avatarChars.length === 0 && (
                      <p className="hp-muted">
                        Design a head in Avatar Edit or LED Mask → Design, then Save. Applies to the
                        Explorer unit, not hero slots.
                      </p>
                    )}
                    {avatarChars.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="hp-card"
                        onClick={() => importAvatar(c)}
                      >
                        <span className="hp-card-title">{c.name}</span>
                        <span className="hp-card-blurb">{c.blurb}</span>
                        <span className="hp-card-meta">Import head → unit</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {craftNotice && <div className="hp-toast">{craftNotice}</div>}
            </section>
          )}

          {tab === "systems" && (
            <section className="hp-panel">
              <h3>Voxel game systems</h3>
              <p className="hp-lead">
                Inclusive design map for harvest, craft, build, codex, maps, skill trees, and avatar
                import — how the production loop fits together. Engine stack SSOT: Three{" "}
                {ENGINE_STACK.three} · Rapier {ENGINE_STACK.rapier} · {ENGINE_STACK.vfxPrimary} ·
                HUD {ENGINE_STACK.hud2dPrimary}.{" "}
                <a href={`${import.meta.env.BASE_URL}docs/fleet-spider.html`} target="_blank" rel="noreferrer">
                  Fleet spider map ↗
                </a>
              </p>
              <div className="hp-grid chars" style={{ marginBottom: 16 }}>
                {Object.entries(engineStackSnapshot().hosts).map(([k, v]) => (
                  <div key={k} className="hp-card static">
                    <span className="hp-card-title">{k}</span>
                    <span className="hp-card-blurb" style={{ wordBreak: "break-all" }}>
                      {v}
                    </span>
                  </div>
                ))}
                <div className="hp-card static">
                  <span className="hp-card-title">AI hub</span>
                  <span className="hp-card-blurb">
                    {aiHealth == null
                      ? "Probing…"
                      : aiHealth.ok
                        ? `${aiHealth.service} v${aiHealth.version} · ${aiHealth.status}`
                        : `offline · ${aiHealth.error || "error"}`}
                  </span>
                  <span className="hp-card-meta">
                    {aiHealth?.providers
                      ? Object.entries(aiHealth.providers)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(" · ")
                      : "grudge-ai-hub"}
                  </span>
                </div>
              </div>
              <div className="hp-grid systems">
                {(systems?.pillars ?? []).map((p) => (
                  <div key={p.id} className="hp-card static">
                    <span className="hp-card-glyph">{p.glyph}</span>
                    <span className="hp-card-title">{p.name}</span>
                    <span className="hp-card-blurb">{p.summary}</span>
                    <div className="hp-sys-io">
                      <div>
                        <em>In</em>
                        <ul>
                          {p.inputs.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <em>Out</em>
                        <ul>
                          {p.outputs.map((o) => (
                            <li key={o}>{o}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <h4>Controls</h4>
              <div className="hp-table-wrap">
                <table className="hp-table">
                  <thead>
                    <tr>
                      <th>Input</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(systems?.controls ?? []).map((c) => (
                      <tr key={c.key}>
                        <td>
                          <kbd className="hp-kbd">{c.key}</kbd>
                        </td>
                        <td>{c.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {systems?.contentPaths?.length ? (
                <>
                  <h4>Content SSOT</h4>
                  <ul className="hp-path-list">
                    {systems.contentPaths.map((p) => (
                      <li key={p}>
                        <code>{p}</code>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          )}
        </div>

        <footer className="hp-foot">
          <span>
            Mode <b>{activityMode}</b> · Tool <b>{activityTool}</b> · Q cycle · hold Tab radial · X
            dodge · Esc close
          </span>
          <span className="hp-muted">Mine-Loader SSOT · content/harvest · fleet avatars</span>
        </footer>
      </div>
    </div>
  );
}

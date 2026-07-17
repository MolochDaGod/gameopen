/**
 * Camp Claim Flag hub — UI at the planted claim flag.
 *
 * Pages: Camp Skills · Farming · Taming · Defensives · Units · Buildings · Upgrades
 *
 * Units: trained from RTS production buildings, level 1–100, then convert to
 * a level-1 hero (T0 equip only) with profession carry-over.
 * Quick-craft (campfire, sleeping bag, …) is listed as excluded, not placeable here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flag, X } from "lucide-react";
import {
  canConvertUnitToHero,
  filterClaimGatedBuildings,
  flattenFactionUnits,
  loadClaimFlagDoc,
  loadFactionUnits,
  loadMasterBuildings,
  loadNodeUpgrades,
  productionBuildingForUnitType,
  unitXpToNext,
  type CampPageId,
  type ClaimFlagDoc,
  type FactionUnitsCatalog,
  type MasterBuilding,
  type NodeUpgradesCatalog,
} from "../game/campClaimCatalog";
import {
  convertUnitToHero,
  grantUnitXp,
  loadCampClaimState,
  scheduleCampClaimSave,
  setCampSkillLevel,
  setStructureLevel,
  trainUnit,
  type CampClaimState,
} from "../lib/campClaimPersist";
import {
  CLAIM_PLACEABLES,
  listClaimGatedPlaceables,
  getPlaceable,
  bindUnitMesh,
  listCommanders,
  listTravelers,
  listPrefabUnits,
} from "../three/camp";
import { resolveSkillNodeIconUrl } from "../lib/skillTreeIcons";
import "./campClaimFlag.css";

function PlaceGhostBtn({
  placeableId,
  onBeginPlace,
  label = "Place ghost",
}: {
  placeableId: string;
  onBeginPlace?: (id: string) => void;
  label?: string;
}) {
  const ok = !!getPlaceable(placeableId);
  return (
    <button
      type="button"
      className="ccf-btn gold"
      disabled={!ok || !onBeginPlace}
      title={
        ok
          ? "Ghost place — LMB commit · R rotate · Esc cancel"
          : `No placeable def for “${placeableId}” yet`
      }
      onClick={() => {
        if (ok) onBeginPlace?.(placeableId);
      }}
    >
      {ok ? label : "Mesh not ready"}
    </button>
  );
}

export type CampClaimFlagPanelProps = {
  open: boolean;
  characterId: string;
  onClose: () => void;
  /** Optional start page (e.g. deep-link to units). */
  initialPage?: CampPageId;
  /** Start Studio placeable ghost (claim-gated structures + flag). */
  onBeginPlace?: (placeableId: string) => void;
};

export function CampClaimFlagPanel({
  open,
  characterId,
  onClose,
  initialPage = "units",
  onBeginPlace,
}: CampClaimFlagPanelProps) {
  const [page, setPage] = useState<CampPageId>(initialPage);
  const [doc, setDoc] = useState<ClaimFlagDoc | null>(null);
  const [unitsCat, setUnitsCat] = useState<FactionUnitsCatalog | null>(null);
  const [buildings, setBuildings] = useState<MasterBuilding[]>([]);
  const [upgrades, setUpgrades] = useState<NodeUpgradesCatalog | null>(null);
  const [state, setState] = useState<CampClaimState>(() => loadCampClaimState(characterId));
  const [notice, setNotice] = useState<string | null>(null);
  const [trainFaction, setTrainFaction] = useState("crusade");

  useEffect(() => {
    if (!open) return;
    setState(loadCampClaimState(characterId));
    setPage(initialPage);
  }, [open, characterId, initialPage]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      loadClaimFlagDoc(),
      loadFactionUnits(),
      loadMasterBuildings(),
      loadNodeUpgrades(),
    ]).then(([d, u, b, up]) => {
      if (cancelled) return;
      setDoc(d);
      setUnitsCat(u);
      setBuildings(b);
      setUpgrades(up);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  const persist = useCallback(
    (next: CampClaimState) => {
      setState(next);
      scheduleCampClaimSave(characterId, next);
    },
    [characterId],
  );

  const prog = doc?.unitProgression;
  const claimBuildings = useMemo(
    () => filterClaimGatedBuildings(buildings, doc),
    [buildings, doc],
  );
  const allUnits = useMemo(() => flattenFactionUnits(unitsCat), [unitsCat]);
  const activeUnits = useMemo(
    () => state.units.filter((u) => !u.convertedHeroId),
    [state.units],
  );
  const pageSummary = doc?.pages.find((p) => p.id === page)?.summary;

  const onTrain = (defId: string) => {
    const def = allUnits.find((u) => u.id === defId);
    if (def) {
      const hall =
        productionBuildingForUnitType(def.type, doc?.productionBuildings || [])?.id ||
        "barracks";
      persist(
        trainUnit(state, {
          defId: def.id,
          name: def.name,
          type: def.type,
          factionId: def.factionId,
          producedBy: hall,
        }),
      );
      const bind = bindUnitMesh(def.id, {
        factionId: def.factionId,
        unitType: def.type,
      });
      setNotice(
        `Trained ${def.name} at ${hall} · mesh ${bind.raceId}/${bind.presetId} (L1)`,
      );
      return;
    }
    // Commander / prefab unit ids (uMMORPG warlords roles)
    const bind = bindUnitMesh(defId);
    const type =
      bind.presetId === "ranger"
        ? "ranged"
        : bind.presetId === "mage"
          ? "magic"
          : bind.presetId === "knight"
            ? "heavy"
            : "melee";
    persist(
      trainUnit(state, {
        defId,
        name: bind.prefab.label,
        type,
        factionId: bind.raceId,
        producedBy: bind.kind === "commander" ? "barracks" : "barracks",
      }),
    );
    setNotice(
      `Trained ${bind.prefab.label} · mesh ${bind.raceId}/${bind.presetId} · ${bind.kind}`,
    );
  };

  const onXp = (instanceId: string, amount: number) => {
    if (!prog) return;
    persist(grantUnitXp(state, instanceId, amount, prog));
  };

  const onConvert = (instanceId: string) => {
    if (!prog) return;
    const res = convertUnitToHero(state, instanceId, prog);
    if (!res.ok) {
      setNotice(res.error || "Convert failed");
      return;
    }
    persist(res.state);
    const hero = res.state.heroesFromUnits[res.state.heroesFromUnits.length - 1];
    setNotice(
      `Converted to L${prog.heroStartLevel} hero · T${prog.heroEquipMaxTier} gear only · professions carried: ${
        Object.keys(hero?.professions || {}).join(", ") || "none"
      }`,
    );
  };

  if (!open) return null;

  return (
    <div className="ccf-root" role="dialog" aria-label="Camp claim flag">
      <div className="ccf-shell">
        <header className="ccf-head">
          <div className="ccf-brand">
            <span className="ccf-flag" aria-hidden>
              <Flag size={28} color="#e8c547" />
            </span>
            <div>
              <h2>{doc?.label || "Camp Claim Flag"}</h2>
              <p>
                {doc?.description ||
                  "Build rights in claim radius. Quick-craft stays field-only."}
              </p>
            </div>
          </div>
          <div className="ccf-head-meta">
            <span className="ccf-pill">
              Radius {doc?.claim.radiusM ?? 48}m
            </span>
            <span className="ccf-pill warn">
              Units L{prog?.minLevel ?? 1}–{prog?.maxLevel ?? 100} → Hero T
              {prog?.heroEquipMaxTier ?? 0}
            </span>
            <button type="button" className="ccf-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        <nav className="ccf-tabs" aria-label="Claim flag pages">
          {(doc?.pages || DEFAULT_PAGES).map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ccf-tab ${page === p.id ? "active" : ""}`}
              onClick={() => setPage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>

        <div className="ccf-body">
          {pageSummary && <p className="ccf-page-intro">{pageSummary}</p>}
          {notice && (
            <p className="ccf-notice" role="status">
              {notice}
            </p>
          )}

          {page === "skills" && (
            <SkillsPage
              doc={doc}
              state={state}
              onLevel={(id, lv, max) => persist(setCampSkillLevel(state, id, lv, max))}
            />
          )}
          {page === "farming" && (
            <FarmingPage
              doc={doc}
              state={state}
              onStructure={persist}
              onBeginPlace={onBeginPlace}
            />
          )}
          {page === "taming" && <TamingPage doc={doc} onBeginPlace={onBeginPlace} />}
          {page === "defensives" && (
            <DefensivesPage
              doc={doc}
              state={state}
              onStructure={persist}
              onBeginPlace={onBeginPlace}
            />
          )}
          {page === "units" && (
            <UnitsPage
              doc={doc}
              allUnits={allUnits}
              activeUnits={activeUnits}
              heroes={state.heroesFromUnits}
              trainFaction={trainFaction}
              onFaction={setTrainFaction}
              onTrain={onTrain}
              onXp={onXp}
              onConvert={onConvert}
              prog={prog}
            />
          )}
          {page === "buildings" && (
            <BuildingsPage
              doc={doc}
              claimBuildings={claimBuildings}
              production={doc?.productionBuildings || []}
              onBeginPlace={onBeginPlace}
            />
          )}
          {page === "upgrades" && (
            <UpgradesPage
              upgrades={upgrades}
              state={state}
              production={doc?.productionBuildings || []}
              onStructure={(id, lv, max) =>
                persist(setStructureLevel(state, id, lv, max))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

const DEFAULT_PAGES: Array<{ id: CampPageId; label: string; summary: string }> = [
  { id: "skills", label: "Camp Skills", summary: "" },
  { id: "farming", label: "Farming", summary: "" },
  { id: "taming", label: "Taming", summary: "" },
  { id: "defensives", label: "Defensives", summary: "" },
  { id: "units", label: "Units", summary: "" },
  { id: "buildings", label: "Buildings", summary: "" },
  { id: "upgrades", label: "Upgrades", summary: "" },
];

function SkillsPage({
  doc,
  state,
  onLevel,
}: {
  doc: ClaimFlagDoc | null;
  state: CampClaimState;
  onLevel: (id: string, level: number, max: number) => void;
}) {
  const skills = doc?.accountCampSkills || [];
  return (
    <>
      <p className="ccf-notice dim">
        Account / camp skills improve this claim. Separate from class skill trees (K Systems).
        Profession XP on units still carries into hero convert.
      </p>
      {skills.map((s) => {
        const lv = state.campSkillLevels[s.id] || 0;
        const pct = s.maxLevel > 0 ? (lv / s.maxLevel) * 100 : 0;
        const ico = resolveSkillNodeIconUrl({
          icon: s.icon,
          iconUrl: s.iconUrl,
          id: s.id,
          treeId: "camp",
        });
        return (
          <div key={s.id} className="ccf-skill-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={ico}
                alt=""
                width={32}
                height={32}
                style={{
                  borderRadius: 6,
                  objectFit: "contain",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(212,164,0,0.3)",
                }}
                loading="lazy"
              />
              <h4 style={{ margin: 0 }}>
                {s.name}{" "}
                <span style={{ color: "#8fa3c0", fontWeight: 600 }}>
                  L{lv}/{s.maxLevel}
                </span>
              </h4>
            </div>
            <div className="ccf-actions">
              <button
                type="button"
                className="ccf-btn"
                disabled={lv <= 0}
                onClick={() => onLevel(s.id, lv - 1, s.maxLevel)}
              >
                −
              </button>
              <button
                type="button"
                className="ccf-btn primary"
                disabled={lv >= s.maxLevel}
                onClick={() => onLevel(s.id, lv + 1, s.maxLevel)}
              >
                +
              </button>
            </div>
            <p>{s.desc}</p>
            <div className="ccf-bar-track" style={{ gridColumn: "1 / -1" }}>
              <div className="ccf-bar-fill gold" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {!skills.length && <div className="ccf-empty">Camp skills catalog loading…</div>}
    </>
  );
}

function FarmingPage({
  doc,
  state,
  onStructure,
  onBeginPlace,
}: {
  doc: ClaimFlagDoc | null;
  state: CampClaimState;
  onStructure: (s: CampClaimState) => void;
  onBeginPlace?: (id: string) => void;
}) {
  const farms = doc?.farming || [];
  return (
    <>
      <p className="ccf-notice dim">
        Farm assets: Ultimate Fantasy RTS Farm / Windmill / Market lines. Claim-gated placeables —
        Place ghost enters build mode (LMB commit, R rotate).
      </p>
      <div className="ccf-grid">
        {farms.map((f) => {
          const lv = state.structureLevels[f.id] || 0;
          const placeId = f.id === "farm_wheat" || f.id === "farm_dirt" ? "farm_plot" : f.id;
          return (
            <article key={f.id} className="ccf-card">
              <h3>{f.name}</h3>
              <div className="sub">{f.assetLine}</div>
              <div className="meta">
                <span className="ccf-tag green">Tier {f.tier}</span>
                <span className="ccf-tag">Yield: {f.yield}</span>
                <span className="ccf-tag gold">Lv {lv}</span>
              </div>
              <div className="ccf-actions">
                <PlaceGhostBtn placeableId={placeId} onBeginPlace={onBeginPlace} />
                <button
                  type="button"
                  className="ccf-btn primary"
                  onClick={() =>
                    onStructure(setStructureLevel(state, f.id, Math.min(3, lv + 1), 3))
                  }
                >
                  Upgrade plot
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function TamingPage({
  doc,
  onBeginPlace,
}: {
  doc: ClaimFlagDoc | null;
  onBeginPlace?: (id: string) => void;
}) {
  const pens = doc?.taming || [];
  return (
    <>
      <p className="ccf-notice">
        Creature taming uses pens at the claim. Bond / husbandry profession levels on the
        unit roster carry over when a unit converts to a hero (T0 gear only).
      </p>
      <div className="ccf-grid">
        {pens.map((p) => (
          <article key={p.id} className="ccf-card">
            <h3>{p.name}</h3>
            <div className="sub">{p.desc}</div>
            <div className="meta">
              <span className="ccf-tag blue">Tier {p.tier}</span>
              {p.claimGated && <span className="ccf-tag gold">Claim gated</span>}
            </div>
            <div className="ccf-actions">
              <PlaceGhostBtn placeableId={p.id} onBeginPlace={onBeginPlace} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function DefensivesPage({
  doc,
  state,
  onStructure,
  onBeginPlace,
}: {
  doc: ClaimFlagDoc | null;
  state: CampClaimState;
  onStructure: (s: CampClaimState) => void;
  onBeginPlace?: (id: string) => void;
}) {
  const list = doc?.defensives || [];
  return (
    <>
      <p className="ccf-notice dim">
        Walls / towers from Ultimate Fantasy RTS. Ghost place requires claim rights (sandbox claim
        auto-planted in Danger Room at z=−6).
      </p>
      <div className="ccf-grid">
        {list.map((d) => {
          const lv = state.structureLevels[d.id] || 0;
          const placeId =
            d.id === "wall_tower" || d.id === "tower_house" || d.id === "wonder_wall"
              ? "watchtower"
              : d.id;
          return (
            <article key={d.id} className="ccf-card">
              <h3>{d.name}</h3>
              <div className="sub">{d.assetLine}</div>
              <div className="meta">
                <span className="ccf-tag">Tier {d.tier}</span>
                <span className="ccf-tag gold">Built Lv {lv}</span>
              </div>
              <div className="ccf-actions">
                <PlaceGhostBtn placeableId={placeId} onBeginPlace={onBeginPlace} />
                <button
                  type="button"
                  className="ccf-btn primary"
                  onClick={() =>
                    onStructure(setStructureLevel(state, d.id, Math.min(3, lv + 1), 3))
                  }
                >
                  Fortify +1
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function UnitsPage({
  doc,
  allUnits,
  activeUnits,
  heroes,
  trainFaction,
  onFaction,
  onTrain,
  onXp,
  onConvert,
  prog,
}: {
  doc: ClaimFlagDoc | null;
  allUnits: ReturnType<typeof flattenFactionUnits>;
  activeUnits: CampClaimState["units"];
  heroes: CampClaimState["heroesFromUnits"];
  trainFaction: string;
  onFaction: (f: string) => void;
  onTrain: (defId: string) => void;
  onXp: (id: string, amount: number) => void;
  onConvert: (id: string) => void;
  prog: ClaimFlagDoc["unitProgression"] | undefined;
}) {
  const factions = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of allUnits) m.set(u.factionId, u.factionName);
    return [...m.entries()];
  }, [allUnits]);

  const trainPool = allUnits.filter((u) => u.factionId === trainFaction);
  const maxLv = prog?.maxLevel ?? 100;
  const convertAt = prog?.heroConvertAtLevel ?? 100;
  const commanders = useMemo(() => listCommanders(), []);
  const travelers = useMemo(() => listTravelers(), []);
  const prefabUnits = useMemo(() => listPrefabUnits().slice(0, 12), []);

  return (
    <div className="ccf-split">
      <section>
        <h3 className="ccf-section-title">Roster (active units)</h3>
        <p className="ccf-notice">
          <strong>Roster sandbox</strong> — train / XP / convert are local UI only; units are not
          spawned in the world yet. Mesh bind shows grudge6 kit mapping for production spawn.
        </p>
        <p className="ccf-notice dim">
          Level to {convertAt} → L{prog?.heroStartLevel ?? 1} hero · T
          {prog?.heroEquipMaxTier ?? 0} equip · professions carry.
        </p>
        {activeUnits.length === 0 && (
          <div className="ccf-empty">No units yet — train from the catalog.</div>
        )}
        {activeUnits.map((u) => {
          const need = unitXpToNext(u.level, maxLv);
          const pct =
            u.level >= maxLv ? 100 : need > 0 ? Math.min(100, (u.xp / need) * 100) : 0;
          const ready = canConvertUnitToHero(u.level, prog);
          const bind = bindUnitMesh(u.defId, {
            factionId: u.factionId,
            unitType: u.type,
            name: u.name,
          });
          return (
            <article key={u.instanceId} className="ccf-card" style={{ marginBottom: 10 }}>
              <div className="ccf-row">
                <h3>
                  {u.name}{" "}
                  <span style={{ color: "#8fa3c0", fontWeight: 600 }}>
                    L{u.level}/{maxLv}
                  </span>
                </h3>
                <span className="ccf-tag blue">{u.type}</span>
              </div>
              <div className="sub">
                From <strong>{u.producedBy}</strong> · mesh{" "}
                <strong>
                  {bind.raceId}/{bind.presetId}
                </strong>{" "}
                · role {bind.roleId}
              </div>
              <div className="sub" style={{ opacity: 0.85 }}>
                {bind.meshSource}
              </div>
              {Object.keys(u.professions).length > 0 && (
                <div className="sub">
                  Profs:{" "}
                  {Object.entries(u.professions)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ")}
                </div>
              )}
              <div className="ccf-row">
                <div className="ccf-bar-track">
                  <div
                    className={`ccf-bar-fill ${ready ? "gold" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span style={{ fontSize: "0.7rem", color: "#8fa3c0", minWidth: 56 }}>
                  {u.level >= maxLv ? "MAX" : `${u.xp}/${need}`}
                </span>
              </div>
              <div className="ccf-actions">
                <button
                  type="button"
                  className="ccf-btn"
                  disabled={u.level >= maxLv}
                  onClick={() => onXp(u.instanceId, 50)}
                >
                  +50 XP
                </button>
                <button
                  type="button"
                  className="ccf-btn"
                  disabled={u.level >= maxLv}
                  onClick={() => onXp(u.instanceId, 500)}
                >
                  +500 XP
                </button>
                <button
                  type="button"
                  className="ccf-btn gold"
                  disabled={!ready}
                  onClick={() => onConvert(u.instanceId)}
                  title={
                    ready
                      ? "Convert to L1 hero (T0 gear, professions carry)"
                      : `Reach level ${convertAt}`
                  }
                >
                  Convert → Hero
                </button>
              </div>
            </article>
          );
        })}

        {heroes.length > 0 && (
          <>
            <h3 className="ccf-section-title" style={{ marginTop: 16 }}>
              Heroes from units (T0)
            </h3>
            <div className="ccf-grid">
              {heroes.map((h) => {
                const bind = bindUnitMesh(h.fromDefId);
                return (
                  <article key={h.heroId} className="ccf-card">
                    <h3>{h.name}</h3>
                    <div className="sub">
                      Mesh {bind.raceId}/{bind.presetId} · from {h.fromDefId}
                    </div>
                    <div className="meta">
                      <span className="ccf-tag gold">T{h.equipMaxTier} gear max</span>
                      <span className="ccf-tag green">L1 hero</span>
                    </div>
                    <div className="sub">
                      Profs:{" "}
                      {Object.keys(h.professions).length
                        ? Object.entries(h.professions)
                            .map(([k, v]) => `${k} ${v}`)
                            .join(", ")
                        : "—"}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <h3 className="ccf-section-title" style={{ marginTop: 16 }}>
          Commanders (uMMORPG prefabs)
        </h3>
        <div className="ccf-grid">
          {commanders.map((c) => (
            <article key={c.id} className="ccf-card">
              <h3>{c.label}</h3>
              <div className="sub">
                {c.raceId} · {c.presetId} · HP {c.maxHp}
              </div>
              <div className="meta">
                <span className="ccf-tag gold">commander</span>
                <span className="ccf-tag">{c.weaponId}</span>
              </div>
              <div className="ccf-actions">
                <button
                  type="button"
                  className="ccf-btn primary"
                  onClick={() => onTrain(c.id)}
                >
                  Train as unit
                </button>
              </div>
            </article>
          ))}
        </div>

        <h3 className="ccf-section-title" style={{ marginTop: 16 }}>
          Travelers (uMMORPG Npc)
        </h3>
        <div className="ccf-grid">
          {travelers.map((t) => (
            <article key={t.id} className="ccf-card">
              <h3>{t.label}</h3>
              <div className="sub">
                {t.raceId} · {t.presetId} · aggro {t.aggro}
              </div>
              <div className="meta">
                <span className="ccf-tag blue">traveler</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3 className="ccf-section-title">Train (RTS catalog)</h3>
        <div className="ccf-actions" style={{ marginBottom: 10 }}>
          {factions.map(([id, name]) => (
            <button
              key={id}
              type="button"
              className={`ccf-btn ${trainFaction === id ? "primary" : ""}`}
              onClick={() => onFaction(id)}
            >
              {name}
            </button>
          ))}
        </div>
        {!trainPool.length && (
          <div className="ccf-empty">
            factionUnits.json offline — use commanders / demo roster.
          </div>
        )}
        <div className="ccf-grid">
          {trainPool.map((u) => {
            const hall = productionBuildingForUnitType(
              u.type,
              doc?.productionBuildings || [],
            );
            const bind = bindUnitMesh(u.id, {
              factionId: u.factionId,
              unitType: u.type,
            });
            return (
              <article key={u.id} className="ccf-card">
                <h3>{u.name}</h3>
                <div className="sub">{u.description || u.type}</div>
                <div className="sub">
                  Mesh → {bind.raceId}/{bind.presetId}
                </div>
                <div className="meta">
                  <span className="ccf-tag">{u.type}</span>
                  {hall && <span className="ccf-tag gold">{hall.name}</span>}
                  {u.stats?.health != null && (
                    <span className="ccf-tag">HP {u.stats.health}</span>
                  )}
                </div>
                <div className="ccf-actions">
                  <button type="button" className="ccf-btn primary" onClick={() => onTrain(u.id)}>
                    Train L1
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <h3 className="ccf-section-title" style={{ marginTop: 16 }}>
          Prefab units (grudge6 hostiles)
        </h3>
        <div className="ccf-grid">
          {prefabUnits.map((p) => (
            <article key={p.id} className="ccf-card">
              <h3>{p.label}</h3>
              <div className="sub">
                {p.raceId} · {p.presetId}
              </div>
              <div className="meta">
                <span className="ccf-tag">unit prefab</span>
                <span className="ccf-tag blue">{p.combat.style}</span>
              </div>
              <div className="ccf-actions">
                <button type="button" className="ccf-btn primary" onClick={() => onTrain(p.id)}>
                  Train L1
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function BuildingsPage({
  doc,
  claimBuildings,
  production,
  onBeginPlace,
}: {
  doc: ClaimFlagDoc | null;
  claimBuildings: MasterBuilding[];
  production: ClaimFlagDoc["productionBuildings"];
  onBeginPlace?: (id: string) => void;
}) {
  const placeables = listClaimGatedPlaceables();
  return (
    <>
      <p className="ccf-notice">
        Migrated claim flag mesh: <code>models/camp/claim-flag.glb</code> (from Decor_PirateFlag_00).
        Place ghost → LMB commit · R rotate · Esc cancel. Quick-craft stays field-only.
      </p>

      <h3 className="ccf-section-title">Claim flag & placeables (ghost)</h3>
      <div className="ccf-grid" style={{ marginBottom: 16 }}>
        {CLAIM_PLACEABLES.filter((p) => p.category !== "quick_craft").map((p) => (
          <article key={p.id} className="ccf-card">
            <h3>{p.name}</h3>
            <div className="sub">{p.assetNote || p.category}</div>
            <div className="meta">
              <span className="ccf-tag">{p.category}</span>
              {p.claimGated ? (
                <span className="ccf-tag gold">claim gated</span>
              ) : (
                <span className="ccf-tag green">plant free</span>
              )}
              {p.meshUrl && <span className="ccf-tag blue">GLB</span>}
            </div>
            <div className="ccf-actions">
              <PlaceGhostBtn placeableId={p.id} onBeginPlace={onBeginPlace} />
            </div>
          </article>
        ))}
      </div>

      <h3 className="ccf-section-title">RTS production halls</h3>
      <div className="ccf-grid" style={{ marginBottom: 16 }}>
        {production.map((p) => (
          <article key={p.id} className="ccf-card">
            <h3>{p.name}</h3>
            <div className="sub">{p.assetLine}</div>
            <div className="meta">
              <span className="ccf-tag gold">{p.role}</span>
              {p.producesTypes.map((t) => (
                <span key={t} className="ccf-tag">
                  {t}
                </span>
              ))}
              {p.claimGated && <span className="ccf-tag green">Claim</span>}
            </div>
            <div className="ccf-actions">
              <PlaceGhostBtn placeableId={p.id} onBeginPlace={onBeginPlace} />
            </div>
          </article>
        ))}
      </div>

      <h3 className="ccf-section-title">Stations & storage (master-buildings)</h3>
      <div className="ccf-grid">
        {claimBuildings.map((b) => (
          <article key={b.uuid} className="ccf-card">
            <h3>{b.name}</h3>
            <div className="sub">{b.description}</div>
            <div className="meta">
              <span className="ccf-tag">{b.category}</span>
              {b.profession && b.profession !== "none" && (
                <span className="ccf-tag blue">{b.profession}</span>
              )}
              {b.tier != null && <span className="ccf-tag gold">T{b.tier}</span>}
            </div>
            {b.buildMaterials && b.buildMaterials.length > 0 && (
              <div className="sub">
                Cost:{" "}
                {b.buildMaterials.map((m) => `${m.quantity} ${m.name}`).join(", ")}
              </div>
            )}
          </article>
        ))}
        {!claimBuildings.length && (
          <div className="ccf-empty">master-buildings.json loading or empty…</div>
        )}
      </div>

      <h3 className="ccf-section-title" style={{ marginTop: 16 }}>
        Quick-craft (not claim-gated)
      </h3>
      <div className="ccf-grid">
        {(doc?.quickCraft?.excludeFromClaimGate || []).map((q) => (
          <article key={q.id} className="ccf-card">
            <h3>{q.name}</h3>
            <div className="sub">Field kit — place anywhere without flag rights.</div>
            <div className="meta">
              <span className="ccf-tag">quick-craft</span>
            </div>
            <div className="ccf-actions">
              <button
                type="button"
                className="ccf-btn primary"
                onClick={() => onBeginPlace?.(q.id)}
              >
                Place ghost
              </button>
            </div>
          </article>
        ))}
      </div>
      {placeables.length === 0 && null}
    </>
  );
}

function UpgradesPage({
  upgrades,
  state,
  production,
  onStructure,
}: {
  upgrades: NodeUpgradesCatalog | null;
  state: CampClaimState;
  production: ClaimFlagDoc["productionBuildings"];
  onStructure: (id: string, level: number, max: number) => void;
}) {
  const nodeEntries = Object.entries(upgrades?.nodeTypes || {});
  const tierEntries = Object.entries(upgrades?.unitTiers || {});

  return (
    <>
      <h3 className="ccf-section-title">Production structure levels</h3>
      <div className="ccf-grid" style={{ marginBottom: 16 }}>
        {production.map((p) => {
          const lv = state.structureLevels[p.id] || 0;
          return (
            <article key={p.id} className="ccf-card">
              <h3>{p.name}</h3>
              <div className="ccf-row">
                <div className="ccf-bar-track">
                  <div
                    className="ccf-bar-fill gold"
                    style={{
                      width: `${(lv / Math.max(1, p.maxLevel)) * 100}%`,
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.75rem" }}>
                  {lv}/{p.maxLevel}
                </span>
              </div>
              <div className="ccf-actions">
                <button
                  type="button"
                  className="ccf-btn"
                  disabled={lv <= 0}
                  onClick={() => onStructure(p.id, lv - 1, p.maxLevel)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="ccf-btn primary"
                  disabled={lv >= p.maxLevel}
                  onClick={() => onStructure(p.id, lv + 1, p.maxLevel)}
                >
                  Upgrade
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <h3 className="ccf-section-title">Node upgrade tracks (nodeUpgrades SSOT)</h3>
      {nodeEntries.length === 0 && (
        <div className="ccf-empty">nodeUpgrades.json offline…</div>
      )}
      {nodeEntries.map(([key, node]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 6px", color: "#e8c547" }}>
            {key} — {node.description}
          </h4>
          <table className="ccf-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Cost</th>
                <th>Spawn</th>
                <th>HP</th>
                <th>Vision</th>
              </tr>
            </thead>
            <tbody>
              {(node.upgrades || []).map((u) => (
                <tr key={u.level}>
                  <td>{u.level}</td>
                  <td>{u.cost}</td>
                  <td>{u.spawnRate ?? "—"}</td>
                  <td>{u.health ?? "—"}</td>
                  <td>{u.visionRadius ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tierEntries.length > 0 && (
        <>
          <h3 className="ccf-section-title">Unit unlock tiers by faction</h3>
          <div className="ccf-grid">
            {tierEntries.map(([faction, tiers]) => (
              <article key={faction} className="ccf-card">
                <h3>{faction}</h3>
                {Object.entries(tiers).map(([tier, ids]) => (
                  <div key={tier} className="sub" style={{ marginTop: 4 }}>
                    <strong>{tier}</strong>: {(ids as string[]).join(", ")}
                  </div>
                ))}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

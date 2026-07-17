/**
 * Craftpix Part_5 style class / weapon skill tree for production main panel.
 * Book list · Talent grid · Path (milestone 0/1/5/10/15/20 + bridge nodes).
 *
 * Data: fleet master-skillTrees + additive class-skill-bridges (not a class rewrite).
 */
import { useEffect, useMemo, useState } from "react";
import type { SkillNode, SkillTree } from "../../game/harvestCatalog";
import {
  CLASS_SKILL_MILESTONES,
  grantAutoNodesFromTree,
  loadSkillUnlocks,
  skillBandLabel,
  unlockSkillNode,
} from "../../game/harvestCatalog";
import { treeIconName } from "../../lib/gameMedia";
import {
  resolveSkillNodeIconUrl,
  resolveTreeHeaderIconUrl,
} from "../../lib/skillTreeIcons";
import { Icon } from "../Icon";
import "./craftpixHud.css";

/** Per-node original catalog icon with safe broken-image fallback. */
function SkillNodeIcon({
  node,
  treeId,
  size = 28,
  className,
}: {
  node: SkillNode;
  treeId: string;
  size?: number;
  className?: string;
}) {
  const src = resolveSkillNodeIconUrl({
    icon: node.icon,
    iconUrl: node.iconUrl,
    id: node.id,
    kind: node.kind,
    treeId,
  });
  return (
    <img
      className={className || "cx-node-icon"}
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fb) return;
        el.dataset.fb = "1";
        el.src = resolveTreeHeaderIconUrl(treeId);
      }}
    />
  );
}

export interface ClassSkillTreePanelProps {
  trees: SkillTree[];
  /** Prefer this tree first (e.g. class-warrior or weapon-combat). */
  preferredTreeId?: string;
  /** Character level for path gates (sandbox default 20). */
  playerLevel?: number;
  onUnlock?: (nodeId: string, unlocks: string[]) => void;
}

function ribbonClass(unlocked: boolean, reqOk: boolean, tier: number): string {
  if (unlocked) return "green";
  if (!reqOk) return "gray";
  if (tier >= 3) return "red";
  if (tier >= 2) return "orange";
  return "orange";
}

function kindLabel(n: SkillNode): string {
  if (n.requiredLevel === 0) return "L0";
  if (n.kind === "milestone") return "MS";
  if (n.kind === "proc") return "PROC";
  if (n.kind === "selection") return "PICK";
  if (n.kind === "form") return "FORM";
  if (n.kind === "passive" || n.passive) return "PAS";
  if (n.kind === "bridge") return "BR";
  return n.kind?.toUpperCase().slice(0, 4) || "SK";
}

function canUnlockNode(
  n: SkillNode,
  unlocks: string[],
  playerLevel: number,
): { ok: boolean; reason?: string } {
  const needLv = n.requiredLevel ?? 0;
  if (needLv > playerLevel) return { ok: false, reason: `Need level ${needLv}` };
  if (n.auto || needLv === 0) return { ok: true };
  const reqOk = (n.requires || []).every((r) => unlocks.includes(r));
  if (!reqOk) return { ok: false, reason: "Requires prior nodes" };
  return { ok: true };
}

/** Group nodes into path columns: L0, L1, bridges 2-4, L5, bridges 6-9, … */
function pathColumns(nodes: SkillNode[]): Array<{ level: number; label: string; milestone: boolean; nodes: SkillNode[] }> {
  const byLv = new Map<number, SkillNode[]>();
  for (const n of nodes) {
    const lv = n.requiredLevel ?? 0;
    if (!byLv.has(lv)) byLv.set(lv, []);
    byLv.get(lv)!.push(n);
  }
  const levels = [...byLv.keys()].sort((a, b) => a - b);
  return levels.map((level) => ({
    level,
    label: skillBandLabel(level),
    milestone: (CLASS_SKILL_MILESTONES as readonly number[]).includes(level),
    nodes: byLv.get(level) || [],
  }));
}

export function ClassSkillTreePanel({
  trees,
  preferredTreeId = "weapon-combat",
  playerLevel = 20,
  onUnlock,
}: ClassSkillTreePanelProps) {
  const ordered = useMemo(() => {
    const list = [...trees];
    list.sort((a, b) => {
      if (a.id === preferredTreeId) return -1;
      if (b.id === preferredTreeId) return 1;
      // Class trees before harvest content
      const ac = a.id.startsWith("class-") ? 0 : 1;
      const bc = b.id.startsWith("class-") ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [trees, preferredTreeId]);

  const [treeId, setTreeId] = useState(ordered[0]?.id ?? preferredTreeId);
  const [unlocks, setUnlocks] = useState(() => loadSkillUnlocks());
  const [view, setView] = useState<"path" | "list" | "talent">("path");

  // Keep preferred tree in sync when class chip changes
  useEffect(() => {
    if (preferredTreeId && ordered.some((t) => t.id === preferredTreeId)) {
      setTreeId(preferredTreeId);
    }
  }, [preferredTreeId, ordered]);

  const tree = ordered.find((t) => t.id === treeId) ?? ordered[0];

  // Auto-grant L0 / auto nodes when viewing a class tree
  useEffect(() => {
    if (!tree?.id.startsWith("class-")) return;
    const next = grantAutoNodesFromTree(tree);
    setUnlocks(next);
  }, [tree?.id]);

  const columns = useMemo(() => (tree ? pathColumns(tree.nodes) : []), [tree]);

  if (!tree) {
    return (
      <div className="cx-skill-panel">
        <div className="cx-skill-head">
          <h3>Class skill tree</h3>
          <p>Loading trees…</p>
        </div>
      </div>
    );
  }

  const tryUnlock = (n: SkillNode) => {
    const gate = canUnlockNode(n, unlocks, playerLevel);
    if (!gate.ok || unlocks.includes(n.id)) return;
    if (n.auto || n.requiredLevel === 0) return; // already granted
    const next = unlockSkillNode(n.id);
    setUnlocks(next);
    onUnlock?.(n.id, next);
  };

  return (
    <div className="cx-skill-panel" data-tree={tree.id}>
      <header className="cx-skill-head">
        <div className="cx-skill-head-icon">
          {tree.iconUrl || tree.icon ? (
            <img
              src={resolveTreeHeaderIconUrl(tree.id, tree.iconUrl || tree.icon)}
              alt=""
              width={28}
              height={28}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Icon name={treeIconName(tree.id)} size={22} />
          )}
        </div>
        <div>
          <h3>Class · {tree.name}</h3>
          <p>
            One class selected · L0 at pick · milestones L1 / L5 / L10 / L15 / L20 · bridge nodes
            (passives, procs, health) between. Character level {playerLevel}.
          </p>
        </div>
        <div
          className="cx-skill-points"
          title="Sandbox unlock count (not a spend budget yet — unlocks are free locally)"
        >
          {unlocks.length} unlocks
        </div>
      </header>

      <div className="cx-skill-tabs" role="tablist">
        {ordered.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={"cx-skill-tab" + (t.id === tree.id ? " is-on" : "")}
            style={t.id === tree.id ? { borderColor: t.color, color: t.color } : undefined}
            onClick={() => setTreeId(t.id)}
          >
            {t.name}
          </button>
        ))}
        <button
          type="button"
          className={"cx-skill-tab" + (view === "path" ? " is-on" : "")}
          onClick={() => setView("path")}
          style={{ marginLeft: "auto" }}
        >
          Path
        </button>
        <button
          type="button"
          className={"cx-skill-tab" + (view === "list" ? " is-on" : "")}
          onClick={() => setView("list")}
        >
          Book
        </button>
        <button
          type="button"
          className={"cx-skill-tab" + (view === "talent" ? " is-on" : "")}
          onClick={() => setView("talent")}
        >
          Talents
        </button>
      </div>

      <div className="cx-skill-body">
        {view === "path" && (
          <div className="cx-path-scroll">
            <div className="cx-path-rail">
              {columns.map((col) => (
                <div
                  key={col.level}
                  className={
                    "cx-path-col" + (col.milestone ? " is-milestone" : " is-bridge")
                  }
                >
                  <div className="cx-path-col-head" title={`Required level ${col.level}`}>
                    {col.label}
                  </div>
                  <div className="cx-path-nodes">
                    {col.nodes.map((n) => {
                      const unlocked = unlocks.includes(n.id);
                      const gate = canUnlockNode(n, unlocks, playerLevel);
                      const locked = !unlocked && !gate.ok;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className={
                            "cx-path-node" +
                            (unlocked ? " is-on" : "") +
                            (locked ? " is-lock" : "") +
                            (col.milestone ? " is-ms" : "")
                          }
                          disabled={unlocked || locked || n.auto || n.requiredLevel === 0}
                          title={
                            locked
                              ? `${n.name}: ${gate.reason || "Locked"} — ${n.desc}`
                              : `${n.name}: ${n.desc}`
                          }
                          onClick={() => tryUnlock(n)}
                        >
                          <SkillNodeIcon node={n} treeId={tree.id} size={32} className="cx-path-ico" />
                          <span className="cx-path-kind">{kindLabel(n)}</span>
                          <span className="cx-path-name">{n.name}</span>
                          <span className="cx-path-meta">
                            {unlocked
                              ? n.auto || n.requiredLevel === 0
                                ? "AUTO"
                                : "OWN"
                              : locked
                                ? "LOCK"
                                : `${n.cost}p`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="cx-path-legend">
              <span className="cx-path-legend-ms">Milestone</span> L0 select · L1 start · L5 / L10 /
              L15 / L20 from fleet trees ·{" "}
              <span className="cx-path-legend-br">Bridge</span> passives / procs / health between.
              Worge L0 includes Bear form start.
            </p>
          </div>
        )}

        {view === "list" &&
          tree.nodes.map((n) => {
            const unlocked = unlocks.includes(n.id);
            const gate = canUnlockNode(n, unlocks, playerLevel);
            const ribbon = ribbonClass(unlocked, gate.ok, n.tier);
            return (
              <button
                key={n.id}
                type="button"
                className={
                  "cx-spell-row" +
                  (unlocked ? " is-unlocked" : "") +
                  (!gate.ok && !unlocked ? " is-locked" : "")
                }
                disabled={unlocked || !gate.ok || n.auto || n.requiredLevel === 0}
                onClick={() => tryUnlock(n)}
                title={n.desc}
              >
                <div className="cx-spell-icon-wrap">
                  <SkillNodeIcon node={n} treeId={tree.id} size={32} />
                  <span className="cx-spell-icon-overlay" />
                </div>
                <div className="cx-spell-main">
                  <span className="cx-spell-name">
                    {n.name}{" "}
                    <em className="cx-spell-lv">
                      {skillBandLabel(n.requiredLevel ?? 0)} · {kindLabel(n)}
                    </em>
                  </span>
                  <span className="cx-spell-desc">{n.desc}</span>
                </div>
                <div className={`cx-spell-ribbon ${ribbon}`}>
                  <span>L{n.requiredLevel ?? 0}</span>
                  <span>
                    {unlocked
                      ? n.auto || n.requiredLevel === 0
                        ? "AUTO"
                        : "OWN"
                      : gate.ok
                        ? `${n.cost}p`
                        : "LOCK"}
                  </span>
                </div>
              </button>
            );
          })}

        {view === "talent" && (
          <div className="cx-talent-grid">
            {tree.nodes.map((n) => {
              const unlocked = unlocks.includes(n.id);
              const gate = canUnlockNode(n, unlocks, playerLevel);
              return (
                <button
                  key={n.id}
                  type="button"
                  className={"cx-talent-node" + (unlocked ? " is-on" : "")}
                  disabled={unlocked || !gate.ok || n.auto || n.requiredLevel === 0}
                  title={`${n.name} (L${n.requiredLevel ?? 0}): ${n.desc}`}
                  onClick={() => tryUnlock(n)}
                >
                  <span className="cx-talent-ico">
                    <SkillNodeIcon node={n} treeId={tree.id} size={26} />
                  </span>
                  <span className="cx-talent-rank">
                    {unlocked ? "✓" : n.requiredLevel === 0 ? "0" : n.cost}
                  </span>
                  <span className="cx-talent-lab">{n.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

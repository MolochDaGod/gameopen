/**
 * Toolbox overlay: tabbed workbench.
 *  Tools  — 5×5 gold launchers (modes / docks / HUD / loadout)
 *  Three  — Three.js systems, scripts, tools, helpers
 *  Rapier — physics systems, colliders, queries, debug
 *  R3F    — React Three Fiber canvas, hooks, drei, perf
 *  Create — Grok Builder games / modes / edits
 *  Music  — CPT RAC Station + volume mixer (host-injected)
 */
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { iconUrl } from "../../three/icons";
import {
  toolsForTab,
  type ToolDef,
  type ToolboxTabId,
} from "./tools";
import "./toolbox.css";

interface Props {
  onLaunch: (tool: ToolDef) => void;
  onClose: () => void;
  /** Music tab content (RAC Station + volume mixer); omit to hide the tab. */
  music?: ReactNode;
}

const TABS: { id: ToolboxTabId; label: string; tip: string }[] = [
  { id: "tools", label: "Tools", tip: "Live Open launchers — every icon opens where it lives" },
  { id: "three", label: "Three.js", tip: "Scene, cameras, animation, loaders, helpers, cinema" },
  { id: "rapier", label: "Rapier", tip: "World, CCT, colliders, joints, queries, layers, debug" },
  { id: "r3f", label: "R3F", tip: "Canvas, hooks, drei, Rapier bridge, Suspense, performance" },
  { id: "create", label: "Create", tip: "Grok Builder — invent games, modes, edits" },
];

export function ToolboxOverlay({ onLaunch, onClose, music }: Props) {
  const [tab, setTab] = useState<ToolboxTabId>("tools");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const showMusic = Boolean(music);
  const activeTools = tab === "music" ? [] : toolsForTab(tab);
  const sub =
    tab === "tools"
      ? "Pick a tool — it opens where it lives"
      : tab === "three"
        ? "Three.js systems · scripts · tools · helpers"
        : tab === "rapier"
          ? "Rapier physics · CCT · colliders · queries"
          : tab === "r3f"
            ? "React Three Fiber · drei · performance"
            : tab === "create"
              ? "Create games · modes · edits in Grok Builder"
              : "CPT RAC Station & volume mixer";

  return (
    <motion.div
      className="toolbox-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="toolbox toolbox-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Toolbox"
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="toolbox-head">
          <span className="toolbox-title">Toolbox</span>
          <div className="toolbox-tabs" role="tablist" aria-label="Toolbox sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`toolbox-tab ${tab === t.id ? "on" : ""}`}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                data-tip={t.tip}
              >
                {t.label}
              </button>
            ))}
            {showMusic && (
              <button
                className={`toolbox-tab ${tab === "music" ? "on" : ""}`}
                role="tab"
                aria-selected={tab === "music"}
                onClick={() => setTab("music")}
                data-tip="CPT RAC Station player & volume mixer"
              >
                Music
              </button>
            )}
          </div>
          <button
            className="toolbox-close"
            onClick={onClose}
            aria-label="Close toolbox"
            data-tip="Close (Esc)"
          >
            <X size={16} />
          </button>
        </header>
        <div className="toolbox-sub-bar">{sub}</div>
        {tab === "music" && music ? (
          <div className="toolbox-music">{music}</div>
        ) : (
          <div className={`toolbox-grid ${tab !== "tools" ? "toolbox-grid-stack" : ""}`}>
            {activeTools.map((tool) => (
              <button
                key={`${tool.stack || "tools"}-${tool.label}`}
                className="toolbox-tool"
                data-tip={tool.hint}
                data-stack={tool.stack || "tools"}
                onClick={() => onLaunch(tool)}
              >
                <img
                  src={iconUrl(tool.icon)}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.dataset.fallback) return;
                    el.dataset.fallback = "1";
                    // Gold framed pack — always have animator as last resort
                    el.src = iconUrl("animator");
                  }}
                />
                <span className="toolbox-tool-label">{tool.label}</span>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

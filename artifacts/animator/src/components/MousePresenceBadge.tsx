/**
 * Visible mouse state chip — shows when the OS/custom cursor is free
 * (unlocked: shell, UI menus, free-mouse play, editors).
 * Hidden during play-locked aim (crosshair only).
 */
import { useEffect, useState } from "react";
import {
  getPointerPresence,
  pointerShowsOsCursor,
  subscribePointerPresence,
  type PointerLayer,
} from "@workspace/grudge-physics";
import { assetUrl } from "../lib/fleet";
import "./mousePresenceBadge.css";

const LAYER_LABEL: Record<PointerLayer, string> = {
  shell: "Menu mouse",
  ui: "UI mouse",
  "play-free": "Free mouse",
  "play-locked": "Locked",
};

export function MousePresenceBadge() {
  const [layer, setLayer] = useState<PointerLayer>(() => getPointerPresence().layer);
  const [show, setShow] = useState(() => pointerShowsOsCursor());

  useEffect(() => {
    const sync = () => {
      const p = getPointerPresence();
      setLayer(p.layer);
      setShow(pointerShowsOsCursor(p));
    };
    sync();
    return subscribePointerPresence(sync);
  }, []);

  if (!show) return null;

  const icon =
    layer === "ui" || layer === "shell"
      ? assetUrl("ui/cursors/cursor-default.svg")
      : assetUrl("ui/cursors/cursor-interact.svg");

  return (
    <div
      className={`mouse-presence-badge mouse-presence-badge--${layer}`}
      title="Mouse unlocked — Escape / click world to re-lock aim in combat (F8 free-mouse sticky)"
      data-pointer-layer={layer}
    >
      <img src={icon} alt="" width={16} height={16} draggable={false} />
      <span>{LAYER_LABEL[layer]}</span>
    </div>
  );
}

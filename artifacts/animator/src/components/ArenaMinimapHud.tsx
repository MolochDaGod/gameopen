/**
 * Live arena / FFA minimap overlay — pads + score during matches.
 */
import { useEffect, useRef } from "react";
import type { ArenaMatchHudState } from "../three/types";
import { ARENA_MAP_CARDS, getMapMinimapUrl } from "../lib/mapPreviews";
import "./mapCard.css";

export function ArenaMinimapHud({ arena }: { arena: ArenaMatchHudState | null | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!arena?.active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const size = 280;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Base art from map catalog
    const def =
      arena.mode === "ffa4"
        ? ARENA_MAP_CARDS.find((c) => c.id === "arena-ffa4")
        : arena.mode === "2v2"
          ? ARENA_MAP_CARDS.find((c) => c.id === "arena-2v2")
          : ARENA_MAP_CARDS.find((c) => c.id === "arena-1v1");
    if (def) {
      const url = getMapMinimapUrl(def, size);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        drawLive(ctx, size, arena);
      };
      img.src = url;
    } else {
      ctx.fillStyle = "#0a1018";
      ctx.fillRect(0, 0, size, size);
      drawLive(ctx, size, arena);
    }
  }, [arena?.active, arena?.mode, arena?.playerKills, arena?.fieldKills, arena?.phase, arena?.bars]);

  if (!arena?.active) return null;

  const score =
    arena.mode === "ffa4"
      ? `${arena.playerKills ?? 0}–${arena.fieldKills ?? 0}`
      : `${arena.livingAllies + 1}v${arena.livingEnemies}`;

  return (
    <div className="arena-minimap" aria-hidden>
      <div className="arena-minimap-head">
        <span>{arena.modeLabel}</span>
        <span className="arena-minimap-score">{score}</span>
      </div>
      <canvas ref={canvasRef} className="arena-minimap-canvas" />
      <div className="arena-minimap-foot">
        {arena.skillCue || arena.label || arena.opponentLabel}
      </div>
    </div>
  );
}

function drawLive(
  ctx: CanvasRenderingContext2D,
  size: number,
  arena: ArenaMatchHudState,
) {
  // Living fighters as blips from bars
  const living = arena.bars.filter((b) => !b.dead);
  const n = Math.max(1, living.length);
  living.forEach((b, i) => {
    let x = size * 0.5;
    let y = size * 0.5;
    if (arena.mode === "ffa4") {
      const pads = [
        [0.28, 0.5],
        [0.5, 0.28],
        [0.72, 0.5],
        [0.5, 0.72],
      ];
      const p = pads[i % pads.length]!;
      x = size * p[0]!;
      y = size * p[1]!;
    } else if (b.faction === "player" || b.faction === "ally") {
      x = size * 0.3;
      y = size * (0.4 + i * 0.12);
    } else {
      x = size * 0.7;
      y = size * (0.4 + (i % 3) * 0.12);
    }
    const color =
      b.faction === "player"
        ? "#4fc3ff"
        : b.faction === "ally"
          ? "#6fffb0"
          : "#ff6a6a";
    // Health ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, b.health01));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  void n;

  if (arena.phase === "countdown") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${size * 0.22}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(arena.label || "…", size / 2, size / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}

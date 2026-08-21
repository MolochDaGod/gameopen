/**
 * Functional Agama Survival minimap — world-space blips for player, allies,
 * hostiles, harvest, faction camps, and the extraction objective.
 */
import type { AgamaHarvestNode, AgamaZone, Vec2 } from "./agamaBattleground";

export interface AgamaMinimapBlip {
  x: number;
  z: number;
  color: string;
  r?: number;
  yaw?: number;
  kind: "player" | "ally" | "enemy" | "harvest" | "extract" | "zone";
}

export class AgamaMinimap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 196;
  private worldHalf = 220;
  private origin: Vec2 = { x: 0, z: 0 };

  constructor(parent?: HTMLElement | null) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.className = "agama-minimap";
    this.canvas.setAttribute("aria-label", "Agama minimap");
    this.canvas.style.cssText = [
      "position:absolute",
      "right:14px",
      "top:52px",
      "width:196px",
      "height:196px",
      "border-radius:14px",
      "border:1px solid rgba(232,160,64,0.55)",
      "box-shadow:0 10px 28px rgba(0,0,0,0.55)",
      "z-index:6",
      "pointer-events:none",
      "background:rgba(8,12,16,0.88)",
    ].join(";");
    this.ctx = this.canvas.getContext("2d")!;
    (parent ?? document.body).appendChild(this.canvas);
  }

  setWorld(half: number, origin: Vec2) {
    this.worldHalf = Math.max(40, half);
    this.origin = origin;
  }

  draw(opts: {
    player: Vec2 & { yaw: number };
    allies: Vec2[];
    enemies: Vec2[];
    harvest: AgamaHarvestNode[];
    zones: AgamaZone[];
    extract: AgamaZone;
  }) {
    const c = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    c.clearRect(0, 0, s, s);
    c.fillStyle = "rgba(10,16,14,0.96)";
    c.beginPath();
    c.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
    c.fill();

    const scale = (s * 0.42) / this.worldHalf;
    const ox = this.origin.x;
    const oz = this.origin.z;
    const mapX = (x: number) => cx + (x - ox) * scale;
    const mapZ = (z: number) => cy + (z - oz) * scale;

    // grid
    c.strokeStyle = "rgba(255,255,255,0.06)";
    c.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(cx + i * 22, 10);
      c.lineTo(cx + i * 22, s - 10);
      c.stroke();
      c.beginPath();
      c.moveTo(10, cy + i * 22);
      c.lineTo(s - 10, cy + i * 22);
      c.stroke();
    }

    for (const z of opts.zones) {
      c.strokeStyle =
        z.kind === "extract"
          ? "rgba(255,210,77,0.9)"
          : z.kind === "war"
            ? "rgba(255,90,70,0.55)"
            : z.kind === "safe" || z.kind === "farm"
              ? "rgba(126,224,160,0.5)"
              : "rgba(160,190,220,0.35)";
      c.lineWidth = z.kind === "extract" ? 2 : 1;
      c.beginPath();
      c.arc(mapX(z.x), mapZ(z.z), z.r * scale, 0, Math.PI * 2);
      c.stroke();
    }

    for (const h of opts.harvest) {
      if (h.hp <= 0) continue;
      c.fillStyle =
        h.kind === "ore"
          ? "#c9a44a"
          : h.kind === "wood"
            ? "#6a9a4a"
            : h.kind === "fiber"
              ? "#d8e080"
              : "#8ecf6a";
      c.fillRect(mapX(h.x) - 1.5, mapZ(h.z) - 1.5, 3, 3);
    }

    for (const e of opts.enemies) {
      c.fillStyle = "#ff6a4a";
      c.beginPath();
      c.arc(mapX(e.x), mapZ(e.z), 2.6, 0, Math.PI * 2);
      c.fill();
    }
    for (const a of opts.allies) {
      c.fillStyle = "#7ee0a0";
      c.beginPath();
      c.arc(mapX(a.x), mapZ(a.z), 2.6, 0, Math.PI * 2);
      c.fill();
    }

    const px = mapX(opts.player.x);
    const pz = mapZ(opts.player.z);
    c.fillStyle = "#4fc3ff";
    c.beginPath();
    c.arc(px, pz, 4.2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(px, pz);
    c.lineTo(px + Math.sin(opts.player.yaw) * 11, pz - Math.cos(opts.player.yaw) * 11);
    c.stroke();

    const ex = mapX(opts.extract.x);
    const ez = mapZ(opts.extract.z);
    c.fillStyle = "#ffd24d";
    c.beginPath();
    c.moveTo(ex, ez - 6);
    c.lineTo(ex + 4.5, ez + 4);
    c.lineTo(ex - 4.5, ez + 4);
    c.closePath();
    c.fill();

    c.fillStyle = "rgba(255,220,160,0.85)";
    c.font = "10px system-ui,sans-serif";
    c.textAlign = "center";
    c.fillText("M · MAP", cx, s - 9);
  }

  dispose() {
    this.canvas.remove();
  }
}

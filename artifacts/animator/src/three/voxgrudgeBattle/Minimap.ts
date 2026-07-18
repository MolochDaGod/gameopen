/**
 * Canvas 2D minimap for VoxGrudge Battle — toggle with M.
 */

import type { BattleFighterLive } from "../../game/voxgrudgeBattle/types";

export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 180;
  private worldRadius = 80;

  constructor(parent?: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.className = "vox-battle-minimap";
    this.canvas.style.cssText = [
      "position:absolute",
      "right:16px",
      "bottom:16px",
      "width:180px",
      "height:180px",
      "border-radius:12px",
      "border:2px solid rgba(255,220,120,0.55)",
      "box-shadow:0 8px 28px rgba(0,0,0,0.55)",
      "z-index:40",
      "pointer-events:none",
      "display:none",
      "background:rgba(8,12,18,0.82)",
    ].join(";");
    this.ctx = this.canvas.getContext("2d")!;
    (parent ?? document.body).appendChild(this.canvas);
  }

  setVisible(v: boolean) {
    this.canvas.style.display = v ? "block" : "none";
  }

  setWorldRadius(r: number) {
    this.worldRadius = Math.max(16, r);
  }

  draw(
    fighters: BattleFighterLive[],
    zone: { x: number; z: number; radius: number },
    localId = "local-player",
  ) {
    const c = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    c.clearRect(0, 0, s, s);

    // background disc
    c.fillStyle = "rgba(12,18,28,0.95)";
    c.beginPath();
    c.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
    c.fill();

    // zone
    const scale = (s * 0.42) / this.worldRadius;
    c.strokeStyle = "rgba(255, 80, 80, 0.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(
      cx + zone.x * scale,
      cy + zone.z * scale,
      zone.radius * scale,
      0,
      Math.PI * 2,
    );
    c.stroke();

    // grid
    c.strokeStyle = "rgba(255,255,255,0.06)";
    c.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(cx + i * 28, 8);
      c.lineTo(cx + i * 28, s - 8);
      c.stroke();
      c.beginPath();
      c.moveTo(8, cy + i * 28);
      c.lineTo(s - 8, cy + i * 28);
      c.stroke();
    }

    for (const f of fighters) {
      if (!f.alive && !f.isLocal) continue;
      const px = cx + f.x * scale;
      const pz = cy + f.z * scale;
      const r = f.isLocal ? 5 : 3.5;
      c.fillStyle = f.alive ? f.color : "rgba(120,120,120,0.5)";
      c.beginPath();
      c.arc(px, pz, r, 0, Math.PI * 2);
      c.fill();
      if (f.id === localId || f.isLocal) {
        c.strokeStyle = "#fff";
        c.lineWidth = 1.5;
        c.stroke();
        // facing notch
        c.beginPath();
        c.moveTo(px, pz);
        c.lineTo(px + Math.sin(f.yaw) * 10, pz - Math.cos(f.yaw) * 10);
        c.stroke();
      }
    }

    c.fillStyle = "rgba(255,230,160,0.85)";
    c.font = "10px system-ui,sans-serif";
    c.textAlign = "center";
    c.fillText("M · MINIMAP", cx, s - 8);
  }

  dispose() {
    this.canvas.remove();
  }
}

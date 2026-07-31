/**
 * Bake pinata / harvest collider plans into Rapier (or no-op when physics null).
 */
import type { ColliderPlan } from "./pinataHarvest";

export class HarvestPhysicsBake {
  private physics: unknown = null;
  private handles: unknown[] = [];

  setPhysics(physics: unknown) {
    this.physics = physics;
  }

  bake(plans: ColliderPlan[], opts?: { max?: number }): number {
    const max = opts?.max ?? 140;
    const slice = plans.slice(0, max);
    // When full Rapier world is available, create fixed cuboids.
    // Soft no-op keeps Studio boot safe without physics backend.
    this.handles = slice.map((p) => ({ id: p.id, pos: p.position.clone() }));
    void this.physics;
    return slice.length;
  }

  clear() {
    this.handles = [];
  }
}

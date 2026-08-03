/**
 * Bake forest mountain harvest nodes into physics + pinata registration count.
 */
export class ForestHarvestBake {
  private physics: unknown = null;
  private lastCount = 0;

  setPhysics(physics: unknown) {
    this.physics = physics;
  }

  /** Map switch / Danger restore — no colliders held in this stub. */
  clear(): void {
    this.lastCount = 0;
  }

  /**
   * @param forestMap — ForestMountainsMapResult-like { harvestNodes }
   * @returns number of harvest nodes considered
   */
  bake(
    forestMap: { harvestNodes?: unknown[] } | null | undefined,
    opts?: { maxHarvest?: number },
  ): number {
    const nodes = forestMap?.harvestNodes ?? [];
    const max = opts?.maxHarvest ?? 160;
    void this.physics;
    this.lastCount = Math.min(nodes.length, max);
    return this.lastCount;
  }
}

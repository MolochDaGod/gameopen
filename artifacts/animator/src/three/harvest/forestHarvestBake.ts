/**
 * Bake forest mountain harvest nodes into physics + pinata registration count.
 */
export class ForestHarvestBake {
  private physics: unknown = null;

  setPhysics(physics: unknown) {
    this.physics = physics;
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
    return Math.min(nodes.length, max);
  }
}

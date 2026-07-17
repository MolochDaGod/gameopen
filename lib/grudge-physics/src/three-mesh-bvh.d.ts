declare module "three-mesh-bvh" {
  export function computeBoundsTree(this: unknown, options?: unknown): unknown;
  export function disposeBoundsTree(this: unknown): void;
  export function acceleratedRaycast(
    this: unknown,
    raycaster: unknown,
    intersects: unknown[],
  ): void;
}

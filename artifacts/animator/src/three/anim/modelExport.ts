import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";

/**
 * Serialise a posed three.js subtree to a Wavefront OBJ string.
 *
 * The Danger Room characters are all NON-skinned: their meshes are parented to
 * named nodes that the clips rotate directly, so calling `updateMatrixWorld`
 * bakes the current pose into the geometry the {@link OBJExporter} reads. The
 * result is a rig-free static mesh — exactly what an auto-rigger like Mixamo
 * wants as input (upload OBJ -> auto-rig -> download a skinned GLB that the
 * whole `mixamorig` animation library then binds to).
 *
 * No `@workspace/*` imports (animator artifact rule); three + jsm addons only.
 */
export function objFromObject(root: THREE.Object3D): string {
  root.updateMatrixWorld(true);
  return new OBJExporter().parse(root);
}

/** Trigger a browser download of an OBJ string under `filename`. */
export function downloadOBJ(obj: string, filename: string): void {
  const blob = new Blob([obj], { type: "model/obj" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".obj") ? filename : `${filename}.obj`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

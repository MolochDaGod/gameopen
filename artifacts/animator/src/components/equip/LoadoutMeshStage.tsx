/**
 * React host for {@link LoadoutMeshPreview} — sits in the TI paperdoll center.
 * UI chrome stays EquipmentScreen; this only owns the Three.js mesh viewport.
 */
import { useEffect, useRef } from "react";
import {
  LoadoutMeshPreview,
  type LoadoutPreviewRace,
} from "../../three/loadout/LoadoutMeshPreview";
import type { WeaponId } from "../../three/types";

interface Props {
  race: LoadoutPreviewRace;
  weaponId: WeaponId;
  offHandId: WeaponId | null;
  className?: string;
}

export function LoadoutMeshStage({ race, weaponId, offHandId, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<LoadoutMeshPreview | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preview = new LoadoutMeshPreview(canvas, statusRef.current);
    previewRef.current = preview;
    preview.setRace(race);
    preview.setWeapons(weaponId, offHandId);
    return () => {
      preview.dispose();
      previewRef.current = null;
    };
    // Mount once; race/weapons via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    previewRef.current?.setRace(race);
  }, [race]);

  useEffect(() => {
    previewRef.current?.setWeapons(weaponId, offHandId);
  }, [weaponId, offHandId]);

  return (
    <div className={`eq-mesh-stage ${className}`.trim()}>
      <canvas ref={canvasRef} className="eq-mesh-canvas" />
      <div ref={statusRef} className="eq-mesh-status" />
      <div className="eq-mesh-hint">Drag to rotate · Three.js mesh</div>
    </div>
  );
}

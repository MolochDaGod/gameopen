/**
 * Library / doors production cinema backdrop.
 * Delegates to {@link ProductionCinema} (`intro_doors`) — mystical post,
 * character asset inclusion, timed captions, torch + embers.
 * Warms same-origin roster REST in parallel (production systems pattern).
 */
import { useEffect } from "react";
import { ProductionCinema } from "./ProductionCinema";
import { warmupProductionSurface } from "../lib/productionSystemsPattern";

export function IntroCinematic() {
  useEffect(() => {
    void warmupProductionSurface("doors").catch(() => undefined);
  }, []);

  return (
    <ProductionCinema
      cinemaId="intro_doors"
      mode="backdrop"
      showHud
      className="intro-cinematic"
    />
  );
}

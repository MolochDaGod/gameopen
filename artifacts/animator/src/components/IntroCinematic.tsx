/**
 * Library / doors production cinema backdrop.
 * Delegates to {@link ProductionCinema} (`intro_doors`) — mystical post,
 * character asset inclusion, timed captions, torch + embers.
 */
import { ProductionCinema } from "./ProductionCinema";

export function IntroCinematic() {
  return (
    <ProductionCinema
      cinemaId="intro_doors"
      mode="backdrop"
      showHud
      className="intro-cinematic"
    />
  );
}

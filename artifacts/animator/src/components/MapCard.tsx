/**
 * Polished map / arena selection cards with poster + procedural minimap.
 */
import { useMemo, useState } from "react";
import type { MapPreviewDef } from "../lib/mapPreviews";
import { getMapMinimapUrl } from "../lib/mapPreviews";
import "./mapCard.css";

export interface MapCardProps {
  def: MapPreviewDef;
  /** Selected / active chrome */
  active?: boolean;
  disabled?: boolean;
  ctaLabel?: string;
  onSelect?: () => void;
  /** Compact row vs tall poster card */
  layout?: "card" | "row";
}

export function MapCard({
  def,
  active,
  disabled,
  ctaLabel = "Enter",
  onSelect,
  layout = "card",
}: MapCardProps) {
  const minimap = useMemo(() => getMapMinimapUrl(def, layout === "row" ? 160 : 320), [def, layout]);
  const [posterOk, setPosterOk] = useState(!!def.posterUrl);
  const showPoster = posterOk && def.posterUrl;

  return (
    <button
      type="button"
      className={`map-card map-card--${layout}${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
      style={{ ["--map-tone" as string]: def.tone }}
      disabled={disabled}
      onClick={onSelect}
      title={def.blurb}
    >
      <div className="map-card-media">
        {showPoster ? (
          <img
            className="map-card-poster"
            src={def.posterUrl}
            alt=""
            draggable={false}
            onError={() => setPosterOk(false)}
          />
        ) : null}
        <img
          className={`map-card-minimap${showPoster ? " map-card-minimap--overlay" : ""}`}
          src={minimap}
          alt=""
          draggable={false}
        />
        <div className="map-card-badges">
          {def.badges.slice(0, 3).map((b) => (
            <span key={b} className="map-card-badge">
              {b}
            </span>
          ))}
        </div>
        {def.players ? (
          <span className="map-card-players" title="Players">
            👥 {def.players}
          </span>
        ) : null}
      </div>
      <div className="map-card-body">
        <div className="map-card-kicker">{def.subtitle}</div>
        <div className="map-card-title">{def.title}</div>
        <p className="map-card-blurb">{def.blurb}</p>
        {def.objective ? (
          <div className="map-card-objective">
            <span>Objective</span> {def.objective}
          </div>
        ) : null}
        <div className="map-card-cta">{ctaLabel} →</div>
      </div>
    </button>
  );
}

/** Grid of map cards for Admin / galleries. */
export function MapCardGrid({
  items,
  onPick,
  disabled,
  activeId,
}: {
  items: MapPreviewDef[];
  onPick: (id: MapPreviewDef["id"]) => void;
  disabled?: boolean;
  activeId?: string;
}) {
  return (
    <div className="map-card-grid">
      {items.map((def) => (
        <MapCard
          key={def.id}
          def={def}
          active={activeId === def.id}
          disabled={disabled}
          onSelect={() => onPick(def.id)}
          ctaLabel={def.kind === "ffa" ? "Start FFA" : "Start"}
        />
      ))}
    </div>
  );
}

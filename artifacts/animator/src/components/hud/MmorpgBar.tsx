// PSD-reference MMORPG bottom bar — a horizontal fantasy RPG action bar with:
//   • Gold-chrome panel with dark wood/stone background
//   • Numbered skill slots (Q, E, R, 1-4, F) with icons + radial cooldown sweeps
//   • Central HP + MP progress bars with numeric readouts
//   • Player name / level strip above the center
// Rendered when layout === "mmorpg". Replaces the classic action bar.

import type { CSSProperties } from "react";
import type { HudSnapshot, SlotBinding } from "../../three/types";
import { WEAPON_ICON } from "../../three/icons";
import { Icon } from "../Icon";
import type { HudPanelBinding } from "../../hud/useHudEditor";
import "./mmorpgBar.css";

interface Props {
  hud: HudSnapshot;
  bind?: HudPanelBinding;
}

// ---- helpers ---------------------------------------------------------------

function pct(v: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
}

function slotByName(hud: HudSnapshot, slot: string): SlotBinding | undefined {
  return hud.slots.find((s) => s.slot === slot);
}

// ---- individual slot -------------------------------------------------------

interface SlotProps {
  keyLabel: string;
  name: string;
  icon: string;
  cd: number;
  cdMax: number;
  accent?: boolean;
  dim?: boolean;
  style?: CSSProperties;
}

function MSlot({ keyLabel, name, icon, cd, cdMax, accent, dim, style }: SlotProps) {
  const onCd = cd > 0 && cdMax > 0;
  const frac = onCd ? Math.max(0, Math.min(1, cd / cdMax)) : 0;
  return (
    <div
      className={`ms-slot${accent ? " ms-accent" : ""}${onCd ? " ms-on-cd" : " ms-ready"}${dim ? " ms-dim" : ""}`}
      style={style}
      data-tip={keyLabel ? `${name} — ${keyLabel}` : name}
    >
      <div className="ms-icon-wrap">
        <Icon name={icon} size={28} />
        {onCd && (
          <div
            className="ms-sweep"
            style={{ background: `conic-gradient(rgba(4,10,20,0.82) ${frac * 360}deg, transparent 0deg)` }}
          />
        )}
        {onCd && <span className="ms-cd">{cd.toFixed(1)}</span>}
      </div>
      <span className="ms-key">{keyLabel}</span>
      <span className="ms-label">{name}</span>
    </div>
  );
}

// ---- resource bar ----------------------------------------------------------

function ResBar({
  label,
  value,
  max,
  kind,
}: {
  label: string;
  value: number;
  max: number;
  kind: "hp" | "mp";
}) {
  const p = pct(value, max);
  return (
    <div className={`ms-res ms-res-${kind}`}>
      <div className="ms-res-label">{label}</div>
      <div className="ms-res-track">
        <div className="ms-res-fill" style={{ width: `${p}%` }} />
        <span className="ms-res-num">
          {Math.round(value)} / {Math.round(max)}
        </span>
      </div>
    </div>
  );
}

// ---- poise strip -----------------------------------------------------------

function PoiseStrip({ value, max, crit }: { value: number; max: number; crit: boolean }) {
  const p = pct(value, max);
  return (
    <div className="ms-poise-wrap">
      <span className="ms-poise-label">POI</span>
      <div className="ms-poise-track">
        <div
          className="ms-poise-fill"
          style={{
            width: `${p}%`,
            background: crit
              ? "linear-gradient(90deg,#ffcc22,#ff6600)"
              : "linear-gradient(90deg,#6490ff,#3060cc)",
          }}
        />
      </div>
    </div>
  );
}

// ---- main export -----------------------------------------------------------

export function MmorpgBar({ hud, bind }: Props) {
  const primary = slotByName(hud, "primary");
  const fskill = slotByName(hud, "fskill");
  const sigs = (["sig1", "sig2", "sig3", "sig4"] as const).map((id) => slotByName(hud, id));

  const panelAttrs = bind
    ? {
        "data-hud-panel": bind["data-hud-panel"],
        className: `ms-bar ${bind.className}`.trim(),
        style: bind.style as CSSProperties,
        onPointerDown: bind.onPointerDown,
        onContextMenu: bind.onContextMenu,
      }
    : { className: "ms-bar" };

  return (
    <div {...panelAttrs}>
      {/* Gold top + bottom border rails */}
      <div className="ms-rail ms-rail-top" />
      <div className="ms-rail ms-rail-bottom" />

      {/* Left slot cluster: Q (parry), primary attack, E (block) */}
      <div className="ms-cluster ms-cluster-left">
        <MSlot keyLabel="Q" name="Parry" icon="rally" cd={0} cdMax={0} />
        {primary && (
          <MSlot
            keyLabel={primary.key}
            name={primary.label}
            icon={WEAPON_ICON[hud.weapon]}
            cd={0}
            cdMax={0}
          />
        )}
        <MSlot keyLabel="E" name="Block" icon="guard" cd={0} cdMax={0} />
      </div>

      {/* Center: resource bars + character name + poise */}
      <div className="ms-center">
        <div className="ms-char-name">{hud.character}</div>
        <div className="ms-bars">
          <ResBar label="HP" value={hud.health} max={hud.maxHealth} kind="hp" />
          <ResBar label="MP" value={hud.stamina} max={hud.maxStamina} kind="mp" />
        </div>
        <PoiseStrip value={hud.poise} max={hud.maxPoise} crit={hud.critWindow > 0} />
      </div>

      {/* Right slot cluster: signatures 1-4, weapon skill F, heavy R */}
      <div className="ms-cluster ms-cluster-right">
        {sigs.map((s, i) => {
          const sigCd = hud.sigCooldowns[i] ?? 0;
          const sigCdMax = hud.sigCooldownMaxes[i] ?? 0;
          const cd = sigCdMax > 0 ? sigCd : 0;
          const cdMax = sigCdMax > 0 ? sigCdMax : 0;
          const def = s ?? { key: String(i + 1), label: `Sig ${i + 1}`, slot: `sig${i + 1}` };
          return (
            <MSlot
              key={i}
              keyLabel={def.key}
              name={def.label}
              icon={(["scout", "ambush", "siege", "skill-vfx-lab"] as const)[i] ?? "skill-vfx-lab"}
              cd={cd}
              cdMax={cdMax}
              dim={!s}
            />
          );
        })}
        {fskill && (
          <MSlot
            keyLabel={fskill.key}
            name={hud.skillName || fskill.label}
            icon={WEAPON_ICON[hud.weapon]}
            cd={hud.skillCooldown}
            cdMax={hud.skillCooldownMax}
          />
        )}
        <MSlot
          keyLabel="R"
          name="Heavy"
          icon="charge"
          cd={hud.skyfallCooldown}
          cdMax={hud.skyfallCooldownMax}
          accent
        />
      </div>
    </div>
  );
}

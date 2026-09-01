import { useEffect, useMemo, useState } from "react";
import {
  grudgeIconUrl,
  loadGrudgeInfo,
  matchGrudgeWeapon,
  matchSkillIcon,
  type GrudgeInfoData,
} from "../../grudge/infoApi";
import { WEAPONS } from "../../three/arsenal";

/**
 * HUD Studio section: the official Grudge skill tree for every weapon's t0/t1
 * tiers, sourced live from info.grudge-studio.com. Tier names in the arsenal
 * match the Grudge catalog, so each tier resolves to its real item — basic
 * ability, the six abilities, signature and passives, with catalog icons.
 */
export function GrudgeSkillsPanel() {
  const [data, setData] = useState<GrudgeInfoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weaponId, setWeaponId] = useState("");
  const [tierIdx, setTierIdx] = useState<0 | 1>(0);
  const [retry, setRetry] = useState(0);

  // Weapons that actually have named tiers (t0/t1) to look up.
  const weapons = useMemo(
    () => WEAPONS.filter((w) => (w.tiers?.length ?? 0) >= 1 && w.id !== "none"),
    [],
  );

  useEffect(() => {
    let alive = true;
    setError(null);
    loadGrudgeInfo()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError("Couldn't reach info.grudge-studio.com — check your connection.");
      });
    return () => {
      alive = false;
    };
  }, [retry]);

  const weapon = weapons.find((w) => w.id === weaponId) ?? null;
  const tiers = weapon?.tiers ?? [];
  const tier = tiers[Math.min(tierIdx, Math.max(0, tiers.length - 1))] ?? null;
  const tierName = tier?.name ?? null;
  const item = data && tierName ? matchGrudgeWeapon(data, tierName) : null;

  const rows = useMemo(() => {
    if (!item) return [];
    const out: { kind: string; text: string; icon: string | null }[] = [];
    const sprite = grudgeIconUrl(item.spritePath);
    const iconFor = (text: string) =>
      (data ? matchSkillIcon(data, text, item.grudgeCategory) : null) ?? sprite;
    if (item.basicAbility) out.push({ kind: "Basic", text: item.basicAbility, icon: iconFor(item.basicAbility) });
    for (const ab of item.abilities ?? []) out.push({ kind: "Ability", text: ab, icon: iconFor(ab) });
    if (item.signatureAbility)
      out.push({ kind: "Signature", text: item.signatureAbility, icon: iconFor(item.signatureAbility) });
    for (const p of item.passives ?? []) out.push({ kind: "Passive", text: p, icon: iconFor(p) });
    return out;
  }, [item, data]);

  return (
    <div className="grudge-skills">
      <select
        className="hud-quickslot-select"
        value={weaponId}
        onChange={(e) => {
          setWeaponId(e.target.value);
          setTierIdx(0);
        }}
      >
        <option value="">— Pick a weapon —</option>
        {weapons.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>

      {weapon && (
        <div className="grudge-tier-toggle">
          {[0, 1].map((t) => {
            const label = tiers[t]?.name;
            if (!label) return null;
            return (
              <button
                key={t}
                className={`hud-layout-card${tierIdx === t ? " active" : ""}`}
                onClick={() => setTierIdx(t as 0 | 1)}
              >
                <span className="hud-theme-text">
                  <span className="hud-theme-name">
                    T{t} · {label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {weapon && error && (
        <div className="hud-editor-note">
          {error}{" "}
          <button className="hud-mini-reset" onClick={() => setRetry((r) => r + 1)}>
            Retry
          </button>
        </div>
      )}
      {weapon && !error && !data && <div className="hud-editor-note">Loading Grudge catalog…</div>}
      {weapon && data && tierName && !item && (
        <div className="hud-editor-note">No Grudge catalog entry for “{tierName}”.</div>
      )}

      {item && (
        <div className="grudge-skill-tree">
          <div className="grudge-item-head">
            {grudgeIconUrl(item.spritePath) && (
              <img src={grudgeIconUrl(item.spritePath)!} alt="" width={34} height={34} />
            )}
            <div>
              <div className="hud-theme-name">{item.name}</div>
              {item.lore && <div className="hud-theme-blurb">{item.lore}</div>}
            </div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grudge-skill-row" data-kind={r.kind.toLowerCase()}>
              {r.icon && <img src={r.icon} alt="" width={22} height={22} loading="lazy" />}
              <span className="grudge-skill-kind">{r.kind}</span>
              <span className="grudge-skill-text">{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Viewport attachment cards — pattern from three-js-basic-character-customisation.
 *
 * Slot card (＋) → opens option strip → apply(option) → parent rebuilds mesh/equip.
 * Use over a 3D preview host (Dressing Room, loadout, unit portrait, Account create).
 */
import { useCallback, useState } from "react";
import type { AttachmentCardKind, AttachmentSlotDef } from "./attachmentCardModel";
import "./attachmentCards.css";

export interface AttachmentSlotCardsProps {
  kind?: AttachmentCardKind;
  slots: AttachmentSlotDef[];
  /** Called when the player picks an option (or clears with null). */
  onApply: (slotId: string, optionId: string | null) => void;
  /** Optional class on the host (must be position:relative). */
  className?: string;
  /** Show slot labels under cards */
  showLabels?: boolean;
}

export function AttachmentSlotCards({
  kind = "player",
  slots,
  onApply,
  className = "",
  showLabels = true,
}: AttachmentSlotCardsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const pick = useCallback(
    (slotId: string, optionId: string) => {
      onApply(slotId, optionId);
      setOpenId(null);
    },
    [onApply],
  );

  return (
    <div
      className={`att-host att-host--${kind} ${className}`.trim()}
      data-ui-id={`attachment-cards.${kind}`}
    >
      {slots.map((slot) => {
        const open = openId === slot.id;
        const equipped = slot.options.find((o) => o.id === slot.equippedId);
        const fan = slot.anchor.fan;
        return (
          <div
            key={slot.id}
            className={`att-cluster att-fan-${fan}${open ? " is-open" : ""}`}
            style={{
              left: `${slot.anchor.x}%`,
              top: `${slot.anchor.y}%`,
            }}
            data-slot={slot.id}
            data-xy={`${slot.anchor.x},${slot.anchor.y}`}
          >
            <button
              type="button"
              className={`att-slot${open ? " is-open" : ""}${equipped ? " has-equip" : ""}`}
              onClick={() => toggle(slot.id)}
              aria-expanded={open}
              aria-label={`${slot.label}${equipped ? `: ${equipped.label}` : " empty"}`}
              title={equipped ? `${slot.label}: ${equipped.label}` : slot.label}
            >
              <span className="att-slot-face">
                {equipped?.icon ? (
                  <span className="att-slot-glyph" aria-hidden>
                    {equipped.icon.length <= 2 ? equipped.icon : equipped.icon.slice(0, 1)}
                  </span>
                ) : (
                  <span className={`att-plus${open ? " is-open" : ""}`} aria-hidden>
                    +
                  </span>
                )}
              </span>
              {showLabels && (
                <span className="att-slot-label">
                  {equipped?.label ?? slot.emptyLabel ?? slot.label}
                </span>
              )}
            </button>

            <div
              className={`att-options${open ? " is-visible" : ""}`}
              role="listbox"
              aria-label={`${slot.label} options`}
              aria-hidden={!open}
            >
              {slot.options.map((opt) => {
                const active = opt.id === slot.equippedId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={opt.disabled}
                    className={`att-option${active ? " is-active" : ""}`}
                    style={
                      opt.tone
                        ? ({ "--att-tone": opt.tone } as React.CSSProperties)
                        : undefined
                    }
                    onClick={() => !opt.disabled && pick(slot.id, opt.id)}
                    title={opt.label}
                  >
                    <span className="att-option-icon" aria-hidden>
                      {opt.icon && opt.icon.length <= 3 ? opt.icon : "◆"}
                    </span>
                    <span className="att-option-name">{opt.label}</span>
                  </button>
                );
              })}
              {slot.equippedId && (
                <button
                  type="button"
                  className="att-option att-option-clear"
                  onClick={() => {
                    onApply(slot.id, null);
                    setOpenId(null);
                  }}
                  title="Unequip"
                >
                  <span className="att-option-icon">∅</span>
                  <span className="att-option-name">None</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

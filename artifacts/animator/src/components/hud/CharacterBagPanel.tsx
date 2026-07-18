/**
 * Character bag panel — default 3×3 inventory.
 * Far-right harvest HUD button opens this.
 * RMB = item options · LMB drag to consumable hotkeys.
 * Quick deposit illuminates inside claim / camp / boat.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BagItemAction,
  type CharacterBagState,
  type DepositContext,
  type ItemInstance,
  getItemTemplate,
  loadCharacterBag,
  saveCharacterBag,
  quickDepositAll,
  assignConsumableHotkey,
  removeFromSlot,
  swapSlots,
  useConsumableHotkey,
  depositZoneTone,
} from "../../game/inventory";
import "./characterBag.css";

export interface CharacterBagPanelProps {
  open: boolean;
  characterId: string;
  deposit: DepositContext;
  onClose: () => void;
  onBagChange?: (bag: CharacterBagState) => void;
  onFlash?: (msg: string) => void;
  /** Apply heal/stamina from consumable use. */
  onConsume?: (heal: number, stamina: number, name: string) => void;
}

export function CharacterBagPanel({
  open,
  characterId,
  deposit,
  onClose,
  onBagChange,
  onFlash,
  onConsume,
}: CharacterBagPanelProps) {
  const [bag, setBag] = useState<CharacterBagState>(() => loadCharacterBag(characterId));
  const [menu, setMenu] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const b = loadCharacterBag(characterId);
    setBag(b);
  }, [open, characterId]);

  const commit = useCallback(
    (next: CharacterBagState) => {
      saveCharacterBag(next);
      setBag(next);
      onBagChange?.(next);
    },
    [onBagChange],
  );

  const occupied = useMemo(
    () => bag.slots.filter((s) => s.item).length,
    [bag.slots],
  );

  const onDeposit = async () => {
    if (!deposit.canDeposit || busy) return;
    setBusy(true);
    try {
      const res = await quickDepositAll(characterId);
      commit(res.bag);
      onFlash?.(res.message);
    } finally {
      setBusy(false);
    }
  };

  const runAction = (index: number, action: BagItemAction) => {
    setMenu(null);
    const slot = bag.slots[index];
    if (!slot?.item) return;
    const tpl = getItemTemplate(slot.item.templateId);

    if (action === "inspect") {
      onFlash?.(
        `${tpl.name} ×${slot.item.qty}${tpl.description ? ` — ${tpl.description}` : ""}`,
      );
      return;
    }
    if (action === "use" && tpl.kind === "consumable") {
      const { bag: next, used, heal, stamina } = (() => {
        // Use stack from this slot
        const r = removeFromSlot(bag, index, 1);
        if (!r.removed) return { bag, used: null as ItemInstance | null, heal: 0, stamina: 0 };
        return {
          bag: r.bag,
          used: r.removed,
          heal: tpl.heal ?? 0,
          stamina: tpl.stamina ?? 0,
        };
      })();
      if (used) {
        commit(next);
        onConsume?.(heal, stamina, tpl.name);
        onFlash?.(`Used ${tpl.name}`);
      }
      return;
    }
    if (action === "deposit") {
      if (!deposit.canDeposit) {
        onFlash?.("Move to claim, camp, or boat to deposit");
        return;
      }
      void onDeposit();
      return;
    }
    if (action === "drop") {
      const { bag: next, removed } = removeFromSlot(bag, index, slot.item.qty);
      if (removed) {
        commit(next);
        onFlash?.(`Dropped ${tpl.name} ×${removed.qty}`);
      }
      return;
    }
    if (action === "equip") {
      onFlash?.(`Equip ${tpl.name} — open Loadout (I) for paperdoll`);
      return;
    }
  };

  const actionsFor = (item: ItemInstance): BagItemAction[] => {
    const tpl = getItemTemplate(item.templateId);
    const acts: BagItemAction[] = ["inspect"];
    if (tpl.kind === "consumable") acts.unshift("use");
    if (tpl.kind === "weapon" || tpl.kind === "equipment" || tpl.kind === "tool") {
      acts.push("equip");
    }
    if (tpl.kind === "material" || tpl.kind === "consumable") acts.push("deposit");
    acts.push("drop");
    return acts;
  };

  if (!open) return null;

  return (
    <div className="cbag-root" role="dialog" aria-label="Character bag">
      <div className="cbag-backdrop" onClick={onClose} />
      <div className="cbag-panel">
        <header className="cbag-head">
          <div>
            <h2>Character bag</h2>
            <p>
              {bag.cols}×{bag.rows} · {occupied}/{bag.slots.length} used · stacks to 100
            </p>
          </div>
          <button type="button" className="cbag-close" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </header>

        <div
          className="cbag-grid"
          style={{
            gridTemplateColumns: `repeat(${bag.cols}, var(--cbag-slot))`,
          }}
        >
          {bag.slots.map((slot) => {
            const item = slot.item;
            const tpl = item ? getItemTemplate(item.templateId) : null;
            return (
              <div
                key={slot.index}
                className={
                  "cbag-slot" +
                  (item ? " has-item" : "") +
                  (dragFrom === slot.index ? " is-drag" : "")
                }
                draggable={!!item}
                onDragStart={() => setDragFrom(slot.index)}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom == null || dragFrom === slot.index) return;
                  commit(swapSlots(bag, dragFrom, slot.index));
                  setDragFrom(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!item) return;
                  setMenu({ index: slot.index, x: e.clientX, y: e.clientY });
                }}
                onClick={() => setMenu(null)}
                title={
                  item
                    ? `${tpl?.name ?? item.templateId} ×${item.qty} · RMB options · drag`
                    : "Empty"
                }
              >
                {item && tpl && (
                  <>
                    <img
                      className="cbag-icon"
                      src={tpl.icon || "/icons/pack/misc/Effect.png"}
                      alt=""
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.style.opacity = "0.2";
                      }}
                    />
                    {item.qty > 1 && <span className="cbag-qty">{item.qty}</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="cbag-hotkeys" aria-label="Consumable hotkeys">
          <span className="cbag-hotkeys-label">Consumables · drag bag → slot</span>
          <div className="cbag-hotkey-row">
            {bag.consumableHotkeys.map((hk, i) => {
              const tpl = hk ? getItemTemplate(hk.templateId) : null;
              return (
                <button
                  key={i}
                  type="button"
                  className={"cbag-hotkey" + (hk ? " has-item" : "")}
                  title={hk ? `${tpl?.name} (use)` : `Consumable ${i + 1}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom == null) return;
                    commit(assignConsumableHotkey(bag, dragFrom, i));
                    setDragFrom(null);
                    onFlash?.(`Bound consumable to hotkey ${i + 1}`);
                  }}
                  onClick={() => {
                    if (!hk) return;
                    const res = useConsumableHotkey(bag, i);
                    commit(res.bag);
                    if (res.used) {
                      onConsume?.(res.heal, res.stamina, getItemTemplate(res.used.templateId).name);
                      onFlash?.(`Used ${getItemTemplate(res.used.templateId).name}`);
                    }
                  }}
                >
                  <span className="cbag-hotkey-key">{i + 1}</span>
                  {hk && tpl && (
                    <>
                      <img src={tpl.icon || "/icons/pack/misc/Effect.png"} alt="" />
                      {hk.qty > 1 && <span className="cbag-qty">{hk.qty}</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="cbag-foot">
          <button
            type="button"
            className={
              "cbag-deposit" + (deposit.canDeposit ? " is-lit" : " is-dim")
            }
            style={
              deposit.canDeposit
                ? { boxShadow: `0 0 14px ${depositZoneTone(deposit.zone)}` }
                : undefined
            }
            disabled={!deposit.canDeposit || busy}
            onClick={() => void onDeposit()}
            title={deposit.label}
          >
            {busy ? "Depositing…" : "Quick deposit → account"}
          </button>
          <p className="cbag-hint">
            Account inventory is shared across characters, islands, instances. Bag holds gear
            swaps, drops, harvest (×100), mission items. RMB = options · LMB drag to consumable
            hotkeys.
          </p>
        </footer>
      </div>

      {menu && bag.slots[menu.index]?.item && (
        <ul
          className="cbag-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {actionsFor(bag.slots[menu.index]!.item!).map((a) => (
            <li key={a}>
              <button type="button" role="menuitem" onClick={() => runAction(menu.index, a)}>
                {a === "use" && "Use"}
                {a === "equip" && "Equip"}
                {a === "deposit" && "Deposit to account"}
                {a === "drop" && "Drop"}
                {a === "inspect" && "Inspect"}
                {a === "split" && "Split"}
                {a === "unequip" && "Unequip"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

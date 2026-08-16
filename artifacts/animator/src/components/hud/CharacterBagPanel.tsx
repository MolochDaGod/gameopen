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
  isWornBackItem,
  loadCharacterBag,
  saveCharacterBag,
  quickDepositAll,
  assignConsumableHotkey,
  removeFromSlot,
  swapSlots,
  useConsumableHotkey,
  depositZoneTone,
  transferLocationToHomeIsland,
  loadLocationStorage,
} from "../../game/inventory";
import "./characterBag.css";

export interface CharacterBagPanelProps {
  open: boolean;
  characterId: string;
  deposit: DepositContext;
  /** Account for home island bag / camp ownership. */
  accountId?: string;
  onClose: () => void;
  onBagChange?: (bag: CharacterBagState) => void;
  onFlash?: (msg: string) => void;
  /** Apply heal/stamina from consumable use. */
  onConsume?: (heal: number, stamina: number, name: string) => void;
  /** Deploy placeable from bag (e.g. claim flag → ghost place). */
  onDeployPlaceable?: (placeableId: string) => void;
  /** Body Back equip (not kept 2×2). Return the saved bag so remint is not overwritten. */
  onEquipBack?: (
    bagIndex: number,
    item: ItemInstance,
  ) => void | CharacterBagState | Promise<void | CharacterBagState>;
  /** Drop / unequip worn Back — clear mesh + ledger. */
  onUnequipBack?: (
    item: ItemInstance,
  ) => void | CharacterBagState | Promise<void | CharacterBagState>;
}

export function CharacterBagPanel({
  open,
  characterId,
  deposit,
  accountId = "local",
  onClose,
  onBagChange,
  onFlash,
  onConsume,
  onDeployPlaceable,
  onEquipBack,
  onUnequipBack,
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
      const res = await quickDepositAll(
        characterId,
        accountId,
        deposit.destination,
      );
      commit(res.bag);
      onFlash?.(res.message);
    } finally {
      setBusy(false);
    }
  };

  /** Albion: empty camp storage into home island bag (own camp only). */
  const onSendCampToHome = async () => {
    if (!deposit.canSendToHome || !deposit.destination?.locationId || busy) {
      return;
    }
    setBusy(true);
    try {
      const st = loadLocationStorage(deposit.destination.locationId);
      const res = await transferLocationToHomeIsland({
        storage: st,
        accountId,
        includeUniques: true,
      });
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
      const qty = slot.item.qty;
      const worn = isWornBackItem(bag, slot.item);
      const finishDrop = (base: CharacterBagState) => {
        const { bag: next, removed } = removeFromSlot(base, index, qty);
        if (removed) {
          commit(next);
          onFlash?.(`Dropped ${tpl.name} ×${removed.qty}`);
        }
      };
      if (worn && onUnequipBack) {
        void Promise.resolve(onUnequipBack(slot.item)).then((nextBag) => {
          finishDrop(nextBag ?? loadCharacterBag(characterId));
        });
        return;
      }
      finishDrop(bag);
      return;
    }
    if (action === "equip") {
      if (tpl.kind === "back" || tpl.equipSlot === "back") {
        if (onEquipBack) {
          void Promise.resolve(onEquipBack(index, slot.item)).then((next) => {
            commit(next ?? loadCharacterBag(characterId));
          });
          return;
        }
        onFlash?.(`Equip ${tpl.name} — open Main Panel (I) for Back`);
        return;
      }
      onFlash?.(`Equip ${tpl.name} — open Main Panel (I) for equipment`);
      return;
    }
    if (action === "deploy") {
      const placeTag = tpl.tags?.find((t) => t.startsWith("placeable:"));
      const placeableId = placeTag?.slice("placeable:".length) || "claim_flag";
      if (onDeployPlaceable) {
        // Consume one flag from bag when starting ghost place
        const { bag: next, removed } = removeFromSlot(bag, index, 1);
        if (removed) {
          commit(next);
          onClose();
          onDeployPlaceable(placeableId);
          onFlash?.(`Deploy ${tpl.name} — LMB place · R rotate · Esc cancel · E open camp`);
        }
      } else {
        onFlash?.("Cannot deploy here");
      }
      return;
    }
  };

  const actionsFor = (item: ItemInstance): BagItemAction[] => {
    const tpl = getItemTemplate(item.templateId);
    const acts: BagItemAction[] = ["inspect"];
    if (tpl.kind === "consumable") acts.unshift("use");
    if (tpl.tags?.some((t) => t.startsWith("placeable:") || t === "claim")) {
      acts.unshift("deploy");
    }
    if (
      tpl.kind === "weapon" ||
      tpl.kind === "equipment" ||
      tpl.kind === "tool" ||
      tpl.kind === "back"
    ) {
      if (!tpl.tags?.includes("claim")) acts.push("equip");
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

        <div className="cbag-hotkeys" aria-label="Utility slots J H V">
          <span className="cbag-hotkeys-label">
            J · H · V · drag bag → consumable / deployable / mount
          </span>
          <div className="cbag-hotkey-row">
            {(["J", "H", "V"] as const).map((keyLabel, i) => {
              const hk = bag.consumableHotkeys[i] ?? null;
              const tpl = hk ? getItemTemplate(hk.templateId) : null;
              return (
                <button
                  key={keyLabel}
                  type="button"
                  className={"cbag-hotkey" + (hk ? " has-item" : "")}
                  title={
                    hk
                      ? `${tpl?.name} (${keyLabel}) · click to use`
                      : `${keyLabel} · drop consumable, claim flag, or mount`
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom == null) return;
                    const before = bag.consumableHotkeys[i]?.templateId ?? null;
                    const next = assignConsumableHotkey(bag, dragFrom, i);
                    const after = next.consumableHotkeys[i]?.templateId ?? null;
                    if (after && after !== before) {
                      commit(next);
                      onFlash?.(`Bound to ${keyLabel}`);
                    } else if (!after) {
                      onFlash?.("Only consumables, deployables, mounts");
                    } else {
                      commit(next);
                      onFlash?.(`Bound to ${keyLabel}`);
                    }
                    setDragFrom(null);
                  }}
                  onClick={() => {
                    if (!hk) return;
                    const res = useConsumableHotkey(bag, i);
                    commit(res.bag);
                    if (!res.used) return;
                    const name = getItemTemplate(res.used.templateId).name;
                    if (res.action === "deploy" && res.placeableId) {
                      onDeployPlaceable?.(res.placeableId);
                      onFlash?.(`Deploy ${name}`);
                      return;
                    }
                    if (res.action === "use") {
                      onConsume?.(res.heal, res.stamina, name);
                      onFlash?.(`Used ${name}`);
                    } else if (res.action === "summon") {
                      onFlash?.(`Summon ${name}`);
                    }
                  }}
                >
                  <span className="cbag-hotkey-key">{keyLabel}</span>
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
            {busy
              ? "Depositing…"
              : deposit.destination?.kind === "camp"
                ? "Quick deposit → camp storage"
                : deposit.destination?.kind === "boat"
                  ? "Quick deposit → boat hold"
                  : deposit.destination?.kind === "home_island"
                    ? "Quick deposit → home island bag"
                    : "Quick deposit"}
          </button>
          {deposit.canSendToHome && deposit.destination?.locationId && (
            <button
              type="button"
              className="cbag-deposit is-lit"
              style={{ boxShadow: "0 0 12px #8ecbff", marginTop: 6 }}
              disabled={busy}
              onClick={() => void onSendCampToHome()}
              title="Move entire camp storage to shared home island bag (Albion bank style)"
            >
              Send camp storage → home island
            </button>
          )}
          <p className="cbag-hint">
            Albion model: deposit at camp stays at camp for RTS. Home island bag is the shared
            account vault. Move goods home explicitly (button above) or carry in bag. RMB =
            options · drag to J/H/V.
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
                {a === "deploy" && "Deploy (place)"}
                {a === "use" && "Use"}
                {a === "equip" && "Equip"}
                {a === "deposit" &&
                  (deposit.destination?.kind === "camp"
                    ? "Deposit to camp"
                    : deposit.destination?.kind === "home_island"
                      ? "Deposit to home island"
                      : "Deposit")}
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

/**
 * Explorer Character Page — Minecraft inventory layout + Fantasy Scene craftpix
 * chrome + Explorer / Avatar Edit character stage.
 *
 * Opens from Loadout (I). Uses:
 *  · character bag SSOT (2×2 kept + 3×3 bag)
 *  · XY layout scripts (characterPageLayout.ts)
 *  · 2×2 crafting recipes (craftRecipes.ts)
 *  · LoadoutMeshStage for live mesh (Explorer preferred via race → mesh)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Wand2, RotateCcw } from "lucide-react";
import {
  loadCharacterBag,
  saveCharacterBag,
  swapSlots,
  setSlotItem,
  removeFromSlot,
  addToBag,
  canEquipInKeptSlot,
  ensureKeptLoadout,
  getItemTemplate,
  type CharacterBagState,
  type ItemInstance,
  type KeptLoadoutSlotId,
  KEPT_LOADOUT_ORDER,
} from "../../game/inventory";
import { LoadoutMeshStage } from "../equip/LoadoutMeshStage";
import type { WeaponId } from "../../three/types";
import {
  loadLayoutScript,
  saveLayoutScript,
  DEFAULT_CHARACTER_LAYOUT,
  cellGridStyle,
  type LayoutCell,
} from "./characterPageLayout";
import { matchRecipe } from "./craftRecipes";
import "./explorerCharacterPage.css";

export type ExplorerPageRace =
  | "human"
  | "barbarian"
  | "dwarf"
  | "elf"
  | "orc"
  | "undead";

type Cursor =
  | { source: "bag"; index: number; item: ItemInstance }
  | { source: "kept"; slot: KeptLoadoutSlotId; item: ItemInstance }
  | { source: "craft"; index: number; item: ItemInstance }
  | null;

interface Props {
  characterName: string;
  characterId?: string;
  race?: ExplorerPageRace;
  currentWeapon: WeaponId;
  currentOffHand: WeaponId | null;
  onEquip: (id: WeaponId) => void;
  onEquipOff: (id: WeaponId | null) => void;
  onClose: () => void;
  /** Open Avatar Edit for Explorer face */
  onOpenAvatarEdit?: () => void;
  /** Open Production craft UI */
  onOpenCrafting?: () => void;
}

function itemIcon(item: ItemInstance | null | undefined): string | null {
  if (!item) return null;
  const tpl = getItemTemplate(item.templateId);
  return tpl.icon ?? null;
}

function itemName(item: ItemInstance | null | undefined): string {
  if (!item) return "";
  return getItemTemplate(item.templateId).name || item.templateId;
}

function weaponIdFromTemplate(templateId: string): WeaponId | null {
  const t = templateId.toLowerCase();
  if (t.includes("sword")) return "sword";
  if (t.includes("axe") && t.includes("great")) return "greataxe";
  if (t.includes("axe")) return "axe";
  if (t.includes("bow")) return "bow";
  if (t.includes("staff") || t.includes("magic")) return "magic";
  if (t.includes("hammer") || t.includes("mace")) return "hammer";
  if (t.includes("spear")) return "spear";
  if (t.includes("gun") || t.includes("pistol") || t.includes("rifle")) return "pistol";
  if (t.includes("knife") || t.includes("dagger")) return "knife";
  return null;
}

export function ExplorerCharacterPage({
  characterName,
  characterId = "local",
  race = "human",
  currentWeapon,
  currentOffHand,
  onEquip,
  onEquipOff,
  onClose,
  onOpenAvatarEdit,
  onOpenCrafting,
}: Props) {
  const [layout] = useState<LayoutCell[]>(() => loadLayoutScript());
  const [bag, setBag] = useState<CharacterBagState>(() => {
    let b = ensureKeptLoadout(loadCharacterBag(characterId));
    // Seed starter materials once so craft grid is playable out of the box
    if (b.slots.every((s) => !s.item)) {
      let next = b;
      for (const [id, qty] of [
        ["wood", 16],
        ["stone", 8],
        ["ore", 4],
        ["coal", 4],
        ["fiber", 6],
        ["meat", 4],
      ] as const) {
        const r = addToBag(next, id, qty);
        next = r.bag;
      }
      b = next;
      saveCharacterBag(b);
    }
    return b;
  });
  const [craft, setCraft] = useState<(ItemInstance | null)[]>([null, null, null, null]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Persist bag
  useEffect(() => {
    saveCharacterBag(bag);
  }, [bag]);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const recipe = useMemo(() => {
    const ids = craft.map((c) => c?.templateId ?? null);
    return matchRecipe(ids);
  }, [craft]);

  const craftResultPreview = useMemo(() => {
    if (!recipe) return null;
    return {
      templateId: recipe.result.templateId,
      qty: recipe.result.qty,
      name: getItemTemplate(recipe.result.templateId).name,
      icon: getItemTemplate(recipe.result.templateId).icon,
    };
  }, [recipe]);

  const putInBagIndex = useCallback(
    (index: number) => {
      const c = cursor;
      if (!c) {
        // Pick up from bag
        const item = bag.slots[index]?.item;
        if (!item) return;
        const { bag: next, removed } = removeFromSlot(bag, index, item.qty);
        if (!removed) return;
        setBag(next);
        setCursor({ source: "bag", index, item: removed });
        setSelected(`bag-${index}`);
        return;
      }
      // Place cursor into bag
      if (c.source === "bag" && c.index === index) {
        setCursor(null);
        return;
      }
      if (c.source === "bag") {
        setBag(swapSlots(bag, c.index, index));
        setCursor(null);
        return;
      }
      // From kept or craft → bag
      const existing = bag.slots[index]?.item;
      let next = setSlotItem(bag, index, c.item);
      if (existing) {
        // swap: existing goes to cursor origin later — simplify: stack if same
        if (existing.templateId === c.item.templateId) {
          const max = getItemTemplate(existing.templateId).maxStack;
          const room = max - existing.qty;
          if (room > 0) {
            const take = Math.min(room, c.item.qty);
            next = setSlotItem(bag, index, {
              ...existing,
              qty: existing.qty + take,
            });
            if (c.item.qty - take > 0) {
              setCursor({ ...c, item: { ...c.item, qty: c.item.qty - take } });
            } else {
              setCursor(null);
            }
            setBag(next);
            return;
          }
        }
      }
      setBag(next);
      setCursor(null);
      if (c.source === "kept") {
        setBag((b) => {
          const k = { ...ensureKeptLoadout(b).kept! };
          k[c.slot] = existing ? { ...existing } : null;
          return { ...b, kept: k, updatedAt: Date.now() };
        });
      }
      if (c.source === "craft") {
        setCraft((g) => {
          const n = [...g];
          n[c.index] = existing ? { ...existing } : null;
          return n;
        });
      }
    },
    [bag, cursor],
  );

  const putInKept = useCallback(
    (slot: KeptLoadoutSlotId) => {
      const kept = ensureKeptLoadout(bag).kept!;
      const c = cursor;
      if (!c) {
        const item = kept[slot];
        if (!item) return;
        setBag((b) => {
          const k = { ...ensureKeptLoadout(b).kept! };
          k[slot] = null;
          return { ...b, kept: k, updatedAt: Date.now() };
        });
        setCursor({ source: "kept", slot, item: { ...item } });
        setSelected(`kept-${slot}`);
        return;
      }
      if (!canEquipInKeptSlot(slot, c.item.templateId)) {
        setMsg(`Cannot equip ${itemName(c.item)} in ${slot}`);
        return;
      }
      const prev = kept[slot];
      setBag((b) => {
        const k = { ...ensureKeptLoadout(b).kept! };
        k[slot] = { ...c.item };
        return { ...b, kept: k, updatedAt: Date.now() };
      });
      // Sync combat weapons when main/side change
      if (slot === "mainHand") {
        const wid = weaponIdFromTemplate(c.item.templateId);
        if (wid) onEquip(wid);
      }
      if (slot === "sideArm") {
        const wid = weaponIdFromTemplate(c.item.templateId);
        onEquipOff(wid);
      }
      setCursor(prev ? { source: "kept", slot, item: { ...prev } } : null);
      setMsg(`Equipped ${itemName(c.item)}`);
    },
    [bag, cursor, onEquip, onEquipOff],
  );

  const putInCraft = useCallback(
    (index: number) => {
      const c = cursor;
      if (!c) {
        const item = craft[index];
        if (!item) return;
        setCraft((g) => {
          const n = [...g];
          n[index] = null;
          return n;
        });
        setCursor({ source: "craft", index, item: { ...item } });
        return;
      }
      const prev = craft[index];
      setCraft((g) => {
        const n = [...g];
        n[index] = { ...c.item };
        return n;
      });
      setCursor(prev ? { source: "craft", index, item: { ...prev } } : null);
    },
    [craft, cursor],
  );

  const takeCraftResult = useCallback(() => {
    if (!recipe) return;
    // Consume one from each non-empty craft cell
    setCraft((g) =>
      g.map((cell) => {
        if (!cell) return null;
        if (cell.qty <= 1) return null;
        return { ...cell, qty: cell.qty - 1 };
      }),
    );
    const add = addToBag(bag, recipe.result.templateId, recipe.result.qty);
    setBag(add.bag);
    if (add.leftover > 0) {
      setMsg(`Crafted — bag full, leftover ${add.leftover}`);
    } else {
      setMsg(`Crafted ${getItemTemplate(recipe.result.templateId).name} ×${recipe.result.qty}`);
    }
  }, [bag, recipe]);

  const resetLayout = () => {
    saveLayoutScript(DEFAULT_CHARACTER_LAYOUT);
    setMsg("Layout script reset to default XY board");
  };

  const kept = ensureKeptLoadout(bag).kept!;

  const renderItemSlot = (
    cell: LayoutCell,
    item: ItemInstance | null,
    onClick: () => void,
    extraClass = "",
  ) => {
    const icon = itemIcon(item);
    return (
      <button
        type="button"
        key={cell.id}
        className={`ecp-slot ecp-slot--${cell.kind} ${extraClass} ${selected === cell.id ? "is-selected" : ""} ${!item ? "is-empty" : ""}`}
        style={cellGridStyle(cell)}
        title={item ? `${itemName(item)} ×${item.qty}` : cell.label}
        onClick={onClick}
      >
        {cell.label && <span className="ecp-slot-label">{cell.label}</span>}
        {icon && <img className="ecp-slot-icon" src={icon} alt="" draggable={false} />}
        {item && item.qty > 1 && <span className="ecp-slot-qty">{item.qty}</span>}
      </button>
    );
  };

  return (
    <div className="ecp-root" role="dialog" aria-label="Explorer character inventory">
      <div className="ecp-panel">
        <header className="ecp-head">
          <h2 className="ecp-title">Character</h2>
          <p className="ecp-sub">
            Explorer · Minecraft-style slots · Fantasy Scene craft grid · {characterName}
          </p>
          <div className="ecp-head-actions">
            {onOpenAvatarEdit && (
              <button type="button" className="ecp-btn" onClick={onOpenAvatarEdit}>
                <Wand2 size={12} style={{ marginRight: 4 }} />
                Avatar face
              </button>
            )}
            {onOpenCrafting && (
              <button type="button" className="ecp-btn" onClick={onOpenCrafting}>
                Production craft
              </button>
            )}
            <button type="button" className="ecp-btn" onClick={resetLayout} title="Reset XY layout script">
              <RotateCcw size={12} />
            </button>
            <button type="button" className="ecp-btn primary" onClick={onClose}>
              <X size={14} style={{ marginRight: 4 }} />
              Close
            </button>
          </div>
        </header>

        <div
          className="ecp-board"
          style={{
            gridTemplateColumns: `repeat(12, minmax(40px, 1fr))`,
          }}
        >
          {layout.map((cell) => {
            if (cell.kind === "label") {
              return (
                <div
                  key={cell.id}
                  className="ecp-slot ecp-slot--label"
                  style={cellGridStyle(cell)}
                >
                  {cell.label}
                </div>
              );
            }

            if (cell.kind === "avatar") {
              return (
                <div key={cell.id} className="ecp-avatar" style={cellGridStyle(cell)}>
                  <div className="ecp-avatar-stage">
                    <LoadoutMeshStage
                      race={race}
                      weaponId={currentWeapon}
                      offHandId={currentOffHand}
                      className="ecp-mesh"
                    />
                  </div>
                  <div className="ecp-avatar-foot">
                    <span className="ecp-avatar-name">{characterName}</span>
                    <span>Explorer · drag mesh</span>
                  </div>
                </div>
              );
            }

            if (cell.kind === "bag" || cell.kind === "hotbar") {
              const idx = cell.bagIndex ?? 0;
              return renderItemSlot(
                cell,
                bag.slots[idx]?.item ?? null,
                () => putInBagIndex(idx),
                cell.kind === "hotbar" ? "ecp-slot--hotbar" : "",
              );
            }

            if (cell.kind === "kept" && cell.bind) {
              const slot = cell.bind as KeptLoadoutSlotId;
              if (!KEPT_LOADOUT_ORDER.includes(slot)) return null;
              return renderItemSlot(cell, kept[slot] ?? null, () => putInKept(slot));
            }

            if (cell.kind === "armor") {
              // Armor binds use bag drag for now — store in accessory tags via bag
              // Display placeholder empty slots for paper-doll feel (head/chest/legs/feet)
              return renderItemSlot(cell, null, () => {
                setMsg(
                  cell.bind
                    ? `${cell.label}: equip from bag (drag gear with matching slot)`
                    : "",
                );
                setSelected(cell.id);
                // If cursor has armor-tagged item, stash message — full armor SSOT is paperdoll
                if (cursor) {
                  const tpl = getItemTemplate(cursor.item.templateId);
                  if (tpl.equipSlot === cell.bind || tpl.tags?.includes(cell.bind || "")) {
                    // Put into first free bag slot as "worn" marker — keep simple
                    putInBagIndex(
                      bag.slots.findIndex((s) => !s.item) >= 0
                        ? bag.slots.findIndex((s) => !s.item)
                        : 0,
                    );
                    setMsg(`Equipped look: ${itemName(cursor.item)} → ${cell.label}`);
                  }
                }
              });
            }

            if (cell.kind === "craft") {
              const idx = cell.craftIndex ?? 0;
              return renderItemSlot(cell, craft[idx] ?? null, () => putInCraft(idx));
            }

            if (cell.kind === "craftResult") {
              const fake: ItemInstance | null = craftResultPreview
                ? {
                    instanceId: "craft-preview",
                    templateId: craftResultPreview.templateId,
                    qty: craftResultPreview.qty,
                  }
                : null;
              return (
                <button
                  type="button"
                  key={cell.id}
                  className={`ecp-slot ecp-slot--craftResult ${!fake ? "is-empty" : ""}`}
                  style={cellGridStyle(cell)}
                  title={fake ? `Take ${craftResultPreview?.name}` : "Craft result"}
                  onClick={() => {
                    if (fake) takeCraftResult();
                  }}
                >
                  <span className="ecp-slot-label">Out</span>
                  {craftResultPreview?.icon && (
                    <img
                      className="ecp-slot-icon"
                      src={craftResultPreview.icon}
                      alt=""
                      draggable={false}
                    />
                  )}
                  {fake && fake.qty > 1 && <span className="ecp-slot-qty">{fake.qty}</span>}
                </button>
              );
            }

            return null;
          })}
        </div>

        <div className="ecp-craft-msg" role="status">
          {msg}
          {cursor && (
            <span style={{ marginLeft: 12, color: "#f0d48a" }}>
              Holding: {itemName(cursor.item)} ×{cursor.item.qty}
            </span>
          )}
        </div>

        <p className="ecp-hint">
          <kbd>Click</kbd> pick / place · <kbd>I</kbd> / <kbd>Esc</kbd> close · Craft: wood→planks,
          wood×2→sticks, stone×4→bricks, ore+coal→ingot · Kept loadout survives death · Avatar face
          uses Explorer modular head from Fantasy Scene opener · Layout script:{" "}
          <code>localStorage gw_character_page_layout_v1</code>
        </p>
      </div>
    </div>
  );
}

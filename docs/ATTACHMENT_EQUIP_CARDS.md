# Attachment equip cards (character / unit / player)

Reference outline:  
`F:\GitHub\voxgrudge-fresh\three-js-basic-character-customisation`

Original: [CodePen gOayPKV](https://codepen.io/eroxburgh/pen/gOayPKV)

---

## What the demo teaches

| Demo piece | Role | Grudge mapping |
|------------|------|----------------|
| `.attachment` | Slot **container card** over the body | `AttachmentSlotCards` `.att-slot` |
| `.add-sign-plus` | ＋ opens / rotates to ✕ | `.att-plus.is-open` |
| `.attachment-options` | Fan of option cards | `.att-options` |
| `.option` + SVG | Visual pick for a part | `.att-option` + icon |
| `applyWeapon` / `applyLegs` | Swap + **redraw** | `onApply` → `studio.setWeapon` / equip |
| `%` left/top | Anchors on viewport | `CardAnchor` `{ x, y, fan }` |
| `applyedWeapon` state | Equipped piece | `equippedId` on slot def |

**Core loop:**  
`toggle slot → pick option → apply → rebuild visuals`  
Not a separate inventory page only — **body-anchored** containers.

---

## Card kinds

| Kind | Use | Anchors |
|------|-----|---------|
| **player** | Live loadout over combat / loadout panel | weapon, offhand, head, body, legs |
| **unit** | Ally / party / AI frame (compact) | weapon, head, body |
| **character** | Account create / race kit preview | race, weapon, armor, legs |

Data: `src/components/equip/attachmentCardModel.ts`  
UI: `src/components/equip/AttachmentSlotCards.tsx`  
Styles: `attachmentCards.css`  
Wired in: `EquipmentScreen` (player loadout figure)

---

## Best practices (keep when migrating kits)

1. **One open menu** — closing other slots when opening one.  
2. **Anchors are % of preview**, not fixed pixels — survives resize.  
3. **Options are data** — weapons from arsenal; legs/armor can stay “Soon”.  
4. **Apply always hits the engine** for live slots (weapon/offhand), not only UI state.  
5. **Unit cards stay smaller** — don’t steal focus from player HUD.  
6. **Character cards** use charactersgrudox race options + same apply → catalog id.  
7. **Scale/color** on mesh still go through `fitCharacterHeight` + material restore.

---

## Next wiring

- Dressing Room / EditorMode: overlay cards on live canvas  
- Account Hub create: `kind="character"` + race options  
- Unit frame (party): `kind="unit"` with read-only or limited swaps  
- Mine-Loader held items: map slot ids → hotbar / equip API  

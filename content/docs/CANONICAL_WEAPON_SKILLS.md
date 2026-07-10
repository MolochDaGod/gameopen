# Canonical weapon skills

**Source of truth:** ObjectStore `master-weaponSkills.json` **v3.1.0**

| Surface | URL |
|---------|-----|
| Browse UI | https://browse.grudge-studio.com/WEAPON_SKILLS |
| Catalog | https://objectstore.grudge-studio.com/api/v1/master-weaponSkills.json |
| Named weapons | https://objectstore.grudge-studio.com/api/v1/weapons.json |
| T0 starters | https://objectstore.grudge-studio.com/api/v1/t0-weapons.json |
| Icons CDN | https://assets.grudge-studio.com/icons/... |

## Counts (v3.1.0)

- **16** weapon types (playable + TOOL; SHIELD/TOME are off-hand modifiers)
- **268** skills
- Every weapon type and skill has an `icon` path

## Gameopen runtime

Prefab JSON under `content/skills/` and `content/weapons/` is the **combat sandbox** layer (anim, VFX, hit windows). Icons and design names should reference ObjectStore:

```json
"icon": {
  "path": "icons/pack/weapons/Sword_01.png",
  "cdnUrl": "https://assets.grudge-studio.com/icons/pack/weapons/Sword_01.png",
  "source": "objectstore-master-weaponSkills@3.1.0",
  "status": "ready"
}
```

Do **not** hardcode skill trees in the client. Fetch the master catalog (or a slim extract) at runtime when building full class loadouts.

# grudge-vfx.puter.site — why it cannot be fixed from our account

## Exact hostname

`https://grudge-vfx.puter.site/` remains **404** for visitors.

## Puter API findings (MolochDaDev)

| Operation | Result |
|-----------|--------|
| `hosting.create("grudge-vfx", …)` | **409** `A site with this subdomain already exists` |
| `hosting.read("grudge-vfx")` | **403** `Access denied` / forbidden |
| `hosting.delete("grudge-vfx")` | **403** Access denied |
| `hosting.list()` (our 24 sites) | **grudge-vfx not listed** |

Conclusion: the subdomain **`grudge-vfx` is reserved by another Puter account (or an orphan reservation we do not own)**. Our CLI deploys that “succeeded” with `https://undefined.puter.site` never attached a working root for that name.

## Working URLs (same Fantasy panel as vfxgrudge)

All of these return **200** and serve the real panel (`Desktop/vfx-sandbox/dist/public`):

- https://vfxgrudge.puter.site/
- https://vfx-grudge.puter.site/
- https://grudgevfx.puter.site/
- https://grudge-vfx-studio.puter.site/
- https://grudgevfx-panel.puter.site/
- https://vfx.grudge.studio/

## Console errors you pasted

```
inpage.js … IN_PAGE_CHANNEL_NODE_ID … EthereumAdapter … SolanaAdapter …
evmAsk.js … Cannot redefine property: ethereum
```

These are **Trust Wallet / multi-chain wallet extension** scripts injected into every page. They are **not** from Grudge VFX. They will appear even on a healthy site.

**Fix the console noise:** disable that extension for `*.puter.site`, or open the URL in Incognito without extensions.

## How to free `grudge-vfx` (if you need that exact name)

1. Log into Puter with **whatever account originally created `grudge-vfx`** and delete the site, **or**
2. Puter support: release subdomain `grudge-vfx` for MolochDaDev, **or**
3. Stop using the name — use **vfxgrudge** / **grudgevfx** (recommended).

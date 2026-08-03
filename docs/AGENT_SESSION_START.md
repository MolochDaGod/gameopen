# Agent session start (Open)

Use when opening a **new** Grok session on this machine for Grudge Open.

## 1. Open the right folder

| Do | Don't |
|----|--------|
| Workspace = `C:\Users\nugye\Documents\gameopen` | `C:\Program Files\Microsoft Visual Studio\...` |
| CWD inside gameopen git root | Random Documents subfolder without AGENTS.md |

Home rules (`~/.grok/rules/*`) load everywhere. **This repo’s `AGENTS.md` only loads when the workspace/repo is gameopen.**

## 2. Fire the owner protocol

Say or imply: **follow work-with-nugye**.

Agent should:

1. Load skill **`work-with-nugye`**
2. Load **`grudge-studio`**
3. Load task leaf (`grudge-live-servers`, grudge6, packages, combat, …)
4. Name the **one SSOT** it will extend

## 3. Quick self-check (agent)

```
[ ] CWD is gameopen
[ ] work-with-nugye preferences known (no invent / map session / Getsuga melee-only)
[ ] AGENTS.md + OPEN_PACKAGE_SSOT known
[ ] Grepped before adding files
[ ] On bug: tighten AGENTS/rules, not a new stack
```

## 4. If something still goes wrong

1. Fix the **product code** if it’s a bug.  
2. If the **agent** misbehaved (invented system, wrong host, wrong package):  
   - Edit `AGENTS.md` or `~/.grok/rules/00-work-with-user.md` / `10-grudge-fleet-hard-rules.md`  
   - Optionally strengthen `work-with-nugye` skill text  
3. **Never** create `*2` / `new*` parallel systems as the fix.

See also: `docs/AGENT_WORK_CONTRACT.md` · `docs/OPEN_PACKAGE_SSOT.md`

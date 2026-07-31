/**
 * Create UI — embeds ui.grudge-studio.com (HYDRA studio + fleet game-ui packs).
 *
 * Product roles:
 *  - Open = library + GRUDOX voxel launcher host
 *  - Forge = 3D game development / deploy
 *  - UI   = HUD / menus / settings / pack solutions + assets for all editors
 *
 * AI assist uses fleet AI + pack JSON dataBindings to guide wiring to game assets.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  LayoutDashboard,
  Sparkles,
  Link2,
  Package,
  Loader2,
} from "lucide-react";
import { FLEET } from "../lib/fleet";
import { toast } from "sonner";
import "./uiStudioMode.css";

const UI_ORIGIN = "https://ui.grudge-studio.com";

export type UiPackId =
  | "open"
  | "grudox"
  | "forge"
  | "warlords"
  | "grudge6"
  | "danger"
  | "survival"
  | "arena";

interface PackMeta {
  id: string;
  name: string;
  features?: string[];
  usageStates?: string[];
  playUrl?: string;
  url?: string;
}

interface Props {
  onExit: () => void;
  /** Starting pack (open / grudox / forge …). */
  initialPack?: string;
}

function studioUrl(opts: {
  pack?: string;
  page?: "studio" | "games" | "assets" | "hotkeys" | "main-panel";
}): string {
  const page = opts.page ?? "studio";
  const u = new URL(`${UI_ORIGIN}/${page === "studio" ? "studio" : page}`);
  u.searchParams.set("embed", "1");
  u.searchParams.set("from", "open");
  u.searchParams.set("return", "https://open.grudge-studio.com/");
  if (opts.pack) u.searchParams.set("pack", opts.pack);
  return u.toString();
}

export function UiStudioMode({ onExit, initialPack = "open" }: Props) {
  const [pack, setPack] = useState(initialPack);
  const [page, setPage] = useState<"studio" | "games" | "assets" | "hotkeys" | "main-panel">(
    "studio",
  );
  const [packs, setPacks] = useState<PackMeta[]>([]);
  const [wireNotes, setWireNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOut, setAiOut] = useState<string | null>(null);

  const src = useMemo(() => studioUrl({ pack, page }), [pack, page]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`${UI_ORIGIN}/game-ui-packs/index.json`);
        if (!r.ok) return;
        const j = (await r.json()) as { packs?: PackMeta[] };
        setPacks(Array.isArray(j.packs) ? j.packs : []);
      } catch {
        /* offline */
      }
    })();
  }, []);

  const selected = packs.find((p) => p.id === pack);

  const copyBindings = useCallback(async () => {
    try {
      const path = selected?.url || `./${pack}.json`;
      const url = path.startsWith("http")
        ? path
        : `${UI_ORIGIN}/game-ui-packs/${path.replace(/^\.\//, "")}`;
      const r2 = await fetch(url);
      if (!r2.ok) throw new Error("pack fetch failed");
      const json = await r2.json();
      const bindings = (json as { dataBindings?: unknown }).dataBindings ?? json;
      const text = JSON.stringify(bindings, null, 2);
      await navigator.clipboard.writeText(text);
      toast.success("Pack JSON / bindings copied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    }
  }, [pack, selected]);

  const askAiWire = useCallback(async () => {
    setAiBusy(true);
    setAiOut(null);
    try {
      const features = selected?.features?.join(", ") || "hud, inventory, menus";
      const states = selected?.usageStates?.join(", ") || "explore, combat, menu";
      const userNotes = wireNotes.trim();
      const prompt = [
        `You are the Grudge Studio UI wiring agent.`,
        `Target pack: ${selected?.name || pack} (${pack}).`,
        `Features: ${features}.`,
        `Usage states: ${states}.`,
        `Play URL: ${selected?.playUrl || "n/a"}.`,
        `UI SSOT: ${UI_ORIGIN} — craftpix assets under /assets/craftpix/, packs under /game-ui-packs/.`,
        `CDN icons/textures also: ${FLEET.assets}/ui/ and ObjectStore/info definitions.`,
        userNotes ? `Designer notes: ${userNotes}` : "",
        `Return:`,
        `1) Recommended pack load snippet (GrudgeGameUI.load or iframe studio export).`,
        `2) dataBindings map: UI element → fleet API / character field / item icon CDN key.`,
        `3) Open vs Forge handoff (when to use open.grudge-studio.com vs forge.grudge-studio.com).`,
        `4) Checklist to ship HUD/menus/settings without hardcoding private buckets.`,
        `Be concise, copy-pasteable.`,
      ]
        .filter(Boolean)
        .join("\n");

      let text = "";
      try {
        const r = await fetch(`${FLEET.ai}/v1/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1200,
          }),
        });
        if (r.ok) {
          const j = (await r.json()) as {
            content?: string;
            message?: string;
            choices?: Array<{ message?: { content?: string } }>;
          };
          text =
            j.content ||
            j.message ||
            j.choices?.[0]?.message?.content ||
            "";
        }
      } catch {
        /* fall through */
      }
      if (!text) {
        text = [
          `## Wire ${pack} UI`,
          ``,
          `\`\`\`js`,
          `// From ui.grudge-studio.com/game-ui-runtime.js`,
          `const ui = await GrudgeGameUI.load("${pack}");`,
          `ui.mount(document.getElementById("hud"));`,
          `ui.setState("${selected?.usageStates?.[0] || "explore"}");`,
          `\`\`\``,
          ``,
          `### Bindings (typical)`,
          `- HP/MP bars → Railway character stats (gameData /api/characters)`,
          `- Inventory slots → account bag + item icons from assets.grudge-studio.com`,
          `- Skill hotbar → ObjectStore skills + baked anim clip ids`,
          `- Settings gear → local saveData.open + fleet prefs`,
          ``,
          `### Fleet`,
          `- Design packs: ${UI_ORIGIN}/studio?pack=${pack}`,
          `- Launch play: Open library (GRUDOX voxel) or Forge publish (3D deploy)`,
          userNotes ? `\nNotes: ${userNotes}` : "",
        ].join("\n");
        toast.message("Offline wiring checklist (AI hub unavailable)");
      } else {
        toast.success("AI wiring plan ready");
      }
      setAiOut(text);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* ignore */
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI wire failed");
    } finally {
      setAiBusy(false);
    }
  }, [pack, selected, wireNotes]);

  return (
    <div className="ui-studio">
      <header className="ui-studio-bar">
        <button type="button" className="ui-studio-btn" onClick={onExit} title="Back to Open">
          <ArrowLeft size={16} /> Open
        </button>
        <div className="ui-studio-brand">
          <LayoutDashboard size={16} className="ui-studio-icon" />
          <div>
            <div className="ui-studio-title">Create UI</div>
            <div className="ui-studio-sub">
              ui.grudge-studio.com · HUD · menus · settings · fleet packs
            </div>
          </div>
        </div>
        <div className="ui-studio-tabs">
          {(
            [
              ["studio", "Studio"],
              ["games", "Packs"],
              ["assets", "Assets"],
              ["hotkeys", "Input"],
              ["main-panel", "Panel"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={"ui-studio-tab" + (page === id ? " on" : "")}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="ui-studio-select"
          value={pack}
          onChange={(e) => setPack(e.target.value)}
          title="Game UI pack"
        >
          {(packs.length
            ? packs
            : [
                { id: "open", name: "Open" },
                { id: "grudox", name: "GRUDOX" },
                { id: "forge", name: "Forge" },
                { id: "warlords", name: "Warlords" },
              ]
          ).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ui-studio-btn"
          onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={14} /> Pop-out
        </button>
      </header>

      <div className="ui-studio-body">
        <iframe
          key={src}
          className="ui-studio-frame"
          title="Grudge UI Studio"
          src={src}
          allow="clipboard-read; clipboard-write"
        />
        <aside className="ui-studio-rail">
          <h3>
            <Package size={14} /> Pack · {pack}
          </h3>
          {selected && (
            <p className="ui-studio-muted">
              {(selected.features || []).slice(0, 8).join(" · ") || "Fleet UI pack"}
            </p>
          )}
          <p className="ui-studio-roles">
            <strong>Open</strong> = GRUDOX voxel launcher · <strong>Forge</strong> = 3D
            deploy · <strong>UI</strong> = chrome for all
          </p>
          <button type="button" className="ui-studio-btn block" onClick={() => void copyBindings()}>
            <Link2 size={14} /> Copy pack JSON
          </button>
          <label className="ui-studio-label">Wiring notes</label>
          <textarea
            className="ui-studio-notes"
            placeholder="e.g. bind hotbar to sword_shield skills, bag to Railway…"
            value={wireNotes}
            onChange={(e) => setWireNotes(e.target.value)}
          />
          <button
            type="button"
            className="ui-studio-btn primary block"
            disabled={aiBusy}
            onClick={() => void askAiWire()}
          >
            {aiBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            AI · wire to game assets
          </button>
          {aiOut && (
            <pre className="ui-studio-aiout">{aiOut}</pre>
          )}
          <div className="ui-studio-links">
            <a href={`${UI_ORIGIN}/games`} target="_blank" rel="noreferrer">
              All game packs
            </a>
            <a href="https://forge.grudge-studio.com" target="_blank" rel="noreferrer">
              Forge (3D deploy)
            </a>
            <a href="https://open.grudge-studio.com/" target="_blank" rel="noreferrer">
              Open library
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default UiStudioMode;

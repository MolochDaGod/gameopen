/**
 * Open character info / equipment — embeds ui Main Panel (Unity Trait Store).
 * Player SSOT: Railway character UUID + account bag + ledger grudge_uuid + model3d mesh bake.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { FLEET } from "../lib/fleet";
import { FLEET_CHARACTER_ERAS, getStoredToken, type FleetCharacterEra } from "../lib/grudgeAuth";
import { gameSession } from "../game/GameSession";
import "./uiStudioMode.css";

const UI_ORIGIN = FLEET.ui;
const ERAS = FLEET_CHARACTER_ERAS;

function panelUrl(era: string, characterId: string | null): string {
  const u = new URL(`${UI_ORIGIN}/main-panel.html`);
  u.searchParams.set("embed", "1");
  u.searchParams.set("from", "open");
  u.searchParams.set("tab", "equipment");
  u.searchParams.set("era", era);
  u.searchParams.set("return", "https://open.grudge-studio.com/equipment");
  if (characterId) u.searchParams.set("characterId", characterId);
  return u.toString();
}

export function CharacterInfoMode({ onExit }: { onExit: () => void }) {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const [era, setEra] = useState<FleetCharacterEra>(() => {
    const e = q.get("era");
    return ERAS.includes(e as FleetCharacterEra) ? (e as FleetCharacterEra) : "warlords";
  });
  const [characterId, setCharacterId] = useState<string | null>(
    () => q.get("characterId") || gameSession.snapshot.selectedCharacterId,
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => panelUrl(era, characterId), [era, characterId]);

  const postAuth = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const token = getStoredToken();
    const account = gameSession.snapshot.account;
    win.postMessage(
      {
        type: "GRUDGE_AUTH",
        token,
        characterId,
        era,
        grudgeId: account?.grudgeId || null,
        username: account?.displayName || null,
        user: account,
      },
      UI_ORIGIN,
    );
  }, [characterId, era]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== UI_ORIGIN) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "GRUDGE_READY") postAuth();
      if (d.type === "GRUDGE_CHARACTER_CHANGE" && d.characterId) {
        setCharacterId(String(d.characterId));
        gameSession.selectCharacter(String(d.characterId));
      }
      if (d.type === "GRUDGE_MESH_EQUIP" && d.characterId) {
        gameSession.selectCharacter(String(d.characterId));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [postAuth]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("era", era);
    if (characterId) url.searchParams.set("characterId", characterId);
    else url.searchParams.delete("characterId");
    window.history.replaceState({ openMode: "equipment" }, "", url.pathname + url.search);
  }, [era, characterId]);

  const hero = gameSession.snapshot.characters.find((c) => c.id === characterId);
  const accountId = gameSession.snapshot.account?.grudgeId;

  return (
    <div className="ui-studio">
      <header className="ui-studio-bar">
        <button type="button" className="ui-studio-btn" onClick={onExit} title="Back to Open">
          <ArrowLeft size={16} />
        </button>
        <div className="ui-studio-brand">
          <span className="ui-studio-title">Character info</span>
          <span className="ui-studio-sub">
            UUID · cNFT · mesh bake · owned gear · {era}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ERAS.map((e) => (
            <button
              key={e}
              type="button"
              className={"ui-studio-tab" + (e === era ? " on" : "")}
              onClick={() => setEra(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <span className="ui-studio-sub" style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
          {accountId ? `ID ${accountId}` : "Sign in"}
          {hero?.id ? ` · hero ${hero.id}` : ""}
        </span>
        <a
          className="ui-studio-btn"
          href={`https://ui.grudge-studio.com/mesh-showcase.html?era=${era}${characterId ? `&characterId=${encodeURIComponent(characterId)}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Mesh showcase all races"
        >
          Meshes
        </a>
        <a
          className="ui-studio-btn"
          href={src.replace("embed=1", "embed=0")}
          target="_blank"
          rel="noopener noreferrer"
          title="Open Main Panel"
        >
          <ExternalLink size={15} />
        </a>
      </header>
      <div className="ui-studio-body">
        <iframe
          ref={iframeRef}
          className="ui-studio-frame"
          title="Character equipment"
          src={src}
          onLoad={postAuth}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}

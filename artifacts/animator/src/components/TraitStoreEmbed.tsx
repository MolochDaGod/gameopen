/**
 * Trait Store embed — ui.grudge-studio.com Main Panel (Unity paperdoll + mesh UUID SSOT).
 * Auth: Open JWT via postMessage GRUDGE_AUTH. Roster/equip: Railway only.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FLEET } from "../lib/fleet";
import { getStoredToken } from "../lib/grudgeAuth";
import { gameSession } from "../game/GameSession";

const UI_ORIGIN = FLEET.ui;
const TRAIT_ORIGIN = FLEET.traits;
const INDEX_URL = `${UI_ORIGIN}/data/mesh-showcase-index.json`;

type MeshItem = {
  meshId: string;
  name: string;
  group: string;
  defUuid: string;
  unarmedBase?: boolean;
};

type MeshIndex = {
  algorithm?: string;
  races?: Record<string, { items?: MeshItem[] }>;
};

export function TraitStoreEmbed({
  era,
  characterId,
  raceId,
  meshIds,
  height = 680,
}: {
  era: string;
  characterId: string | null;
  raceId?: string | null;
  meshIds?: string[];
  height?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [index, setIndex] = useState<MeshIndex | null>(null);
  const src = useMemo(() => {
    const u = new URL(`${TRAIT_ORIGIN}/`);
    u.searchParams.set("embed", "1");
    u.searchParams.set("from", "open-account");
    u.searchParams.set("tab", "equipment");
    u.searchParams.set("era", era);
    u.searchParams.set("return", "https://open.grudge-studio.com/account");
    if (characterId) u.searchParams.set("characterId", characterId);
    return u.toString();
  }, [era, characterId]);

  useEffect(() => {
    let live = true;
    fetch(INDEX_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (live && j) setIndex(j as MeshIndex);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const postAuth = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const account = gameSession.snapshot.account;
    win.postMessage(
      {
        type: "GRUDGE_AUTH",
        token: getStoredToken(),
        characterId,
        era,
        grudgeId: account?.grudgeId || null,
        username: account?.displayName || null,
        user: account,
      },
      TRAIT_ORIGIN,
    );
  }, [characterId, era]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== TRAIT_ORIGIN && e.origin !== UI_ORIGIN) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "GRUDGE_READY") postAuth();
      if (d.type === "GRUDGE_CHARACTER_CHANGE" && d.characterId) {
        gameSession.selectCharacter(String(d.characterId));
      }
      if (d.type === "GRUDGE_MESH_EQUIP") {
        void gameSession.refreshCharacters();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [postAuth]);

  useEffect(() => {
    postAuth();
  }, [postAuth, src]);

  const raceKey = String(raceId || "human").toLowerCase();
  const catalog = index?.races?.[raceKey]?.items || [];
  const rows = (meshIds || []).map((id) => {
    const hit = catalog.find((it) => it.meshId === id);
    return {
      meshId: id,
      name: hit?.name || id,
      group: hit?.group || "",
      defUuid: hit?.defUuid || "",
      unarmedBase: !!hit?.unarmedBase,
    };
  });

  return (
    <div>
      {rows.length > 0 && (
        <div
          style={{
            overflowX: "auto",
            marginBottom: 10,
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.55 }}>
                <th style={th}>Group</th>
                <th style={th}>Item</th>
                <th style={th}>mesh_id</th>
                <th style={th}>def UUID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.meshId}>
                  <td style={td}>{r.group || "—"}</td>
                  <td style={td}>
                    {r.name}
                    {r.unarmedBase ? " · base" : ""}
                  </td>
                  <td style={{ ...td, color: "#fde68a" }}>{r.meshId}</td>
                  <td style={{ ...td, color: "#86efac", wordBreak: "break-all" }}>
                    {r.defUuid || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ opacity: 0.5, margin: "6px 0 0", fontSize: 10 }}>
            {index?.algorithm || "sha1(grudge-asset:kit#meshId)"} · definitions only · owned gear uses ledger
            grudge_uuid
          </p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Trait Store"
        src={src}
        onLoad={postAuth}
        allow="clipboard-read; clipboard-write"
        style={{
          width: "100%",
          height,
          border: "1px solid rgba(201,149,10,0.35)",
          borderRadius: 8,
          background: "#0a0705",
        }}
      />
    </div>
  );
}

const th: CSSProperties = { padding: "4px 6px", fontWeight: 600 };
const td: CSSProperties = { padding: "4px 6px", verticalAlign: "top" };

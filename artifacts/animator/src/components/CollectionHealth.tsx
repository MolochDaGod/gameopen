/**
 * Lightweight fleet health strip for Open collection (hub / zones).
 * Probes same-origin rewrites so we see what the player origin can reach.
 */
import { useEffect, useState, type CSSProperties } from "react";

type ProbeId = "open-api" | "blocks" | "characters" | "arcade";

interface Probe {
  id: ProbeId;
  label: string;
  /** Relative URL on open.grudge-studio.com */
  path: string;
  /** Accept these status codes as "up" */
  ok?: number[];
}

const PROBES: Probe[] = [
  { id: "open-api", label: "Open API", path: "/api/health", ok: [200, 204] },
  { id: "blocks", label: "Codex blocks", path: "/api/blocks?limit=1", ok: [200] },
  { id: "characters", label: "Characters", path: "/api/characters?limit=1", ok: [200, 401] },
  // Arcade path exists when CF edge is live (document or redirect)
  { id: "arcade", label: "Arcade edge", path: "/arcade/play/racer", ok: [200, 301, 302, 307, 308] },
];

type Status = "pending" | "up" | "down";

export function CollectionHealth({ compact }: { compact?: boolean }) {
  const [status, setStatus] = useState<Record<ProbeId, Status>>(() =>
    Object.fromEntries(PROBES.map((p) => [p.id, "pending"])) as Record<ProbeId, Status>,
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await Promise.all(
        PROBES.map(async (p) => {
          try {
            const r = await fetch(p.path, {
              method: "GET",
              credentials: "include",
              signal: AbortSignal.timeout(6000),
            });
            const okCodes = p.ok ?? [200];
            if (!cancelled) {
              setStatus((s) => ({
                ...s,
                [p.id]: okCodes.includes(r.status) ? "up" : "down",
              }));
            }
          } catch {
            if (!cancelled) {
              setStatus((s) => ({ ...s, [p.id]: "down" }));
            }
          }
        }),
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={compact ? rowCompact : row} aria-label="Collection fleet health">
      <span style={label}>Fleet</span>
      {PROBES.map((p) => (
        <span key={p.id} style={chip(status[p.id])} title={`${p.label}: ${p.path}`}>
          <i style={dot(status[p.id])} />
          {p.label}
        </span>
      ))}
    </div>
  );
}

const row: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  margin: "10px 0 4px",
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
};

const rowCompact: CSSProperties = {
  ...row,
  margin: "6px 0",
  opacity: 0.9,
};

const label: CSSProperties = {
  opacity: 0.55,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginRight: 4,
};

function chip(s: Status): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    color: s === "up" ? "#9fe8a0" : s === "down" ? "#ff8a8a" : "#9bb3d4",
  };
}

function dot(s: Status): CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: s === "up" ? "#3dce6a" : s === "down" ? "#ff4d4d" : "#6b7c99",
    boxShadow: s === "up" ? "0 0 6px #3dce6a88" : undefined,
  };
}

/**
 * VoxGrudgeNative — the native in-gameopen VoxGrudge surface.
 *
 * Mounts the Danger Room VoxelEditor for local building, and attempts a
 * lightweight WebSocket presence connection to `/api/space` for live
 * multiplayer awareness (player count + position pings). The editor works
 * fully offline if the socket isn't available.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { VoxelEditor } from "../three/voxel/VoxelEditor";
import { zoneWsUrl } from "../lib/zone";

interface Props {
  onExit: () => void;
}

// ── simple position-ping protocol ────────────────────────────────────────────

interface PresencePing {
  type: "ping";
  id: string;
  x: number;
  y: number;
  z: number;
}

interface PresenceState {
  id: string;
  x: number;
  y: number;
  z: number;
  lastSeen: number;
}

// ── component ─────────────────────────────────────────────────────────────────

export function VoxGrudgeNative({ onExit }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef    = useRef<VoxelEditor | null>(null);
  const wsRef        = useRef<WebSocket | null>(null);

  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [peers, setPeers]       = useState<PresenceState[]>([]);

  // Remove stale peers after 8 s of silence.
  const peerMapRef = useRef<Map<string, PresenceState>>(new Map());

  // ── VoxelEditor mount ────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let editor: VoxelEditor | null = null;
    try {
      editor = new VoxelEditor(container);
      editorRef.current = editor;
    } catch (err) {
      console.warn("[VoxGrudgeNative] VoxelEditor init failed", err);
    }
    return () => {
      editor?.dispose();
      editorRef.current = null;
    };
  }, []);

  // ── WebSocket presence ───────────────────────────────────────────────────────

  useEffect(() => {
    // GRUDOX room server — never same-origin on open.grudge-studio.com
    // (Vercel does not terminate WebSockets on rewrites reliably).
    const wsUrl = zoneWsUrl("/api/space");
    let ws: WebSocket;
    let disposed = false;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let pruneInterval: ReturnType<typeof setInterval> | null = null;
    const selfId = `vox-${Math.random().toString(36).slice(2, 8)}`;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (disposed) return;
        setWsStatus("live");

        // Broadcast a position ping every 2 s (no real cursor tracking —
        // just a heartbeat so others know we're here).
        pingInterval = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const msg: PresencePing = { type: "ping", id: selfId, x: 0, y: 0, z: 0 };
          ws.send(JSON.stringify(msg));
        }, 2000);
      });

      ws.addEventListener("message", (ev) => {
        if (disposed) return;
        try {
          const msg = JSON.parse(ev.data as string) as PresencePing;
          if (msg.type !== "ping" || msg.id === selfId) return;
          const now = Date.now();
          peerMapRef.current.set(msg.id, { id: msg.id, x: msg.x, y: msg.y, z: msg.z, lastSeen: now });
          setPeers([...peerMapRef.current.values()]);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.addEventListener("close", () => {
        if (disposed) return;
        setWsStatus("offline");
        if (pingInterval) clearInterval(pingInterval);
      });

      ws.addEventListener("error", () => {
        if (disposed) return;
        setWsStatus("offline");
        if (pingInterval) clearInterval(pingInterval);
      });
    } catch {
      setWsStatus("offline");
    }

    // Prune peers that have gone quiet (>8 s).
    pruneInterval = setInterval(() => {
      const cutoff = Date.now() - 8000;
      let changed = false;
      for (const [id, p] of peerMapRef.current) {
        if (p.lastSeen < cutoff) {
          peerMapRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) setPeers([...peerMapRef.current.values()]);
    }, 4000);

    return () => {
      disposed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (pruneInterval) clearInterval(pruneInterval);
      try { wsRef.current?.close(); } catch { /* ignore */ }
      wsRef.current = null;
      peerMapRef.current.clear();
    };
  }, []);

  const inWorldCount = peers.length + 1; // +1 for self

  return (
    <div style={wrap}>
      {/* Full-screen VoxelEditor container */}
      <div ref={containerRef} style={editorContainer} />

      {/* ── top bar ── */}
      <div style={topBar}>
        <div style={brandBlock}>
          <span style={brandVox}>VOX</span>
          <span style={brandGrudge}>GRUDGE</span>
          <span style={brandTag}>OPEN WORLD</span>
        </div>

        <div style={statusBlock}>
          {wsStatus === "live" ? (
            <span style={statusLive}>● live · {inWorldCount} in world</span>
          ) : wsStatus === "connecting" ? (
            <span style={statusConnecting}>○ connecting…</span>
          ) : (
            <span style={statusOffline}>○ offline — local editor mode</span>
          )}
        </div>

        <button type="button" style={leaveBtn} onClick={onExit}>
          ⬑ Doors
        </button>
      </div>

      {/* ── bottom hint bar ── */}
      <div style={hintBar}>
        RMB orbit · scroll zoom · LMB build · Shift+drag pan · R to connect to open world server
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const wrap: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#040810",
  userSelect: "none",
  fontFamily: "Inter, system-ui, sans-serif",
};

const editorContainer: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
};

const topBar: CSSProperties = {
  position: "absolute",
  top: 10,
  left: 14,
  right: 14,
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(4,8,16,0.82)",
  border: "1px solid rgba(95,224,255,0.22)",
  pointerEvents: "auto",
};

const brandBlock: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  marginRight: 4,
};

const brandVox: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#5fe0ff",
  letterSpacing: 2,
  textShadow: "0 1px 10px rgba(95,224,255,0.55)",
};

const brandGrudge: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#eaf4ff",
  letterSpacing: 2,
};

const brandTag: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#5fe0ff",
  letterSpacing: 2,
  opacity: 0.7,
  alignSelf: "center",
  marginLeft: 2,
};

const statusBlock: CSSProperties = {
  flex: 1,
  fontSize: 12,
};

const statusLive: CSSProperties = {
  color: "#5fe0ff",
  fontWeight: 700,
};

const statusConnecting: CSSProperties = {
  color: "#9fb8da",
  opacity: 0.7,
};

const statusOffline: CSSProperties = {
  color: "#9fb8da",
  opacity: 0.55,
};

const leaveBtn: CSSProperties = {
  border: "1px solid rgba(95,224,255,0.35)",
  background: "rgba(4,8,16,0.6)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "5px 12px",
  cursor: "pointer",
  fontSize: 13,
};

const hintBar: CSSProperties = {
  position: "absolute",
  bottom: 12,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10,
  fontSize: 11,
  color: "#9fb8da",
  opacity: 0.6,
  pointerEvents: "none",
  textAlign: "center",
  whiteSpace: "nowrap",
};

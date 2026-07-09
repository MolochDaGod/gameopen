import http from "http";
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import { config, isOriginAllowed } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import router from "./routes/index.js";

const app = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, cb) {
      if (isOriginAllowed(origin)) cb(null, true);
      else cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) =>
    req.path === "/healthz" ||
    req.path === "/api/healthz" ||
    req.path === "/health" ||
    req.path === "/api/health",
});
app.use(globalLimiter);

app.get("/", (_req, res) => {
  res.json({
    service: "gameopen-api",
    health: "/api/healthz",
    effects: "/api/effects",
    characters: "/api/characters",
    fleet: "/api/fleet/config",
  });
});

app.use("/api", router);

// Also expose health at root for some platforms
app.get("/healthz", (_req, res) => res.redirect(307, "/api/healthz"));

const server = http.createServer(app);

/** Lightweight co-op room for future open-world sync (Carrier-style). */
const wss = new WebSocketServer({ noServer: true });
const rooms = new Map<string, Set<import("ws").WebSocket>>();

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/carrier" && url.pathname !== "/api/realtime") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", "http://localhost");
  const roomId = url.searchParams.get("room") || "lobby";
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  const room = rooms.get(roomId)!;
  room.add(ws);

  ws.send(JSON.stringify({ t: "welcome", room: roomId, peers: room.size - 1 }));

  ws.on("message", (data) => {
    const payload = typeof data === "string" ? data : data.toString();
    for (const peer of room) {
      if (peer !== ws && peer.readyState === peer.OPEN) peer.send(payload);
    }
  });

  ws.on("close", () => {
    room.delete(ws);
    if (room.size === 0) rooms.delete(roomId);
  });
});

server.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    "gameopen-api listening",
  );
});

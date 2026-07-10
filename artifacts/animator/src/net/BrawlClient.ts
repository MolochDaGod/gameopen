/**
 * Browser-side client for the GRUDOX Ruins Brawler room (`/api/brawl`).
 *
 * A thin typed wrapper over a WebSocket that mirrors the conventions of
 * {@link ../net/DangerClient.DangerClient} (connect/reconnect, queued control
 * frames, decoded server messages emitted to subscribers) but targets the
 * shared GRUDOX zone backend and the `@workspace/brawl-net` wire protocol
 * instead of gameopen's own Danger Room relay.
 *
 * The Danger Room lives on gameopen's api-server (`VITE_GAME_SERVER_URL`); the
 * Brawler is an authoritative GRUDOX zone room, so this client resolves its URL
 * from `VITE_ZONE_SERVER_URL` (see {@link ../lib/zone}).
 */
import {
  WS_PATH,
  decodeServer,
  encode,
  type GameEvent,
  type LootState,
  type PlayerInput,
  type PlayerState,
  type ProjectileState,
  type ShopItemId,
  type ZombieState,
} from "@workspace/brawl-net";
import { zoneWsUrl } from "../lib/zone";

export interface BrawlWelcome {
  self: string;
  serverTime: number;
  tickHz: number;
  snapshotHz: number;
  /** Map seed — the client regenerates the identical static world from it. */
  seed: number;
}

export interface BrawlSnapshot {
  time: number;
  ack: number;
  players: PlayerState[];
  zombies: ZombieState[];
  projectiles: ProjectileState[];
  loot: LootState[];
  events: GameEvent[];
}

export interface BrawlClientEvents {
  open: () => void;
  close: () => void;
  welcome: (msg: BrawlWelcome) => void;
  snapshot: (snap: BrawlSnapshot) => void;
}

type Listener<K extends keyof BrawlClientEvents> = BrawlClientEvents[K];

export class BrawlClient {
  private ws: WebSocket | null = null;
  private listeners: { [K in keyof BrawlClientEvents]: Set<Listener<K>> } = {
    open: new Set(),
    close: new Set(),
    welcome: new Set(),
    snapshot: new Set(),
  };

  private wantOpen = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private outbox: string[] = [];
  /** Pending join name, resent automatically after a reconnect. */
  private joinName: string | null = null;

  selfId = "";
  seed = 0;

  on<K extends keyof BrawlClientEvents>(event: K, cb: Listener<K>): () => void {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  private emit<K extends keyof BrawlClientEvents>(
    event: K,
    ...args: Parameters<Listener<K>>
  ): void {
    for (const cb of this.listeners[event]) {
      (cb as (...a: Parameters<Listener<K>>) => void)(...args);
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    this.wantOpen = true;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(zoneWsUrl(WS_PATH));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      // Re-announce our join before flushing any queued input.
      if (this.joinName !== null) ws.send(encode({ t: "join", name: this.joinName }));
      for (const frame of this.outbox.splice(0)) ws.send(frame);
      this.emit("open");
    };
    ws.onclose = () => {
      this.emit("close");
      if (this.wantOpen) this.scheduleReconnect();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
    ws.onmessage = (e) => this.handle(typeof e.data === "string" ? e.data : "");
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.wantOpen) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1500);
  }

  private handle(raw: string): void {
    const msg = decodeServer(raw);
    if (!msg) return;
    switch (msg.t) {
      case "welcome":
        this.selfId = msg.id;
        this.seed = msg.seed;
        this.emit("welcome", {
          self: msg.id,
          serverTime: msg.serverTime,
          tickHz: msg.tickHz,
          snapshotHz: msg.snapshotHz,
          seed: msg.seed,
        });
        return;
      case "snapshot":
        this.emit("snapshot", {
          time: msg.time,
          ack: msg.ack,
          players: msg.players,
          zombies: msg.zombies,
          projectiles: msg.projectiles,
          loot: msg.loot,
          events: msg.events,
        });
        return;
    }
  }

  private send(frame: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else {
      // Only worth queuing control frames; high-rate input can be dropped.
      this.outbox.push(frame);
      if (this.outbox.length > 8) this.outbox.shift();
    }
  }

  /** Announce our display name and join the shared brawl room. */
  join(name: string): void {
    this.joinName = name.slice(0, 32);
    this.send(encode({ t: "join", name: this.joinName }));
  }

  /** Send a per-tick input command (dropped rather than queued if offline). */
  sendInput(cmd: PlayerInput): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode({ t: "input", cmd }));
  }

  /** Buy a safe-zone shop item. */
  buy(item: ShopItemId): void {
    this.send(encode({ t: "buy", item }));
  }

  /** Tear down for good (no reconnect). */
  dispose(): void {
    this.wantOpen = false;
    this.joinName = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    for (const key of Object.keys(this.listeners) as (keyof BrawlClientEvents)[]) {
      this.listeners[key].clear();
    }
  }
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional origin of a dedicated game server (e.g. a VPS-hosted realtime
   * relay). Accepts an `http(s)://` or `ws(s)://` base URL; when unset, the
   * client falls back to the same-origin relay. See `net/DangerClient.ts`.
   */
  readonly VITE_GAME_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

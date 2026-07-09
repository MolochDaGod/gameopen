/** Fleet + runtime configuration for gameopen API. */

function splitOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [
      "https://gameopen.vercel.app",
      "https://grudges.grudge-studio.com",
      "https://survival.grudge-studio.com",
      "https://open.grudge-studio.com",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4173",
    ];
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || "development",
  allowedOrigins: splitOrigins(process.env.ALLOWED_ORIGINS),
  grudgeBuilderApi:
    process.env.GRUDGE_BUILDER_API ||
    "https://grudge-api-production-0d46.up.railway.app",
  grudgeIdUrl: process.env.GRUDGE_ID_URL || "https://id.grudge-studio.com",
  assetsCdn: process.env.ASSETS_CDN || "https://assets.grudge-studio.com",
  objectStoreUrl:
    process.env.OBJECTSTORE_URL ||
    "https://objectstore.grudge-studio.com/api/v1",
  gameopenAssetPrefix: process.env.GAMEOPEN_ASSET_PREFIX || "gameopen",
};

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  if (origin.endsWith(".grudge-studio.com")) return true;
  if (origin.endsWith(".puter.site") || origin.endsWith(".puter.work")) return true;
  return false;
}

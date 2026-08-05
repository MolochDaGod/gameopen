# Sync canonical public fleet VITE_* env to Vercel Production (names + public URLs only).
# Usage: pwsh scripts/sync-fleet-public-env.ps1 [-Preview] [-Projects gameopen,grudge-builder]
# Docs: docs/FLEET_ENV_SECRETS_MATRIX.md
# Never put secrets in this script.

param(
  [switch]$Preview,
  [string[]]$Projects = @(
    "gameopen",
    "grudge-builder",
    "warlord-genesis",
    "mine-loader",
    "voxgrudge",
    "grudge-studio-forge",
    "dungeon-crawler-quest",
    "grudox"
  ),
  [string]$Scope = "grudgenexus"
)

$ErrorActionPreference = "Stop"
$envTarget = if ($Preview) { "preview" } else { "production" }

$pack = [ordered]@{
  VITE_AUTH_GATEWAY_URL = "https://id.grudge-studio.com"
  VITE_AUTH_URL         = "https://id.grudge-studio.com"
  VITE_ASSETS_URL       = "https://assets.grudge-studio.com"
  VITE_ASSET_CDN_URL    = "https://assets.grudge-studio.com"
  VITE_OBJECTSTORE_URL  = "https://objectstore.grudge-studio.com/api/v1"
  VITE_AI_URL           = "https://ai.grudge-studio.com"
  VITE_GAME_DATA_API    = "https://grudge-api-production-0d46.up.railway.app"
  VITE_GRUDGE_API_BASE  = "https://grudge-api-production-0d46.up.railway.app"
}

foreach ($p in $Projects) {
  Write-Host "=== $p ($envTarget) ===" -ForegroundColor Cyan
  foreach ($k in $pack.Keys) {
    vercel env add $k $envTarget --scope $Scope --project $p --value $pack[$k] --force -y --no-sensitive
    if ($LASTEXITCODE -ne 0) { throw "Failed $p $k" }
  }
  if ($p -eq "gameopen") {
    vercel env add VITE_ZONE_SERVER_URL $envTarget --scope $Scope --project $p --value "wss://voxgrudge-grudox-room-production.up.railway.app" --force -y --no-sensitive
    vercel env add VITE_USE_R2 $envTarget --scope $Scope --project $p --value "true" --force -y --no-sensitive
  }
}

Write-Host "Done. Redeploy Vite apps so builds bake new env." -ForegroundColor Green

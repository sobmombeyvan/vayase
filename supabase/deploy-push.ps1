# ============================================================
# ATTENTION: CE FICHIER EST UN SCRIPT POWERSHELL
# NE PAS COLLER DANS SUPABASE SQL EDITOR
# Pour SQL, utilisez: supabase/push_setup_ready.sql
# ============================================================
# VAYASE - Deploy send-web-push and configure secrets
# Usage: powershell -ExecutionPolicy Bypass -File supabase\deploy-push.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot ".env"

if (-not (Test-Path $EnvFile)) {
  Write-Host "ERREUR: fichier .env introuvable" -ForegroundColor Red
  exit 1
}

# Load .env
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim().Trim('"')
    Set-Item -Path "env:$name" -Value $value
  }
}

$ProjectRef = $env:VITE_SUPABASE_PROJECT_ID
$VapidPublic = $env:VITE_VAPID_PUBLIC_KEY
$VapidPrivate = $env:VAPID_PRIVATE_KEY
$WebhookSecret = $env:PUSH_WEBHOOK_SECRET

if (-not $ProjectRef -or -not $VapidPublic -or -not $VapidPrivate -or -not $WebhookSecret) {
  Write-Host "ERREUR: .env incomplet" -ForegroundColor Red
  Write-Host "Requis: VITE_SUPABASE_PROJECT_ID, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_WEBHOOK_SECRET"
  exit 1
}

Write-Host ""
Write-Host "=== VAYASE - Deploiement Web Push ===" -ForegroundColor Cyan
Write-Host "Projet: $ProjectRef"
Write-Host ""

# Step 1: Login
Write-Host "[1/4] Connexion Supabase - le navigateur va s ouvrir..." -ForegroundColor Yellow
npx.cmd supabase login
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Step 2: Link project
Write-Host ""
Write-Host "[2/4] Liaison du projet - entrez le mot de passe DB Supabase..." -ForegroundColor Yellow
npx.cmd supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Step 3: Set secrets
Write-Host ""
Write-Host "[3/4] Configuration des secrets..." -ForegroundColor Yellow
npx.cmd supabase secrets set `
  "VAPID_PUBLIC_KEY=$VapidPublic" `
  "VAPID_PRIVATE_KEY=$VapidPrivate" `
  "VAPID_SUBJECT=mailto:contact@vayase.com" `
  "PUSH_WEBHOOK_SECRET=$WebhookSecret" `
  --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Step 4: Deploy function
Write-Host ""
Write-Host "[4/4] Deploiement send-web-push..." -ForegroundColor Yellow
npx.cmd supabase functions deploy send-web-push --no-verify-jwt --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Derniere etape SQL:" -ForegroundColor Yellow
Write-Host "  1. Ouvrez https://supabase.com/dashboard/project/$ProjectRef/sql/new"
Write-Host "  2. Copiez-collez le contenu de supabase/push_setup_ready.sql"
Write-Host "  3. Cliquez Run"
Write-Host ""

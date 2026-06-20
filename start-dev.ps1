# Revenue Copilot — Script para levantar en desarrollo (sin Docker)
# Ejecutar: .\start-dev.ps1

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Revenue Copilot — Inicio Local" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verificar .env
if (-not (Test-Path ".env")) {
    Write-Host "[!] No se encontro .env — copiando de .env.example" -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "[!] EDITA .env con tus API keys antes de continuar!" -ForegroundColor Red
    Write-Host ""
}

# 1. Engine (FastAPI)
Write-Host "[1/3] Iniciando Engine (FastAPI) en puerto 8000..." -ForegroundColor Green
$engineProcess = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" -WorkingDirectory ".\apps\engine" -PassThru -WindowStyle Normal

Start-Sleep -Seconds 2

# 2. Web (Next.js)  
Write-Host "[2/3] Iniciando Web (Next.js) en puerto 3000..." -ForegroundColor Green
$webProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory ".\apps\web" -PassThru -WindowStyle Normal

Start-Sleep -Seconds 3

# 3. Info
Write-Host "" 
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "  Todo corriendo!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:  http://localhost:3000" -ForegroundColor White
Write-Host "  Engine API: http://localhost:8000" -ForegroundColor White
Write-Host "  Health:     http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "  Para parar: Cerrar las ventanas o Ctrl+C" -ForegroundColor DarkGray
Write-Host ""

# Mantener script vivo
Write-Host "Presiona Enter para detener todo..." -ForegroundColor DarkGray
Read-Host

# Cleanup
if ($engineProcess -and !$engineProcess.HasExited) { Stop-Process $engineProcess }
if ($webProcess -and !$webProcess.HasExited) { Stop-Process $webProcess }
Write-Host "Detenido." -ForegroundColor Yellow

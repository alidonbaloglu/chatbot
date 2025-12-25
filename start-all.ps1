# ChatBot - Tum Sunuculari Baslatma Scripti
# Bu script hem Node.js hem de Python RAG sunucusunu baslatir

Write-Host "ChatBot Sunuculari Baslatiliyor..." -ForegroundColor Cyan
Write-Host ""

# Proje dizinine git
$projectDir = $PSScriptRoot
Set-Location $projectDir

# Python RAG sunucusunu arka planda baslat
Write-Host "[1/2] Python RAG Servisi baslatiliyor (Port 8000)..." -ForegroundColor Yellow
$pythonJob = Start-Process -FilePath "python" -ArgumentList "python/rag_service.py" -WorkingDirectory $projectDir -PassThru -WindowStyle Normal

# Kisa bir bekleme
Start-Sleep -Seconds 2

# Node.js sunucusunu baslat
Write-Host "[2/2] Node.js Sunucusu baslatiliyor (Port 5280)..." -ForegroundColor Green
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Magenta
Write-Host "  RAG Servisi: http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Web Sunucu:  http://localhost:5280" -ForegroundColor Green
Write-Host "  Login:       http://localhost:5280/login.html" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Durdurmak icin Ctrl+C basin" -ForegroundColor Gray
Write-Host ""

# Node sunucusunu baslat (foreground'da calisir)
npm start

# Script sonlandiginda Python process'ini de durdur
if ($pythonJob) {
    Stop-Process -Id $pythonJob.Id -Force -ErrorAction SilentlyContinue
}

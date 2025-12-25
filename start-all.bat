@echo off
echo ========================================
echo   ChatBot - Tum Sunuculari Baslat
echo ========================================
echo.

cd /d %~dp0

echo [1/2] Python RAG Servisi baslatiliyor (Port 8000)...
start "RAG Service" cmd /k "cd /d %~dp0 && python python/rag_service.py"

timeout /t 2 /nobreak > nul

echo [2/2] Node.js Sunucusu baslatiliyor (Port 5280)...
echo.
echo ========================================
echo   RAG Servisi: http://localhost:8000
echo   Web Sunucu:  http://localhost:5280
echo   Login:       http://localhost:5280/login.html
echo ========================================
echo.

npm start

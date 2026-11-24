@echo off
chcp 65001 >nul
title FocusFlow OS — Lanzador de Escritorio

echo ========================================================
echo        🔮 FocusFlow OS — Ecosistema Cognitivo TDAH
echo ========================================================
echo.
echo Iniciando el backend local (API + IA, puerto 8081)...

:: Iniciar el backend unico (python -m server) si no esta corriendo
powershell -Command "if (-not (Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue)) { Start-Process python -ArgumentList '-m','server' -WorkingDirectory '%~dp0' -WindowStyle Hidden }"

timeout /t 1 /nobreak >nul

echo Abriendo FocusFlow OS en modo App de Escritorio...

:: Obtener la ruta absoluta de index.html
set "APP_PATH=%~dp0index.html"
set "APP_URL=file:///%APP_PATH:\=/%"

:: Intentar abrir con Microsoft Edge en modo --app (Ventana nativa sin barras de navegacin)
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start msedge --app="%APP_URL%" --enable-features=OverlayScrollbar
    goto done
)

:: Intentar con Google Chrome en modo --app
where chrome >nul 2>nul
if %errorlevel% equ 0 (
    start chrome --app="%APP_URL%"
    goto done
)

:: Intentar con Brave
if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" --app="%APP_URL%"
    goto done
)

:: Fallback predeterminado del sistema
start "" "%APP_PATH%"

:done
echo.
echo [OK] Aplicacion de escritorio abierta con exito.
echo Puedes cerrar esta ventana cuando desees.
timeout /t 3 >nul
exit

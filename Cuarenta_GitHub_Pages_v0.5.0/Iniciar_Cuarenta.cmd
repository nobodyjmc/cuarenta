@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar_Cuarenta.ps1" %*
if errorlevel 1 (
  echo.
  echo Revisa el mensaje anterior. Pulsa una tecla para cerrar.
  pause >nul
  exit /b 1
)
endlocal

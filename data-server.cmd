@echo off
chcp 65001 >nul
title REZEDA - сервер данных договоров
cd /d "%~dp0"

rem Ищем Node: сначала в системе, потом переносимую сборку рядом с проектом.
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%~dp0..\nodejs\node-v22.11.0-win-x64\node.exe" set "NODE_EXE=%~dp0..\nodejs\node-v22.11.0-win-x64\node.exe"
if not defined NODE_EXE if exist "%~dp0..\..\nodejs\node-v22.11.0-win-x64\node.exe" set "NODE_EXE=%~dp0..\..\nodejs\node-v22.11.0-win-x64\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
  echo.
  echo   Не найден Node.js — без него сервер данных не запустится.
  echo   Сам сайт при этом работает: откройте index.html двойным кликом.
  echo.
  pause
  exit /b 1
)

"%NODE_EXE%" "%~dp0server\rezeda-server.js"

echo.
echo   Сервер остановлен.
pause

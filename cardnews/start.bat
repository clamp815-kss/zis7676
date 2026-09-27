@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 카드뉴스 에디터 서버
where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치하세요.
  pause
  exit /b 1
)
rem 서버가 뜰 시간을 준 뒤 브라우저 자동 오픈
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8787/"
node server.js
echo.
echo 서버가 종료되었습니다.
pause

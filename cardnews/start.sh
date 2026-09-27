#!/usr/bin/env bash
# macOS/Linux용 실행 스크립트 (Windows는 start.bat)
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js가 필요합니다: https://nodejs.org"; exit 1; }
URL="http://localhost:${PORT:-8787}/"
( sleep 2; command -v open >/dev/null && open "$URL" || xdg-open "$URL" >/dev/null 2>&1 ) &
exec node server.js

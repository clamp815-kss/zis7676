#!/usr/bin/env bash
# headless Chrome 일괄 캡처 (보조 도구 — 기본 내보내기는 에디터의 "전체 ZIP")
# 사용: ./render.sh <덱.json> [스타일] [출력폴더]      예) ./render.sh my-deck.json mag out
# 전제: 서버 실행 중 (start.bat / start.sh). 덱 JSON은 에디터의 💾 버튼으로 저장.
# 환경변수: CHROME=<크롬 경로>, CHROME_FLAGS=--no-sandbox(root 환경), SERVER=http://host:8787
# Windows에서는: node tools\render.js <덱.json> [스타일] [출력폴더]
cd "$(dirname "$0")" && exec node tools/render.js "$@"

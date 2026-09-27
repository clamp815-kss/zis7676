# 🃏 카드뉴스 에디터

글(기사·대본·메모)을 붙여넣으면 AI가 요약·구성해 인스타그램 카드뉴스(1080×1350 PNG 세트)로 만들어주는 로컬 브라우저 에디터입니다.
설치는 호스트 PC 1대에만 하고, 팀원은 브라우저로 접속합니다.

- **텍스트는 HTML, 이미지는 배경** — 한글을 AI 이미지에 굽지 않으므로 글자가 선명하고 언제든 수정할 수 있습니다.
- **API 키 없이 기본 기능 동작** — 호스트의 Claude 구독(`claude -p`)과 ChatGPT 구독(Codex CLI)을 재사용합니다.
- **빌드·프레임워크 없음** — `editor/index.html` 한 파일, 서버는 Node.js 내장 모듈만 사용합니다(의존성 0).

## 빠른 시작

### 호스트 (1회 설정)
1. [Node.js](https://nodejs.org) **22 이상** 설치
2. (AI 변환) [Claude Code](https://claude.com/claude-code) 설치 후 `claude` 로그인
3. (선택, AI 배경) [Codex CLI](https://github.com/openai/codex) 설치 후 `codex` 로그인 → `~/.codex/auth.json`이 생기면 자동 감지
4. `start.bat` 더블클릭 (macOS/Linux: `./start.sh`) → 서버 기동 + 브라우저 자동 오픈

콘솔에 팀원용 주소(`http://<호스트IP>:8787/`)와 기능별 활성 상태가 출력됩니다.

### 팀원
브라우저(Chrome 계열)로 `http://<호스트IP>:8787/` 접속. 끝.
에디터를 다른 경로로 열었다면 상단 ⚙에서 호스트 주소를 입력하세요.

> ⚠️ `editor/index.html`을 더블클릭(`file://`)으로 열면 편집은 되지만 **PNG/ZIP 내보내기와 AI 기능은 동작하지 않습니다.** 반드시 `start.bat`으로 연 `http://` 주소를 사용하세요.

## 사용법

1. **✨ 글로 카드 만들기** → 글 전체 붙여넣기 → **✨ AI로 변환** (20~40초)
   - 표지 → 도입 → 포인트 01~NN → (비교표) → (인용) → 마무리 CTA 순서로 8~12장이 만들어집니다.
   - 서버/AI 없이 쓰려면 **⚡ 빠른변환**: 첫 줄=제목, `##`·`1.`=본문 카드, 마크다운 표=비교표, `>`=인용
2. 배경은 자동 처리됩니다: 즉시 풀 셔플 → 이미지 생성 수단이 있으면 표지·인용·마무리를 주제 맞춤 AI 배경으로 순차 교체 (사진 스타일에서만)
3. 상단 드롭다운으로 **스타일 6종** 전환, 오른쪽 패널에서 내용·포인트 색·배경 수정
4. **전체 ZIP** → `01.png` ~ `NN.png` (1080×1350)

### 편집 문법 (모든 텍스트 필드)
| 입력 | 결과 |
|---|---|
| Enter | 줄바꿈 |
| `*단어*` | 포인트색 강조 |
| `**단어**` | 굵게 |

글이 넘치면 헤드라인(최저 40px)·본문(최저 23px) 글자 크기가 자동으로 줄어듭니다.

### 스타일
| 키 | 이름 | 특징 |
|---|---|---|
| `cine` | 시네마틱 (사진) | 다크 전면, 블루 포인트, 사진 배경 |
| `mag` | 매거진 형광 (사진) | 깃발형 라벨, 형광펜 강조, 백지 본문 |
| `manga` | 만화 오버레이 (사진) | 세로바 라벨, 텍스트 섀도, 일러스트 배경 |
| `pixel` | 픽셀 인포 (주황) | Black Han Sans, 청키 배지, 마스코트 |
| `doodle` | 도들 (손글씨) | Gaegu 폰트, 비정형 라운드 테두리, 파스텔 핑크 |
| `blue` | 화이트 & 블루 | 블루 그라데이션, 사진 미사용 |

URL 해시로 스타일을 지정할 수 있습니다: `http://localhost:8787/#mag`
배경 이미지는 스타일별로 따로 저장되므로 스타일을 바꿔도 서로 섞이지 않습니다.

### 저장
- 입력 즉시 브라우저(localStorage)에 자동 저장됩니다.
- 💾 / 📂 : 덱 JSON 파일 내보내기/불러오기 (팀원 간 전달·백업)
- 🗑 : 초기화 (브라우저 저장본 삭제)

## 배경 이미지

| 경로 | 조건 | 비고 |
|---|---|---|
| 🎲 풀 셔플 | 항상 (사진 스타일) | `editor/assets/pool/<스타일>/` |
| 📁 업로드 | 항상 | dataURL로 덱에 저장 |
| 스톡 검색 | 서버 필요 | Pexels 키가 있으면 Pexels, 없으면 Openverse(무키) |
| 🎨 AI 생성 | 서버 + 아래 중 하나 | 우선순위: Codex → Gemini → OpenAI |

AI 생성 수단 (위에서부터 자동 선택):
1. **Codex CLI (ChatGPT 구독)** — 로그인만 되어 있으면 추가 키·과금 없음. 1장에 1~2분.
2. **Gemini API 키** — `tools/gemini-key.txt` (기본 `gemini-3.1-flash-image-preview`, 모델이 없으면 `gemini-2.5-flash-image`로 자동 폴백)
3. **OpenAI API 키** — `tools/openai-key.txt` (`gpt-image-2`, 1024×1536)

키 파일 규칙: `tools/*.txt.example`을 복사해 `.example`을 뗀 이름으로 저장 → 1줄=키, (선택) 2줄=모델명.
요청마다 다시 읽으므로 서버 재시작이 필요 없습니다. 키 파일은 `.gitignore`에 포함되어 커밋되지 않습니다.
Pexels 키는 `tools/pexels-key.txt`.

하단 어둠(스크림) 슬라이더로 카드별 가독성을 조절할 수 있습니다.

> 기본 풀 이미지(`editor/assets/pool/`)는 `node tools/make-pool.js`로 만든 **추상 그라데이션 플레이스홀더**입니다. 실제 사진이나 AI 생성 이미지로 바꾸려면 같은 파일명(`01.png`…)으로 덮어쓰세요. 개수를 바꾸면 `index.html`의 `PRESETS.<스타일>.pool` 값도 맞춰주세요.

## 보조 도구

| 명령 | 설명 |
|---|---|
| `?selftest=1` | 브라우저 자가진단 (내보내기 가능 여부, 서버·폰트·AI 상태) |
| `?shoot=N` | N번 카드만 풀사이즈로 렌더 (`&deck=<json 경로>` 로 덱 지정 가능) |
| `./render.sh deck.json [스타일] [폴더]` | headless Chrome 일괄 캡처 (Windows: `node tools\render.js …`) |
| `node tools/make-pool.js` | 기본 배경 풀 + 픽셀 마스코트 재생성 |

## 서버 API (포트 8787, `PORT` 환경변수로 변경)

| 엔드포인트 | 역할 |
|---|---|
| `GET /` | `editor/` 정적 서빙 |
| `GET /ping` | 기능 감지 `{ok, claude, pexels, codex, gemini, openai}` |
| `POST /convert` `{text}` | `claude -p`로 글 → 덱 JSON 변환 (프롬프트: `tools/deck-prompt.md`) |
| `POST /img-gen` `{prompt, provider?}` | AI 배경 생성 → `editor/assets/gen/`에 저장 후 경로 반환 |
| `GET /img-search?q=` | Pexels / Openverse 검색 프록시 |
| `GET /img?url=` | 이미지 CORS 프록시 (https만, 24시간 캐시) — 내보내기용 |

## 보안
- 서버는 **인증이 없습니다.** 사내 LAN 전용으로 쓰고 공인망(포트포워딩·클라우드)에 노출하지 마세요.
- API 키는 `tools/*-key.txt`에만 두고 커밋하지 마세요 (`.gitignore` 처리됨).

## 폴더 구조
```
cardnews/
├─ start.bat / start.sh      호스트 실행
├─ server.js                 로컬 서버 (AI 브리지)
├─ render.sh                 일괄 캡처 (tools/render.js 래퍼)
├─ editor/
│  ├─ index.html             에디터 (단일 파일)
│  ├─ vendor/                html2canvas, JSZip (MIT)
│  └─ assets/pool|gen|mascot.png
└─ tools/
   ├─ deck-prompt.md         AI 변환 프롬프트
   ├─ *-key.txt.example      키 파일 템플릿
   ├─ make-pool.js           풀/마스코트 생성기
   └─ render.js              DevTools 프로토콜 캡처
```

## 알려진 제약
- Codex 이미지 생성은 장당 1~2분 걸립니다(순차 생성, 그동안 편집 가능).
- Google 구독(AI Pro)은 OAuth 이미지 생성을 지원하지 않아 Gemini는 API 키로만 사용합니다.
- html2canvas는 일부 최신 CSS(`clip-path`, 하드 `box-shadow` 등)를 브라우저와 다르게 그립니다. 스타일을 추가하면 `?selftest=1`과 ZIP 결과를 꼭 확인하세요.
- 폰트(Pretendard·Gaegu·Black Han Sans)는 CDN에서 불러오므로 인터넷 연결이 필요합니다. 연결이 없으면 시스템 폰트로 대체됩니다.

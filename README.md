# zis7676

브라우저에서 바로 실행되는 블록 퍼즐 게임입니다. 빌드 과정이 없으며 `index.html`을 열면 실행됩니다.

## 파일

| 파일 | 설명 |
|---|---|
| `index.html` | 게임 화면 마크업. 가장 나중에 올라온 버전을 분리한 것 |
| `css/style.css` | `index.html`의 스타일 |
| `js/game.js` | `index.html`의 게임 로직 |
| `tetris_palace_v13_audio_ui_fix.html` | v13 버전(단일 파일 그대로). 어느 쪽을 정식으로 할지는 아직 정하지 않았습니다 |
| `tests/smoke.test.js` | 두 HTML 파일 모두에 대해 실행되는 브라우저 테스트 |
| `.github/workflows/test.yml` | 푸시·PR마다 테스트를 실행하는 CI |

## 조작

| | 이동 | 회전 | 소프트드롭 | 하드드롭 |
|---|---|---|---|---|
| P1 | ← → | ↑ | ↓ | Space |
| P2 | A D | W | S | Shift |

일시정지는 `P` 또는 상단 버튼입니다. 모바일에서는 화면의 터치 버튼으로 조작합니다.

## 테스트

```bash
npm ci
npx playwright install chromium
npm test
```

각 HTML 파일마다 다음을 확인합니다.

- 스크립트 오류 없이 열리고 메뉴가 표시되는지
- 1인용·2인용 시작, 키 입력, 점수 반영
- 일시정지(P 키와 버튼), 메뉴로 돌아가기
- 최고 점수가 새로고침 후에도 유지되는지
- iPhone 13, Pixel 7, iPad Mini 화면에서 보드가 화면 안에 들어오고 탭으로 시작되는지

조작감, 소리, 난이도는 자동으로 확인하지 못하므로 실기기에서 직접 확인해야 합니다.

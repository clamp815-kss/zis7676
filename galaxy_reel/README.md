# Galaxy 스마트폰 30초 쇼릴 (비공식 콘셉트 영상)

- 결과물: `galaxy_reel_30s.mp4` — 1080×1920(9:16), 30fps, 30초, H.264 + AAC
- 배경음악: `make_music.py`로 직접 합성한 **오리지널 곡**(120 BPM 일렉트로닉 팝)입니다.
  삼성 공식 광고 음악(예: Over the Horizon)이나 그 멜로디는 저작권 문제로 사용하지 않았습니다.
- 폰 디자인과 로고는 코드로 그린 일반적인 형태이며, 삼성 공식 로고나 이미지는 쓰지 않았습니다.
- 폰트: Pretendard (SIL Open Font License, `fonts/Pretendard-LICENSE.txt`)

## 구성 (음악 마디와 동기)
| 구간 | 장면 |
|---|---|
| 0–2s | 인트로: 워프 별빛 + "새로운 차원이 열린다" |
| 2–6s | 폰 앞면 등장 + "Galaxy" |
| 6–10s | 뒷면 회전 → 카메라 클로즈업 "프로급 카메라" |
| 10–14s | 야경 촬영 화면, 줌 인 "밤에도 밝게" (빌드업) |
| 14–18s | 드롭: "Galaxy AI" + 기능 칩 4개 |
| 18–22s | "압도적인 디스플레이" → "강력한 성능" |
| 22–26s | 배터리 링 0→100% "하루 종일 든든하게" |
| 26–30s | 컬러 라인업 3대 + "Galaxy / 지금 만나보세요" |

## 다시 만들기
```bash
python3 make_music.py galaxy_reel_music.wav
node render.js galaxy_reel_music.wav galaxy_reel_30s.mp4
```
필요: Python3 + numpy, Node + Playwright(Chromium), ffmpeg.
문구·색상·타이밍은 `reel.html`의 `render(t)` 함수에서 수정합니다.

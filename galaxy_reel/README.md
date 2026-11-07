# Galaxy 스마트폰 쇼릴 (비공식 콘셉트 영상)

두 가지 버전이 있습니다. 모두 1080×1920(9:16), 30fps, H.264 + AAC 입니다.

| 파일 | 길이 | 내용 |
|---|---|---|
| `s25_ultra_reel_50s.mp4` | 50초 | 갤럭시 S25 울트라 스펙 설명 버전 |
| `galaxy_reel_30s.mp4` | 30초 | 스펙 수치 없는 일반 홍보 버전 |

- 배경음악은 `make_music_s25.py` / `make_music.py`로 직접 합성한 **오리지널 곡**(120 BPM 일렉트로닉 팝)입니다.
  삼성 공식 광고 음악이나 그 멜로디는 저작권 문제로 사용하지 않았습니다.
- 폰 모양은 코드로 그린 단순화된 형태이며 실제 제품 외형(렌즈 배치 등)과 다를 수 있습니다. 삼성 공식 로고·이미지는 쓰지 않았습니다.
- 폰트: Pretendard (SIL Open Font License, `fonts/Pretendard-LICENSE.txt`)

## S25 울트라 50초 구성 (음악 마디와 동기)
| 구간 | 장면 | 사양 |
|---|---|---|
| 0–2s | 인트로 | |
| 2–6s | 폰 등장 | Galaxy S25 Ultra |
| 6–10s | 디스플레이 | 6.9형 QHD+ 다이내믹 AMOLED 2X, 최대 120Hz, 최대 2,600nits, 코닝 고릴라 아머 2 |
| 10–14s | 메인 카메라 | 200MP 광각 |
| 14–18s | 카메라 구성 | 200MP 광각 / 50MP 초광각 / 50MP 망원(광학 5배) / 10MP 망원(광학 3배) / 12MP 전면 |
| 18–22s | 줌 / 영상 | 최대 100배 디지털 줌, 8K 30fps |
| 22–26s | Galaxy AI | Now Brief, Audio Eraser, Gemini Live, ProScaler |
| 26–30s | 성능 | Snapdragon 8 Elite for Galaxy, 전작 대비 NPU +40% / CPU +37% / GPU +30% (삼성 발표) |
| 30–34s | 메모리 / OS | 12GB RAM, One UI 7, 7세대 OS 업그레이드, 7년 보안 업데이트 |
| 34–38s | 배터리 | 5,000mAh(일반 측정치, 정격 4,855mAh), 동영상 재생 최대 31시간, 45W 초고속 충전 2.0 |
| 38–42s | 디자인 | 티타늄 프레임, 8.2mm, 218g, IP68 |
| 42–50s | 아웃트로 | 티타늄 화이트실버 · 그레이 · 젯블랙, "지금 만나보세요" |

사양은 삼성전자 공식 사이트(samsung.com, 2026-11 검색 결과) 기준입니다.
출처마다 값이 달라 확인되지 않은 **무선 충전 W 수치는 넣지 않았습니다.**
RAM·무게 등은 국가/모델별로 다를 수 있습니다.

## 다시 만들기
```bash
python3 make_music_s25.py s25_ultra_reel_music.wav
node render.js s25_ultra_reel.html s25_ultra_reel_music.wav s25_ultra_reel_50s.mp4 50

python3 make_music.py galaxy_reel_music.wav
node render.js reel.html galaxy_reel_music.wav galaxy_reel_30s.mp4 30
```
필요: Python3 + numpy, Node + Playwright(Chromium), ffmpeg.
문구·색상·타이밍은 각 HTML의 `render(t)` 함수에서 수정합니다.

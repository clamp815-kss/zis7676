# 동영상 편집기 기능 조사와 HanCut 범위

조사일: 2026-09-19. 제품 수가 계속 늘고 기능도 수시로 바뀌므로 “현존하는 모든 프로그램”을 유한하게 확인하는 것은 불가능하다. 대신 Windows에서 널리 쓰이는 대표 제품과 서로 다른 편집 방식을 공식 자료 중심으로 비교해 공통 기능군을 도출했다.

## 대표 제품에서 확인한 기능

| 제품 | 확인한 방향 | HanCut 0.1 반영 |
|---|---|---|
| CapCut | 자동 자막, 자막 스타일, 다국어 자막, TTS 중심의 빠른 숏폼 제작 | SRT/수동 자막, 자막 번인, 세로 출력 |
| Vrew | 자동 자막을 중심으로 한 문서형 편집 | 자막 목록과 시간 기반 미리보기 |
| Adobe Premiere | 전문 타임라인 편집과 생성형 클립 연장 | 트림·분할·재정렬·페이드. 생성 연장은 후속 범위 |
| DaVinci Resolve 20 | 편집·색보정·오디오 통합, AI 검색·스크립트 타임라인·애니메이션 자막 | 순차 타임라인·대본 장면화. 고급 색보정은 후속 범위 |
| Microsoft Clipchamp | 가져오기·트림·결합·전환·텍스트·음악과 프롬프트 기반 초안 | 초보자용 단일 창 작업 흐름과 텍스트→장면 초안 |
| Wondershare Filmora | 텍스트 기반 편집, 텍스트→영상, AI 효과 | 오프라인 텍스트→컬러 제목 장면과 화면 텍스트 |

## 도출한 공통 기능군

1. 미디어 가져오기와 분석
2. 타임라인 배치, 트림, 분할, 복제, 순서 변경, 삭제
3. 화면 텍스트, 제목 장면, 페이드
4. 자막 가져오기·편집·번인
5. 가로·세로·정사각형 출력과 MP4 렌더링
6. 대본 또는 프롬프트에서 편집 가능한 초안 생성
7. 프로젝트 저장과 다시 열기

## 현재 구현과 의도적 한계

HanCut 0.1은 위 1–7을 단일 순차 영상 트랙 기준으로 구현한 작동 가능한 MVP다. 실제 확산 모델 기반 텍스트→영상, 음성 인식 자동 자막, 멀티트랙 합성, 키프레임, GPU 색보정, 모션 추적, 협업 클라우드는 대형 모델·GPU·서버 또는 추가 코덱이 필요하므로 포함하지 않았다. 현재 “텍스트→영상”은 네트워크 없이 대본을 문장별 제목 장면으로 바꾸며, 결과는 타임라인에서 편집하고 MP4로 내보낼 수 있다.

## 공식 출처

- [CapCut 자동 자막 도움말](https://www.capcut.com/help/how-to-recognise-subtitles)
- [Vrew 공식 제품 페이지](https://vrew.ai/en/)
- [Adobe Premiere Generative Extend 개요](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-with-generative-ai/generative-extend-overview.html)
- [Blackmagic Design DaVinci Resolve 제품 페이지](https://www.blackmagicdesign.com/products/davinciresolve)
- [Microsoft Clipchamp 서비스 설명](https://learn.microsoft.com/en-us/office365/servicedescriptions/windows-365-service-description/microsoft-clipchamp-service-description)
- [Microsoft Clipchamp Copilot 영상 만들기](https://support.microsoft.com/en-us/clipchamp/how-to-create-video-with-copilot)
- [Wondershare Filmora 텍스트 기반 편집](https://filmora.wondershare.com/ai-text-based-editing.html)
- [Wondershare Filmora 텍스트→영상](https://filmora.wondershare.com/tutorial/ai-text-to-video.html)

외부 출처 내용은 라이선스 준수를 위해 직접 복제하지 않고 요약·재서술했다.

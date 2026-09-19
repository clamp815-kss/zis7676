# HanCut Studio

HanCut Studio는 Windows에서 실행할 수 있는 로컬 우선 동영상 편집기 MVP입니다. 미디어 가져오기, 타임라인 트림·분할·재정렬, 제목/화면 텍스트, SRT 자막, 오프라인 텍스트→장면 생성, 프로젝트 저장, H.264 MP4 내보내기를 제공합니다.

## 구현 기능

- MP4/MOV/MKV/AVI/WebM 영상, 주요 오디오, JPG/PNG/WebP 이미지 가져오기
- ffprobe 기반 길이·해상도·오디오 분석
- 순차 타임라인: 추가, 소스 시작점/길이 트림, 재생 위치 분할, 복제, 좌우 이동, 삭제
- 영상 프레임·이미지·생성 장면 미리보기와 플레이헤드
- 제목 장면, 컬러 배경, 화면 텍스트, 장면 페이드
- 문장/줄 단위 오프라인 텍스트→영상 스토리보드
- 수동 자막 추가, UTF-8 SRT 가져오기, 미리보기, 영상 번인
- Full HD 가로, Shorts 세로, 정사각형, HD 및 15–60fps
- `.hancut` 프로젝트 저장/열기, MP4 내보내기

## Windows에서 바로 실행 앱 만들기

요구 사항은 **JDK 21 이상**과 **FFmpeg/FFprobe**입니다. PowerShell에서 프로젝트 폴더를 열고 다음을 실행합니다.

```powershell
winget install Microsoft.OpenJDK.21
winget install Gyan.FFmpeg
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\build-windows.ps1
```

완성된 실행 파일은 다음 위치에 생깁니다.

```text
build\windows\HanCut Studio\HanCut Studio.exe
```

같은 폴더의 `HanCut-Studio-Windows-x64.zip`은 다른 Windows PC로 복사할 수 있습니다. FFmpeg를 앱에 직접 포함하려면 빌드 전에 `tools/ffmpeg.exe`와 `tools/ffprobe.exe`를 넣으세요. 그렇지 않으면 대상 PC의 PATH에서 FFmpeg를 찾습니다.

## 개발 실행

```powershell
.\gradlew.bat run
```

환경 진단:

```powershell
.\gradlew.bat jar
java -jar .\build\libs\hancut-studio-0.1.0.jar --self-check
```

## 기본 사용법

1. **＋ 미디어**로 원본을 가져오고 미디어 항목을 더블클릭합니다.
2. 타임라인 클립을 선택하고 오른쪽 **클립** 탭에서 시작점·길이·화면 텍스트를 편집합니다.
3. 플레이헤드를 옮긴 뒤 **분할**하거나 화살표로 순서를 바꿉니다.
4. **T 제목 장면** 또는 **✦ 텍스트→영상**으로 생성 장면을 추가합니다.
5. **CC SRT 자막**으로 자막을 가져오거나 **자막** 탭에서 직접 추가합니다.
6. **출력** 탭에서 비율과 FPS를 정하고 **내보내기**로 MP4를 만듭니다.
7. 작업 중 `.hancut` 프로젝트를 저장합니다. 원본 미디어는 프로젝트 파일에 포함되지 않습니다.

## 알려진 범위

이 버전은 완성형 Premiere/Resolve 대체품이 아니라 실제 실행·확장이 가능한 첫 MVP입니다. 단일 순차 영상 트랙을 사용하며 멀티트랙, 키프레임, 자동 음성 인식, 생성형 AI 모델, GPU 색보정은 후속 개발 항목입니다. 제품 조사와 범위 근거는 [`docs/FEATURE_RESEARCH.md`](docs/FEATURE_RESEARCH.md), 내부 구조는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)를 참고하세요.

## 라이선스 참고

HanCut 소스와 별개로 FFmpeg 바이너리의 라이선스 및 사용한 코덱의 배포 조건을 확인해야 합니다. 본 저장소에는 FFmpeg 바이너리를 포함하지 않습니다.

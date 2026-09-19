#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build/windows-portable"
NATIVE="$ROOT/build/native-windows"

cd "$ROOT"
gradle clean jar
rm -rf "$BUILD" "$NATIVE"
mkdir -p "$BUILD" "$NATIVE" "$BUILD/tools"

llvm-dlltool -m i386:x86-64 -d "$ROOT/native/kernel32.def" -l "$NATIVE/kernel32.lib"
llvm-dlltool -m i386:x86-64 -d "$ROOT/native/user32.def" -l "$NATIVE/user32.lib"
clang --target=x86_64-pc-windows-msvc -ffreestanding -fno-stack-protector -fshort-wchar \
  -c "$ROOT/native/windows-launcher.c" -o "$NATIVE/windows-launcher.obj"
lld-link "$NATIVE/windows-launcher.obj" "$NATIVE/kernel32.lib" "$NATIVE/user32.lib" \
  /entry:WinMainCRTStartup /subsystem:windows /nodefaultlib /machine:x64 \
  "/out:$BUILD/HanCut Studio.exe"

cp "$ROOT/build/libs/hancut-studio-0.1.0.jar" "$BUILD/"
cp "$ROOT/tools/README.md" "$BUILD/tools/FFmpeg-설치안내.md"
cat > "$BUILD/실행안내.txt" <<'EOF'
HanCut Studio Windows 이동식 배포본

1. HanCut Studio.exe를 더블클릭하세요.
2. Java 오류가 표시되면 PowerShell에서 다음 명령을 실행하세요.
   winget install Microsoft.OpenJDK.21
3. 영상 가져오기/내보내기를 위해 FFmpeg를 설치하세요.
   winget install Gyan.FFmpeg

이 폴더 안의 EXE와 JAR는 항상 함께 이동해야 합니다.
EOF

printf 'Windows portable bundle: %s\n' "$BUILD"

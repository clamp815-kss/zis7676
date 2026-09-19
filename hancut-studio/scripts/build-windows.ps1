$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw 'JDK 21 이상이 필요합니다. winget install Microsoft.OpenJDK.21 명령으로 설치하세요.'
}
if (-not (Get-Command jpackage -ErrorAction SilentlyContinue)) {
    throw 'jpackage를 찾을 수 없습니다. JRE가 아닌 JDK 21 이상을 설치하세요.'
}

& .\gradlew.bat clean jar
if ($LASTEXITCODE -ne 0) { throw 'Gradle 빌드에 실패했습니다.' }

$Version = '0.1.0'
$Jar = "hancut-studio-$Version.jar"
$Destination = Join-Path $Root 'build\windows'
$AppDir = Join-Path $Destination 'HanCut Studio'
if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
New-Item -ItemType Directory -Path $Destination | Out-Null

& jpackage `
    --type app-image `
    --input (Join-Path $Root 'build\libs') `
    --dest $Destination `
    --name 'HanCut Studio' `
    --main-jar $Jar `
    --main-class 'studio.hancut.App' `
    --app-version $Version `
    --vendor 'HanCut Studio' `
    --description '로컬 우선 Windows 동영상 편집기'
if ($LASTEXITCODE -ne 0) { throw 'Windows 앱 이미지 생성에 실패했습니다.' }

$ToolSource = Join-Path $Root 'tools'
$ToolDestination = Join-Path $AppDir 'tools'
New-Item -ItemType Directory -Path $ToolDestination -Force | Out-Null
foreach ($Tool in @('ffmpeg.exe', 'ffprobe.exe')) {
    $Candidate = Join-Path $ToolSource $Tool
    if (Test-Path $Candidate) { Copy-Item $Candidate $ToolDestination }
}

$Zip = Join-Path $Destination 'HanCut-Studio-Windows-x64.zip'
Compress-Archive -Path "$AppDir\*" -DestinationPath $Zip -Force
Write-Host "완료: $AppDir\HanCut Studio.exe"
Write-Host "배포 ZIP: $Zip"
if (-not (Test-Path (Join-Path $ToolDestination 'ffmpeg.exe'))) {
    Write-Warning 'FFmpeg가 번들되지 않았습니다. 대상 PC에서 winget install Gyan.FFmpeg를 실행하거나 tools에 실행 파일을 넣으세요.'
}

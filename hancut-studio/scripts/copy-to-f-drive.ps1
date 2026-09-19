$ErrorActionPreference = 'Stop'
$Source = Join-Path (Split-Path -Parent $PSScriptRoot) 'build\windows-portable'
$Destination = 'F:\app\move'

if (-not (Test-Path $Source)) {
    throw "먼저 build/windows-portable 배포본을 준비해야 합니다: $Source"
}
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
Copy-Item -Path "$Source\*" -Destination $Destination -Recurse -Force
Write-Host "복사 완료: $Destination\HanCut Studio.exe"

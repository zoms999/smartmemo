# PowerShell 스크립트 - UTF-8 인코딩으로 애플리케이션 실행
$OutputEncoding = [console]::OutputEncoding = [Text.Encoding]::UTF8
$env:LC_ALL = "ko_KR.UTF-8"
$env:LANG = "ko_KR.UTF-8"

Write-Host "UTF-8 인코딩으로 설정되었습니다."
npx electron . --dev 
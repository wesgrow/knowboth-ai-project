param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
New-Item -ItemType Directory -Force -Path "$p\src\app\post-deal" | Out-Null
$src = "$dl\post-deal-v2.tsx"
$dst = "$p\src\app\post-deal\page.tsx"
if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "OK post-deal/page.tsx" -ForegroundColor Green }
else{ Write-Host "MISSING post-deal-v2.tsx" -ForegroundColor Red }
Write-Host "Done" -ForegroundColor Cyan

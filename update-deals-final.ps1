param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$src = "$dl\deals-page-final-v2.tsx"
$dst = "$p\src\app\deals\page.tsx"
if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "OK deals/page.tsx" -ForegroundColor Green }
else{ Write-Host "MISSING deals-page-final-v2.tsx" -ForegroundColor Red }
Write-Host "Done" -ForegroundColor Cyan

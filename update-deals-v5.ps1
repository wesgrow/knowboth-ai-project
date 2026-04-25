param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$src = "$dl\deals-page-v5.tsx"
$dst = "$p\src\app\deals\page.tsx"
if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "✅ deals/page.tsx updated" -ForegroundColor Green }
else{ Write-Host "❌ Missing: deals-page-v5.tsx" -ForegroundColor Red }
Write-Host "Run: npm run dev" -ForegroundColor Yellow

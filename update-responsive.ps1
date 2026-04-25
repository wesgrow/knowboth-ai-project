param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$src = "$dl\globals-responsive.css"
$dst = "$p\src\app\globals.css"
if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "✅ globals.css updated" -ForegroundColor Green }
else{ Write-Host "❌ Missing: globals-responsive.css" -ForegroundColor Red }
Write-Host "Run: npm run dev" -ForegroundColor Yellow

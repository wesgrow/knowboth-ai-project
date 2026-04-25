param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$src = "$dl\globals-premium.css"
$dst = "$p\src\app\globals.css"
if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "✅ globals.css restored to premium version" -ForegroundColor Green }
else{ Write-Host "❌ Missing: globals-premium.css in Downloads" -ForegroundColor Red }
Write-Host "Run: npm run dev" -ForegroundColor Yellow

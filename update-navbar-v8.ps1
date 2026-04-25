param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$src = "$dl\Navbar-v8.tsx"
$dst = "$p\src\components\Navbar.tsx"
if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "✅ Navbar.tsx updated" -ForegroundColor Green }
else{ Write-Host "❌ Missing: Navbar-v8.tsx" -ForegroundColor Red }
Write-Host "Run: npm run dev" -ForegroundColor Yellow

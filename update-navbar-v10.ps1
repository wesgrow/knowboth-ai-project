param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$src = "$dl\Navbar-v10.tsx"
$dst = "$p\src\components\Navbar.tsx"
if(Test-Path $src) {
  Copy-Item -Path $src -Destination $dst -Force
  Write-Host "OK Navbar.tsx updated" -ForegroundColor Green
} else {
  Write-Host "MISSING Navbar-v10.tsx in Downloads" -ForegroundColor Red
}
Write-Host "Run: npm run dev" -ForegroundColor Yellow

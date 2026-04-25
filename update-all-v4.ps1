param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location

$files = @(
  @{ src="Navbar-v9.tsx";       dst="src\components\Navbar.tsx" },
  @{ src="deals-page-v4.tsx";   dst="src\app\deals\page.tsx" },
  @{ src="home-page-v4.tsx";    dst="src\app\home\page.tsx" }
)

$ok=0; $fail=0
foreach($f in $files){
  $src="$dl\$($f.src)"; $dst="$p\$($f.dst)"
  if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "✅ $($f.src)" -ForegroundColor Green; $ok++ }
  else{ Write-Host "❌ Missing: $($f.src)" -ForegroundColor Red; $fail++ }
}
Write-Host ""
Write-Host "Done: $ok copied, $fail missing" -ForegroundColor Cyan
Write-Host "Run: npm run dev" -ForegroundColor Yellow

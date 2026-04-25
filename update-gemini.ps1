param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$files = @(
  @{ src="extract-route-gemini.ts"; dst="src\app\api\extract\route.ts" },
  @{ src="scan-route-gemini.ts";    dst="src\app\api\scan\route.ts" }
)
$ok=0; $fail=0
foreach($f in $files){
  $src="$dl\$($f.src)"; $dst="$p\$($f.dst)"
  if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "OK $($f.src)" -ForegroundColor Green; $ok++ }
  else{ Write-Host "MISSING $($f.src)" -ForegroundColor Red; $fail++ }
}
Write-Host "Done: $ok copied, $fail missing" -ForegroundColor Cyan
Write-Host "Add GEMINI_API_KEY to .env.local" -ForegroundColor Yellow

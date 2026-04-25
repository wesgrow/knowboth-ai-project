param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
$files = @(
  @{ src="extract-route-claude.ts"; dst="src\app\api\extract\route.ts" },
  @{ src="scan-route-claude.ts";    dst="src\app\api\scan\route.ts" }
)
foreach($f in $files){
  $src="$dl\$($f.src)"; $dst="$p\$($f.dst)"
  if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "OK $($f.src)" -ForegroundColor Green }
  else{ Write-Host "MISSING $($f.src)" -ForegroundColor Red }
}
Write-Host "Done - using Claude Haiku (cheapest)" -ForegroundColor Cyan

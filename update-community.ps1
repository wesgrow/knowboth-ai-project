param([string]$dl = "$env:USERPROFILE\Downloads")
$p = Get-Location
New-Item -ItemType Directory -Force -Path "$p\src\app\community" | Out-Null
$files = @(
  @{ src="community-page.tsx"; dst="src\app\community\page.tsx" },
  @{ src="Navbar-v11.tsx";     dst="src\components\Navbar.tsx" }
)
foreach($f in $files){
  $src="$dl\$($f.src)"; $dst="$p\$($f.dst)"
  if(Test-Path $src){ Copy-Item -Path $src -Destination $dst -Force; Write-Host "OK $($f.src)" -ForegroundColor Green }
  else{ Write-Host "MISSING $($f.src)" -ForegroundColor Red }
}
Write-Host "Done" -ForegroundColor Cyan

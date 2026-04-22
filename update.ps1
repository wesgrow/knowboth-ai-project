# KNOWBOTH.AI — Run this from your project root
# Usage: .\update.ps1 "C:\path\to\downloads"

param([string]$dl = "$env:USERPROFILE\Downloads")

$p = Get-Location

# Create new folders
New-Item -ItemType Directory -Force -Path "$p\src\app\chat" | Out-Null
New-Item -ItemType Directory -Force -Path "$p\src\app\analytics" | Out-Null
New-Item -ItemType Directory -Force -Path "$p\src\app\profile" | Out-Null
New-Item -ItemType Directory -Force -Path "$p\src\app\api\chat" | Out-Null
New-Item -ItemType Directory -Force -Path "$p\public\icons" | Out-Null

# Copy and rename all files
$files = @(
  @{ src="Navbar-final.tsx";       dst="src\components\Navbar.tsx" },
  @{ src="deals-page-final.tsx";   dst="src\app\deals\page.tsx" },
  @{ src="compare-page-final.tsx"; dst="src\app\compare\page.tsx" },
  @{ src="chat-page.tsx";          dst="src\app\chat\page.tsx" },
  @{ src="chat-api-route.ts";      dst="src\app\api\chat\route.ts" },
  @{ src="analytics-page.tsx";     dst="src\app\analytics\page.tsx" },
  @{ src="profile-page.tsx";       dst="src\app\profile\page.tsx" },
  @{ src="NotificationsManager.tsx"; dst="src\components\NotificationsManager.tsx" },
  @{ src="ShareDeal.tsx";          dst="src\components\ShareDeal.tsx" },
  @{ src="home-page-v3.tsx";       dst="src\app\home\page.tsx" },
  @{ src="manifest.json";          dst="public\manifest.json" },
  @{ src="sw.js";                  dst="public\sw.js" },
  @{ src="PWAInstall.tsx";         dst="src\components\PWAInstall.tsx" },
  @{ src="layout-v3.tsx";          dst="src\app\layout.tsx" }
)

$ok = 0; $fail = 0
foreach ($f in $files) {
  $src = "$dl\$($f.src)"
  $dst = "$p\$($f.dst)"
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "✅ $($f.src)" -ForegroundColor Green
    $ok++
  } else {
    Write-Host "❌ Missing: $($f.src)" -ForegroundColor Red
    $fail++
  }
}

Write-Host ""
Write-Host "Done: $ok copied, $fail missing" -ForegroundColor Cyan
Write-Host "Run: npm run dev" -ForegroundColor Yellow

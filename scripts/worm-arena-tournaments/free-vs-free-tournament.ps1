# Author: Claude Code (Haiku 4.5)
# Date: 2025-12-18
# PURPOSE: Queue and monitor Worm Arena matches between free models only (test tournament).
#          Runs 5 games per pairing, polls API for real-time status.
# SRP/DRY check: Pass - focused single-purpose script with verbose output

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://localhost:5000",

  [Parameter(Mandatory = $false)]
  [switch]$NoWait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$baseUrl = $BaseUrl.TrimEnd('/')
$queueEndpoint = "$baseUrl/api/snakebench/run-batch"
$listGamesEndpoint = "$baseUrl/api/snakebench/games"

# Free models only
$models = @(
  'xiaomi/mimo-v2-flash:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'mistralai/devstral-2512:free',
  'allenai/olmo-3-32b-think:free',
  'kwaipilot/kat-coder-pro:free'
)

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  Worm Arena: Free vs Free Tournament (Test)" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Base URL: $baseUrl"
Write-Host "  Games per pairing: 5"
Write-Host "  Board: 10x10, maxRounds=150, numApples=5"
Write-Host ""

Write-Host "Free Models ($($models.Count)):" -ForegroundColor Cyan
$models | ForEach-Object { Write-Host "  [FREE] $_" -ForegroundColor DarkGreen }
Write-Host ""

$totalPairings = $models.Count * ($models.Count - 1)
$totalMatches = $totalPairings * 5
Write-Host "Tournament Size:" -ForegroundColor Yellow
Write-Host "  Total pairings: $totalPairings ($($models.Count) models x $($models.Count - 1) opponents)"
Write-Host "  Games per pairing: 5"
Write-Host "  Total matches to queue: $totalMatches"
Write-Host ""

$queuedCount = 0

# ==== QUEUEING PHASE ====
Write-Host "Queueing matches..." -ForegroundColor Green
Write-Host ""

foreach ($modelA in $models) {
  foreach ($modelB in $models) {
    if ($modelA -eq $modelB) { continue }

    for ($i = 0; $i -lt 5; $i++) {
      $body = @{
        modelA = $modelA
        modelB = $modelB
        count = 1
        width = 10
        height = 10
        maxRounds = 150
        numApples = 5
      } | ConvertTo-Json

      try {
        $percent = if ($totalMatches -gt 0) { [Math]::Floor($queuedCount/$totalMatches*100) } else { 0 }
        Write-Host "[Queue $percent%] $queuedCount/$totalMatches - $modelA vs $modelB" -ForegroundColor Yellow

        Invoke-WebRequest -Uri $queueEndpoint -Method Post `
          -Headers @{"Content-Type"="application/json"} `
          -Body $body -ErrorAction Stop | Out-Null

        $queuedCount++
        Start-Sleep -Milliseconds 300
      } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
      }
    }
  }
}

Write-Host ""
Write-Host "Queued $queuedCount matches successfully." -ForegroundColor Green

if ($NoWait) {
  Write-Host ""
  Write-Host "Exiting (--NoWait). Monitor via Worm Arena UI." -ForegroundColor Cyan
  exit 0
}

# ==== POLLING PHASE ====
Write-Host ""
Write-Host "Monitoring progress..." -ForegroundColor Green
Write-Host "(Polling every 2 seconds)" -ForegroundColor DarkGray
Write-Host ""

$initialGameCount = 0
$lastSeenGameCount = 0
$stableCounter = 0
$startTime = Get-Date
$pollCount = 0

function Get-GameCount {
  try {
    $resp = Invoke-WebRequest -Uri "$listGamesEndpoint?limit=10000" -Method Get -ErrorAction Stop
    $data = $resp.Content | ConvertFrom-Json
    return $data.total
  } catch {
    return -1
  }
}

while ($true) {
  $pollCount++
  $currentGameCount = Get-GameCount

  if ($currentGameCount -eq -1) {
    Start-Sleep -Milliseconds 2000
    continue
  }

  if ($initialGameCount -eq 0) {
    $initialGameCount = $currentGameCount
    Write-Host "  Initial DB count: $currentGameCount games" -ForegroundColor Cyan
  }

  $newGames = $currentGameCount - $initialGameCount
  $percent = if ($queuedCount -gt 0) { [Math]::Min(100, [Math]::Floor($newGames/$queuedCount*100)) } else { 0 }
  $elapsed = ((Get-Date) - $startTime).ToString('hh\:mm\:ss')

  Write-Host "[$elapsed | Poll #$pollCount] $newGames/$queuedCount complete ($percent%) | DB total: $currentGameCount" -ForegroundColor Cyan

  if ($currentGameCount -eq $lastSeenGameCount) {
    $stableCounter++
    if ($stableCounter -ge 5) {
      Write-Host ""
      Write-Host "No new games for 5 polls. Tournament complete." -ForegroundColor Green
      break
    }
  } else {
    $stableCounter = 0
    $lastSeenGameCount = $currentGameCount
  }

  if ($newGames -ge $queuedCount) {
    Write-Host ""
    Write-Host "All $queuedCount matches complete!" -ForegroundColor Green
    break
  }

  Start-Sleep -Milliseconds 2000
}

$elapsed = ((Get-Date) - $startTime).ToString('hh\:mm\:ss')
Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "  Tournament Complete" -ForegroundColor Green
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Total time: $elapsed" -ForegroundColor Yellow
Write-Host "Matches queued: $queuedCount" -ForegroundColor Yellow
Write-Host "Games in database: $currentGameCount" -ForegroundColor Yellow
Write-Host ""

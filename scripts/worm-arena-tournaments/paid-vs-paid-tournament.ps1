# Author: Claude Code (Haiku 4.5)
# Date: 2025-12-18
# PURPOSE: Queue and monitor Worm Arena matches between paid models only.
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
$gamesEndpoint = "$baseUrl/api/snakebench/games"

# Paid models only
$models = @(
  'mistralai/ministral-3b-2512',
  'mistralai/ministral-14b-2512',
  'mistralai/ministral-8b-2512',
  'nvidia/nemotron-nano-12b-v2-vl',
  'qwen/qwen3-vl-8b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'baidu/ernie-4.5-21b-a3b-thinking',
  'google/gemini-2.5-flash-lite-preview-09-2025',
  'x-ai/grok-4-fast',
  'openai/gpt-oss-120b'
)

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  Worm Arena: Paid vs Paid Tournament" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Base URL: $baseUrl"
Write-Host "  Games per pairing: 2"
Write-Host "  Board: 10x10, maxRounds=150, numApples=5"
Write-Host ""

Write-Host "Paid Models ($($models.Count)):" -ForegroundColor Cyan
$models | ForEach-Object { Write-Host "  [PAID] $_" -ForegroundColor DarkYellow }
Write-Host ""

$totalPairings = $models.Count * ($models.Count - 1)
$totalMatches = $totalPairings * 2
Write-Host "Tournament Size:" -ForegroundColor Yellow
Write-Host "  Total pairings: $totalPairings ($($models.Count) models x $($models.Count - 1) opponents)"
Write-Host "  Games per pairing: 2"
Write-Host "  Total matches to queue: $totalMatches"
Write-Host ""

$queuedCount = 0

# ==== QUEUEING PHASE ====
Write-Host "Queueing matches..." -ForegroundColor Green
Write-Host ""

foreach ($modelA in $models) {
  foreach ($modelB in $models) {
    if ($modelA -eq $modelB) { continue }

    $body = @{
      modelA = $modelA
      modelB = $modelB
      count = 5
      width = 10
      height = 10
      maxRounds = 150
      numApples = 5
    } | ConvertTo-Json

    try {
      $percent = if ($totalMatches -gt 0) { [Math]::Floor($queuedCount/$totalMatches*100) } else { 0 }
      Write-Host "[Queue $percent%] $queuedCount/$totalMatches - $modelA vs $modelB (5 games)" -ForegroundColor Yellow

      Invoke-WebRequest -Uri $queueEndpoint -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body $body -ErrorAction Stop -TimeoutSec 30 | Out-Null

      $queuedCount += 5
    } catch {
      Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
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
Write-Host "(Polling every 5 seconds)" -ForegroundColor DarkGray
Write-Host ""

$initialGameCount = 0
$lastSeenGameCount = 0
$stableCounter = 0
$startTime = Get-Date
$pollCount = 0

function Get-GameCount {
  try {
    $resp = Invoke-WebRequest -Uri "$gamesEndpoint?limit=10000" -Method Get -ErrorAction Stop
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
    Start-Sleep -Milliseconds 5000
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

  Start-Sleep -Milliseconds 5000
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

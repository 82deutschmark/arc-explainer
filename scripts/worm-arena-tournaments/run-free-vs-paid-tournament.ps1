# Author: Claude Code (Haiku 4.5)
# Date: 2025-12-18
# PURPOSE: Queue Worm Arena matches between specified free and paid models with verbose status output.
#          Queues N games per pairing and polls API to show real-time progress.
# SRP/DRY check: Pass - single-purpose batch tournament with status monitoring

[CmdletBinding()]
param(
  # Base URL for the server
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://localhost:5000",

  # Games per pairing (each direction)
  [Parameter(Mandatory = $false)]
  [int]$GamesPerPairing = 5,

  # Delay between queue requests (milliseconds)
  [Parameter(Mandatory = $false)]
  [int]$QueueDelayMs = 300,

  # Delay between status polls (milliseconds)
  [Parameter(Mandatory = $false)]
  [int]$PollDelayMs = 2000,

  # Board dimensions
  [Parameter(Mandatory = $false)]
  [int]$Width = 10,

  [Parameter(Mandatory = $false)]
  [int]$Height = 10,

  [Parameter(Mandatory = $false)]
  [int]$MaxRounds = 150,

  [Parameter(Mandatory = $false)]
  [int]$NumApples = 5,

  # Skip polling (just queue and exit)
  [Parameter(Mandatory = $false)]
  [switch]$NoWait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$baseUrl = $BaseUrl.TrimEnd('/')
$queueEndpoint = "$baseUrl/api/snakebench/run-batch"
$listGamesEndpoint = "$baseUrl/api/snakebench/games"

# Define model lists
$freeModels = @(
  'xiaomi/mimo-v2-flash:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'mistralai/devstral-2512:free',
  'allenai/olmo-3-32b-think:free',
  'kwaipilot/kat-coder-pro:free'
)

$paidModels = @(
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

Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Worm Arena: Free vs Paid Tournament                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Base URL: $baseUrl"
Write-Host "  Games per pairing: $GamesPerPairing"
Write-Host "  Board: ${Width}x${Height}, maxRounds=$MaxRounds, numApples=$NumApples"
Write-Host "  Queue delay: ${QueueDelayMs}ms, Poll delay: ${PollDelayMs}ms"
Write-Host ""

Write-Host "Free Models ($($freeModels.Count)):" -ForegroundColor Cyan
$freeModels | ForEach-Object { Write-Host "  ✓ $_" -ForegroundColor DarkGreen }
Write-Host ""

Write-Host "Paid Models ($($paidModels.Count)):" -ForegroundColor Cyan
$paidModels | ForEach-Object { Write-Host "  ○ $_" -ForegroundColor DarkYellow }
Write-Host ""

$totalPairings = $freeModels.Count * $paidModels.Count
$totalMatches = $totalPairings * $GamesPerPairing * 2
Write-Host "Tournament Size:" -ForegroundColor Yellow
Write-Host "  Total pairings: $totalPairings (free × paid)"
Write-Host "  Games per pairing: $($GamesPerPairing * 2) (free→paid + paid→free)"
Write-Host "  Total matches to queue: $totalMatches"
Write-Host ""

# Track games by their signatures
$gameSignatures = @{}
$queuedCount = 0
$allGameIds = New-Object System.Collections.Generic.List[string]

# ==== QUEUEING PHASE ====
Write-Host "Queueing matches..." -ForegroundColor Green
Write-Host ""

foreach ($freeModel in $freeModels) {
  foreach ($paidModel in $paidModels) {
    for ($i = 0; $i -lt $GamesPerPairing; $i++) {
      # Free vs Paid
      $body = @{
        modelA = $freeModel
        modelB = $paidModel
        count = 1
        width = $Width
        height = $Height
        maxRounds = $MaxRounds
        numApples = $NumApples
      } | ConvertTo-Json

      try {
        Write-Host "[Queue $([Math]::Floor($queuedCount/$totalMatches*100))%] Queueing: $freeModel → $paidModel" -ForegroundColor Yellow
        $resp = Invoke-WebRequest -Uri $queueEndpoint -Method Post `
          -Headers @{"Content-Type"="application/json"} `
          -Body $body -ErrorAction Stop
        $queuedCount++
        Start-Sleep -Milliseconds $QueueDelayMs
      } catch {
        Write-Host "  ⚠ Queue failed: $($_.Exception.Message)" -ForegroundColor Red
      }

      # Paid vs Free (reverse)
      $body = @{
        modelA = $paidModel
        modelB = $freeModel
        count = 1
        width = $Width
        height = $Height
        maxRounds = $MaxRounds
        numApples = $NumApples
      } | ConvertTo-Json

      try {
        Write-Host "[Queue $([Math]::Floor($queuedCount/$totalMatches*100))%] Queueing: $paidModel → $freeModel" -ForegroundColor Yellow
        $resp = Invoke-WebRequest -Uri $queueEndpoint -Method Post `
          -Headers @{"Content-Type"="application/json"} `
          -Body $body -ErrorAction Stop
        $queuedCount++
        Start-Sleep -Milliseconds $QueueDelayMs
      } catch {
        Write-Host "  ⚠ Queue failed: $($_.Exception.Message)" -ForegroundColor Red
      }
    }
  }
}

Write-Host ""
Write-Host "Queued $queuedCount matches." -ForegroundColor Green

if ($NoWait) {
  Write-Host ""
  Write-Host "Exiting (--NoWait). Monitor progress via Worm Arena UI or completed games folder." -ForegroundColor Cyan
  exit 0
}

# ==== POLLING PHASE ====
Write-Host ""
Write-Host "Monitoring progress..." -ForegroundColor Green
Write-Host "(Polling every ${PollDelayMs}ms for game status)" -ForegroundColor DarkGray
Write-Host ""

$initialGameCount = 0
$lastSeenGameCount = 0
$stableCounter = 0
$maxStableWait = 5  # Poll this many times with no change before assuming done

function Get-RecentGameCount {
  try {
    $resp = Invoke-WebRequest -Uri "$listGamesEndpoint?limit=1000" -Method Get -ErrorAction Stop
    $data = $resp.Content | ConvertFrom-Json
    return $data.total
  } catch {
    Write-Host "  ⚠ Poll failed: $($_.Exception.Message)" -ForegroundColor Red
    return -1
  }
}

$startTime = Get-Date
$pollCount = 0

while ($true) {
  $pollCount++
  $currentGameCount = Get-RecentGameCount

  if ($currentGameCount -eq -1) {
    Start-Sleep -Milliseconds $PollDelayMs
    continue
  }

  if ($initialGameCount -eq 0) {
    $initialGameCount = $currentGameCount
    Write-Host "  Initial game count: $currentGameCount" -ForegroundColor Cyan
  }

  $newGames = $currentGameCount - $initialGameCount
  $percentComplete = if ($queuedCount -gt 0) { [Math]::Min(100, [Math]::Floor($newGames/$queuedCount*100)) } else { 0 }

  $elapsed = ((Get-Date) - $startTime).ToString('hh\:mm\:ss')
  Write-Host "[$elapsed | Poll #$pollCount] Games: $newGames/$queuedCount complete ($percentComplete%) | Total in DB: $currentGameCount" -ForegroundColor Cyan

  if ($currentGameCount -eq $lastSeenGameCount) {
    $stableCounter++
    if ($stableCounter -ge $maxStableWait) {
      Write-Host ""
      Write-Host "No new games detected for $maxStableWait polls. Assuming tournament complete." -ForegroundColor Green
      break
    }
  } else {
    $stableCounter = 0
    $lastSeenGameCount = $currentGameCount
  }

  if ($newGames -ge $queuedCount) {
    Write-Host ""
    Write-Host "All matches complete!" -ForegroundColor Green
    break
  }

  Start-Sleep -Milliseconds $PollDelayMs
}

$elapsed = ((Get-Date) - $startTime).ToString('hh\:mm\:ss')
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Tournament Complete                                           ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Total time: $elapsed"
Write-Host "  Matches queued: $queuedCount"
Write-Host "  Games in database: $currentGameCount"
Write-Host "  View results in Worm Arena UI or export from database."
Write-Host ""

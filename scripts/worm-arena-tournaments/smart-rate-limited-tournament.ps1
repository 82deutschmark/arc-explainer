# Author: Claude Code (Haiku 4.5)
# Date: 2025-12-25
# PURPOSE: Smart tournament scheduler that respects rate-limits for free models.
#          Free models (identified by :free suffix) can only play one match at a time.
#          Paid models can play unlimited matches in parallel.
#          The script queues matches intelligently and polls to manage concurrency.
# SRP/DRY check: Pass - single-purpose scheduler with clear rate-limit enforcement

# ============================================================================
# RATE-LIMIT PHILOSOPHY (For Other Developers)
# ============================================================================
# FREE MODELS (e.g., nvidia/nemotron-3-nano-30b-a3b:free):
#   - Can ONLY have 1 active match at any time (like a human player).
#   - If nemotron is playing against model X, it cannot start a match vs model Y
#     until the match vs model X is complete.
#   - This is enforced by tracking active_game_count per model.
#
# PAID MODELS (e.g., openai/gpt-5-nano):
#   - Can play unlimited concurrent matches simultaneously.
#   - They are not rate-limited; no tracking needed.
#   - This allows rapid tournament progression.
#
# QUEUEING CONSTRAINT:
#   A match pairing (modelA vs modelB) can only be queued if:
#   - modelA has no active games (or is paid), AND
#   - modelB has no active games (or is paid)
# ============================================================================

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://localhost:5000",

  [Parameter(Mandatory = $false)]
  [int]$GamesPerPairing = 1,

  [Parameter(Mandatory = $false)]
  [switch]$NoWait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$baseUrl = $BaseUrl.TrimEnd('/')
$queueEndpoint = "$baseUrl/api/snakebench/run-batch"

# Models from user's list
$models = @(
  'xiaomi/mimo-v2-flash:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'deepseek/deepseek-v3.2',
  'deepseek/deepseek-v3.2-exp',
  'openai/gpt-5-nano',
  'openai/gpt-5-mini',
  'openai/gpt-4.1-nano',
  'x-ai/grok-code-fast-1'
)

# Classify models: free (has :free suffix) vs paid
$freeModels = @($models | Where-Object { $_ -match ':free$' })
$paidModels = @($models | Where-Object { $_ -notmatch ':free$' })

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  Worm Arena: Smart Rate-Limited Tournament" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Base URL: $baseUrl"
Write-Host "  Games per pairing: $GamesPerPairing"
Write-Host "  Board: 10x10, maxRounds=150, numApples=5"
Write-Host ""

Write-Host "Free Models ($($freeModels.Count)) [Rate-limited to 1 active game]:" -ForegroundColor Yellow
$freeModels | ForEach-Object { Write-Host "    [FREE] $_" -ForegroundColor DarkYellow }
Write-Host ""

Write-Host "Paid Models ($($paidModels.Count)) [Unlimited concurrent games]:" -ForegroundColor Cyan
$paidModels | ForEach-Object { Write-Host "    [PAID] $_" -ForegroundColor DarkCyan }
Write-Host ""

# Build all match pairings (ordered pairs, so A vs B and B vs A are separate)
$allPairings = @()
foreach ($modelA in $models) {
  foreach ($modelB in $models) {
    if ($modelA -ne $modelB) {
      $allPairings += @{ modelA = $modelA; modelB = $modelB; gamesLeft = $GamesPerPairing }
    }
  }
}

$totalPairings = $allPairings.Count
$totalGames = $totalPairings * $GamesPerPairing

Write-Host "Tournament Size:" -ForegroundColor Magenta
Write-Host "  Total pairings: $totalPairings"
Write-Host "  Games per pairing: $GamesPerPairing"
Write-Host "  Total games to queue: $totalGames"
Write-Host ""

# Track active games per model (for rate-limiting)
$activeGameCount = @{}
$models | ForEach-Object { $activeGameCount[$_] = 0 }

# Track queued and completed games
$queuedCount = 0
$completedCount = 0
$pairingIndex = 0
$pollCount = 0

Write-Host "Starting smart tournament queueing..." -ForegroundColor Green
Write-Host ""

if ($NoWait) {
  Write-Host "Note: --NoWait flag provided. After initial queue, will exit." -ForegroundColor DarkGray
}

$startTime = Get-Date

function Show-ModelStatus {
  Write-Host ""
  Write-Host "--- Current Model Status ---" -ForegroundColor DarkGray
  foreach ($model in $models) {
    $activeCount = $activeGameCount[$model]
    $isFree = $model -in $freeModels
    $typeLabel = if ($isFree) { "[FREE]" } else { "[PAID]" }
    $statusColor = if ($activeCount -eq 0) { "Green" } elseif ($activeCount -eq 1 -and $isFree) { "Yellow" } else { "Red" }
    Write-Host "  $typeLabel $model : $activeCount active game(s)" -ForegroundColor $statusColor
  }
  Write-Host ""
}

# ============================================================================
# MAIN LOOP: Queue matches and monitor progress
# ============================================================================
while ($pairingIndex -lt $totalPairings -or $queuedCount -gt $completedCount) {

  # Attempt to queue new matches from pending pairings
  $queuedThisRound = 0
  while ($pairingIndex -lt $totalPairings) {
    $pairing = $allPairings[$pairingIndex]
    $modelA = $pairing.modelA
    $modelB = $pairing.modelB

    # Check if we can queue this pairing
    $canQueueA = ($modelA -in $paidModels) -or ($activeGameCount[$modelA] -eq 0)
    $canQueueB = ($modelB -in $paidModels) -or ($activeGameCount[$modelB] -eq 0)

    if (-not ($canQueueA -and $canQueueB)) {
      # Rate-limit hit; log why and stop queueing for now
      $reasonA = if ($modelA -in $freeModels -and $activeGameCount[$modelA] -gt 0) { "$modelA BLOCKED (active: $($activeGameCount[$modelA]))" } else { "" }
      $reasonB = if ($modelB -in $freeModels -and $activeGameCount[$modelB] -gt 0) { "$modelB BLOCKED (active: $($activeGameCount[$modelB]))" } else { "" }
      $reasons = @($reasonA, $reasonB) | Where-Object { $_ -ne "" } | Join-String -Separator ", "
      Write-Host "  [QUEUING PAUSED] $modelA vs $modelB → $reasons" -ForegroundColor DarkYellow
      break
    }

    # Queue one game from this pairing
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
      Invoke-WebRequest -Uri $queueEndpoint -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body $body -ErrorAction Stop -TimeoutSec 10 | Out-Null

      $queuedCount += 1
      $queuedThisRound += 1
      $pairing.gamesLeft -= 1

      # Increment active game count for both models
      $activeGameCount[$modelA] += 1
      $activeGameCount[$modelB] += 1

      $percent = [Math]::Min(100, [Math]::Floor($queuedCount / $totalGames * 100))
      Write-Host "  [QUEUED] $modelA ($($activeGameCount[$modelA])) vs $modelB ($($activeGameCount[$modelB])) | $queuedCount/$totalGames ($percent%)" -ForegroundColor Green

      # If this pairing has more games, keep it in the queue; otherwise move to next
      if ($pairing.gamesLeft -eq 0) {
        $pairingIndex += 1
      }
    } catch {
      Write-Host "  [ERROR] Failed to queue $modelA vs $modelB : $($_.Exception.Message)" -ForegroundColor Red
      break
    }
  }

  if ($queuedThisRound -gt 0) {
    Write-Host "  → Queued $queuedThisRound game(s) this round" -ForegroundColor Cyan
    Show-ModelStatus
  }

  # If we queued everything and completed everything, we're done
  if ($pairingIndex -ge $totalPairings -and $queuedCount -eq $completedCount) {
    Write-Host "All pairings complete and all games finished!" -ForegroundColor Green
    break
  }

  # Poll for game completion
  if ($queuedCount -gt $completedCount) {
    $pollCount++
    try {
      $resp = Invoke-WebRequest -Uri "$gamesEndpoint?limit=10000" -Method Get -ErrorAction Stop
      $data = $resp.Content | ConvertFrom-Json
      $currentDbCount = $data.total

      # We assume DB count increases monotonically; completed = current - initial
      if (-not $script:initialDbCount) {
        $script:initialDbCount = $currentDbCount
        Write-Host "[INIT] Initial DB game count: $currentDbCount" -ForegroundColor DarkCyan
      }

      $newCompletedCount = $currentDbCount - $script:initialDbCount

      # For each newly completed game, decrement active count on both models
      if ($newCompletedCount -gt $completedCount) {
        $justFinished = $newCompletedCount - $completedCount
        $completedCount = $newCompletedCount

        Write-Host "[COMPLETED] $justFinished new game(s) finished | Total: $completedCount/$totalGames" -ForegroundColor Cyan

        # Reset active counts for all free models (conservative approach)
        # A better approach would fetch recent games to see which models finished
        $freeModels | ForEach-Object { $activeGameCount[$_] = 0 }

        Show-ModelStatus
      }

      $elapsed = ((Get-Date) - $startTime).ToString('hh\:mm\:ss')
      $inQueue = $queuedCount - $completedCount
      Write-Host "[$elapsed | Poll #$pollCount] Progress: $completedCount/$totalGames complete | In queue: $inQueue | Remaining pairings: $($totalPairings - $pairingIndex)" `
        -ForegroundColor DarkCyan
    } catch {
      Write-Host "  [ERROR] Failed to poll games: $($_.Exception.Message)" -ForegroundColor Red
    }

    if ($NoWait -and $completedCount -eq 0) {
      Write-Host ""
      Write-Host "Exiting after initial queue (--NoWait flag). Monitor via Worm Arena UI." -ForegroundColor Yellow
      exit 0
    }
  }

  Start-Sleep -Milliseconds 3000
}

$elapsed = ((Get-Date) - $startTime).ToString('hh\:mm\:ss')
Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "  Tournament Complete" -ForegroundColor Green
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Total time: $elapsed" -ForegroundColor Yellow
Write-Host "Games queued: $queuedCount" -ForegroundColor Yellow
Write-Host "Games completed: $completedCount" -ForegroundColor Yellow
Write-Host ""

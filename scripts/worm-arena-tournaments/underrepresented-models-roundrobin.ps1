# Author: Cascade
# Date: 2025-12-17
# PURPOSE: Star-model tournament runner for Worm Arena / SnakeBench.
#          Runs google/gemini-3-flash-preview (the model under test) against a
#          fixed roster of champion/free models (same roster as run-paid-devstral-matches.ps1)
#          in both directions, strictly one match at a time to avoid rate limits.
# SRP/DRY check: Pass - single-purpose orchestration script,
#                reusing existing /api/snakebench/run-batch endpoint.

$apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"

$starModel = "google/gemini-3-flash-preview"

# Opponent roster: copied from scripts/worm-arena-tournaments/run-paid-devstral-matches.ps1
# Keep this list stable so tournaments are comparable across runs.
$opponentModels = @(
    "openai/gpt-5-nano",
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5-mini",
    "google/gemini-2.5-flash-preview-09-2025",
    "google/gemini-2.5-flash-lite-preview-09-2025",
    "deepseek/deepseek-v3.2",
    "mistralai/mistral-small-creative",
    "allenai/olmo-3.1-32b-think:free",
    "moonshotai/kimi-dev-72b:free",
    "nex-agi/deepseek-v3.1-nex-n1:free",
    "mistralai/devstral-2512:free",
    "amazon/nova-2-lite-v1:free",
    "essentialai/rnj-1-instruct",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "xiaomi/mimo-v2-flash:free"
)

# Number of matches to run for each direction, per opponent.
$matchesPerOpponentPerDirection = 1

# Delay between matches to avoid provider rate limiting.
$delaySeconds = 2

function Invoke-SnakeBenchBatch {
    param(
        [Parameter(Mandatory=$true)] [string] $ModelA,
        [Parameter(Mandatory=$true)] [string] $ModelB
    )

    # Run a single match (count=1). The server executes sequentially inside the request.
    $payload = @{
        modelA = $ModelA
        modelB = $ModelB
        count  = 1
    }

    try {
        Invoke-RestMethod -Uri $apiEndpoint -Method Post -ContentType "application/json" -Body ($payload | ConvertTo-Json) | Out-Null
        return $true
    } catch {
        Write-Host "Request failed: $ModelA vs $ModelB :: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$totalOpponents = $opponentModels.Count
$totalMatches = $totalOpponents * $matchesPerOpponentPerDirection * 2

Write-Host "Worm Arena Star Model Tournament (sequential)" -ForegroundColor Green
Write-Host "Star model: $starModel" -ForegroundColor Cyan
Write-Host "Opponents: $totalOpponents" -ForegroundColor Cyan
Write-Host "Matches per opponent per direction: $matchesPerOpponentPerDirection" -ForegroundColor Cyan
Write-Host "Total matches: $totalMatches" -ForegroundColor Cyan
Write-Host "Delay seconds between matches: $delaySeconds" -ForegroundColor Cyan
Write-Host "API endpoint: $apiEndpoint" -ForegroundColor Cyan
Write-Host ""

$submitted = 0

foreach ($opponent in $opponentModels) {
    for ($i = 0; $i -lt $matchesPerOpponentPerDirection; $i++) {
        # Star vs Opponent
        Write-Host "Running: $starModel vs $opponent" -ForegroundColor Yellow
        $ok1 = Invoke-SnakeBenchBatch -ModelA $starModel -ModelB $opponent
        if ($ok1) { $submitted += 1 }
        Start-Sleep -Milliseconds ([int]($delaySeconds * 1000))

        # Opponent vs Star
        Write-Host "Running: $opponent vs $starModel" -ForegroundColor Yellow
        $ok2 = Invoke-SnakeBenchBatch -ModelA $opponent -ModelB $starModel
        if ($ok2) { $submitted += 1 }
        Start-Sleep -Milliseconds ([int]($delaySeconds * 1000))
    }
}

Write-Host "" 
Write-Host "Done submitting matches (sequential). Submitted: $submitted / $totalMatches" -ForegroundColor Green
Write-Host "Replays: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan

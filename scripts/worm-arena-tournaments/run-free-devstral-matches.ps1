# Worm Arena Tournament Script - Round-Robin Tournament (All Free Models)
# Author: Claude Haiku 4.5
# Date: 2025-12-11
# PURPOSE: Run a round-robin tournament where each model faces every other model once.
# Each unique pairing is queued as one batch of 9 games.

$apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"
# $apiEndpoint = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"

# All models to include in the tournament
$allModels = @(
    "openai/gpt-5.2",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-5.1-codex-mini",
    "arcee-ai/trinity-mini:free",
    "anthropic/claude-haiku-4.5",
    "nvidia/nemotron-nano-12b-v2-vl:free"
)

$jobCount = 0
$matchups = @()

# Generate all unique pairings (round-robin)
for ($i = 0; $i -lt $allModels.Count; $i++) {
    for ($j = $i + 1; $j -lt $allModels.Count; $j++) {
        $matchups += @{
            modelA = $allModels[$i]
            modelB = $allModels[$j]
        }
    }
}

Write-Host "Tournament Configuration:" -ForegroundColor Cyan
Write-Host "Models: $($allModels.Count)"
Write-Host "Unique matchups: $($matchups.Count)"
Write-Host "Total games: $($matchups.Count * 9)"
Write-Host ""

# Queue all matchups
foreach ($matchup in $matchups) {
    Write-Host "Queuing match: $($matchup.modelA) vs $($matchup.modelB)" -ForegroundColor Cyan
    $body = @{
        modelA = $matchup.modelA
        modelB = $matchup.modelB
        count = 1
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList $apiEndpoint, $body | Out-Null

    $jobCount++
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All $jobCount matchups submitted asynchronously!" -ForegroundColor Green
Write-Host "Games running in parallel on backend"

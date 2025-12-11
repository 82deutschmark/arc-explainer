# Worm Arena Tournament Script - Coverage for Nova Lite & Kat Coder vs Multiple Opponents
# Author: Claude Code using Haiku 4.5
# Date: 2025-12-10
# PURPOSE: Run Worm Arena matches for amazon/nova-2-lite-v1:free and kwaipilot/kat-coder-pro:free
#          against diverse opponent models for comprehensive TrueSkill ranking data.
#          Uses new multi-opponent batch API with sequential execution.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$coverageModels = @(
    "amazon/nova-2-lite-v1:free",
    "kwaipilot/kat-coder-pro:free"
)

$opponentModels = @(
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5-nano",
    "mistralai/devstral-2512",
    "mistralai/ministral-8b-2512",
    "arcee-ai/trinity-mini:free",
    "amazon/nova-2-lite-v1:free",
    "deepseek/deepseek-chat-v3.1",
    "deepseek/deepseek-v3.2",
    "allenai/olmo-3-7b-think",
    "allenai/olmo-3-32b-think:free"
)

$gamesPerPairing = 1
$headToHeadGames = 9

Write-Host "Starting Nova/Kat coverage batch runs (non-streaming)..." -ForegroundColor Green
Write-Host "Coverage Models: $($coverageModels -join ', ')" -ForegroundColor Cyan
Write-Host "Opponent Pool: $($opponentModels.Count) models" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

foreach ($modelA in $coverageModels) {
    foreach ($opponent in $opponentModels) {
        Write-Host "Queuing batch: $modelA vs $opponent (x$gamesPerPairing)" -ForegroundColor Yellow

        $body = @{
            modelA    = $modelA
            modelB    = $opponent
            count     = $gamesPerPairing
            width     = 10
            height    = 10
            maxRounds = 150
            numApples = 5
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $payload)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload | Out-Null
        } -ArgumentList $apiEndpoint, $body | Out-Null

        $jobCount++
        Start-Sleep -Milliseconds 500
    }
}

Write-Host ""

# Nova vs Kat head-to-head
Write-Host "Queuing head-to-head: amazon/nova-2-lite-v1:free vs kwaipilot/kat-coder-pro:free (x$headToHeadGames)" -ForegroundColor Yellow

$headToHeadBody = @{
    modelA    = "amazon/nova-2-lite-v1:free"
    modelB    = "kwaipilot/kat-coder-pro:free"
    count     = $headToHeadGames
    width     = 10
    height    = 10
    maxRounds = 150
    numApples = 5
} | ConvertTo-Json

Start-Job -ScriptBlock {
    param($uri, $payload)
    Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload | Out-Null
} -ArgumentList $apiEndpoint, $headToHeadBody | Out-Null

$jobCount++

Write-Host ""
Write-Host "All $jobCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host "Breakdown:" -ForegroundColor Cyan
Write-Host "  - Nova vs $($opponentModels.Count) diverse opponents (x$gamesPerPairing each)" -ForegroundColor Cyan
Write-Host "  - Kat vs $($opponentModels.Count) diverse opponents (x$gamesPerPairing each)" -ForegroundColor Cyan
Write-Host "  - Nova vs Kat head-to-head (x$headToHeadGames)" -ForegroundColor Cyan
Write-Host ("Total: {0} matches queued" -f (($coverageModels.Count * $opponentModels.Count * $gamesPerPairing) + $headToHeadGames)) -ForegroundColor Cyan
Write-Host "JSONs will be written to: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan

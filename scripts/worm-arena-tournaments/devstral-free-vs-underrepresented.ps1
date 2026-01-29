 # Author: GPT-5.1 Codex
 # Date: 2025-12-11
 # PURPOSE: Run Worm Arena coverage matches for mistralai/devstral-2512:free
 #          against GPT-5 Nano and underrepresented OpenRouter models to
 #          strengthen TrueSkill estimates for both Devstral-free and tail models.
 # SRP/DRY check: Pass — single-purpose batch queuing script using the
 #                existing /api/snakebench/run-batch pattern.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$focusModel = "mistralai/devstral-2512:free"

$opponents = @(
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "deepseek/deepseek-v3.2",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-4.1-nano",
    "x-ai/grok-code-fast-1",

    "deepseek/deepseek-v3.2-exp",
    "allenai/olmo-3.1-32b-think:free",
    "kwaipilot/kat-coder-pro:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "mistralai/devstral-2512:free"
)

$gamesPerPairing = 2

Write-Host "Starting Devstral-free vs GPT-5 Nano + underrepresented coverage runs..." -ForegroundColor Green
Write-Host "Focus model: $focusModel" -ForegroundColor Cyan
Write-Host "Opponents: $($opponents -join ', ')" -ForegroundColor Cyan
Write-Host "Games per pairing: $gamesPerPairing" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

foreach ($opponent in $opponents) {
    Write-Host "Queuing batch: $focusModel vs $opponent (x$gamesPerPairing)" -ForegroundColor Yellow

    $body = @{
        modelA    = $focusModel
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

Write-Host ""
Write-Host "All $jobCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host ("Total matches queued: {0}" -f ($opponents.Count * $gamesPerPairing)) -ForegroundColor Cyan
Write-Host "JSONs will be written to: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan


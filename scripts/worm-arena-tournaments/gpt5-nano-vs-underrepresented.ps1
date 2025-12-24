 # Author: GPT-5.1 Codex
 # Date: 2025-12-11
 # PURPOSE: Run Worm Arena coverage matches for underrepresented OpenRouter models
 #          specifically against GPT-5 Nano, to feed TrueSkill rankings with
 #          more balanced data for tail models.
 # SRP/DRY check: Pass — single-purpose batch queuing script, reusing the
 #                existing /api/snakebench/run-batch pattern.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$focusModel = "openai/gpt-5-nano"

$underrepresentedModels = @(
    "x-ai/grok-4-fast",
    "kwaipilot/kat-coder-pro:free",
    "x-ai/grok-4.1-fast",
    "moonshotai/kimi-k2-thinking",
    "nvidia/nemotron-nano-12b-v2-vl",
    "allenai/olmo-3-32b-think:free",
    "allenai/olmo-3-7b-instruct",
    "deepseek/deepseek-v3.2"
)

$gamesPerPairing = 9

Write-Host "Starting GPT-5 Nano vs underrepresented models coverage runs..." -ForegroundColor Green
Write-Host "Focus model: $focusModel" -ForegroundColor Cyan
Write-Host "Opponents: $($underrepresentedModels -join ', ')" -ForegroundColor Cyan
Write-Host "Games per pairing: $gamesPerPairing" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

foreach ($opponent in $underrepresentedModels) {
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
Write-Host ("Total matches queued: {0}" -f ($underrepresentedModels.Count * $gamesPerPairing)) -ForegroundColor Cyan
Write-Host "JSONs will be written to: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan


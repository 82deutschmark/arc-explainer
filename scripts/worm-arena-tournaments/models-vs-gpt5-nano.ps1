# Worm Arena Tournament Script - Various Models vs OpenAI GPT-5 Nano
# Author: Claude Code using Haiku 4.5
# Date: 2025-12-11
# PURPOSE: Run Worm Arena batches where various models (kimi-k2-thinking,
#          devstral-2512, ministral-8b-2512, nemotron-nano-12b-v2-vl)
#          each play nine games against GPT-5 Nano via the standard
#          /api/snakebench/run-batch endpoint, using the same batch-queuing
#          pattern as other tournament scripts.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$modelsToTest = @(
    "moonshotai/kimi-k2-thinking",
    "mistralai/devstral-2512",
    "mistralai/ministral-8b-2512",
    "nvidia/nemotron-nano-12b-v2-vl:free"
)

$gptNanoOpponent = "openai/gpt-5-nano"

$gamesPerPairing = 9

Write-Host "Various Models vs OpenAI GPT-5 Nano" -ForegroundColor Green
Write-Host "Models: $($modelsToTest -join ', ')" -ForegroundColor Cyan
Write-Host "Opponent: $gptNanoOpponent" -ForegroundColor Cyan
Write-Host "Games per pairing: $gamesPerPairing" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

foreach ($model in $modelsToTest) {
    Write-Host "Queuing batch: $model vs $gptNanoOpponent (x$gamesPerPairing)" -ForegroundColor Yellow

    $body = @{
        modelA = $model
        modelB = $gptNanoOpponent
        count  = $gamesPerPairing
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $payload)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type" = "application/json"} -Body $payload | Out-Null
    } -ArgumentList $apiEndpoint, $body | Out-Null

    $jobCount++
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All $jobCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host ("Total matches queued: {0}" -f ($modelsToTest.Count * $gamesPerPairing)) -ForegroundColor Cyan
Write-Host "JSONs will be written to: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan

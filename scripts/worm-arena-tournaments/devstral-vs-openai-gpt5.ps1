# Worm Arena Tournament Script - Devstral 2512 vs OpenAI GPT-5 Family
# Author: GPT-5.1 Codex CLI
# Date: 2025-12-11
# PURPOSE: Run Worm Arena batches where Mistral Devstral 2 2512 plays
#          nine games each against GPT-5.1 Codex-Mini, GPT-5 Mini,
#          and GPT-5 Nano via the standard /api/snakebench/run-batch
#          endpoint, using the same batch-queuing pattern as other
#          tournament scripts.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$devstralModel = "mistralai/devstral-2512:free"

$openaiOpponents = @(
    "openrouter/gpt-5.1-codex-mini",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano"
)

$gamesPerPairing = 9

Write-Host "Mistral Devstral 2 2512 vs OpenAI GPT-5 Family" -ForegroundColor Green
Write-Host "Devstral model: $devstralModel" -ForegroundColor Cyan
Write-Host "Opponents: $($openaiOpponents -join ', ')" -ForegroundColor Cyan
Write-Host "Games per pairing: $gamesPerPairing" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

foreach ($opponent in $openaiOpponents) {
    Write-Host "Queuing batch: $devstralModel vs $opponent (x$gamesPerPairing)" -ForegroundColor Yellow

    $body = @{
        modelA = $devstralModel
        modelB = $opponent
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
Write-Host ("Total matches queued: {0}" -f ($openaiOpponents.Count * $gamesPerPairing)) -ForegroundColor Cyan
Write-Host "JSONs will be written to: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan


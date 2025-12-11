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
    "openai/gpt-5-nano",
    "arcee-ai/trinity-mini:free",
    "mistralai/ministral-3b-2512",
    "nvidia/nemotron-nano-9b-v2",
    "google/gemma-3n-e2b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "z-ai/glm-4.6v"
)

$gamesPerPairing = 9

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


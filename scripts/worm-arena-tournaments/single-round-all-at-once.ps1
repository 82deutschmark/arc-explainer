# Author: Claude Haiku 4.5
# Date: 2025-12-20
# PURPOSE: Run Worm Arena single-round matches (all requests sent concurrently).
#          Each model pairs sent once to the /api/snakebench/run-batch endpoint.
#          No staggering—all jobs submitted immediately for faster turnaround.
# SRP/DRY check: Pass — single-purpose concurrent batch submission using
#                existing /api/snakebench/run-batch pattern.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$focusModel = "xiaomi/mimo-v2-flash:free"

$opponents = @(
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "arcee-ai/trinity-mini:free",
    "nex-agi/deepseek-v3.1-nex-n1:free",
    "allenai/olmo-3.1-32b-think:free",
    "kwaipilot/kat-coder-pro:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "mistralai/devstral-2512:free"
)

Write-Host "Starting single-round matches (all requests sent concurrently)..." -ForegroundColor Green
Write-Host "Focus model: $focusModel" -ForegroundColor Cyan
Write-Host "Opponents: $($opponents.Count)" -ForegroundColor Cyan
Write-Host ""

$jobs = @()

foreach ($opponent in $opponents) {
    Write-Host "Submitting: $focusModel vs $opponent" -ForegroundColor Yellow

    $body = @{
        modelA    = $focusModel
        modelB    = $opponent
        count     = 1
        width     = 10
        height    = 10
        maxRounds = 150
        numApples = 5
    } | ConvertTo-Json

    $job = Start-Job -ScriptBlock {
        param($uri, $payload)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload | Out-Null
    } -ArgumentList $apiEndpoint, $body

    $jobs += $job
}

Write-Host ""
Write-Host "All $($opponents.Count) matches submitted!" -ForegroundColor Green
Write-Host "JSONs will be written to: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan

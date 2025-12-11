# Worm Arena Tournament Script - Coverage for Nova Lite & Kat Coder vs GPT-5 Baselines
# Author: Cascade
# Date: 2025-12-10
# PURPOSE: Run Worm Arena matches for amazon/nova-2-lite-v1:free and kwaipilot/kat-coder-pro:free
#          against cost-controlled GPT-5 baseline models (GPT-5.1 Codex Mini, GPT-5 Nano) for coverage.

$apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"
# $apiEndpoint = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"

$coverageModels = @(
    "amazon/nova-2-lite-v1:free",
    "kwaipilot/kat-coder-pro:free"
)

$baselineModels = @(
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5-nano"
)

$gamesPerPairing = 9

$jobCount = 0

foreach ($modelA in $coverageModels) {
    foreach ($modelB in $baselineModels) {
        Write-Host "Queuing match: $modelA vs $modelB (x$gamesPerPairing)" -ForegroundColor Cyan
        $body = @{
            modelA = $modelA
            modelB = $modelB
            count = $gamesPerPairing
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $body)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
        } -ArgumentList $apiEndpoint, $body | Out-Null

        $jobCount++
        Start-Sleep -Milliseconds 500
    }
}

Write-Host ""
Write-Host "All $jobCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host "Games running in parallel on backend"

# Worm Arena Tournament Script - Devstral 2512 Free vs All Free Models
# Author: Cascade
# Date: 2025-12-10
# PURPOSE: Run parallel Worm Arena matches between Devstral 2512 Free and all other free models listed in server/config/models.ts.
  $apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"
# $apiEndpoint = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"
$modelA = "mistralai/devstral-2512:free"

# Only free models whose apiModelName exists in server/config/models.ts (provider: OpenRouter)
$freeModels = @(
    "openai/gpt-5-nano",
    "moonshotai/kimi-dev-72b:free",
    "google/gemma-3n-e2b-it:free",
    "arcee-ai/trinity-mini:free",
    "amazon/nova-2-lite-v1:free",
    "nvidia/nemotron-nano-12b-v2-vl:free"
)

$jobCount = 0

foreach ($modelB in $freeModels) {
    Write-Host "Queuing match: $modelA vs $modelB" -ForegroundColor Cyan
    $body = @{
        modelA = $modelA
        modelB = $modelB
        count = 9
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList $apiEndpoint, $body | Out-Null

    $jobCount++
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All $jobCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host "Games running in parallel on backend"

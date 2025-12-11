# Worm Arena Tournament Script - Devstral 2512 Paid vs All Paid Models
# Author: Cascade
# Date: 2025-12-10
# PURPOSE: Run parallel Worm Arena matches between Devstral 2512 Paid and all other paid models listed in server/config/models.ts.
 $apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"
# $apiEndpoint = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"
$modelA = "mistralai/devstral-2512"

# Only paid models whose apiModelName exists in server/config/models.ts (excluding the free version of Devstral)
$paidModels = @(
    "o3-mini-2025-01-31",
    "o4-mini-2025-04-16",
    "o3-2025-04-16",
    "gpt-4.1-2025-04-14",
    "gpt-5-2025-08-07",
    "gpt-5-mini-2025-08-07",
    "gpt-5.1-codex-mini",
    "gpt-5.1-codex",
    "gpt-5.1-2025-11-13",
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-5-20250929",
    "anthropic/claude-opus-4.5",
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
    "deepseek-reasoner",
    "deepseek-reasoner-speciale",
    "qwen/qwen-plus-2025-07-28:thinking",
    "mistralai/mistral-large-2512",
    "moonshotai/kimi-k2-thinking",
    "openrouter/gpt-5.1-codex-mini",
    "openai/gpt-5.1",
    "grok-4",
    "x-ai/grok-3"
)

$jobCount = 0

foreach ($modelB in $paidModels) {
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

# Worm Arena Tournament Script - Devstral 2512 Paid vs All Free Models
# Author: Cascade GPT 5.1 high reasoning
# Date: 2025-12-10
# PURPOSE: Run parallel Worm Arena matches between Devstral 2512 Paid and all free models listed in server/config/models.ts.
 $apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"
# $apiEndpoint = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"
$modelA = "google/gemini-3-flash-preview"

# mostly free models whose apiModelName exists in server/config/models.ts (provider: OpenRouter)
$freeModels = @(
    "openai/gpt-5-nano",
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5-mini",
    "google/gemini-2.5-flash-preview-09-2025",
    "google/gemini-2.5-flash-lite-preview-09-2025",
    "deepseek/deepseek-v3.2",

    
    "mistralai/mistral-small-creative",
    "allenai/olmo-3.1-32b-think:free",
    "moonshotai/kimi-dev-72b:free",
    "nex-agi/deepseek-v3.1-nex-n1:free",
    "mistralai/devstral-2512:free",
    "amazon/nova-2-lite-v1:free",
    "essentialai/rnj-1-instruct"
    "nvidia/nemotron-3-nano-30b-a3b:free"
    "xiaomi/mimo-v2-flash:free"
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

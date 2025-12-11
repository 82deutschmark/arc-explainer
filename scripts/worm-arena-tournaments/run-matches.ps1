# Worm Arena Tournament Script - GPT-5.1 Codex Mini vs OpenRouter roster
# Author: Cascade
# Date: 2025-12-10
# PURPOSE: Run parallel Worm Arena matches between GPT-5.1 Codex Mini and verified OpenRouter models listed in server/config/models.ts.
  $apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"
# $apiEndpoint = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"
$modelA = "openai/gpt-5.1-codex-mini"

# Only models whose apiModelName exists in server/config/models.ts (provider: OpenRouter)
$openRouterModels = @(
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-5.1",
    "openai/gpt-oss-120b",
    "mistralai/ministral-14b-2512",
    "mistralai/ministral-8b-2512",
    "mistralai/ministral-3b-2512",
    "mistralai/codestral-2508",
  
    "qwen/qwen3-coder",
    "qwen/qwen-plus-2025-07-28:thinking",
    "moonshotai/kimi-k2-thinking",
    "moonshotai/kimi-dev-72b:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemini-2.5-flash-lite-preview-09-2025",
    "google/gemini-2.5-flash-preview-09-2025",
    "google/gemini-3-pro-preview",

    "x-ai/grok-4.1-fast",
   
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-haiku-4.5",
    "arcee-ai/trinity-mini:free",
    "amazon/nova-2-lite-v1:free",
    "amazon/nova-premier-v1",
    
    "nvidia/nemotron-nano-12b-v2-vl:free",
    
    "z-ai/glm-4.6v"
)

$jobCount = 0

foreach ($modelB in $openRouterModels) {
    Write-Host "Queuing match: $modelA vs $modelB" -ForegroundColor Cyan
    $body = @{
        modelA = $modelA
        modelB = $modelB
        count = 5
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

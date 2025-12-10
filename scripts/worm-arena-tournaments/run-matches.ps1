# Worm Arena Tournament Script - GPT-5 Nano vs Free/OpenRouter Models
# Author: Cascade
# Date: 2025-12-10
# PURPOSE: Run parallel matches between GPT-5 Nano and inexpensive models

$modelA = "openai/gpt-5-nano"

# Expanded list of free and inexpensive models from OpenRouter
$freeModels = @(
    # Free models
    "arcee-ai/trinity-mini:free",
    "amazon/nova-2-lite-v1:free", 
    "kwaipilot/kat-coder-pro:free",
    "nvidia/nemotron-nano-9b-v2",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "moonshotai/kimi-dev-72b:free",
    "mistralai/ministral-14b-2512",
    "mistralai/ministral-8b-2512", 
    "mistralai/ministral-3b-2512",
    
    # Inexpensive models (under $0.01 per 1K tokens)
    "meta-llama/llama-3.1-8b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "google/gemma-2-9b-it:free",
    "qwen/qwen-2.5-7b-instruct:free",
    "anthropic/claude-3-haiku:free",
    "cohere/command-r-plus:free",
    "perplexity/llama-3.1-sonar-small-128k-online:free",
    "deepseek/deepseek-chat:free",
    "groq/llama-3.1-70b-versatile:free",
    "ai21/jamba-1.5-mini:free"
)

$jobCount = 0

foreach ($modelB in $freeModels) {
    Write-Host "Queuing match: $modelA vs $modelB" -ForegroundColor Cyan
    $body = @{
        modelA = $modelA
        modelB = $modelB
        count = 5
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch", $body | Out-Null

    $jobCount++
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All $jobCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host "Games running in parallel on backend"

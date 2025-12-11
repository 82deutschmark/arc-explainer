# Worm Arena Tournament Script - Coverage for Nova Lite & Kat Coder vs Multiple Opponents
# Author: Claude Code using Haiku 4.5
# Date: 2025-12-10
# PURPOSE: Run Worm Arena matches for amazon/nova-2-lite-v1:free and kwaipilot/kat-coder-pro:free
#          against diverse opponent models for comprehensive TrueSkill ranking data.
#          Uses new multi-opponent batch API with sequential execution.

$apiEndpoint = "http://localhost:5000/api/wormarena/prepare"

$coverageModels = @(
    "amazon/nova-2-lite-v1:free",
    "kwaipilot/kat-coder-pro:free"
)

$opponentModels = @(
    "x-ai/grok-4.1-fast",
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5-nano",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.0-flash-exp",
    "openrouter/meta-llama/llama-3.3-70b-instruct",
    "openrouter/deepseek/deepseek-chat",
    "openrouter/mistral/mistral-large-2",
    "openrouter/qwen/qwen-max"
)

Write-Host "Starting multi-opponent batch runs..." -ForegroundColor Green
Write-Host "Coverage Models: $($coverageModels -join ', ')" -ForegroundColor Cyan
Write-Host "Opponent Pool: $($opponentModels.Count) models" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

foreach ($modelA in $coverageModels) {
    Write-Host "Queuing batch for: $modelA vs 9 opponents" -ForegroundColor Yellow

    $body = @{
        modelA = $modelA
        opponents = $opponentModels
        width = 10
        height = 10
        maxRounds = 150
        numApples = 5
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri $apiEndpoint -Method Post -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction Stop
        $result = $response.Content | ConvertFrom-Json

        if ($result.success) {
            $sessionId = $result.sessionId
            $liveUrl = "http://localhost:5000/worm-arena/live/$sessionId"
            Write-Host "✓ Batch queued! Session: $sessionId" -ForegroundColor Green
            Write-Host "  Live view: $liveUrl" -ForegroundColor Cyan
        } else {
            Write-Host "✗ Error: $($result.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Request failed: $_" -ForegroundColor Red
    }

    $jobCount++
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All $jobCount batches submitted!" -ForegroundColor Green
Write-Host "Each batch runs 9 sequential matches (rate-limit safe)" -ForegroundColor Cyan
Write-Host "Total: $($jobCount * $opponentModels.Count) matches queued" -ForegroundColor Cyan

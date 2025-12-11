# TrueSkill Coverage Tournament - Nova & Kat vs 9 Diverse Opponents
# Author: Claude Code using Haiku 4.5
# Date: 2025-12-10
# PURPOSE: Run Nova and Kat against 9 diverse opponents for proper TrueSkill convergence.
#          Each model plays each opponent once (9 matches per model).
#          Also: Nova vs Kat head-to-head (9 times).

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$coverageModels = @(
    "amazon/nova-2-lite-v1:free",
    "kwaipilot/kat-coder-pro:free"
)

$diverseOpponents = @(
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

Write-Host "TrueSkill Coverage Tournament" -ForegroundColor Green
Write-Host "Coverage Models: Nova, Kat" -ForegroundColor Cyan
Write-Host "Opponent Pool: 9 diverse models" -ForegroundColor Cyan
Write-Host ""

$batchCount = 0

# Each coverage model vs 9 diverse opponents
foreach ($modelA in $coverageModels) {
    Write-Host "Launching: $modelA vs 9 diverse opponents" -ForegroundColor Yellow

    foreach ($opponent in $diverseOpponents) {
        Write-Host "  Queue: $modelA vs $opponent (1 match)" -ForegroundColor Cyan

        $body = @{
            modelA = $modelA
            modelB = $opponent
            count = 1
        } | ConvertTo-Json

        try {
            $response = Invoke-WebRequest -Uri $apiEndpoint -Method Post -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction Stop
            $result = $response.Content | ConvertFrom-Json
            if ($result.success) {
                Write-Host "    OK" -ForegroundColor Green
            } else {
                Write-Host "    ERROR: $($result.error)" -ForegroundColor Red
            }
        } catch {
            Write-Host "    FAILED: $_" -ForegroundColor Red
        }

        $batchCount++
        Start-Sleep -Milliseconds 100
    }
}

Write-Host ""
Write-Host "Head-to-Head: Nova vs Kat (9 matches)" -ForegroundColor Yellow

for ($i = 1; $i -le 9; $i++) {
    Write-Host "  Queue: amazon/nova-2-lite-v1:free vs kwaipilot/kat-coder-pro:free (match $i/9)" -ForegroundColor Cyan

    $body = @{
        modelA = "amazon/nova-2-lite-v1:free"
        modelB = "kwaipilot/kat-coder-pro:free"
        count = 1
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri $apiEndpoint -Method Post -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction Stop
        $result = $response.Content | ConvertFrom-Json
        if ($result.success) {
            Write-Host "    OK" -ForegroundColor Green
        } else {
            Write-Host "    ERROR: $($result.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "    FAILED: $_" -ForegroundColor Red
    }

    $batchCount++
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "Tournament submitted!" -ForegroundColor Green
Write-Host "Total queued: $batchCount matches" -ForegroundColor Cyan
Write-Host "JSONs: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan

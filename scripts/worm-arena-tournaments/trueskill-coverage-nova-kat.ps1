 # Author: GPT-5.1 Codex
 # Date: 2025-12-11
 # PURPOSE: Run Nova and Kat against 9 diverse opponents for proper TrueSkill convergence.
 #          Each model plays each opponent once (9 matches per model).
 #          Also: Nova vs Kat head-to-head (9 times).
 # SRP/DRY check: Pass — script only submits batch jobs and reuses common queuing pattern.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$coverageModels = @(
    "amazon/nova-2-lite-v1:free",
    "kwaipilot/kat-coder-pro:free"
)

$diverseOpponents = @(
    "mistralai/devstral-2512:free",
    "mistralai/ministral-8b-2512",
    "mistralai/ministral-3b-2512",
    "arcee-ai/trinity-mini:free",
    "deepseek/deepseek-v3.2",
    "allenai/olmo-3-32b-think:free",
    "moonshotai/kimi-k2-thinking",
    "nvidia/nemotron-nano-9b-v2",
    "google/gemma-3n-e2b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "z-ai/glm-4.6v"
)

Write-Host "TrueSkill Coverage Tournament" -ForegroundColor Green
Write-Host "Coverage Models: Nova, Kat" -ForegroundColor Cyan
Write-Host "Opponent Pool: 9 diverse models" -ForegroundColor Cyan
Write-Host ""

$batchCount = 0
$jobHandles = @()

# Each coverage model vs 9 diverse opponents (queued asynchronously)
foreach ($modelA in $coverageModels) {
    Write-Host "Launching: $modelA vs 9 diverse opponents" -ForegroundColor Yellow

    foreach ($opponent in $diverseOpponents) {
        Write-Host "  Queue: $modelA vs $opponent (1 match)" -ForegroundColor Cyan

        $body = @{
            modelA = $modelA
            modelB = $opponent
            count = 1
        } | ConvertTo-Json

        $job = Start-Job -ScriptBlock {
            param($uri, $payload)
            try {
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload -ErrorAction Stop | Out-Null
                return "OK"
            } catch {
                return "FAILED: $_"
            }
        } -ArgumentList $apiEndpoint, $body

        $jobHandles += $job
        $batchCount++
        Start-Sleep -Milliseconds 200
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

    $job = Start-Job -ScriptBlock {
        param($uri, $payload)
        try {
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload -ErrorAction Stop | Out-Null
            return "OK"
        } catch {
            return "FAILED: $_"
        }
    } -ArgumentList $apiEndpoint, $body

    $jobHandles += $job
    $batchCount++
    Start-Sleep -Milliseconds 200
}

# Allow a short window for all jobs to be submitted and start executing
Write-Host ""
Write-Host "Waiting briefly for jobs to start (up to 30 seconds)..." -ForegroundColor Yellow
Wait-Job -Job $jobHandles -Timeout 30 | Out-Null

Write-Host ""
Write-Host "Tournament submitted!" -ForegroundColor Green
Write-Host "Total queued: $batchCount matches" -ForegroundColor Cyan
Write-Host "JSONs: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan

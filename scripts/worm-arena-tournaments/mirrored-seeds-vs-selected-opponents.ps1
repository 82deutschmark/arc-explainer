# Author: Cascade
# Date: 2025-12-20
# PURPOSE: Run a mirrored mini round-robin between a small set of "seed" models
#          and a small set of "target opponent" models for Worm Arena.
#          
#          Mirrored mode means for each (seed, opponent) pairing we queue:
#            1) seed vs opponent (count = 2)
#            2) opponent vs seed (count = 2)
#          
#          This reduces first-move / ordering bias while keeping the total run
#          small and easy to configure.
# 
#          IMPORTANT: This script queues ALL batches immediately (asynchronous
#          Start-Job calls). It does not wait for any match to complete.
# 
# SRP/DRY check: Pass — single-purpose batch queuing script using the existing
#                /api/snakebench/run-batch pattern.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

# Two matches per pairing as requested.
$gamesPerPairing = 2

# Default Worm Arena match settings (consistent with existing tournament scripts).
$width = 10
$height = 10
$maxRounds = 150
$numApples = 5

# Seeds: the models you listed that you want to evaluate.
$seedModels = @(
    "deepseek/deepseek-v3.2-exp",
    "x-ai/grok-4-fast",
    "moonshotai/kimi-k2-thinking",
    "z-ai/glm-4.6v",
    "x-ai/grok-code-fast-1"
)

# Opponents: the models you want each seed to play against.
$opponentModels = @(
    "deepseek/deepseek-v3.1-terminus",
    "google/gemini-3-flash-preview",
    "qwen/qwen3-coder:free"
    "nvidia/nemotron-nano-12b-v2-vl"
)

Write-Host "Starting mirrored seeds vs selected opponents tournament..." -ForegroundColor Green
Write-Host "Endpoint: $apiEndpoint" -ForegroundColor Cyan
Write-Host "Seeds: $($seedModels -join ', ')" -ForegroundColor Cyan
Write-Host "Opponents: $($opponentModels -join ', ')" -ForegroundColor Cyan
Write-Host "Games per pairing (per direction): $gamesPerPairing" -ForegroundColor Cyan
Write-Host "Settings: ${width}x${height}, maxRounds=$maxRounds, numApples=$numApples" -ForegroundColor Cyan
Write-Host "" 

$jobCount = 0
$batchCount = 0

# For each seed/opponent pairing, queue two batches (mirrored directions).
foreach ($seed in $seedModels) {
    foreach ($opponent in $opponentModels) {
        # Batch 1: seed vs opponent
        $bodyForward = @{
            modelA    = $seed
            modelB    = $opponent
            count     = $gamesPerPairing
            width     = $width
            height    = $height
            maxRounds = $maxRounds
            numApples = $numApples
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $payload)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload | Out-Null
        } -ArgumentList $apiEndpoint, $bodyForward | Out-Null

        $jobCount++
        $batchCount++

        # Batch 2: opponent vs seed (mirrored)
        $bodyMirrored = @{
            modelA    = $opponent
            modelB    = $seed
            count     = $gamesPerPairing
            width     = $width
            height    = $height
            maxRounds = $maxRounds
            numApples = $numApples
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $payload)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload | Out-Null
        } -ArgumentList $apiEndpoint, $bodyMirrored | Out-Null

        $jobCount++
        $batchCount++

        # No throttling: launch batches as fast as possible.
    }
}

$totalMatchesQueued = $batchCount * $gamesPerPairing

Write-Host "" 
Write-Host "All $batchCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host ("Total matches queued: {0} (batches={1}, gamesPerBatch={2})" -f $totalMatchesQueued, $batchCount, $gamesPerPairing) -ForegroundColor Cyan
Write-Host "JSONs will be written to: external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan

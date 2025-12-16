# Author: Claude Haiku 4.5
# Date: 2025-12-13
# PURPOSE: Coverage tournament for underrepresented models vs champion models.
#          Each underrepresented model plays against each major/champion model
#          in both directions (A vs B and B vs A), filling gaps in TrueSkill
#          rankings and ensuring balanced matchup coverage.
# SRP/DRY check: Pass - single-purpose batch orchestration script,
#                reusing existing /api/snakebench/run-batch endpoint.

$apiEndpoint = "https://localhost:5000/api/snakebench/run-batch"

$underrepresentedModels = @(
    "mistralai/devstral-2512",
    "mistralai/ministral-8b-2512",
    "nvidia/nemotron-nano-12b-v2-vl",
    "allenai/olmo-3-7b-think",
    "mistralai/ministral-14b-2512",
    "openai/gpt-5-nano",
    "mistralai/mistral-large-2512"
)

$championModels = @(
    "x-ai/grok-code-fast-1",
    
    "x-ai/grok-4.1-fast",
 
    "deepseek/deepseek-chat-v3-0324",
    "deepseek/deepseek-chat-v3.1",
    "deepseek/deepseek-v3.2-exp",
    "deepseek/deepseek-v3.2-speciale"
)

$matchesPerPair = 1
$delaySeconds = 0.5

$totalPairings = $underrepresentedModels.Count * $championModels.Count
$totalMatches = $totalPairings * $matchesPerPair * 2

Write-Host "Underrepresented Models vs Champions Coverage Tournament" -ForegroundColor Green
Write-Host "Underrepresented models: $($underrepresentedModels.Count)" -ForegroundColor Cyan
foreach ($model in $underrepresentedModels) {
    Write-Host "  - $model" -ForegroundColor DarkCyan
}
Write-Host ""
Write-Host "Champion models: $($championModels.Count)" -ForegroundColor Cyan
foreach ($model in $championModels) {
    Write-Host "  - $model" -ForegroundColor Green
}
Write-Host ""
Write-Host "Matches per pairing: $matchesPerPair (both directions)" -ForegroundColor Cyan
Write-Host "Total pairings: $totalPairings" -ForegroundColor Cyan
Write-Host "Total matches to queue: $totalMatches" -ForegroundColor Cyan
Write-Host "API endpoint: $apiEndpoint" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

foreach ($underrep in $underrepresentedModels) {
    foreach ($champion in $championModels) {
        Write-Host "Queueing: $underrep vs $champion ($matchesPerPair matches, both directions)" -ForegroundColor Yellow

        for ($match = 0; $match -lt $matchesPerPair; $match++) {
            # Underrep vs Champion
            $body1 = @{
                modelA = $underrep
                modelB = $champion
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList $apiEndpoint, $body1 | Out-Null

            # Champion vs Underrep
            $body2 = @{
                modelA = $champion
                modelB = $underrep
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList $apiEndpoint, $body2 | Out-Null

            $jobCount += 2
            Start-Sleep -Milliseconds ($delaySeconds * 1000)
        }
    }
}

Write-Host ""
Write-Host "All $jobCount matches queued asynchronously!" -ForegroundColor Green
Write-Host "Games running in parallel on backend" -ForegroundColor Cyan
Write-Host "Completed games will be saved to external/SnakeBench/backend/completed_games/" -ForegroundColor Cyan
Write-Host ""

Write-Host "Monitor: Check the Worm Arena UI or external/SnakeBench/backend/completed_games/ to track progress." -ForegroundColor Cyan
Write-Host "Matches are queued and running in parallel on the backend." -ForegroundColor Green

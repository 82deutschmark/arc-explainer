# Author: Claude Haiku 4.5
# Date: 2025-12-13
# PURPOSE: Round-robin tournament for underrepresented models.
#          Each model plays against every other underrepresented model
#          in both directions (A vs B and B vs A), ensuring balanced
#          TrueSkill coverage and ranking depth for the tail of the
#          leaderboard (models with <10 games).
# SRP/DRY check: Pass - single-purpose batch orchestration script,
#                reusing existing /api/snakebench/run-batch endpoint.

$apiEndpoint = "http://localhost:5000/api/snakebench/run-batch"

$underrepresentedModels = @(
    "mistralai/devstral-2512",
    "mistralai/ministral-8b-2512",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "allenai/olmo-3-7b-think",
    "mistralai/ministral-14b-2512",
    "allenai/olmo-3-32b-think:free",
    "mistralai/mistral-large-2512"
)

$matchesPerPair = 1
$delaySeconds = 0.5

$totalPairings = [math]::Floor($underrepresentedModels.Count * ($underrepresentedModels.Count - 1) / 2)
$totalMatches = $totalPairings * $matchesPerPair * 2

Write-Host "Underrepresented Models Round-Robin Tournament" -ForegroundColor Green
Write-Host "Models: $($underrepresentedModels.Count)" -ForegroundColor Cyan
Write-Host "Models:" -ForegroundColor Cyan
foreach ($model in $underrepresentedModels) {
    Write-Host "  - $model" -ForegroundColor DarkCyan
}
Write-Host ""
Write-Host "Matches per pair: $matchesPerPair (both directions)" -ForegroundColor Cyan
Write-Host "Total unique pairings: $totalPairings" -ForegroundColor Cyan
Write-Host "Total matches to queue: $totalMatches" -ForegroundColor Cyan
Write-Host "API endpoint: $apiEndpoint" -ForegroundColor Cyan
Write-Host ""

$jobCount = 0

for ($i = 0; $i -lt $underrepresentedModels.Count; $i++) {
    for ($j = $i + 1; $j -lt $underrepresentedModels.Count; $j++) {
        $modelA = $underrepresentedModels[$i]
        $modelB = $underrepresentedModels[$j]

        Write-Host "Queueing: $modelA vs $modelB ($matchesPerPair matches, both directions)" -ForegroundColor Yellow

        for ($match = 0; $match -lt $matchesPerPair; $match++) {
            # A vs B
            $body1 = @{
                modelA = $modelA
                modelB = $modelB
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList $apiEndpoint, $body1 | Out-Null

            # B vs A
            $body2 = @{
                modelA = $modelB
                modelB = $modelA
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

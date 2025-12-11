$modelA = "google/gemini-3-pro-preview"
$modelB = "anthropic/claude-opus-4.5"

$matchesCount = 5
$delaySeconds = 1.5
$baseUri = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"

Write-Host "Gemini 3 Pro vs Claude Opus 4.5 Championship"
Write-Host "Model A: $modelA"
Write-Host "Model B: $modelB"
Write-Host "Matches per direction: $matchesCount"
Write-Host "Total matches: $($matchesCount * 2)"
Write-Host ""

$jobCount = 0

for ($match = 0; $match -lt $matchesCount; $match++) {
    # Gemini 3 vs Opus
    $body1 = @{
        modelA = $modelA
        modelB = $modelB
        count = 1
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList $baseUri, $body1 | Out-Null

    # Opus vs Gemini 3 (reverse)
    $body2 = @{
        modelA = $modelB
        modelB = $modelA
        count = 1
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList $baseUri, $body2 | Out-Null

    $jobCount += 2
    Start-Sleep -Milliseconds ($delaySeconds * 1000)
}

Write-Host ""
Write-Host "Done! All $jobCount matches queued asynchronously!"
Write-Host "Games running in parallel on backend"
Write-Host "Completed games will be saved to external/SnakeBench/backend/completed_games/"

$modelA = "openrouter/gpt-5.1-codex-mini"
$modelB = "openai/gpt-5-mini"

$matchesCount = 5
$delaySeconds = 1.5
$baseUri = "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch"

Write-Host "GPT-5.1 Codex-Mini vs GPT-5-Mini Championship"
Write-Host "Model A: $modelA"
Write-Host "Model B: $modelB"
Write-Host "Matches per direction: $matchesCount"
Write-Host "Total matches: $($matchesCount * 2)"
Write-Host ""

$jobCount = 0

for ($match = 0; $match -lt $matchesCount; $match++) {
    # Codex-Mini vs 5-Mini
    $body1 = @{
        modelA = $modelA
        modelB = $modelB
        count = 1
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList $baseUri, $body1 | Out-Null

    # 5-Mini vs Codex-Mini (reverse)
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

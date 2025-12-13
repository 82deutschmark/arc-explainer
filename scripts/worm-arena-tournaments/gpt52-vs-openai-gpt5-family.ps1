$champion = "openai/gpt-5.2"
$challengers = @(
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5-nano"
)

$matchesPerDirection = 5
$delayMilliseconds = 500

Write-Host "GPT-5.2 Championship: Champion vs GPT-5 Family"
Write-Host "Champion: $champion"
Write-Host "Challengers: $($challengers.Count)"
Write-Host "Matches per direction: $matchesPerDirection"
Write-Host "Total pairings: $($challengers.Count)"
Write-Host "Total matches: $($challengers.Count * $matchesPerDirection * 2)"
Write-Host ""

$jobCount = 0

foreach ($challenger in $challengers) {
    Write-Host "Queueing: $champion vs $challenger ($matchesPerDirection matches, both directions)"

    for ($match = 0; $match -lt $matchesPerDirection; $match++) {
        # Champion vs Challenger
        $body1 = @{
            modelA = $champion
            modelB = $challenger
            count = 1
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $body)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
        } -ArgumentList "https://localhost:5000/api/snakebench/run-batch", $body1 | Out-Null

        # Challenger vs Champion (reverse)
        $body2 = @{
            modelA = $challenger
            modelB = $champion
            count = 1
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $body)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
        } -ArgumentList "https://localhost:5000/api/snakebench/run-batch", $body2 | Out-Null

        $jobCount += 2
        Start-Sleep -Milliseconds $delayMilliseconds
    }
}

Write-Host ""
Write-Host "Done! All $jobCount matches queued asynchronously!"
Write-Host "Games running in parallel on backend"
Write-Host "Completed games will be saved to external/SnakeBench/backend/completed_games/"

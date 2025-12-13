$champion = "x-ai/grok-4.1-fast"
$challengers = @(
    "openai/gpt-5.2",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini"
)

$matchesPerDirection = 5
$delayMilliseconds = 500
$baseUrl = "http://localhost:5000/api/snakebench/run-batch"

Write-Host "Grok 4.1 Fast Championship"
Write-Host "Champion: $champion"
Write-Host "Challengers: $($challengers.Count)"
Write-Host "Matches per direction: $matchesPerDirection"
Write-Host "Total pairings: $($challengers.Count)"
Write-Host "Total matches: $($challengers.Count * $matchesPerDirection * 2)"
Write-Host ""

$matchCount = 0
$successCount = 0
$failureCount = 0

foreach ($challenger in $challengers) {
    Write-Host "Starting: $champion vs $challenger ($matchesPerDirection matches, both directions)"

    for ($match = 0; $match -lt $matchesPerDirection; $match++) {
        # Champion vs Challenger
        $body1 = @{
            modelA = $champion
            modelB = $challenger
            count = 1
        } | ConvertTo-Json

        Write-Host -NoNewline "  [$($matchCount + 1)] $champion vs $challenger ... "
        try {
            Invoke-WebRequest -Uri $baseUrl -Method Post -Headers @{"Content-Type"="application/json"} -Body $body1 | Out-Null
            Write-Host "OK" -ForegroundColor Green
            $successCount++
        } catch {
            Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
            $failureCount++
        }
        $matchCount++
        Start-Sleep -Milliseconds $delayMilliseconds

        # Challenger vs Champion (reverse)
        $body2 = @{
            modelA = $challenger
            modelB = $champion
            count = 1
        } | ConvertTo-Json

        Write-Host -NoNewline "  [$($matchCount + 1)] $challenger vs $champion ... "
        try {
            Invoke-WebRequest -Uri $baseUrl -Method Post -Headers @{"Content-Type"="application/json"} -Body $body2 | Out-Null
            Write-Host "OK" -ForegroundColor Green
            $successCount++
        } catch {
            Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
            $failureCount++
        }
        $matchCount++
        Start-Sleep -Milliseconds $delayMilliseconds
    }
}

Write-Host ""
Write-Host "Tournament complete!"
Write-Host "Total matches: $matchCount"
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failureCount" -ForegroundColor $(if ($failureCount -eq 0) { "Green" } else { "Red" })
Write-Host "Games running on backend"
Write-Host "Completed games will be saved to external/SnakeBench/backend/completed_games/"

param (
    [int]$count = 3,
    [int]$delayMilliseconds = 500
)

$champion = "openai/gpt-5.2"
$challengers = @(
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5-nano",
    "deepseek/deepseek-v3.2",
    "google/gemini-3-pro-preview",
    "anthropic/claude-haiku-4.5"
)

$endpoint = "https://localhost:5000/api/snakebench/run-batch"

Write-Host "GPT-5.2 Tournament: Champion vs OpenAI + Hybrid Challengers"
Write-Host "Champion: $champion"
Write-Host "Challengers: $($challengers.Count)"
Write-Host "Games per batch (count): $count"
Write-Host "Endpoint: $endpoint"
Write-Host ""

$matchIndex = 0
$success = 0
$failures = 0

foreach ($challenger in $challengers) {
    Write-Host "Queuing both directions against: $challenger"

    foreach ($direction in 0..1) {
        $modelA = if ($direction -eq 0) { $champion } else { $challenger }
        $modelB = if ($direction -eq 0) { $challenger } else { $champion }
        $label = if ($direction -eq 0) { "$champion vs $challenger" } else { "$challenger vs $champion" }

        $body = @{
            modelA = $modelA
            modelB = $modelB
            count  = $count
        } | ConvertTo-Json

        $matchIndex++
        Write-Host -NoNewline "  [$matchIndex] $label ... "
        try {
            Invoke-WebRequest -Uri $endpoint -Method Post -Headers @{ "Content-Type" = "application/json" } -Body $body | Out-Null
            Write-Host "queued" -ForegroundColor Green
            $success++
        } catch {
            Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
            $failures++
        }

        Start-Sleep -Milliseconds $delayMilliseconds
    }
}

Write-Host ""
Write-Host "Submission complete."
Write-Host "Total batches attempted: $matchIndex"
Write-Host "Successful submissions: $success" -ForegroundColor Green
Write-Host ("Failed submissions: {0}" -f $failures) -ForegroundColor $(if ($failures -eq 0) { "Green" } else { "Red" })
Write-Host "Batches run on /api/snakebench/run-batch; completed games land in external/SnakeBench/backend/completed_games/"

$gptModels = @(
    "openai/gpt-oss-120b",
    "openrouter/gpt-5.1-codex-mini",
    "openai/gpt-5.1",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini"
)

$claudeModels = @(
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-haiku-4.5"
)

$matchesPerPair = 3
$delaySeconds = 0.5

Write-Host "GPT vs Claude Family Championship"
Write-Host "GPT Models: $($gptModels.Count)"
Write-Host "Claude Models: $($claudeModels.Count)"
Write-Host "Matches per pair: $matchesPerPair"
Write-Host "Total pairings: $($gptModels.Count * $claudeModels.Count)"
Write-Host "Total matches: $($gptModels.Count * $claudeModels.Count * $matchesPerPair * 2)"
Write-Host ""

$jobCount = 0

foreach ($gptModel in $gptModels) {
    foreach ($claudeModel in $claudeModels) {
        Write-Host "Queueing: $gptModel vs $claudeModel ($matchesPerPair matches, both directions)"

        for ($match = 0; $match -lt $matchesPerPair; $match++) {
            # GPT vs Claude
            $body1 = @{
                modelA = $gptModel
                modelB = $claudeModel
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList "http://localhost:5000/api/snakebench/run-batch", $body1 | Out-Null

            # Claude vs GPT (reverse)
            $body2 = @{
                modelA = $claudeModel
                modelB = $gptModel
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList "http://localhost:5000/api/snakebench/run-batch", $body2 | Out-Null

            $jobCount += 2
            Start-Sleep -Milliseconds ($delaySeconds * 1000)
        }
    }
}

Write-Host ""
Write-Host "Done! All $jobCount matches queued asynchronously!"
Write-Host "Games running in parallel on backend"
Write-Host "Completed games will be saved to external/SnakeBench/backend/completed_games/"

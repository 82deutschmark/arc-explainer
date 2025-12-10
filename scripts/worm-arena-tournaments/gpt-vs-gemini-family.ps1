$gptModels = @(
    "openai/gpt-oss-120b",
    "openrouter/gpt-5.1-codex-mini",
    
    "openai/gpt-5-nano",
    "openai/gpt-5-mini"
)

$geminiModels = @(
    "google/gemini-2.5-flash-lite-preview-09-2025",
    "google/gemini-2.5-flash-preview-09-2025",
    "google/gemini-3-pro-preview"
)

$matchesPerPair = 3
$delaySeconds = 1.5

Write-Host "GPT vs Gemini Family Championship"
Write-Host "GPT Models: $($gptModels.Count)"
Write-Host "Gemini Models: $($geminiModels.Count)"
Write-Host "Matches per pair: $matchesPerPair"
Write-Host "Total pairings: $($gptModels.Count * $geminiModels.Count)"
Write-Host "Total matches: $($gptModels.Count * $geminiModels.Count * $matchesPerPair * 2)"
Write-Host ""

$jobCount = 0

foreach ($gptModel in $gptModels) {
    foreach ($geminiModel in $geminiModels) {
        Write-Host "Queueing: $gptModel vs $geminiModel ($matchesPerPair matches, both directions)"

        for ($match = 0; $match -lt $matchesPerPair; $match++) {
            # GPT vs Gemini
            $body1 = @{
                modelA = $gptModel
                modelB = $geminiModel
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList "http://localhost:5000/api/snakebench/run-batch", $body1 | Out-Null

            # Gemini vs GPT (reverse)
            $body2 = @{
                modelA = $geminiModel
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

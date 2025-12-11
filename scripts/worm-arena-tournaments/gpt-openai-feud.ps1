$modelsA = @(
    "openai/gpt-oss-120b",
    "openrouter/gpt-5.1-codex-mini",
    "openai/gpt-5.1",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini"
)

$matchesPerPair = 3
$delaySeconds = 0.5

Write-Host "GPT OpenAI Models Feud - Round Robin Tournament"
Write-Host "Models: $($modelsA.Count)"
Write-Host "Matches per pair: $matchesPerPair"
Write-Host "Total pairings: $([math]::Floor($modelsA.Count * ($modelsA.Count - 1) / 2))"
Write-Host "Total matches: $([math]::Floor($modelsA.Count * ($modelsA.Count - 1) / 2) * $matchesPerPair * 2)"

$jobCount = 0

for ($i = 0; $i -lt $modelsA.Count; $i++) {
    for ($j = $i + 1; $j -lt $modelsA.Count; $j++) {
        $modelA = $modelsA[$i]
        $modelB = $modelsA[$j]

        Write-Host "Queueing: $modelA vs $modelB ($matchesPerPair matches, both directions)"

        for ($match = 0; $match -lt $matchesPerPair; $match++) {
            $body1 = @{
                modelA = $modelA
                modelB = $modelB
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch", $body1 | Out-Null

            $body2 = @{
                modelA = $modelB
                modelB = $modelA
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch", $body2 | Out-Null

            $jobCount += 2
            Start-Sleep -Milliseconds ($delaySeconds * 1000)
        }
    }
}

Write-Host "Done! All $jobCount matches queued asynchronously!"
Write-Host "Games running in parallel on backend"
Write-Host "Completed games will be saved to external/SnakeBench/backend/completed_games/"

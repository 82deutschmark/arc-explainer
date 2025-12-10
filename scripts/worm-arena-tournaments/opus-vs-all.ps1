$modelA = "anthropic/claude-opus-4.5"

$haikuModel = "claude-haiku-4-5-20251015"

$gptModels = @(
    "openai/gpt-oss-120b",
    "openrouter/gpt-5.1-codex-mini",
    "openai/gpt-5.1",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini"
)

Write-Host "Claude Opus 4.5 Championship Match"
Write-Host "WARNING: EXTREMELY EXPENSIVE RUN"
Write-Host "Cost per match: $0.50 - $5.00+"
Write-Host ""

$jobCount = 0

Write-Host "Phase 1: Opus vs Haiku (3 matches)"
for ($i = 0; $i -lt 3; $i++) {
    $body = @{
        modelA = $modelA
        modelB = $haikuModel
        count = 1
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch", $body | Out-Null

    $jobCount++
    Start-Sleep -Milliseconds 500
}

Write-Host "Phase 2: Opus vs GPT Family (5 models, 3 matches each)"
foreach ($gptModel in $gptModels) {
    Write-Host "  Queueing: $modelA vs $gptModel (3 matches)"

    for ($i = 0; $i -lt 3; $i++) {
        $body = @{
            modelA = $modelA
            modelB = $gptModel
            count = 1
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $body)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
        } -ArgumentList "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch", $body | Out-Null

        $jobCount++
        Start-Sleep -Milliseconds 500
    }
}

Write-Host ""
Write-Host "Done! All $jobCount matches queued!"
Write-Host "Total matches: 3 (Haiku) + 15 (GPT family) = 18"
Write-Host "Estimated cost: $9 - $90"
Write-Host "Games running in parallel on backend"

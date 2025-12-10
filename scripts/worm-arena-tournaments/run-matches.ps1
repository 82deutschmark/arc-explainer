$modelA = "openai/gpt-5-nano"
$freeModels = @(
    "arcee-ai/trinity-mini:free",
    "amazon/nova-2-lite-v1:free",
    "kwaipilot/kat-coder-pro:free",
    "nvidia/nemotron-nano-9b-v2",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "moonshotai/kimi-dev-72b:free",
    "mistralai/ministral-14b-2512",
    "mistralai/ministral-8b-2512",
    "mistralai/ministral-3b-2512"
)

$jobCount = 0

foreach ($modelB in $freeModels) {
    Write-Host "Queuing match: $modelA vs $modelB" -ForegroundColor Cyan
    $body = @{
        modelA = $modelA
        modelB = $modelB
        count = 5
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
        param($uri, $body)
        Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
    } -ArgumentList "https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch", $body | Out-Null

    $jobCount++
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All $jobCount batches submitted asynchronously!" -ForegroundColor Green
Write-Host "Games running in parallel on backend"

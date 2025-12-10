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

foreach ($modelB in $freeModels) {
    Write-Host "Starting match: $modelA vs $modelB"
    $body = @{
        modelA = $modelA
        modelB = $modelB
        count = 5
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/snakebench/run-batch" -Method Post -Headers @{"Content-Type"="application/json"} -Body $body
    Write-Host "Response: $($response.StatusCode)" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

Write-Host "All batches submitted!" -ForegroundColor Green

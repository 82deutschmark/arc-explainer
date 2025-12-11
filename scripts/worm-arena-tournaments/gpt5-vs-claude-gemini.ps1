$gptModels = @(
    "openai/gpt-5-nano",
    "openai/gpt-5.2",
    "deepseek/deepseek-v3.2",
    "openai/gpt-5-mini",
    "openrouter/gpt-5.1-codex-mini"
)

$claudeModels = @(
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-haiku-4.5"
)

$geminiModel = "google/gemini-3-pro-preview",
"google/gemini-2.5-flash-preview-09-2025",
"google/gemini-2.5-flash-lite-preview-09-2025"

Write-Host "GPT-5 Family vs Claude Family vs Gemini 3 Tournament"

Write-Host ""

$jobCount = 0
$baseUri = "http://localhost:5000/api/snakebench/run-batch"

Write-Host "Phase 1: GPT-5 vs Claude Family"
foreach ($gptModel in $gptModels) {
    foreach ($claudeModel in $claudeModels) {
        Write-Host "Queueing: $gptModel vs $claudeModel (3 matches)"

        for ($i = 0; $i -lt 3; $i++) {
            $body = @{
                modelA = $gptModel
                modelB = $claudeModel
                count = 1
            } | ConvertTo-Json

            Start-Job -ScriptBlock {
                param($uri, $body)
                Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
            } -ArgumentList $baseUri, $body | Out-Null

            $jobCount++
            Start-Sleep -Milliseconds 500
        }
    }
}

Write-Host ""
Write-Host "Phase 2: GPT-5 vs Gemini 3"
foreach ($gptModel in $gptModels) {
    Write-Host "Queueing: $gptModel vs $geminiModel (3 matches)"

    for ($i = 0; $i -lt 3; $i++) {
        $body = @{
            modelA = $gptModel
            modelB = $geminiModel
            count = 1
        } | ConvertTo-Json

        Start-Job -ScriptBlock {
            param($uri, $body)
            Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null
        } -ArgumentList $baseUri, $body | Out-Null

        $jobCount++
        Start-Sleep -Milliseconds 500
    }
}

Write-Host ""
Write-Host "Done! All $jobCount matches queued!"
Write-Host "Games running in parallel on backend"

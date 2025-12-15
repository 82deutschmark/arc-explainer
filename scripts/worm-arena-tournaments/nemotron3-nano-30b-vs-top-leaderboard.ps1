# Worm Arena Tournament Script - Nemotron 3 Nano 30B A3B (free) vs selected top models + all DeepSeek models
# Author: Codex (GPT-5)
# Date: 2025-12-15
# PURPOSE: Queue matches against a targeted opponent set:
#          - GPT-5 Nano (OpenRouter)
#          - GPT-5 Mini (OpenRouter)
#          - Claude Haiku 4.5 (OpenRouter)
#          - All DeepSeek models available to Worm Arena via OpenRouter
#          This script uses the existing SnakeBench batch endpoint and does not wait for games to complete.

$apiBase = "http://localhost:5000"
$runBatchEndpoint = "$apiBase/api/snakebench/run-batch"
$modelsEndpoint = "$apiBase/api/models"
$openRouterModelsEndpoint = "$apiBase/api/models/provider/OpenRouter"

$challenger = "nvidia/nemotron-3-nano-30b-a3b:free"
$gamesPerPair = 5
$bothDirections = $true

Write-Host "Fetching models from: $modelsEndpoint" -ForegroundColor Cyan
$allModels = Invoke-RestMethod -Uri $modelsEndpoint -Method Get
if (-not $allModels) {
  throw "Failed to fetch models from $modelsEndpoint"
}

Write-Host "Fetching OpenRouter models from: $openRouterModelsEndpoint" -ForegroundColor Cyan
$openRouterModels = Invoke-RestMethod -Uri $openRouterModelsEndpoint -Method Get
if (-not $openRouterModels) {
  throw "Failed to fetch OpenRouter models from $openRouterModelsEndpoint"
}

function Get-ModelNameBySlug {
  param([string]$slug)
  $m = $allModels | Where-Object { $_.key -eq $slug } | Select-Object -First 1
  if ($m -and $m.name) { return [string]$m.name }
  return $slug
}

$explicitOpponents = @(
  "openai/gpt-5-nano",
  "openai/gpt-5-mini",
  "anthropic/claude-haiku-4.5"
)

$deepseekOpponents = @(
  $openRouterModels |
    Where-Object { $_.key -is [string] -and $_.key.ToLower().StartsWith("deepseek/") } |
    ForEach-Object { $_.key }
)

$opponents = @(
  $explicitOpponents +
  $deepseekOpponents
) | Where-Object { $_ -and $_ -ne $challenger } | Sort-Object -Unique

if ($opponents.Count -eq 0) {
  throw "No opponents resolved. Is your dev server running and returning OpenRouter models?"
}

Write-Host ""
Write-Host "Opponents to challenge (slug -> name):" -ForegroundColor Cyan
$opponents | ForEach-Object {
  $slug = $_
  $name = Get-ModelNameBySlug -slug $slug
  Write-Host "  $slug -> $name"
}
Write-Host ""

Write-Host "Queuing matches via: $runBatchEndpoint" -ForegroundColor Cyan
Write-Host "Challenger: $challenger" -ForegroundColor Cyan
Write-Host "Opponents: $($opponents -join ', ')" -ForegroundColor Cyan
Write-Host "Games per pairing: $gamesPerPair" -ForegroundColor Cyan
Write-Host "Both directions: $bothDirections" -ForegroundColor Cyan

$batchesSubmitted = 0

foreach ($opponent in $opponents) {
  $pairs = @(@($challenger, $opponent))
  if ($bothDirections) {
    $pairs += @(@($opponent, $challenger))
  }

  foreach ($pair in $pairs) {
    $modelA = $pair[0]
    $modelB = $pair[1]

    Write-Host "Queuing: $modelA vs $modelB" -ForegroundColor Cyan
    $body = @{
      modelA = $modelA
      modelB = $modelB
      count  = $gamesPerPair
    } | ConvertTo-Json

    Start-Job -ScriptBlock {
      param($uri, $bodyJson)
      Invoke-WebRequest -Uri $uri -Method Post -Headers @{"Content-Type"="application/json"} -Body $bodyJson | Out-Null
    } -ArgumentList $runBatchEndpoint, $body | Out-Null

    $batchesSubmitted++
    Start-Sleep -Milliseconds 500
  }
}

Write-Host ""
Write-Host "Submitted $batchesSubmitted batches. Matches are running on the backend." -ForegroundColor Green
Write-Host "Tip: use /worm-arena/stats or /worm-arena/matches to monitor progress." -ForegroundColor Green

# Grover E2E Test Script
# Author: Sonnet 4.5
# Date: 2025-10-09
# Purpose: Test Grover iterative solver end-to-end

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Grover E2E Test - Puzzle 342dd610" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if server is running
Write-Host "[TEST 1] Checking if server is running..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is NOT running. Start with: npm run test" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Send Grover analysis request
Write-Host "[TEST 2] Sending Grover analysis request..." -ForegroundColor Yellow
Write-Host "Endpoint: POST /api/puzzle/grover/342dd610/grover-gpt-5-nano" -ForegroundColor Gray
Write-Host "Body: {temperature: 0.2, maxIterations: 3}" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/puzzle/grover/342dd610/grover-gpt-5-nano" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"temperature": 0.2, "maxIterations": 3}' `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    $jsonResponse = $response.Content | ConvertFrom-Json
    
    if ($jsonResponse.success) {
        Write-Host "✅ Request accepted" -ForegroundColor Green
        Write-Host "   Session ID: $($jsonResponse.data.sessionId)" -ForegroundColor Gray
        Write-Host "   Message: $($jsonResponse.data.message)" -ForegroundColor Gray
        $sessionId = $jsonResponse.data.sessionId
    } else {
        Write-Host "❌ Request failed: $($jsonResponse.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Full error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Wait for analysis to complete
Write-Host "[TEST 3] Waiting for analysis to complete (60 seconds)..." -ForegroundColor Yellow
Write-Host "   Watch server console for:" -ForegroundColor Gray
Write-Host "   - [Grover] Starting analysis" -ForegroundColor Gray
Write-Host "   - [Grover] Iteration N/3" -ForegroundColor Gray
Write-Host "   - [Grover] Found program" -ForegroundColor Gray
Write-Host "   - [Grover] Extracted N programs" -ForegroundColor Gray
Write-Host "   - [Grover] Analysis complete and saved" -ForegroundColor Gray

Start-Sleep -Seconds 60
Write-Host "✅ Wait complete" -ForegroundColor Green
Write-Host ""

# Test 4: Check database for results
Write-Host "[TEST 4] Checking database for saved results..." -ForegroundColor Yellow
Write-Host "   Puzzle: 342dd610" -ForegroundColor Gray
Write-Host "   Model: grover-gpt-5-nano" -ForegroundColor Gray

# Note: This would need psql or database connection
Write-Host "⚠️  Manual check required:" -ForegroundColor Yellow
Write-Host '   SELECT id, puzzle_id, model_name, iteration_count, ' -ForegroundColor Gray
Write-Host '          jsonb_array_length(grover_iterations) as iter_count,' -ForegroundColor Gray
Write-Host '          length(grover_best_program) as program_length' -ForegroundColor Gray
Write-Host '   FROM explanations ' -ForegroundColor Gray
Write-Host "   WHERE puzzle_id='342dd610' AND model_name LIKE 'grover%'" -ForegroundColor Gray
Write-Host '   ORDER BY created_at DESC LIMIT 1;' -ForegroundColor Gray
Write-Host ""

# Test 5: Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Server health check passed" -ForegroundColor Green
Write-Host "✅ API request accepted" -ForegroundColor Green
Write-Host "⏳ Analysis running (check server logs)" -ForegroundColor Yellow
Write-Host "⚠️  Database verification pending" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Check server console for completion message" -ForegroundColor White
Write-Host "2. Navigate to: http://localhost:3000/puzzle/342dd610" -ForegroundColor White
Write-Host "3. Click '🔄 Grover Solver' button to view results" -ForegroundColor White
Write-Host "4. Verify iteration history displays correctly" -ForegroundColor White
Write-Host ""

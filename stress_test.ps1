
# StayEaze API Stress Test — Uses .NET HttpClient + Tasks for true concurrency
# Compatible with any PowerShell 5.1+ session

param(
    [int]$ConcurrentRequests = 10,
    [int]$RequestsPerEndpoint = 30,
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$Email = "testproperty01@gmail.com",
    [string]$Password = "Friend@2010"
)

Add-Type -AssemblyName System.Net.Http

# ─── Login ───────────────────────────────────────────────────────────────────
Write-Host "`n  Authenticating..." -ForegroundColor Cyan
$loginBody = "{`"email`":`"$Email`",`"password`":`"$Password`"}"
$wc = New-Object System.Net.WebClient
$wc.Headers["Content-Type"] = "application/json"
try {
    $rawResp = $wc.UploadString("$BaseUrl/auth/login", $loginBody)
    $parsed  = $rawResp | ConvertFrom-Json
    $token   = $parsed.accessToken
    Write-Host "  Login OK — token obtained`n" -ForegroundColor Green
} catch {
    Write-Host "  Login FAILED: $_" -ForegroundColor Red
    exit 1
}

# ─── Endpoint list ───────────────────────────────────────────────────────────
$endpoints = @(
    "GET|/tenants?page=1&pageSize=10",
    "GET|/tenants/minimal",
    "GET|/properties?page=1&pageSize=10",
    "GET|/properties/minimal",
    "GET|/buildings?page=1&pageSize=10",
    "GET|/floors?page=1&pageSize=10",
    "GET|/rooms?page=1&pageSize=10",
    "GET|/beds?page=1&pageSize=10",
    "GET|/bookings?page=1&pageSize=10",
    "GET|/check-ins?page=1&pageSize=10",
    "GET|/check-outs?page=1&pageSize=10",
    "GET|/invoices?page=1&pageSize=10",
    "GET|/payments?page=1&pageSize=10",
    "GET|/complaints?page=1&pageSize=10",
    "GET|/maintenance?page=1&pageSize=10",
    "GET|/users?page=1&pageSize=10",
    "GET|/roles?page=1&pageSize=10",
    "GET|/audit-logs?page=1&pageSize=10",
    "GET|/visitors?page=1&pageSize=10",
    "GET|/system-configs",
    "GET|/organization-billing-profile",
    "GET|/super-admin/settings"
)

Write-Host ("  {0,-33} {1,6} {2,8} {3,8} {4,8} {5,8} {6,8} {7,8} {8,8}" -f `
    "Endpoint","Reqs","Err%","Min ms","Avg ms","P50 ms","P95 ms","P99 ms","RPS") -ForegroundColor White
Write-Host ("  " + ("-" * 92)) -ForegroundColor DarkGray

$allResults = @()
$globalStart = [System.Diagnostics.Stopwatch]::StartNew()

foreach ($ep in $endpoints) {
    $parts  = $ep.Split("|")
    $method = $parts[0]
    $path   = $parts[1]
    $label  = "$method $path".Split("?")[0]
    $url    = $BaseUrl + $path

    # Build shared HttpClient handler
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.ServerCertificateCustomValidationCallback = $null
    $client  = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [System.TimeSpan]::FromSeconds(20)
    $client.DefaultRequestHeaders.Authorization = `
        New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
    $client.DefaultRequestHeaders.Add("X-Stress-Test", "true")

    $timings  = [System.Collections.Generic.List[double]]::new()
    $errCount = 0
    $okCount  = 0

    $script:firstErr = $null
    # Run in batches of $ConcurrentRequests
    $remaining = $RequestsPerEndpoint
    while ($remaining -gt 0) {
        $batch = [Math]::Min($ConcurrentRequests, $remaining)
        $remaining -= $batch

        # Build async tasks
        $tasks = for ($i = 0; $i -lt $batch; $i++) {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            $task = $client.GetAsync($url)
            [PSCustomObject]@{ Task = $task; SW = $sw }
        }

        # Wait for all tasks in batch
        foreach ($t in $tasks) {
            try {
                $resp = $t.Task.GetAwaiter().GetResult()
                $t.SW.Stop()
                $timings.Add($t.SW.Elapsed.TotalMilliseconds)
                $statusCode = [int]$resp.StatusCode
                if ($statusCode -ge 200 -and $statusCode -lt 400) {
                    $okCount++
                } else {
                    $errCount++
                    if (-not $script:firstErr) { $script:firstErr = "$statusCode $($resp.ReasonPhrase)" }
                }
                $resp.Dispose()
            } catch {
                $t.SW.Stop()
                $timings.Add($t.SW.Elapsed.TotalMilliseconds)
                $errCount++
                if (-not $script:firstErr) { $script:firstErr = $_.Exception.Message }
            }
        }

    }

    $client.Dispose()

    $sorted   = ($timings.ToArray() | Sort-Object)
    $total    = $sorted.Count
    $avg      = [Math]::Round(($sorted | Measure-Object -Average).Average, 1)
    $minMs    = [Math]::Round($sorted[0], 1)
    $maxMs    = [Math]::Round($sorted[-1], 1)
    $p50      = [Math]::Round($sorted[[Math]::Min($total-1, [Math]::Floor($total*0.50))], 1)
    $p95      = [Math]::Round($sorted[[Math]::Min($total-1, [Math]::Floor($total*0.95))], 1)
    $p99      = [Math]::Round($sorted[[Math]::Min($total-1, [Math]::Floor($total*0.99))], 1)
    $totalMs  = ($timings | Measure-Object -Sum).Sum
    $rps      = if ($totalMs -gt 0) { [Math]::Round(($total / ($totalMs / 1000.0)), 1) } else { 0 }
    $errPct   = [Math]::Round(($errCount / [Math]::Max(1,$total)) * 100, 1)

    $icon = if ($errPct -eq 0 -and $avg -lt 600) { "OK" }
            elseif ($errPct -lt 5 -and $avg -lt 2000) { "WARN" }
            else { "FAIL" }

    $color = switch ($icon) { "OK" { "Green" } "WARN" { "Yellow" } "FAIL" { "Red" } }

    $errMsg = if ($script:firstErr) { " [$($script:firstErr)]" } else { "" }
    Write-Host ("  {0,-33} {1,6} {2,7}% {3,7} {4,7} {5,7} {6,7} {7,7} {8,8}{9}" -f `
        $label.PadRight(33).Substring(0,33), $total, $errPct, $minMs, $avg, $p50, $p95, $p99, $rps, $errMsg) `
        -ForegroundColor $color

    $allResults += [PSCustomObject]@{
        Endpoint = $label; Total=$total; OK=$okCount; Errors=$errCount
        ErrPct=$errPct; MinMs=$minMs; AvgMs=$avg; P50Ms=$p50; P95Ms=$p95; P99Ms=$p99; MaxMs=$maxMs; RPS=$rps
    }
}

$globalStart.Stop()
$wallSec   = [Math]::Round($globalStart.Elapsed.TotalSeconds, 1)
$totReqs   = ($allResults | Measure-Object -Property Total -Sum).Sum
$totErrs   = ($allResults | Measure-Object -Property Errors -Sum).Sum
$avgAll    = [Math]::Round(($allResults | Measure-Object -Property AvgMs -Average).Average, 1)
$overallRps= [Math]::Round($totReqs / $wallSec, 1)
$errPctAll = [Math]::Round(($totErrs/$totReqs)*100, 2)

Write-Host "`n  ═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  SUMMARY" -ForegroundColor White
Write-Host "  ═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  Total Requests  : $totReqs over $wallSec seconds" -ForegroundColor White
Write-Host "  Total Errors    : $totErrs ($errPctAll%)" -ForegroundColor $(if ($errPctAll -lt 1) {"Green"} elseif ($errPctAll -lt 5) {"Yellow"} else {"Red"})
Write-Host "  Avg Response    : $avgAll ms" -ForegroundColor White
Write-Host "  Overall RPS     : $overallRps req/s" -ForegroundColor White

Write-Host "`n  TOP 5 SLOWEST (P95):" -ForegroundColor Yellow
$allResults | Sort-Object P95Ms -Descending | Select-Object -First 5 | ForEach-Object {
    Write-Host ("    {0,-33} P95={1}ms  Avg={2}ms  Err={3}%" -f $_.Endpoint, $_.P95Ms, $_.AvgMs, $_.ErrPct) -ForegroundColor DarkYellow
}

Write-Host "`n  TOP 5 FASTEST (Avg):" -ForegroundColor Cyan
$allResults | Sort-Object AvgMs | Select-Object -First 5 | ForEach-Object {
    Write-Host ("    {0,-33} Avg={1}ms  P95={2}ms  RPS={3}" -f $_.Endpoint, $_.AvgMs, $_.P95Ms, $_.RPS) -ForegroundColor DarkCyan
}

$withErr = $allResults | Where-Object { $_.Errors -gt 0 }
if ($withErr) {
    Write-Host "`n  ENDPOINTS WITH ERRORS:" -ForegroundColor Red
    $withErr | ForEach-Object { Write-Host "    FAIL $($_.Endpoint) — $($_.Errors) errors ($($_.ErrPct)%)" -ForegroundColor Red }
} else {
    Write-Host "`n  Zero errors across all $($allResults.Count) endpoints!" -ForegroundColor Green
}

# Save CSV
$csvPath = "c:\Users\gandh\OneDrive\Desktop\StayEaze\stress_test_results.csv"
$allResults | Export-Csv -Path $csvPath -NoTypeInformation
Write-Host "`n  Results saved to: $csvPath" -ForegroundColor DarkGray
Write-Host ""

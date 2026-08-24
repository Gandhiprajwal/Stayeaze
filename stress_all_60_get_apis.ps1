# StayEaze Comprehensive GET APIs Stress Test
# Dynamically routes Super Admin & Admin JWT tokens to appropriate endpoints

param(
    [int]$Concurrency = 200,
    [int]$TotalRequestsPerEndpoint = 1000,
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$SuperAdminEmail = "superadmin@stayeaze.com",
    [string]$AdminEmail = "testowner1@gmail.com",
    [string]$Password = "Friend@2010"
)

Add-Type -AssemblyName System.Net.Http

# Set ServicePointManager connection limits for 5,000 outbound TCP sockets
[System.Net.ServicePointManager]::DefaultConnectionLimit = 5000
[System.Net.ServicePointManager]::Expect100Continue = $false

Write-Host "`n🔐 Authenticating Super Admin & Property Admin Accounts..." -ForegroundColor Cyan

# 1. Super Admin Authentication
$superAdminBody = "{`"email`":`"$SuperAdminEmail`",`"password`":`"$Password`"}"
$wc = New-Object System.Net.WebClient
$wc.Headers["Content-Type"] = "application/json"
try {
    $rawResp = $wc.UploadString("$BaseUrl/auth/login", $superAdminBody)
    $respObj = $rawResp | ConvertFrom-Json
    $superAdminToken = if ($respObj.token) { $respObj.token } else { $respObj.accessToken }
    Write-Host "✅ Super Admin Authentication Successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Super Admin Auth failed: $_" -ForegroundColor Red
    exit 1
}

# 2. Property Admin/Owner Authentication
$adminBody = "{`"email`":`"$AdminEmail`",`"password`":`"$Password`"}"
try {
    $rawResp = $wc.UploadString("$BaseUrl/auth/login", $adminBody)
    $respObj = $rawResp | ConvertFrom-Json
    $adminToken = if ($respObj.token) { $respObj.token } else { $respObj.accessToken }
    Write-Host "✅ Property Admin Authentication Successful`n" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Property Admin Auth warning: $_ — Using Super Admin token fallback" -ForegroundColor Yellow
    $adminToken = $superAdminToken
}

# Full List of GET API Endpoints mapped to required Auth Role
$allGetEndpoints = @(
    # --- Property Admin Operational APIs ---
    "ADMIN|GET|/tenants?page=1&pageSize=10",
    "ADMIN|GET|/tenants/minimal",
    "ADMIN|GET|/properties?page=1&pageSize=10",
    "ADMIN|GET|/properties/minimal",
    "ADMIN|GET|/buildings?page=1&pageSize=10",
    "ADMIN|GET|/floors?page=1&pageSize=10",
    "ADMIN|GET|/rooms?page=1&pageSize=10",
    "ADMIN|GET|/beds?page=1&pageSize=10",
    "ADMIN|GET|/check-ins?page=1&pageSize=10",
    "ADMIN|GET|/check-outs?page=1&pageSize=10",
    "ADMIN|GET|/bookings?page=1&pageSize=10",
    "ADMIN|GET|/invoices?page=1&pageSize=10",
    "ADMIN|GET|/payments",
    "ADMIN|GET|/complaints?page=1&pageSize=10",
    "ADMIN|GET|/maintenance?page=1&pageSize=10",
    "ADMIN|GET|/visitors",
    "ADMIN|GET|/agreements?page=1&pageSize=10",
    "ADMIN|GET|/inquiries?page=1&pageSize=10",
    "ADMIN|GET|/parcels?page=1&pageSize=10",
    "ADMIN|GET|/meter-readings?page=1&pageSize=10",
    "ADMIN|GET|/safety-incidents?page=1&pageSize=10",
    "ADMIN|GET|/users?page=1&pageSize=10",
    "ADMIN|GET|/users/me",
    "ADMIN|GET|/roles",
    "ADMIN|GET|/subscription/my-subscription",
    "ADMIN|GET|/subscription/plans",
    "ADMIN|GET|/audit-logs?page=1&pageSize=10",
    "ADMIN|GET|/notification-logs?page=1&pageSize=10",
    "ADMIN|GET|/checkin-checklists?page=1&pageSize=10",
    "ADMIN|GET|/checkout-audits?page=1&pageSize=10",
    "ADMIN|GET|/penalties-discounts?page=1&pageSize=10",
    "ADMIN|GET|/billing-plans?page=1&pageSize=10",

    # --- Super Admin Management APIs ---
    "SUPER_ADMIN|GET|/super-admin/subscribers",
    "SUPER_ADMIN|GET|/super-admin/plans",
    "SUPER_ADMIN|GET|/super-admin/api-metrics",
    "SUPER_ADMIN|GET|/super-admin/settings",
    "SUPER_ADMIN|GET|/super-admin/system-logs",
    "SUPER_ADMIN|GET|/system/metrics",
    "SUPER_ADMIN|GET|/system-configs",
    "SUPER_ADMIN|GET|/organizations"
)

Write-Host "══════════════════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  StayEaze STRESS TEST — ALL GET APIs (SUPER ADMIN & PROPERTY ADMIN ROLE-BASED SUITE)" -ForegroundColor White
Write-Host "  Concurrency: $Concurrency Threads | Reqs/EP: $TotalRequestsPerEndpoint | Total Reqs: 40,000+" -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor DarkGray

Write-Host ("  {0,-13} {1,-36} {2,6} {3,6} {4,6} {5,7}% {6,8} {7,8} {8,8}" -f `
    "Role Auth","GET API Endpoint","Total","OK","Err","Err%","Avg ms","P95 ms","RPS") -ForegroundColor White
Write-Host ("  " + ("-" * 100)) -ForegroundColor DarkGray

$scaleResults = @()
$globalSW = [System.Diagnostics.Stopwatch]::StartNew()

foreach ($item in $allGetEndpoints) {
    $parts    = $item.Split("|")
    $roleReq  = $parts[0]
    $method   = $parts[1]
    $path     = $parts[2]
    $label    = "$method $path".Split("?")[0]
    $url      = $BaseUrl + $path

    $activeToken = if ($roleReq -eq "SUPER_ADMIN") { $superAdminToken } else { $adminToken }

    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.MaxConnectionsPerServer = 5000
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [System.TimeSpan]::FromSeconds(30)
    $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $activeToken)
    $client.DefaultRequestHeaders.Add("X-Stress-Test", "true")

    $timings  = [System.Collections.Generic.List[double]]::new()
    $okCount  = 0
    $errCount = 0

    $swBatch = [System.Diagnostics.Stopwatch]::StartNew()
    $batches = [Math]::Ceiling($TotalRequestsPerEndpoint / $Concurrency)

    for ($b = 0; $b -lt $batches; $b++) {
        $tasks = for ($i = 0; $i -lt $Concurrency; $i++) {
            $reqSW = [System.Diagnostics.Stopwatch]::StartNew()
            $t = $client.GetAsync($url)
            [PSCustomObject]@{ Task = $t; SW = $reqSW }
        }

        foreach ($t in $tasks) {
            try {
                $resp = $t.Task.GetAwaiter().GetResult()
                $t.SW.Stop()
                $timings.Add($t.SW.Elapsed.TotalMilliseconds)
                if ([int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 400) {
                    $okCount++
                } else {
                    $errCount++
                }
                $resp.Dispose()
            } catch {
                $t.SW.Stop()
                $timings.Add($t.SW.Elapsed.TotalMilliseconds)
                $errCount++
            }
        }
    }

    $swBatch.Stop()
    $client.Dispose()

    $sorted   = ($timings.ToArray() | Sort-Object)
    $total    = $sorted.Count
    $avg      = if ($total -gt 0) { [Math]::Round(($sorted | Measure-Object -Average).Average, 1) } else { 0 }
    $minMs    = if ($total -gt 0) { [Math]::Round($sorted[0], 1) } else { 0 }
    $p95      = if ($total -gt 0) { [Math]::Round($sorted[[Math]::Min($total-1, [Math]::Floor($total*0.95))], 1) } else { 0 }
    $rps      = if ($swBatch.Elapsed.TotalSeconds -gt 0) { [Math]::Round($total / $swBatch.Elapsed.TotalSeconds, 1) } else { 0 }
    $errPct   = [Math]::Round(($errCount / [Math]::Max(1,$total)) * 100, 1)

    $color = if ($errPct -eq 0) { "Green" } elseif ($errPct -lt 5) { "Yellow" } else { "Red" }

    Write-Host ("  {0,-13} {1,-36} {2,6} {3,6} {4,6} {5,6}% {6,8} {7,8} {8,8}" -f `
        $roleReq, $label.PadRight(36).Substring(0,36), $total, $okCount, $errCount, $errPct, $avg, $p95, $rps) `
        -ForegroundColor $color

    $scaleResults += [PSCustomObject]@{
        Role = $roleReq; Endpoint = $label; Total=$total; OK=$okCount; Errors=$errCount
        ErrPct=$errPct; MinMs=$minMs; AvgMs=$avg; P95Ms=$p95; RPS=$rps
    }
}

$globalSW.Stop()

$totReqs = ($scaleResults | Measure-Object -Property Total -Sum).Sum
$totErrs = ($scaleResults | Measure-Object -Property Errors -Sum).Sum
$overallErrPct = [Math]::Round(($totErrs / $totReqs) * 100, 2)
$overallAvg = [Math]::Round(($scaleResults | Measure-Object -Property AvgMs -Average).Average, 1)
$overallRps = [Math]::Round($totReqs / $globalSW.Elapsed.TotalSeconds, 1)

Write-Host "`n  ══════════════════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  COMPLETE GET APIs ROLE-BASED STRESS TEST SUMMARY" -ForegroundColor White
Write-Host "  ══════════════════════════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  Total Requests Fired : $totReqs ($TotalRequestsPerEndpoint per GET endpoint)" -ForegroundColor White
Write-Host "  Wall Clock Time      : $([Math]::Round($globalSW.Elapsed.TotalSeconds, 2)) seconds" -ForegroundColor White
Write-Host "  Total Errors         : $totErrs ($overallErrPct%)" -ForegroundColor $(if ($overallErrPct -lt 1) {"Green"} elseif ($overallErrPct -lt 5) {"Yellow"} else {"Red"})
Write-Host "  Average Response     : $overallAvg ms" -ForegroundColor White
Write-Host "  Peak Throughput      : $overallRps req/sec" -ForegroundColor White
Write-Host "  ══════════════════════════════════════════════════════════════════════════════════════════════`n" -ForegroundColor DarkGray

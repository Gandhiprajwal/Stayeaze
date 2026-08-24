# ==============================================================================
# StayEaze Super-Admin Automated Production API Verification & Health Suite
# ==============================================================================
param (
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "superadmin@stayeaze.com",
    [string]$Password = "Friend@2010"
)

$ErrorActionPreference = "Continue"
$script:TotalTests = 0
$script:Passed = 0
$script:Failed = 0

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " 🚀 StayEaze Super-Admin Live API Verification Suite " -ForegroundColor Yellow
Write-Host " Target URL: $BaseUrl" -ForegroundColor Gray
Write-Host " Admin User: $Email" -ForegroundColor Gray
Write-Host "========================================================`n" -ForegroundColor Cyan

function Test-Endpoint {
    param (
        [string]$Name,
        [string]$Method = "GET",
        [string]$Path,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [int]$ExpectedStatus = 200
    )

    $script:TotalTests++
    $Uri = "$BaseUrl$Path"
    $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $Params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
            ErrorAction = "Stop"
        }
        if ($Body) {
            $Params["Body"] = $Body
        }

        $Response = Invoke-RestMethod @Params
        $Stopwatch.Stop()

        Write-Host " [PASS] " -ForegroundColor Green -NoNewline
        Write-Host "$Name " -ForegroundColor White -NoNewline
        Write-Host "($($Stopwatch.ElapsedMilliseconds)ms) - $Method $Path" -ForegroundColor DarkGray
        $script:Passed++
        return $Response
    }
    catch {
        $Stopwatch.Stop()
        $StatusCode = $_.Exception.Response.StatusCode.value__
        if ($StatusCode -eq $ExpectedStatus) {
            Write-Host " [PASS] " -ForegroundColor Green -NoNewline
            Write-Host "$Name " -ForegroundColor White -NoNewline
            Write-Host "(Status $StatusCode as expected) - $Method $Path" -ForegroundColor DarkGray
            $script:Passed++
            return $null
        } else {
            Write-Host " [FAIL] " -ForegroundColor Red -NoNewline
            Write-Host "$Name " -ForegroundColor White -NoNewline
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:Failed++
            return $null
        }
    }
}

# 1. Authenticate & Obtain JWT Token
Write-Host "🔹 Phase 1: Authentication & Token Issuance" -ForegroundColor Cyan
$LoginPayload = @{
    email = $Email
    password = $Password
} | ConvertTo-Json

$LoginRes = Test-Endpoint -Name "Super Admin Login" -Method "POST" -Path "/api/v1/auth/login" -Body $LoginPayload

$Token = $null
if ($LoginRes.requires2FA) {
    Write-Host "  -> 2FA Required. Completing OTP verification..." -ForegroundColor Yellow
    $OtpCode = if ($LoginRes.otpDev) { $LoginRes.otpDev } else { "123456" }
    $Verify2faPayload = @{
        email = $Email
        otp = $OtpCode
    } | ConvertTo-Json
    $OtpRes = Test-Endpoint -Name "Verify 2FA OTP" -Method "POST" -Path "/api/v1/auth/verify-2fa" -Body $Verify2faPayload
    $Token = if ($OtpRes.accessToken) { $OtpRes.accessToken } else { $OtpRes.token }
} else {
    $Token = if ($LoginRes.accessToken) { $LoginRes.accessToken } else { $LoginRes.token }
}

if (-not $Token) {
    Write-Host "`n❌ Could not acquire Super Admin JWT Token. Aborting subsequent tests." -ForegroundColor Red
    exit 1
}

$AuthHeaders = @{
    "Authorization" = "Bearer $Token"
}

Write-Host "`n🔹 Phase 2: Platform SaaS Governance & Subscriber Intelligence" -ForegroundColor Cyan
$Subscribers = Test-Endpoint -Name "List SaaS Subscribers" -Method "GET" -Path "/api/v1/super-admin/subscribers?page=1&pageSize=10" -Headers $AuthHeaders

if ($Subscribers -and $Subscribers.data -and $Subscribers.data.Count -gt 0) {
    $OrgId = $Subscribers.data[0].id
    Test-Endpoint -Name "Subscriber Organization Dossier" -Method "GET" -Path "/api/v1/super-admin/subscribers/$OrgId/overview" -Headers $AuthHeaders
    Test-Endpoint -Name "Export Single Subscriber JSON" -Method "GET" -Path "/api/v1/super-admin/subscribers/$OrgId/export" -Headers $AuthHeaders
    Test-Endpoint -Name "Support Impersonation Token" -Method "POST" -Path "/api/v1/super-admin/subscribers/$OrgId/impersonate" -Headers $AuthHeaders
}

Write-Host "`n🔹 Phase 3: SaaS Plans & Enterprise Multi-Tenant Quotas" -ForegroundColor Cyan
Test-Endpoint -Name "Fetch SaaS Tier Catalog" -Method "GET" -Path "/api/v1/super-admin/plans" -Headers $AuthHeaders

Write-Host "`n🔹 Phase 4: B2B Invoicing & GST Financial Compliance" -ForegroundColor Cyan
Test-Endpoint -Name "Fetch Subscription Invoices" -Method "GET" -Path "/api/v1/super-admin/invoices?page=1&pageSize=10" -Headers $AuthHeaders

Write-Host "`n🔹 Phase 5: Live Telemetry, API Metrics & System Operations" -ForegroundColor Cyan
Test-Endpoint -Name "System Resource Telemetry (JVM/DB/Services)" -Method "GET" -Path "/api/v1/system/metrics" -Headers $AuthHeaders
Test-Endpoint -Name "API Hit Metrics Snapshot" -Method "GET" -Path "/api/v1/super-admin/api-metrics" -Headers $AuthHeaders
Test-Endpoint -Name "Master Cloud Integration Settings" -Method "GET" -Path "/api/v1/super-admin/settings" -Headers $AuthHeaders
Test-Endpoint -Name "Platform Security Sessions" -Method "GET" -Path "/api/v1/super-admin/sessions" -Headers $AuthHeaders
Test-Endpoint -Name "System-Wide DB Snapshot" -Method "GET" -Path "/api/v1/super-admin/backup/export-system" -Headers $AuthHeaders
Test-Endpoint -Name "System Console Logs Stream" -Method "GET" -Path "/api/v1/super-admin/system-logs?limit=20" -Headers $AuthHeaders
Test-Endpoint -Name "Flush Application Caches" -Method "POST" -Path "/api/v1/super-admin/clear-cache" -Headers $AuthHeaders

# Summary Report
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " 📊 Production Verification Results Summary" -ForegroundColor Yellow
Write-Host " Total Endpoints Tested: $script:TotalTests" -ForegroundColor White
Write-Host " Passed: $script:Passed" -ForegroundColor Green
Write-Host " Failed: $script:Failed" -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Red" })
Write-Host "========================================================`n" -ForegroundColor Cyan

if ($script:Failed -gt 0) {
    exit 1
} else {
    exit 0
}

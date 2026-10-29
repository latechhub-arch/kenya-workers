param(
  [string]$Api = "https://kenya-workers.onrender.com",
  [string]$NationalHqOrganizationId = "0b07fc45-a484-46b8-a527-f0dc69f29b08"
)

$ErrorActionPreference = "Stop"
$adminEmail = Read-Host "Administrator email"
$passwordSecure = Read-Host "Administrator password" -AsSecureString
$password = [Net.NetworkCredential]::new("", $passwordSecure).Password

try {
  $loginBody = @{ email = $adminEmail; password = $password } | ConvertTo-Json
  $session = Invoke-RestMethod -Uri "$Api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
  $headers = @{ Authorization = "Bearer $($session.accessToken)" }

  $stamp = Get-Date -Format "yyyyMMddHHmmss"
  $personBody = @{
    organizationId = $NationalHqOrganizationId
    personNumber = "DEMO-RETIREE-$stamp"
    firstName = "Miriam"
    middleName = "Achieng"
    lastName = "Demo Retiree"
    dateOfBirth = "1965-01-01"
  } | ConvertTo-Json
  $person = Invoke-RestMethod -Uri "$Api/persons" -Method Post -Headers $headers -ContentType "application/json" -Body $personBody

  $employmentBody = @{
    employmentNumber = "EMP-DEMO-RETIREE-$stamp"
    personId = $person.id
    organizationId = $NationalHqOrganizationId
    employmentType = "PERMANENT"
    startDate = "1995-01-01"
  } | ConvertTo-Json
  $employment = Invoke-RestMethod -Uri "$Api/employments" -Method Post -Headers $headers -ContentType "application/json" -Body $employmentBody

  $retirementDate = "2025-12-31"
  $null = Invoke-RestMethod -Uri "$Api/employments/$($employment.id)/status" -Method Patch -Headers $headers -ContentType "application/json" -Body (@{ status = "RETIRED"; effectiveDate = $retirementDate } | ConvertTo-Json)

  $schemesResponse = Invoke-RestMethod -Uri "$Api/pensions/schemes" -Headers $headers
  $schemes = @($schemesResponse)
  if ($schemes.Count -eq 1 -and $schemes[0] -is [array]) { $schemes = $schemes[0] }
  $scheme = $schemes | Where-Object { $_.code -eq "DEMO-PUBLIC-SERVICE-LEGACY" -and $_.organizationId -eq $NationalHqOrganizationId } | Select-Object -First 1
  if (-not $scheme) {
    $schemeBody = @{
      organizationId = $NationalHqOrganizationId
      code = "DEMO-PUBLIC-SERVICE-LEGACY"
      name = "Synthetic Public Service Legacy Pension Demo"
      schemeType = "PUBLIC_SERVICE_LEGACY"
      eligibilityPolicy = "Synthetic presentation case. Confirm scheme membership and all service/pay facts with the competent authority."
      officialSource = "https://www.psss.go.ke/sites/default/files/PSSS%20Downloads/Public-Service-Superannuation-Scheme-HandBook.pdf"
      requiredEvidenceTypes = @()
    } | ConvertTo-Json -Depth 5
    $scheme = Invoke-RestMethod -Uri "$Api/pensions/schemes" -Method Post -Headers $headers -ContentType "application/json" -Body $schemeBody
  }

  $caseBody = @{
    employmentId = $employment.id
    schemeId = $scheme.id
    retirementDate = $retirementDate
    qualifyingServiceYears = 31
    currency = "KES"
    caseReference = "DEMO-PENSION-$stamp"
  } | ConvertTo-Json
  $pensionCase = Invoke-RestMethod -Uri "$Api/pensions/cases" -Method Post -Headers $headers -ContentType "application/json" -Body $caseBody

  foreach ($evidenceType in @("RETIREMENT_NOTICE", "SERVICE_RECORD")) {
    $evidenceBody = @{ evidenceType = $evidenceType; documentReference = "SYNTHETIC-DEMO-$stamp-$evidenceType" } | ConvertTo-Json
    $evidence = Invoke-RestMethod -Uri "$Api/pensions/cases/$($pensionCase.id)/evidence" -Method Post -Headers $headers -ContentType "application/json" -Body $evidenceBody
    $reviewBody = @{ decision = "VERIFIED"; notes = "Synthetic presentation reference; no real document was reviewed." } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "$Api/pensions/cases/$($pensionCase.id)/evidence/$($evidence.id)/review" -Method Post -Headers $headers -ContentType "application/json" -Body $reviewBody
  }

  $null = Invoke-RestMethod -Uri "$Api/pensions/cases/$($pensionCase.id)/submit" -Method Post -Headers $headers -ContentType "application/json" -Body "{}"
  $null = Invoke-RestMethod -Uri "$Api/pensions/cases/$($pensionCase.id)/review" -Method Post -Headers $headers -ContentType "application/json" -Body (@{ notes = "Synthetic presentation workflow." } | ConvertTo-Json)

  $estimateBody = @{
    serviceMonths = 372
    finalAnnualPensionableEmoluments = 1200000
    commutedFraction = 0.25
  } | ConvertTo-Json
  $result = Invoke-RestMethod -Uri "$Api/pensions/cases/$($pensionCase.id)/legacy-estimate" -Method Post -Headers $headers -ContentType "application/json" -Body $estimateBody

  Write-Host "Synthetic retired employee and pension case created."
  Write-Host "Employee: $($person.firstName) $($person.middleName) $($person.lastName)"
  Write-Host "Employment number: $($employment.employmentNumber)"
  Write-Host "Retirement date: $retirementDate; synthetic service: 372 months"
  Write-Host "Synthetic final annual pensionable emoluments: KES 1,200,000"
  Write-Host "Illustrative monthly pension after 25% commutation: KES $($result.calculationResult.estimatedMonthlyPension)"
  Write-Host "Illustrative commutation lump sum: KES $($result.calculationResult.commutationLumpSum)"
  Write-Host "Case reference: $($result.caseReference); status: $($result.status)"
  Write-Host "The case is UNDER REVIEW; no payment schedule is approved or created. All employee facts and values are synthetic."
  Write-Host "Open the admin portal, choose Pension cases, and select this employee's case."
} finally {
  Remove-Variable password, passwordSecure, loginBody -ErrorAction SilentlyContinue
}

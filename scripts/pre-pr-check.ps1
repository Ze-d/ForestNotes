# ForestNotes Pre-PR Check Script
# 用法: .\scripts\pre-pr-check.ps1
# 在项目根目录运行

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path "$projectRoot\.."

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " ForestNotes Pre-PR Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$pass = 0
$fail = 0
$warn = 0
$total = 5

# ==== 1. ESLint ====
Write-Host "[1/$total] ESLint .............................. " -NoNewline
$result = npm run lint 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS" -ForegroundColor Green
    $pass++
} else {
    Write-Host "FAIL" -ForegroundColor Red
    Write-Host $result
    $fail++
}

# ==== 2. TypeScript 类型检查 ====
Write-Host "[2/$total] TypeScript (tsc -b) ................. " -NoNewline
$result = npx tsc -b 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS" -ForegroundColor Green
    $pass++
} else {
    Write-Host "FAIL" -ForegroundColor Red
    Write-Host $result
    $fail++
}

# ==== 3. Vitest 单元测试 ====
Write-Host "[3/$total] Vitest (unit tests) ................. " -NoNewline
# 用 cmd /c 执行，避免 PowerShell 5.1 把 stderr 包装为 ErrorRecord
$rawOutput = cmd /c "npm test 2>&1"
if ($LASTEXITCODE -eq 0) {
    $testLine = ($rawOutput | Select-String "Tests\s+\d+ passed" | Select-Object -First 1).ToString().Trim()
    if (-not $testLine) { $testLine = "passed" }
    Write-Host "PASS ($testLine)" -ForegroundColor Green
    $pass++
} else {
    Write-Host "FAIL" -ForegroundColor Red
    Write-Host $rawOutput
    $fail++
}

# ==== 4. Vite 生产构建 ====
Write-Host "[4/$total] Vite build .......................... " -NoNewline
$result = npx vite build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS" -ForegroundColor Green
    $pass++
} else {
    Write-Host "FAIL" -ForegroundColor Red
    Write-Host $result
    $fail++
}

# ==== 5. Rust 编译 + 测试 ====
Write-Host "[5/$total] Cargo test (src-tauri) .............. " -NoNewline
Push-Location "$projectRoot\src-tauri"
$result = cargo test 2>&1
$cargoExit = $LASTEXITCODE
Pop-Location
if ($cargoExit -eq 0) {
    Write-Host "PASS" -ForegroundColor Green
    $pass++
} else {
    Write-Host "FAIL" -ForegroundColor Red
    Write-Host $result
    $fail++
}

# ==== Summary ====
Write-Host "`n========================================" -ForegroundColor Cyan
if ($fail -eq 0) {
    Write-Host " Result: ALL $pass/$total PASSED" -ForegroundColor Green
    Write-Host "========================================`n"
    Write-Host "Ready for PR. 🚀" -ForegroundColor Green
    exit 0
} else {
    Write-Host " Result: $pass passed, $fail failed, $warn warnings" -ForegroundColor Red
    Write-Host "========================================`n"
    Write-Host "Fix the failures above before PR." -ForegroundColor Red
    exit 1
}

# Token Usage Checker
# Run this script to check current Claude API token usage

Write-Host "Checking Claude token usage..." -ForegroundColor Green

# Check if ccusage command is available
try {
    $usage = ccusage 2>&1
    Write-Host $usage
} catch {
    Write-Host "ERROR: ccusage command not found" -ForegroundColor Red
    Write-Host "Make sure you have the Anthropic CLI installed" -ForegroundColor Yellow
    Write-Host "Visit: https://github.com/anthropics/anthropic-sdk" -ForegroundColor Cyan
}

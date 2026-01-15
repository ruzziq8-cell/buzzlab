$envPath = Join-Path $PSScriptRoot ".env"

if (Test-Path $envPath) {
    $envLines = Get-Content $envPath
} else {
    $envLines = @()
}

function Set-EnvLine {
    param(
        [string[]]$Lines,
        [string]$Key,
        [string]$Value
    )

    if (-not $Value) {
        return ,$Lines
    }

    $newLines = @()
    $found = $false

    foreach ($line in $Lines) {
        if ($line -match "^\s*$Key\s*=") {
            $newLines += "$Key=$Value"
            $found = $true
        } else {
            $newLines += $line
        }
    }

    if (-not $found) {
        $newLines += "$Key=$Value"
    }

    return ,$newLines
}

Write-Host "=== Update API Key LLM di .env ==="
Write-Host "File .env: $envPath"

$openrouter1 = Read-Host "Tempel OpenRouter KEY 1 (Enter untuk skip)"
$openrouter2 = Read-Host "Tempel OpenRouter KEY 2 (Enter untuk skip)"
$mistral = Read-Host "Tempel Mistral API KEY (Enter untuk skip)"

$envLines = Set-EnvLine -Lines $envLines -Key "OPENROUTER_KEY_1" -Value $openrouter1
$envLines = Set-EnvLine -Lines $envLines -Key "OPENROUTER_KEY_2" -Value $openrouter2
$envLines = Set-EnvLine -Lines $envLines -Key "MISTRAL_API_KEY" -Value $mistral

Set-Content -Path $envPath -Value $envLines -Encoding UTF8

Write-Host ""
Write-Host "Selesai update .env. Nilai lama tetap dipertahankan untuk key yang dikosongkan."


# Malaya Campsite — deploy booking automation without `supabase login`
# Usage:
#   .\scripts\deploy-booking-automation.ps1
#
# Reads:
#   .env.supabase                  -> Supabase CLI project ref + access token
#   supabase/functions/.env        -> Google / website secrets
#
# The Supabase secret API key is NOT stored in this project.
# Hosted Edge Functions receive SUPABASE_SECRET_KEYS automatically.
# The Database Webhook supplies the selected secret through `apikey`.

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$CliEnvFile = Join-Path $Root '.env.supabase'
$FunctionEnvFile = Join-Path $Root 'supabase\functions\.env'

function Import-DotEnv([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) {
        throw "Environment file not found: $Path"
    }

    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            continue
        }

        $pair = $line -split '=', 2
        if ($pair.Count -ne 2) {
            continue
        }

        $name = $pair[0].Trim()
        $value = $pair[1].Trim()

        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        Set-Item -Path "Env:$name" -Value $value
    }
}

Import-DotEnv $CliEnvFile

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_PROJECT_REF)) {
    throw "SUPABASE_PROJECT_REF is missing from .env.supabase"
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    throw "SUPABASE_ACCESS_TOKEN is missing from .env.supabase"
}

Write-Host "Setting production Edge Function secrets..."
npx supabase secrets set --env-file $FunctionEnvFile --project-ref $env:SUPABASE_PROJECT_REF

Write-Host "Deploying booking-automation..."
npx supabase functions deploy booking-automation --project-ref $env:SUPABASE_PROJECT_REF --use-api

Write-Host ""
Write-Host "Deployment complete."
Write-Host "Function URL:"
Write-Host "https://$($env:SUPABASE_PROJECT_REF).supabase.co/functions/v1/booking-automation"

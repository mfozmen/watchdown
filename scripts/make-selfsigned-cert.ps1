# Generates a self-signed code-signing certificate for LOCAL testing of the Windows signing
# pipeline, exported to a gitignored .pfx that electron-builder can consume via CSC_LINK.
#
# IMPORTANT: a self-signed signature does NOT remove Windows SmartScreen / "unknown publisher"
# warnings for other users — it only proves the binary is signed and lets `npm run dist` exercise
# signing. For distribution, use a real certificate (e.g. SignPath, free for open source) or a CA
# cert. To silence the warning on YOUR OWN machine, import the .pfx into your Trusted Root and
# Trusted Publishers stores.
#
# Usage (PowerShell): run it, then paste the two env-var lines it prints and build:
#   npm run cert:win                 # or: powershell -ExecutionPolicy Bypass -File scripts/make-selfsigned-cert.ps1
#   $env:CSC_LINK = ...              # printed by the script
#   $env:CSC_KEY_PASSWORD = ...      # printed by the script (randomly generated)
#   npm run dist

param(
  [string]$Subject = 'CN=Watchdown (self-signed dev)',
  [string]$OutDir = 'certs',
  [string]$Password # a random password is generated when omitted
)

$ErrorActionPreference = 'Stop'

# Generate a random password when none is supplied, so no fixed secret ships in the repo/docs.
if (-not $Password) { $Password = [guid]::NewGuid().ToString('N') }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$pfxPath = Join-Path $OutDir 'watchdown-selfsigned.pfx'

# Create the cert (with an exportable private key) in the current user's store, export it to the
# .pfx, then remove it from the store so the .pfx is the only artifact.
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $Subject `
  -CertStoreLocation Cert:\CurrentUser\My -KeyUsage DigitalSignature `
  -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(3) `
  -FriendlyName 'Watchdown local signing'

$secure = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secure | Out-Null
Remove-Item -Path ("Cert:\CurrentUser\My\" + $cert.Thumbprint) -Force

Write-Host "Created $pfxPath (subject: $Subject)"
Write-Host ''
Write-Host 'Sign a local build by setting these, then running npm run dist:'
Write-Host ("  `$env:CSC_LINK = (Resolve-Path '$pfxPath').Path")
Write-Host ("  `$env:CSC_KEY_PASSWORD = '$Password'")
Write-Host '  npm run dist'

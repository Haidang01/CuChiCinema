param(
  [ValidateSet('Private','Public')][string]$NetworkProfile = 'Private',
  [string]$LocalAddress = 'Any'
)
$ErrorActionPreference = 'Stop'
if ($NetworkProfile -eq 'Public' -and $LocalAddress -eq 'Any') { throw 'Public profile requires the specific Wi-Fi IPv4 address via -LocalAddress.' }
# Run in an elevated PowerShell. This opens only the web dev port on trusted private LANs.
$ruleName = "CineVerse-Dev-LAN-5173-$NetworkProfile"
$existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Output 'Rule CineVerse LAN đã tồn tại. Không sửa các rule khác.'
} else {
  New-NetFirewallRule -Name $ruleName -DisplayName 'CineVerse dev web (Local subnet only)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile $NetworkProfile -LocalAddress $LocalAddress -RemoteAddress LocalSubnet -ErrorAction Stop | Out-Null
  Write-Output "Đã cho phép TCP 5173, profile $NetworkProfile, địa chỉ $LocalAddress, nguồn LocalSubnet."
}

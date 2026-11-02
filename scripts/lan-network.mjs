import { isIPv4 } from 'node:net';

export function isPrivateIPv4(address) {
  if (!isIPv4(address)) return false;
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function lanInterfaces(interfaces, selectedIP) {
  const candidates = Object.entries(interfaces).flatMap(([name, records]) =>
    (records ?? [])
      .filter((row) => !row.internal && row.family === 'IPv4' && isPrivateIPv4(row.address))
      .map((row) => ({ name, address: row.address })),
  );
  if (selectedIP) {
    const selected = candidates.find((row) => row.address === selectedIP);
    if (!selected) throw new Error('LAN_IP phải là địa chỉ IPv4 nội bộ đang có trên máy này.');
    return [selected];
  }
  return candidates
    .filter(
      (row) => !/zerotier|tailscale|vpn|virtual|vethernet|vmware|docker|vbox|wsl/i.test(row.name),
    )
    .sort(
      (a, b) =>
        Number(/wi-?fi|wlan|wireless/i.test(b.name)) - Number(/wi-?fi|wlan|wireless/i.test(a.name)),
    );
}

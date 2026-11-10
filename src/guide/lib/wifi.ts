// Standard Wi-Fi QR payload for WPA/WPA2 personal networks.
export function wifiQrPayload(network: string, password: string): string {
  const escape = (value: string) => value.replace(/[\\;,:\"]/g, '\\$&');
  return `WIFI:T:WPA;S:${escape(network)};P:${escape(password)};;`;
}

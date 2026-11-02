import 'dotenv/config';
import { networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { lanInterfaces } from './lan-network.mjs';

const https = process.argv.includes('--https');
const scheme = https ? 'https' : 'http';
let addresses;
try {
  addresses = lanInterfaces(networkInterfaces(), process.env.LAN_IP);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (!addresses.length) {
  console.error(
    'Chưa tìm thấy IPv4 Wi-Fi/Ethernet nội bộ. Kết nối mạng rồi chạy lại, hoặc chọn interface bằng LAN_IP trong .env.',
  );
  process.exit(1);
}
if (https) {
  const cert = path.resolve(process.env.LOCAL_TLS_CERT || '.local/certs/lan.pem');
  const key = path.resolve(process.env.LOCAL_TLS_KEY || '.local/certs/lan-key.pem');
  if (!existsSync(cert) || !existsSync(key)) {
    console.error(
      'Chưa có chứng chỉ HTTPS local. Xem docs/mobile-lan.md để chuẩn bị chứng chỉ tin cậy trên điện thoại.',
    );
    process.exit(1);
  }
}
const urls = addresses.map((row) => `${scheme}://${row.address}:5173`);
const extra = [
  process.env.APP_ORIGINS,
  ...urls,
  `${scheme}://localhost:5173`,
  `${scheme}://127.0.0.1:5173`,
]
  .filter(Boolean)
  .join(',');
console.log('\nCineVerse cho điện thoại cùng Wi-Fi:');
addresses.forEach((row, index) => console.log(`  ${row.name}: ${urls[index]}`));
console.log(`  Trên máy tính: ${scheme}://localhost:5173`);
console.log('  API và PostgreSQL vẫn chỉ ở localhost. Dừng bằng Ctrl+C.');
if (!https)
  console.log(
    '  HTTP dùng để kiểm tra web/phim. Micro cần npm run dev:lan:https và chứng chỉ được điện thoại tin cậy.',
  );
if (process.argv.includes('--print-only')) process.exit(0);
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DEV_LAN: '1',
  LOCAL_HTTPS: https ? '1' : '0',
  APP_ORIGINS: extra,
  LAN_SHARE_ORIGIN: urls[0],
};
const child = spawn(
  process.execPath,
  [
    path.resolve('node_modules/concurrently/dist/bin/concurrently.js'),
    '-k',
    '-n',
    'api,web',
    'npm run dev -w @cineverse/server',
    'npm run dev -w @cineverse/web',
  ],
  { stdio: 'inherit', env },
);
child.on('error', () => {
  console.error('Không chạy được dev server. Hãy chạy npm install trước.');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
process.on('SIGINT', () => {
  child.kill('SIGINT');
});
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

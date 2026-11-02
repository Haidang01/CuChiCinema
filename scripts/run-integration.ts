import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// This runner never runs integration mutations against the application's database.
const source = process.env.DATABASE_URL;
if (!source) throw new Error('Thiếu DATABASE_URL');
const url = new URL(source);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Kiểm thử chỉ được chạy trên PostgreSQL localhost.');
url.pathname = '/cineverse_test';
const testUrl = url.toString();
url.pathname = '/postgres';
url.search = '';
const admin = new pg.Client({ connectionString: url.toString() });
try {
  await admin.connect();
  const result = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    'cineverse_test',
  ]);
  if (!result.rowCount) await admin.query('CREATE DATABASE cineverse_test');
} catch {
  console.error('Không thể chuẩn bị cineverse_test. Kiểm tra PostgreSQL localhost.');
  process.exit(1);
} finally {
  await admin.end();
}
const env = { ...process.env, DATABASE_URL: testUrl, MEDIA_ROOT: '.local/test-media' };
const commands = [
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  ['node_modules/tsx/dist/cli.mjs', 'scripts/seed.ts'],
  ['node_modules/tsx/dist/cli.mjs', '--test', 'tests/integration/api.test.ts'],
];
for (const [file, ...args] of commands) {
  const result = spawnSync(process.execPath, [path.resolve(file!), ...args], {
    env,
    stdio: 'inherit',
    timeout: 90000,
  });
  if (result.error) {
    console.error('Lệnh kiểm thử không hoàn tất:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

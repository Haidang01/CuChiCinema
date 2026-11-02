import 'dotenv/config';
import pg from 'pg';

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('Thiếu DATABASE_URL trong .env');
const url = new URL(raw);
const name = url.pathname.slice(1);
if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error('Tên database không hợp lệ');
url.pathname = '/postgres';
url.search = '';
const client = new pg.Client({ connectionString: url.toString() });
try {
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${name}"`);
  console.log(`Database ${name} sẵn sàng.`);
} catch {
  console.error('Không thể tạo/kết nối database. Kiểm tra PostgreSQL localhost và DATABASE_URL.');
  process.exitCode = 1;
} finally {
  await client.end();
}

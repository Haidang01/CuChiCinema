import 'dotenv/config';
import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { createApp, errorHandler, origins } from './app.js';
import { setupRealtime } from './realtime.js';
import { db } from './db.js';

const app = createApp();
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist/web')));
  app.get('/{*path}', (_, res) => res.sendFile(path.resolve('dist/web/index.html')));
}
app.use(errorHandler);
const http = createServer(app);
const realtime = setupRealtime(http, origins);
const port = Number(process.env.PORT ?? 3001);
http.listen(port, '127.0.0.1', () => console.log(`CineVerse API: http://localhost:${port}`));
const shutdown = async () => {
  await realtime.stop();
  http.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

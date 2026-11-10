// 3DGAME サーバー：静的配信・games 一覧 API・オンライン用ルーム中継（ビルド工程なし）
import express from 'express';
import http from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachRooms } from './server/rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = path.join(__dirname, 'games');
const PORT = Number(process.env.PORT) || 3000;

/** games/*\/meta.json を走査して order 順の配列を返す */
export async function listGames() {
  const entries = await readdir(GAMES_DIR, { withFileTypes: true });
  const games = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    try {
      const raw = await readFile(path.join(GAMES_DIR, ent.name, 'meta.json'), 'utf8');
      const meta = JSON.parse(raw);
      games.push({ slug: ent.name, ...meta, url: `/games/${ent.name}/` });
    } catch {
      // meta.json が無い・壊れているフォルダは一覧に出さない
    }
  }
  games.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return games;
}

/** Express アプリ（HTTP ルートのみ） */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => res.status(200).type('text').send('ok'));

  app.get('/api/games', async (_req, res) => {
    try {
      res.json(await listGames());
    } catch (err) {
      console.error('[api/games] 一覧の取得に失敗', err);
      res.status(500).json({ error: 'games の読み込みに失敗しました' });
    }
  });

  // three.js（npm で固定したものを配信。CDN は使わない）
  // addons を先に登録しないと /vendor/three 側に吸われる
  app.use('/vendor/three/addons', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));
  app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));

  // Socket.io クライアント（shared/net.js が読み込む）
  app.use('/vendor/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));

  app.use('/shared', express.static(path.join(__dirname, 'shared')));
  app.use('/games', express.static(GAMES_DIR));
  app.use('/', express.static(path.join(__dirname, 'public')));

  return app;
}

/** HTTP サーバー＋ルーム中継。listen() はまだしない */
export function createServer() {
  const server = http.createServer(createApp());
  attachRooms(server);
  return server;
}

// 直接起動されたときだけ listen する（smoke からの import にも対応）
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  createServer().listen(PORT, () => {
    console.log(`3DGAME サーバー起動: http://localhost:${PORT}`);
  });
}

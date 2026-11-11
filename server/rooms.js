// 汎用ルーム中継（Socket.io）。ゲームのルールは一切持たない。
// できること：ルーム作成・合言葉で参加・退出・メッセージ中継・ホスト交代（ホスト退出時は次の参加者へ）
// ルームは「ゲーム（slug）× 合言葉」で区別するので、別ゲームで同じ合言葉を使ってもぶつからない。
import { Server } from 'socket.io';

const MAX_PLAYERS_LIMIT = 8;          // 1ルームの上限（ゲーム側の指定はこれ以下に丸める）
const MAX_PAYLOAD = 64 * 1024;        // 1メッセージの上限（バイト、JSON 換算）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい 0/O/1/I は除く
const SLUG_RE = /^[a-z0-9-]{1,32}$/;
const CODE_RE = /^[A-Z0-9]{3,12}$/;

/** ルーム状態（メモリのみ。サーバー再起動で消える） */
const rooms = new Map(); // key: `${slug}:${code}` → { slug, code, hostId, maxPlayers, players: [{id, name}] }

function roomKey(slug, code) {
  return `${slug}:${code}`;
}

function genCode(slug) {
  for (let i = 0; i < 100; i++) {
    let c = '';
    for (let j = 0; j < 4; j++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(roomKey(slug, c))) return c;
  }
  return null;
}

function cleanName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16);
  return s || 'プレイヤー';
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

/** クライアントに送る公開情報 */
function publicRoom(room) {
  return {
    slug: room.slug,
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
  };
}

function sizeOf(v) {
  try {
    return Buffer.byteLength(JSON.stringify(v ?? null));
  } catch {
    return Infinity; // 循環参照など JSON 化できないものは拒否
  }
}

/**
 * http.Server に Socket.io のルーム中継を取り付ける
 * @param {import('node:http').Server} httpServer
 */
export function attachRooms(httpServer) {
  const io = new Server(httpServer, {
    serveClient: false, // クライアントは /vendor/socket.io から配信する
    maxHttpBufferSize: MAX_PAYLOAD * 2,
  });

  function broadcastRoom(room) {
    io.to(roomKey(room.slug, room.code)).emit('room:update', publicRoom(room));
  }

  /** ソケットを今いるルームから外す（ホスト交代・空ルーム削除込み） */
  function leave(socket, reason = 'leave') {
    const key = socket.data.roomKey;
    if (!key) return;
    socket.data.roomKey = null;
    socket.leave(key);
    const room = rooms.get(key);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(key);
      return;
    }
    let hostChanged = false;
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id; // 一番古い参加者がホストを引き継ぐ
      hostChanged = true;
    }
    io.to(key).emit('room:left', { id: socket.id, reason });
    if (hostChanged) io.to(key).emit('room:host', { hostId: room.hostId });
    broadcastRoom(room);
  }

  io.on('connection', (socket) => {
    socket.data.roomKey = null;
    const reply = (ack, body) => {
      if (typeof ack === 'function') ack(body);
    };

    // ルーム作成：{ slug, name, code?（合言葉。省略で自動生成）, maxPlayers? }
    socket.on('room:create', (opts = {}, ack) => {
      const slug = String(opts.slug ?? '');
      if (!SLUG_RE.test(slug)) return reply(ack, { ok: false, error: 'ゲーム名（slug）が不正です' });
      let code = opts.code ? normalizeCode(opts.code) : genCode(slug);
      if (!code || !CODE_RE.test(code)) return reply(ack, { ok: false, error: '合言葉は英数字3〜12文字にしてください' });
      if (rooms.has(roomKey(slug, code))) return reply(ack, { ok: false, error: 'その合言葉のルームは既にあります' });

      leave(socket, 'switch');
      const maxPlayers = Math.max(1, Math.min(MAX_PLAYERS_LIMIT, Number(opts.maxPlayers) || 4));
      const room = { slug, code, hostId: socket.id, maxPlayers, players: [{ id: socket.id, name: cleanName(opts.name) }] };
      const key = roomKey(slug, code);
      rooms.set(key, room);
      socket.join(key);
      socket.data.roomKey = key;
      reply(ack, { ok: true, id: socket.id, room: publicRoom(room) });
    });

    // 参加：{ slug, code, name }
    socket.on('room:join', (opts = {}, ack) => {
      const slug = String(opts.slug ?? '');
      const code = normalizeCode(opts.code);
      const key = roomKey(slug, code);
      const room = rooms.get(key);
      if (!SLUG_RE.test(slug) || !room) return reply(ack, { ok: false, error: 'ルームが見つかりません（合言葉を確認してください）' });
      if (socket.data.roomKey === key) return reply(ack, { ok: true, id: socket.id, room: publicRoom(room) });
      if (room.players.length >= room.maxPlayers) return reply(ack, { ok: false, error: 'ルームが満員です' });

      leave(socket, 'switch');
      const player = { id: socket.id, name: cleanName(opts.name) };
      room.players.push(player);
      socket.join(key);
      socket.data.roomKey = key;
      reply(ack, { ok: true, id: socket.id, room: publicRoom(room) });
      socket.to(key).emit('room:joined', player);
      broadcastRoom(room);
    });

    // 退出
    socket.on('room:leave', (_opts, ack) => {
      leave(socket, 'leave');
      reply(ack, { ok: true });
    });

    // メッセージ中継：{ type, data, to? }（to 省略で自分以外の全員、to 指定でその1人だけ）
    socket.on('room:msg', (msg = {}) => {
      const key = socket.data.roomKey;
      if (!key || typeof msg.type !== 'string' || msg.type.length > 64) return;
      if (sizeOf(msg.data) > MAX_PAYLOAD) {
        socket.emit('room:error', { error: 'メッセージが大きすぎます', type: msg.type });
        return;
      }
      const out = { from: socket.id, type: msg.type, data: msg.data ?? null };
      if (msg.to) {
        const room = rooms.get(key);
        if (room && room.players.some((p) => p.id === msg.to)) io.to(msg.to).emit('room:msg', out);
      } else {
        socket.to(key).emit('room:msg', out);
      }
    });

    // ホストが自分から譲る：{ to }
    socket.on('room:host', (opts = {}, ack) => {
      const room = rooms.get(socket.data.roomKey);
      if (!room || room.hostId !== socket.id) return reply(ack, { ok: false, error: 'ホストではありません' });
      if (!room.players.some((p) => p.id === opts.to)) return reply(ack, { ok: false, error: '相手がルームにいません' });
      room.hostId = opts.to;
      io.to(roomKey(room.slug, room.code)).emit('room:host', { hostId: room.hostId });
      broadcastRoom(room);
      reply(ack, { ok: true });
    });

    socket.on('disconnect', () => leave(socket, 'disconnect'));
  });

  return io;
}

/** 現在のルーム数（デバッグ・テスト用） */
export function roomCount() {
  return rooms.size;
}

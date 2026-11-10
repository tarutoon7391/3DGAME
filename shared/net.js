// 共通オンライン：Socket.io の汎用ルームに入って、メッセージをやり取りする（ゲームのルールは持たない）
// 想定：ホスト役のクライアントが進行（状態の正本）を持ち、他は入力を送って状態を受け取る。
// 1人プレイでは使わない（createNet しただけでは接続しない。createRoom / joinRoom で初めて接続する）。

const ACK_TIMEOUT = 5000;

/**
 * オンライン用のハンドルを作る。
 * @param {string} slug ゲームのスラッグ（例 'sports'）。ルームはゲームごとに分かれる
 * @param {{name?:string, url?:string, io?:Function}} [opts]
 *   name: 表示名、url: 接続先（省略で同じオリジン）、io: Socket.io クライアントの io 関数（テスト用。省略で自動読み込み）
 */
export function createNet(slug, { name = 'プレイヤー', url, io: ioFn } = {}) {
  let socket = null;
  let myId = null;
  let room = null; // { slug, code, hostId, maxPlayers, players: [{id, name}] }
  let myName = name;

  const handlers = new Map(); // type → Set<fn>。'*' は全メッセージ
  const listeners = { room: new Set(), join: new Set(), leave: new Set(), host: new Set(), disconnect: new Set(), error: new Set() };

  const on = (set, fn) => {
    set.add(fn);
    return () => set.delete(fn);
  };
  const emit = (set, ...args) => {
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (e) {
        console.error('[net] ハンドラでエラー', e);
      }
    }
  };

  async function connect() {
    if (socket) return socket;
    if (!ioFn) ioFn = (await import('/vendor/socket.io/socket.io.esm.min.js')).io;
    const s = ioFn(url, { transports: ['websocket'], reconnection: false });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('サーバーに接続できませんでした')), ACK_TIMEOUT);
      s.once('connect', () => { clearTimeout(t); resolve(); });
      s.once('connect_error', (e) => { clearTimeout(t); reject(new Error('サーバーに接続できませんでした: ' + e.message)); });
    }).catch((e) => {
      s.close();
      throw e;
    });
    socket = s;

    s.on('room:update', (r) => {
      room = r;
      emit(listeners.room, r);
    });
    s.on('room:joined', (p) => emit(listeners.join, p));
    s.on('room:left', ({ id, reason }) => emit(listeners.leave, { id, reason }));
    s.on('room:host', ({ hostId }) => {
      if (room) room.hostId = hostId;
      emit(listeners.host, { hostId, isHost: hostId === myId });
    });
    s.on('room:error', (e) => emit(listeners.error, e));
    s.on('room:msg', (msg) => {
      for (const key of [msg.type, '*']) {
        const set = handlers.get(key);
        if (!set) continue;
        for (const fn of [...set]) {
          try {
            fn(msg.data, msg.from, msg.type);
          } catch (e) {
            console.error(`[net] onMessage(${key}) でエラー`, e);
          }
        }
      }
    });
    s.on('disconnect', (reason) => {
      // 自動再接続はしない。ゲーム側で「接続が切れました」を出して1人プレイへ戻すなどする
      socket = null;
      room = null;
      myId = null;
      emit(listeners.disconnect, reason);
    });
    return s;
  }

  async function request(event, payload) {
    const s = await connect();
    const res = await s.timeout(ACK_TIMEOUT).emitWithAck(event, payload);
    if (!res?.ok) throw new Error(res?.error || 'サーバーが応答しませんでした');
    return res;
  }

  return {
    /**
     * ルームを作ってホストになる。
     * @param {{code?:string, maxPlayers?:number}} [o] code: 合言葉（英数字3〜12。省略で4文字を自動生成）、maxPlayers: 上限（1〜8、既定4）
     * @returns {Promise<{code:string, room:object}>}
     */
    async createRoom({ code, maxPlayers } = {}) {
      const res = await request('room:create', { slug, name: myName, code, maxPlayers });
      myId = res.id;
      room = res.room;
      emit(listeners.room, room);
      return { code: room.code, room };
    },
    /**
     * 合言葉でルームに参加する（大文字小文字は区別しない）
     * @returns {Promise<{code:string, room:object}>}
     */
    async joinRoom(code) {
      const res = await request('room:join', { slug, name: myName, code });
      myId = res.id;
      room = res.room;
      emit(listeners.room, room);
      return { code: room.code, room };
    },
    /** ルームから出る（接続も閉じる） */
    leaveRoom() {
      if (!socket) return;
      socket.emit('room:leave');
      socket.close(); // disconnect イベントは自分で閉じた場合も onDisconnect に届く（reason: 'io client disconnect'）
    },
    /**
     * メッセージを送る（自分には届かない）。data は JSON 化できる値。64KB まで
     * @param {string} type 種類（例 'input' / 'state'）
     * @param {*} data
     * @param {{to?:string}} [o] to: 相手の id（省略で自分以外の全員）
     */
    send(type, data, { to } = {}) {
      if (!socket || !room) return false;
      socket.emit('room:msg', { type, data, to });
      return true;
    },
    /** メッセージ受信。type に '*' で全部。fn(data, fromId, type)。戻り値は解除関数 */
    onMessage(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      return on(handlers.get(type), fn);
    },
    /** ホスト役を他の参加者に譲る（ホストのみ） */
    async transferHost(toId) {
      await request('room:host', { to: toId });
    },
    /** 表示名の変更（次の createRoom / joinRoom から反映） */
    setName(n) {
      myName = n;
    },

    /** 参加者一覧が変わった（参加・退出・ホスト交代）。fn(room) */
    onRoomChange: (fn) => on(listeners.room, fn),
    /** 誰かが参加した。fn({id, name}) */
    onPlayerJoin: (fn) => on(listeners.join, fn),
    /** 誰かが抜けた（切断含む）。fn({id, reason}) reason: 'leave' | 'disconnect' | 'switch' */
    onPlayerLeave: (fn) => on(listeners.leave, fn),
    /** ホストが交代した。fn({hostId, isHost}) */
    onHostChange: (fn) => on(listeners.host, fn),
    /** 自分の接続が切れた（サーバー停止・回線断・leaveRoom）。fn(reason) */
    onDisconnect: (fn) => on(listeners.disconnect, fn),
    /** サーバーからのエラー通知（メッセージが大きすぎる等）。fn({error, type}) */
    onError: (fn) => on(listeners.error, fn),

    /** 自分の id（未接続なら null） */
    get myId() { return myId; },
    /** ルーム情報（未参加なら null） */
    get room() { return room; },
    /** 参加者一覧 [{id, name}]（参加順。先頭が一番古い） */
    get players() { return room ? room.players : []; },
    /** 自分の参加者番号（players 内の位置。未参加なら -1） */
    get myIndex() { return room ? room.players.findIndex((p) => p.id === myId) : -1; },
    /** 自分がホストか */
    get isHost() { return !!room && room.hostId === myId; },
    /** 接続中か */
    get connected() { return !!socket && socket.connected; },
  };
}

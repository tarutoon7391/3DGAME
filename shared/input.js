// 共通入力：キーボード・マウス・ポインタロック（凍結対象の契約）

/**
 * 入力を監視する。毎フレームの最後に endFrame() を呼ぶこと。
 * キーは KeyboardEvent.code（'KeyW', 'Space', 'ShiftLeft' など）、
 * マウスボタンは 'Mouse0'（左）'Mouse1'（中）'Mouse2'（右）でも isDown / wasPressed できる。
 * @param {HTMLElement} [dom=document.body] マウスを拾う要素（通常は renderer.domElement）
 */
export function createInput(dom = document.body) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, wheel: 0, buttons: 0, locked: false };

  // ゲーム中にブラウザ側の動作（スクロール等）を起こさないキー
  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  function onKeyDown(e) {
    if (isTyping(e)) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  }
  function onKeyUp(e) {
    down.delete(e.code);
  }
  function onBlur() {
    // フォーカスが外れたら押しっぱなし扱いを解除
    down.clear();
    mouse.buttons = 0;
  }
  function onMouseMove(e) {
    mouse.dx += e.movementX || 0;
    mouse.dy += e.movementY || 0;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onMouseDown(e) {
    mouse.buttons = e.buttons;
    const code = 'Mouse' + e.button;
    if (!down.has(code)) pressed.add(code);
    down.add(code);
  }
  function onMouseUp(e) {
    mouse.buttons = e.buttons;
    down.delete('Mouse' + e.button);
  }
  function onWheel(e) {
    mouse.wheel += Math.sign(e.deltaY);
  }
  function onContextMenu(e) {
    e.preventDefault();
  }
  function onLockChange() {
    mouse.locked = document.pointerLockElement === dom;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  dom.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  dom.addEventListener('wheel', onWheel, { passive: true });
  dom.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    mouse,
    /** 押しっぱなしか */
    isDown: (code) => down.has(code),
    /** このフレームで押されたか（endFrame までの間 true） */
    wasPressed: (code) => pressed.has(code),
    /** ポインタロック要求（ユーザー操作のイベント内で呼ぶこと） */
    lockPointer() {
      if (document.pointerLockElement !== dom && dom.requestPointerLock) {
        try {
          const p = dom.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch { /* 非対応環境は無視 */ }
      }
    },
    /** ポインタロック解除 */
    unlockPointer() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    /** フレーム末尾で呼ぶ：wasPressed とマウス移動量・ホイールをリセット */
    endFrame() {
      pressed.clear();
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.wheel = 0;
    },
    /** リスナーを全部外す */
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}

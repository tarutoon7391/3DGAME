// 共通セーブ：localStorage（キーは 3dgame:<slug>／凍結対象の契約）

/**
 * @param {string} slug ゲームのスラッグ（例 'rpg'）
 */
export function createSave(slug) {
  const key = `3dgame:${slug}`;

  return {
    key,
    /**
     * 読み込む。保存が無い・壊れている場合は defaults を返す。
     * 保存データに無いキーは defaults で補う（浅いマージ）。
     */
    load(defaults = {}) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return structuredClone(defaults);
        const data = JSON.parse(raw);
        if (data && typeof data === 'object' && !Array.isArray(data) && defaults && typeof defaults === 'object' && !Array.isArray(defaults)) {
          return { ...structuredClone(defaults), ...data };
        }
        return data ?? structuredClone(defaults);
      } catch (e) {
        console.warn(`[save] ${key} の読み込みに失敗`, e);
        return structuredClone(defaults);
      }
    },
    /** 保存する。成功で true */
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) {
        console.warn(`[save] ${key} の保存に失敗`, e);
        return false;
      }
    },
    /** 保存があるか（「つづきから」の表示判定用） */
    exists() {
      try {
        return localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    },
    /** 削除 */
    clear() {
      try {
        localStorage.removeItem(key);
      } catch { /* 無視 */ }
    },
  };
}

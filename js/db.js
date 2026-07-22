/* === IndexedDB 封装 === */

const DB = (() => {
  const DB_NAME = "readflow";
  const VERSION = 1;

  /** @returns {Promise<IDBDatabase>} */
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // 生词表
        if (!db.objectStoreNames.contains("vocabulary")) {
          const vocab = db.createObjectStore("vocabulary", { keyPath: "id" });
          vocab.createIndex("source", "source", { unique: false });
          vocab.createIndex("createdAt", "createdAt", { unique: false });
        }

        // 学习日志
        if (!db.objectStoreNames.contains("studyLog")) {
          const log = db.createObjectStore("studyLog", { keyPath: "id" });
          log.createIndex("date", "date", { unique: true });
        }

        // 练习记录
        if (!db.objectStoreNames.contains("exercises")) {
          const ex = db.createObjectStore("exercises", { keyPath: "id" });
          ex.createIndex("type", "type", { unique: false });
          ex.createIndex("createdAt", "createdAt", { unique: false });
        }

        // 用户画像
        if (!db.objectStoreNames.contains("userProfile")) {
          db.createObjectStore("userProfile", { keyPath: "key" });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** 通用添加/更新 */
  async function put(storeName, data) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 通用获取全部 */
  async function getAll(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** 按索引查询 */
  async function getByIndex(storeName, indexName, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** 按主键获取 */
  async function get(storeName, key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** 删除 */
  async function remove(storeName, key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 计数 */
  async function count(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // --- 便捷方法 ---

  async function addWord(word) {
    word.id = word.id || Utils.uid();
    word.createdAt = word.createdAt || Utils.today();
    return put("vocabulary", word);
  }

  async function getWords(source = null) {
    if (source) return getByIndex("vocabulary", "source", source);
    return getAll("vocabulary");
  }

  async function logStudy(date = null, { newWords = 0, reviewCount = 0, studyMinutes = 0 } = {}) {
    date = date || Utils.today();
    const existing = await getByIndex("studyLog", "date", date);
    if (existing.length > 0) {
      const entry = existing[0];
      entry.newWords += newWords;
      entry.reviewCount += reviewCount;
      entry.studyMinutes += studyMinutes;
      return put("studyLog", entry);
    }
    return put("studyLog", { id: Utils.uid(), date, newWords, reviewCount, studyMinutes });
  }

  async function getStudyLogs() {
    return getAll("studyLog");
  }

  async function addExercise(ex) {
    ex.id = ex.id || Utils.uid();
    ex.createdAt = ex.createdAt || Utils.today();
    return put("exercises", ex);
  }

  async function getExercises(type = null) {
    if (type) return getByIndex("exercises", "type", type);
    return getAll("exercises");
  }

  async function saveProfile(key, value) {
    return put("userProfile", { key, value });
  }

  async function getProfile(key) {
    const result = await get("userProfile", key);
    return result ? result.value : null;
  }

  return { open, put, getAll, getByIndex, get, remove, count,
           addWord, getWords, logStudy, getStudyLogs,
           addExercise, getExercises, saveProfile, getProfile };
})();

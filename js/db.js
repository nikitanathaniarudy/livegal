/**
 * GalGameDB — wraps IndexedDB with a clean async API.
 * No external dependencies.
 *
 * Schema (v1):
 *   people        { id, name, createdAt, lastSeen, totalAffection, conversationCount }
 *   conversations { id, personId, startedAt, endedAt, exchanges[], finalAffection }
 */

const DB_NAME    = 'galgame-db';
const DB_VERSION = 1;

export class GalGameDB {
  constructor() {
    this._db = null;
  }

  // ── Open / upgrade ───────────────────────────────────────────────

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('people')) {
          const ps = db.createObjectStore('people', { keyPath: 'id', autoIncrement: true });
          ps.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('conversations')) {
          const cs = db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
          cs.createIndex('personId', 'personId', { unique: false });
        }
      };

      req.onsuccess = () => { this._db = req.result; resolve(); };
      req.onerror  = () => reject(req.error);
    });
  }

  // ── People ───────────────────────────────────────────────────────

  getAllPeople() {
    return this._getAll('people');
  }

  getPerson(id) {
    return this._get('people', id);
  }

  createPerson(name) {
    const now = new Date().toISOString();
    return this._add('people', {
      name,
      createdAt:         now,
      lastSeen:          now,
      totalAffection:    0,
      conversationCount: 0,
    });
  }

  updatePerson(id, changes) {
    return this._update('people', id, changes);
  }

  // ── Conversations ────────────────────────────────────────────────

  /** Returns all conversations for a person, newest first. */
  async getConversationsForPerson(personId) {
    const all = await this._getAllByIndex('conversations', 'personId', personId);
    return all.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  getAllConversations() {
    return this._getAll('conversations');
  }

  saveConversation(personId, exchanges, finalAffection, startedAt) {
    return this._add('conversations', {
      personId,
      startedAt,
      endedAt:        new Date().toISOString(),
      exchanges:      [...exchanges],
      finalAffection,
    });
  }

  // ── Low-level helpers ────────────────────────────────────────────

  _getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  _get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  _add(storeName, value) {
    return new Promise((resolve, reject) => {
      const tx    = this._db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req   = store.add(value);
      req.onsuccess = () => resolve({ ...value, id: req.result });
      req.onerror   = () => reject(req.error);
    });
  }

  _update(storeName, key, changes) {
    return new Promise((resolve, reject) => {
      const tx    = this._db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const updated = { ...getReq.result, ...changes };
        const putReq  = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror   = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  _getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx    = this._db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const req   = index.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
}

/**
 * GalGameDB — wraps IndexedDB with a clean async API.
 * No external dependencies.
 *
 * Schema (v3):
 *   people        { id, name, faceDescriptor, createdAt, lastSeen, totalAffection, conversationCount }
 *   conversations { id, personId, startedAt, endedAt, exchanges[], finalAffection }
 *   memories      { id, personId, said, text, label, cls, embedding, timestamp }
 *   relationships { id, fromPersonId, fromName, toName, relationship, category, context, timestamp }
 *   memories      { id, personId, said, text, label, cls, embedding, timestamp }
 */

const DB_NAME    = 'galgame-db';
const DB_VERSION = 3;

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

        // v2: persistent RAG memory per person
        if (!db.objectStoreNames.contains('memories')) {
          const ms = db.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
          ms.createIndex('personId', 'personId', { unique: false });
        }

        // v3: relationship graph edges
        if (!db.objectStoreNames.contains('relationships')) {
          const rs = db.createObjectStore('relationships', { keyPath: 'id', autoIncrement: true });
          rs.createIndex('fromPersonId', 'fromPersonId', { unique: false });
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

  async getPersonByName(name) {
    const all = await this._getAllByIndex('people', 'name', name);
    return all[0] || null;
  }

  createPerson(name, faceDescriptor = null) {
    const now = new Date().toISOString();
    return this._add('people', {
      name,
      faceDescriptor,
      createdAt:         now,
      lastSeen:          now,
      totalAffection:    0,
      conversationCount: 0,
    });
  }

  updatePerson(id, changes) {
    return this._update('people', id, changes);
  }

  async deletePerson(id) {
    const person = await this.getPerson(id);
    const tx = this._db.transaction(
      ['people', 'conversations', 'memories', 'relationships'],
      'readwrite'
    );

    const people = tx.objectStore('people');
    const conversations = tx.objectStore('conversations').index('personId');
    const memories = tx.objectStore('memories').index('personId');
    const relationshipsStore = tx.objectStore('relationships');
    const relationships = relationshipsStore.index('fromPersonId');

    people.delete(id);
    this._deleteByIndex(conversations, id);
    this._deleteByIndex(memories, id);
    this._deleteByIndex(relationships, id);

    if (person?.name) {
      relationshipsStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        if (cursor.value.toName === person.name) cursor.delete();
        cursor.continue();
      };
    }

    return this._txDone(tx);
  }

  // ── Conversations ────────────────────────────────────────────────

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

  // ── Memories (persistent RAG) ────────────────────────────────────

  saveMemory(personId, exchange, embedding) {
    return this._add('memories', {
      personId,
      said:      exchange.said,
      text:      exchange.text,
      label:     exchange.label,
      cls:       exchange.cls,
      embedding,
      timestamp: new Date().toISOString(),
    });
  }

  getMemoriesForPerson(personId) {
    return this._getAllByIndex('memories', 'personId', personId);
  }

  // ── Relationships (network graph) ────────────────────────────────

  saveRelationship(fromPersonId, fromName, toName, relationship, category, context) {
    return this._add('relationships', {
      fromPersonId,
      fromName,
      toName,
      relationship,
      category,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  getAllRelationships() {
    return this._getAll('relationships');
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

  _deleteByIndex(index, value) {
    index.openCursor(IDBKeyRange.only(value)).onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  }

  _txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}

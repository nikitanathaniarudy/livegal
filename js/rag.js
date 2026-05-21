import { EMBED_URL, EMBED_MODEL } from './config.js';

function cosine(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function embed(text) {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

/**
 * RAG memory store that works both in-session (fast) and across sessions (persistent).
 * Entries are keyed to a person so memories accumulate over time with that specific person.
 */
export class ConversationRAG {
  constructor() {
    this._entries = []; // { exchange, embedding }
  }

  /**
   * Load all past memories for a person from IndexedDB into the in-memory store.
   * Call this at session start after identifying the person.
   * @param {GalGameDB} db
   * @param {number} personId
   */
  async loadFromDB(db, personId) {
    this._entries = [];
    try {
      const rows = await db.getMemoriesForPerson(personId);
      for (const row of rows) {
        this._entries.push({
          exchange: { said: row.said, text: row.text, label: row.label, cls: row.cls },
          embedding: row.embedding,
        });
      }
    } catch (_) {}
  }

  /**
   * Embed a completed exchange, add it to the in-memory store, and persist it to IndexedDB.
   * Call this after the user picks a response during an active session.
   * Fails silently — never blocks the main flow.
   * @param {{ said, text, label, cls }} exchange
   * @param {GalGameDB} db
   * @param {number} personId
   */
  async addAndPersist(exchange, db, personId) {
    try {
      const fullText = `They said: ${exchange.said}. You responded: ${exchange.text}`;
      const embedding = await embed(fullText);
      this._entries.push({ exchange, embedding });
      await db.saveMemory(personId, exchange, embedding);
    } catch (_) {}
  }

  /**
   * Retrieve the top-K most relevant past exchanges for a given query.
   * Searches across all sessions loaded for this person.
   * Returns [] if the store is empty or embedding fails.
   * @param {string} query
   * @param {number} topK
   */
  async retrieve(query, topK = 3) {
    if (!this._entries.length) return [];
    let queryEmb;
    try {
      queryEmb = await embed(query);
    } catch (_) {
      return [];
    }

    const n = this._entries.length;
    return this._entries
      .map((e, i) => {
        const base      = cosine(queryEmb, e.embedding);
        const recency   = (i / Math.max(1, n - 1)) * 0.15;           // up to +15% for newest
        const affBoost  = Math.min(0.20, Math.abs(e.exchange.affectionDelta || 0) * 0.04); // up to +20% for high-impact moments
        return { exchange: e.exchange, score: base * (1 + recency + affBoost) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(e => e.exchange);
  }

  clear() {
    this._entries = [];
  }

  get size() {
    return this._entries.length;
  }
}

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
 * In-memory RAG store for one conversation session.
 * Each entry holds the raw exchange plus the embedding of what they said,
 * so retrieval finds past moments where the topic was similar.
 */
export class ConversationRAG {
  constructor() {
    this._entries = []; // { exchange, embedding }
  }

  /**
   * Embed and store a completed exchange.
   * Call this after the user picks a response.
   * Fails silently — never blocks the main flow.
   * @param {{ said: string, label: string, text: string, cls: string }} exchange
   */
  async add(exchange) {
    try {
      // Embed the full exchange so facts mentioned in either direction are retrievable
      const fullText = `They said: ${exchange.said}. You responded: ${exchange.text}`;
      const embedding = await embed(fullText);
      this._entries.push({ exchange, embedding });
    } catch (_) {
      // Embedding unavailable — degrade gracefully
    }
  }

  /**
   * Retrieve the top-K most relevant past exchanges for a given query.
   * Returns [] if the store is empty or embedding fails.
   * @param {string} query - current "said" text
   * @param {number} topK
   * @returns {Promise<Array>}
   */
  async retrieve(query, topK = 3) {
    if (!this._entries.length) return [];
    let queryEmb;
    try {
      queryEmb = await embed(query);
    } catch (_) {
      return [];
    }

    return this._entries
      .map(e => ({ exchange: e.exchange, score: cosine(queryEmb, e.embedding) }))
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

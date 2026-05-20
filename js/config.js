// Ollama API endpoints
export const OLLAMA_URL  = 'http://localhost:11434/api/chat';
export const EMBED_URL   = 'http://localhost:11434/api/embeddings';
export const EMBED_MODEL = 'nomic-embed-text';

// Response type labels and their CSS classes (order matters — maps to choices)
export const RESPONSE_TYPES = [
  { label: 'Kind',      cls: 'a' },
  { label: 'Funny',     cls: 'b' },
  { label: 'Sarcastic', cls: 'c' },
  { label: 'Cold',      cls: 'd' },
];

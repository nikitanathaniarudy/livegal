import { OLLAMA_URL, RESPONSE_TYPES } from './config.js';

/**
 * Fetches 4 response options from the local Ollama model.
 * @param {string} said - What the other person said
 * @param {string} model - Ollama model name (e.g. 'llama3.2')
 * @returns {Promise<Array<{label: string, text: string}>>}
 */
/**
 * @param {string} said
 * @param {string} model
 * @param {Array}  context - relevant past exchanges from RAG (may be empty)
 */
export async function fetchOptions(said, model, context = []) {
  const prompt = buildPrompt(said, context);

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);

  const data = await res.json();
  const raw = data.message?.content || '';

  const options = parseOptions(raw);
  if (!options) throw new Error('Could not parse response from model. Try again.');

  return options;
}

function buildPrompt(said, context) {
  const labels = RESPONSE_TYPES.map(t => t.label).join(', ');

  const contextBlock = context.length
    ? `\nFrom earlier in this conversation you already know:\n${
        context.map(c =>
          `- They said: "${c.said.replace(/"/g, "'")}" and you replied: "${c.text.replace(/"/g, "'")}"`
        ).join('\n')
      }\nUse this as memory — if the current message references something from above, acknowledge it naturally.\n`
    : '';

  return `You are generating response options for a real-life visual novel / galgame simulator.${contextBlock}
Someone just said to you: "${said.replace(/"/g, "'")}"

Generate exactly 4 short response options (1-2 sentences each). If the current message references facts or names from the conversation memory above, use them in your responses.
CRITICAL RULES:
- Do NOT use double-quote characters inside any response text. Use single quotes (') instead.
- Do NOT use backslashes.
- Return ONLY raw JSON, no markdown, no code blocks, no explanation.

Format exactly like this:
[{"label":"Kind","text":"..."},{"label":"Funny","text":"..."},{"label":"Sarcastic","text":"..."},{"label":"Cold","text":"..."}]

Labels must be exactly: ${labels} (in that order).`;
}

/**
 * Tries multiple strategies to extract a valid options array from raw LLM output.
 * Local models often produce slightly malformed JSON, so we try to recover gracefully.
 */
function parseOptions(raw) {
  // Strip markdown code fences
  const text = raw.replace(/```json|```/gi, '').trim();

  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    // Strategy 1: parse directly
    try { return JSON.parse(arrMatch[0]); } catch (_) {}

    // Strategy 2: replace unescaped double-quotes inside string values
    const sanitized = arrMatch[0].replace(
      /:\s*"([\s\S]*?)(?=",\s*"|"\s*[}\]])/g,
      (_, inner) => ': "' + inner.replace(/"/g, "'") + '"'
    );
    try { return JSON.parse(sanitized); } catch (_) {}

    // Strategy 3: aggressive quote replacement
    const aggressive = arrMatch[0].replace(/"((?:[^"\\]|\\.)*)"/g, (match, inner) =>
      '"' + inner.replace(/(?<!\\)"/g, "'") + '"'
    );
    try { return JSON.parse(aggressive); } catch (_) {}
  }

  // Strategy 4: regex-extract label + text pairs
  const labels = RESPONSE_TYPES.map(t => t.label);
  const results = [];
  for (const label of labels) {
    const re = new RegExp(label + '[^:]*:\\s*["\u201c]([^"\u201d\\n]{3,})', 'i');
    const m = text.match(re);
    if (m) results.push({ label, text: m[1].trim().replace(/["\u201d]$/, '') });
  }
  if (results.length === 4) return results;

  // Strategy 5: split by numbered lines (1. / 2. etc.)
  const numbered = text.split(/\n/).filter(l => /^[1-4][.)]\s/.test(l.trim()));
  if (numbered.length === 4) {
    return numbered.map((l, i) => ({
      label: labels[i],
      text: l.replace(/^[1-4][.)]\s*(\w+[:\-]\s*)?/, '').trim(),
    }));
  }

  return null;
}

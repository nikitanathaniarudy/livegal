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
 * @param {Array}  recentHistory - the last few exchanges of the current session (chronological)
 * @param {Array}  memories - relevant past exchanges from RAG (similarity-based)
 */
export async function fetchOptions(said, model, recentHistory = [], memories = [], relationships = [], playerName = '') {
  const prompt = buildPrompt(said, recentHistory, memories, relationships, playerName);

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

function buildPrompt(said, recentHistory = [], memories = [], relationships = [], playerName = '') {
  const labels = RESPONSE_TYPES.map(t => t.label).join(', ');

  const historyBlock = recentHistory.length
    ? `\nImmediate Conversation History (chronological):\n${
        recentHistory.map(c =>
          `- They said: "${c.said.replace(/"/g, "'")}" | You replied: "${c.text.replace(/"/g, "'")}"`
        ).join('\n')
      }\n`
    : '';

  const memoryBlock = memories.length
    ? `\nRelevant Past Memories (from older sessions or distant context):\n${
        memories.map(c =>
          `- They said: "${c.said.replace(/"/g, "'")}" | You replied: "${c.text.replace(/"/g, "'")}"`
        ).join('\n')
      }\n`
    : '';

  const contextInstruction = (historyBlock || memoryBlock)
    ? `Use the history and memories provided above to stay consistent and refer back to previous topics naturally. Do not repeat yourself.\n`
    : '';

  // Deduplicate relationships by person name, keep most recent per name
  const relMap = {};
  for (const r of relationships) {
    if (!relMap[r.toName] || r.timestamp > relMap[r.toName].timestamp) {
      relMap[r.toName] = r;
    }
  }
  const relList = Object.values(relMap)
    .sort((a, b) => {
      const priority = { romantic: 0, family: 1, friend: 2, work: 3, other: 4 };
      return (priority[a.category] ?? 4) - (priority[b.category] ?? 4);
    })
    .slice(0, 8);

  const relationshipBlock = relList.length
    ? `\nBackground facts about this person (use only to inform your tone and awareness — never invent events):\n${
        relList.map(r => `- ${r.toName}: ${r.relationship || 'someone they know'} (${r.category})`).join('\n')
      }\nOnly reference these people if the current message directly mentions them or if their relationship is clearly relevant. Do NOT fabricate events, history, or drama involving these names.\n`
    : '';

  const identity = playerName
    ? `You are ${playerName}, the player character in a real-life visual novel / galgame simulator.`
    : `You are the player character in a real-life visual novel / galgame simulator.`;

  return `${identity}${historyBlock}${memoryBlock}${contextInstruction}${relationshipBlock}
Someone just said to you: "${said.replace(/"/g, "'")}"

Generate exactly 4 short response options (1-2 sentences each).
CRITICAL RULES:
- Do NOT use double-quote characters inside any response text. Use single quotes (') instead.
- Do NOT use backslashes.
- NEVER invent or assume events, facts, or history not explicitly stated in the conversation above (e.g. do NOT say things like "didn't X dump you" or "I heard X did Y" unless it was actually said).
- Only mention people from the background facts if the current message is directly about them.
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

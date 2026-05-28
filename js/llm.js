import { OLLAMA_URL, RESPONSE_TYPES, CHARACTERS } from './config.js';

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
export async function fetchOptions(said, model, recentHistory = [], memories = [], relationships = [], playerName = '', characterKey = 'default', language = '', scenarioContext = '') {
  const prompt = buildPrompt(said, recentHistory, memories, relationships, playerName, characterKey, language, scenarioContext);

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

function buildPrompt(said, recentHistory = [], memories = [], relationships = [], playerName = '', characterKey = 'default', language = '', scenarioContext = '') {
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

  const scenarioBlock = scenarioContext
    ? `\nACTIVE SCENARIO (this is the most important context — read carefully):\n${scenarioContext}\n\nAll 4 response options MUST reflect this specific situation and emotional state. They should feel like things only someone in exactly this scenario would say — reference the specific tension, history, or stakes where natural. Generic responses that could apply to any conversation are wrong. Make each option distinct in how it handles the emotional subtext.\n`
    : '';

  const identity = playerName
    ? `You are ${playerName}. Your name is ${playerName} and only ${playerName} — never any other name. You are the player character in a real-life social simulator.`
    : `You are the player character in a real-life social simulator.`;

  const character = CHARACTERS[characterKey] || CHARACTERS.default;
  const personaBlock = character.prompt
    ? `\nPersonality: ${character.prompt}\n`
    : '';

  const languageRule = language
    ? `- Write ALL response text in ${language}. Do not mix languages.\n`
    : '';

  return `${identity}${personaBlock}${scenarioBlock}${historyBlock}${memoryBlock}${contextInstruction}${relationshipBlock}
Someone just said to you: "${said.replace(/"/g, "'")}"

Generate exactly 4 short response options (1-2 sentences each).
CRITICAL RULES:
- Do NOT use double-quote characters inside any response text. Use single quotes (') instead.
- Do NOT use backslashes.
- NEVER invent or assume events, facts, or history not explicitly stated in the conversation above.
- Only mention people from the background facts if the current message is directly about them.
${playerName ? `- Your name is ${playerName}. NEVER refer to yourself by any other name (not Max, not Alex, not any AI name).\n` : ''}- Responses are what ${playerName || 'you'} would say — first-person, natural, conversational.
${languageRule}- Return ONLY raw JSON, no markdown, no code blocks, no explanation.

Format exactly like this:
[{"label":"Kind","text":"..."},{"label":"Funny","text":"..."},{"label":"Sarcastic","text":"..."},{"label":"Cold","text":"..."}]

Labels must be exactly: ${labels} (in that order).`;
}

/**
 * At session end — asks the LLM to evaluate how the player navigated the scenario.
 * Returns { honesty, empathy, courage, overall } or null on failure.
 */
export async function evaluateSession(exchanges, scenarioContext, model) {
  if (!exchanges.length || !scenarioContext) return null;

  const chron   = [...exchanges].reverse();
  const summary = chron.map((e, i) =>
    `${i + 1}. They said: "${e.said.replace(/"/g, "'")}" — You chose (${e.label}): "${e.text.replace(/"/g, "'")}"`
  ).join('\n');

  const prompt = `You are analyzing how someone handled a real social situation.

SCENARIO:
${scenarioContext}

CONVERSATION — ${chron.length} exchange${chron.length !== 1 ? 's' : ''} (chronological):
${summary}

Rate the player on these 3 dimensions (integer 1–10) with one short honest observation each. Then write one sentence about what this conversation revealed about them as a person.

Return ONLY raw JSON — no markdown, no explanation:
{"honesty":{"score":7,"note":"..."},"empathy":{"score":6,"note":"..."},"courage":{"score":8,"note":"..."},"overall":"..."}`;

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw  = (data.message?.content || '').replace(/```json|```/gi, '').trim();
    const m    = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (_) {}
  return null;
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

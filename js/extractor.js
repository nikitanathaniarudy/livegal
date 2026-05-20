import { OLLAMA_URL } from './config.js';

const CATEGORIES = {
  friend:   /friend|buddy|pal|bestie|mate|homie/i,
  family:   /brother|sister|mother|father|mom|dad|son|daughter|sibling|cousin|uncle|aunt|grandma|grandpa|grandparent|nephew|niece|wife|husband/i,
  romantic: /girlfriend|boyfriend|partner|fianc|spouse|lover|crush|ex/i,
  work:     /colleague|coworker|boss|employee|manager|supervisor|teammate|cofounder|intern/i,
};

function categorize(relationship) {
  for (const [cat, re] of Object.entries(CATEGORIES)) {
    if (re.test(relationship)) return cat;
  }
  return 'other';
}

function parse(raw) {
  const text = raw.replace(/```json|```/gi, '').trim();
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr)
      ? arr
          .filter(r => r.name && r.relationship && typeof r.name === 'string')
          .map(r => ({ ...r, category: categorize(r.relationship) }))
      : [];
  } catch (_) {
    return [];
  }
}

/**
 * Calls the LLM to extract named people and relationships from what someone said.
 * Fire-and-forget safe — always resolves (never throws).
 *
 * @param {string} said        - what the person said
 * @param {string} model       - Ollama model name
 * @param {string} speakerName - name of the person who said it
 * @returns {Promise<Array<{name, relationship, category}>>}
 */
export async function extractRelationships(said, model, speakerName) {
  const prompt =
`List any people that ${speakerName} explicitly names and their relationship to ${speakerName} in the sentence below.

"${said.replace(/"/g, "'")}"

Return ONLY a JSON array. If no person is named, return [].
Format: [{"name":"Alice","relationship":"close friend"}]
Names must be proper nouns. Do not invent names not in the sentence.`;

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return parse(data.message?.content || '');
  } catch (_) {
    return [];
  }
}

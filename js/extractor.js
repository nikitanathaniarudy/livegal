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

function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function parse(raw, said = '') {
  let text = raw.replace(/```json|```/gi, '').trim();

  const objectRegex = /\{[\s\S]*?\}/g;
  const matches = text.match(objectRegex);

  if (matches) {
    const results = [];
    for (const m of matches) {
      try {
        const result = validate(JSON.parse(m), said);
        if (result) results.push(result);
      } catch (_) {}
    }
    if (results.length > 0) return results;
  }

  const startArr = text.indexOf('[');
  const endArr   = text.lastIndexOf(']');

  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    const jsonPart = text.slice(startArr, endArr + 1);
    try {
      const parsed = JSON.parse(jsonPart);
      if (Array.isArray(parsed)) {
        if (parsed.length === 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
          const result = validate({ name: parsed[0], relationship: parsed[1] }, said);
          return result ? [result] : [];
        }
        return parsed.map(item => validate(item, said)).filter(Boolean);
      }
      return [validate(parsed, said)].filter(Boolean);
    } catch (_) {}
  }

  return [];
}

// Words that are never people's names — catches common LLM hallucinations
const WORD_BLACKLIST = new Set([
  'None', 'Unknown', 'N/A', 'Someone', 'Anyone', 'Everyone', 'Nobody',
  'Everybody', 'Anybody', 'User', 'Speaker', 'Me', 'You', 'Him', 'Her',
  'Them', 'Us', 'Myself', 'Yourself', 'Himself', 'Herself', 'Themselves',
  'This', 'That', 'These', 'Those', 'Here', 'There', 'Now', 'Then', 'Soon',
  'Later', 'Today', 'Tomorrow', 'Yesterday', 'Someday', 'Always', 'Never',
  'Something', 'Nothing', 'Everything', 'Anything', 'Somewhere', 'Nowhere',
  'Introducer', 'Presenter', 'Friend', 'Buddy', 'Boss', 'Manager', 'Colleague',
  'Boyfriend', 'Girlfriend', 'Partner', 'Spouse', 'Husband', 'Wife',
  'Lover', 'Crush', 'Fiance', 'Fiancee', 'Ex', 'Coworker', 'Teammate',
]);

function validate(item, said = '') {
  let obj = item;
  if (typeof item === 'string' && item.includes('{')) {
    try { obj = JSON.parse(item); } catch (_) { return null; }
  }

  if (!obj || typeof obj !== 'object' || !obj.name) return null;

  const name = toTitleCase(String(obj.name).trim());

  if (name.length < 2)                 return null; // too short
  if (WORD_BLACKLIST.has(name))        return null; // common word
  if (/^\d/.test(name))               return null; // starts with digit
  if (name.split(/\s+/).length > 3)   return null; // too many words for a name

  // The name must actually appear in what was said — kills LLM hallucinations
  if (said && !said.toLowerCase().includes(name.toLowerCase())) return null;

  return {
    name,
    relationship: obj.relationship ? String(obj.relationship).toLowerCase().trim() : null,
    traits:       Array.isArray(obj.traits) ? obj.traits.map(t => String(t).toLowerCase().trim()) : [],
    category:     obj.relationship ? categorize(String(obj.relationship)) : 'other',
  };
}

/**
 * Calls the LLM to extract named people, relationships, and traits from what someone said.
 * Fire-and-forget safe — always resolves (never throws).
 *
 * @param {string} said        - what the person said
 * @param {string} model       - Ollama model name
 * @param {string} speakerName - name of the person who said it
 * @returns {Promise<Array<{name, relationship, traits, category}>>}
 */
export async function extractRelationships(said, model, speakerName) {
  const prompt =
`Extract ONLY real named people from this text (excluding ${speakerName}).

Text: "${said.replace(/"/g, "'")}"

STRICT RULES:
- A person MUST have an actual first name or full name used in the text.
- Do NOT extract: pronouns (her, him, they), adverbs (someday, later), common words, or anything that is not a person's real name.
- If no named person is mentioned, return exactly: []
- Return ONLY raw JSON array, no explanation.

Fields per person:
- "name": their proper name (Title Case, must appear verbatim in the text)
- "relationship": their connection to ${speakerName} (e.g. "friend", "sister"). null if unclear.
- "traits": adjectives describing them. [] if none.

Examples:
"I'm gonna catch up with my friend Sandra" → [{"name":"Sandra","relationship":"friend","traits":[]}]
"I will introduce you to her someday" → []
"My boss Tom is really strict" → [{"name":"Tom","relationship":"boss","traits":["strict"]}]
"Let's go see Alice" → [{"name":"Alice","relationship":null,"traits":[]}]
"I might see someone later" → []

JSON ONLY:`;

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
    if (!res.ok) {
      console.error('Relationship extraction failed: HTTP', res.status);
      return [];
    }
    const data = await res.json();
    const content = data.message?.content || '';
    const parsed = parse(content, said);
    return parsed;
  } catch (err) {
    console.error('Relationship extraction error:', err);
    return [];
  }
}

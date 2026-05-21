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

function parse(raw) {
  // 1. Remove markdown code blocks if present
  let text = raw.replace(/```json|```/gi, '').trim();

  // 2. Try to find objects directly using regex as a first pass/fallback
  // This is very robust against LLM chatter and bad array quoting
  const objectRegex = /\{[\s\S]*?\}/g;
  const matches = text.match(objectRegex);
  
  if (matches) {
    const results = [];
    for (const m of matches) {
      try {
        // Clean potential bad quotes inside the match if it's wrapped in quotes
        let cleaned = m;
        const result = validate(JSON.parse(cleaned));
        if (result) results.push(result);
      } catch (_) {
        // If JSON.parse fails, it might be the "unescaped quotes" issue
        // Try a more aggressive cleanup or just skip
      }
    }
    if (results.length > 0) return results;
  }

  // 3. Fallback to standard array parsing if regex didn't find anything valid
  const startArr = text.indexOf('[');
  const endArr   = text.lastIndexOf(']');
  
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    const jsonPart = text.slice(startArr, endArr + 1);
    try {
      const parsed = JSON.parse(jsonPart);
      if (Array.isArray(parsed)) {
        if (parsed.length === 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
           const result = validate({ name: parsed[0], relationship: parsed[1] });
           return result ? [result] : [];
        }
        return parsed.map(validate).filter(Boolean);
      }
      return [validate(parsed)].filter(Boolean);
    } catch (err) { }
  }

  return [];
}

const BLACKLIST_NAMES = ['None', 'Unknown', 'N/A', 'Someone', 'Nobody', 'User', 'Speaker'];

function validate(item) {
  let obj = item;
  if (typeof item === 'string' && item.includes('{')) {
    try { obj = JSON.parse(item); } catch (_) { return null; }
  }
  
  if (obj && typeof obj === 'object' && obj.name) {
    const name = toTitleCase(String(obj.name).trim());
    if (BLACKLIST_NAMES.includes(name)) return null;

    return {
      name,
      relationship: obj.relationship ? String(obj.relationship).toLowerCase().trim() : null,
      traits: Array.isArray(obj.traits) ? obj.traits.map(t => String(t).toLowerCase().trim()) : [],
      category: obj.relationship ? categorize(String(obj.relationship)) : 'other'
    };
  }
  return null;
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
`Analyze the text and extract any people mentioned (other than ${speakerName}).
Distinguish between their permanent RELATIONSHIP to ${speakerName} and their current TRAITS/ADJECTIVES.

Text: "${said.replace(/"/g, "'")}"

Instructions:
- Return ONLY a raw JSON array of objects.
- "name": person's name (Title Case).
- "relationship": their role (e.g. "child", "friend", "boss"). Use null if not mentioned.
- "traits": array of adjectives describing them (e.g. ["naughty", "kind"]). Empty array if none.

Example:
"Raynard is my child and has been so naughty" -> [{"name":"Raynard","relationship":"child","traits":["naughty"]}]
"Alice is a kind friend" -> [{"name":"Alice","relationship":"friend","traits":["kind"]}]

JSON ONLY.`;

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
    console.log('LLM Relationship Raw Output:', content);
    const parsed = parse(content);
    console.log('Parsed Relationships:', parsed);
    return parsed;
  } catch (err) {
    console.error('Relationship extraction error:', err);
    return [];
  }
}

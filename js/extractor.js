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

  // 2. Try to find an array first [...]
  const startArr = text.indexOf('[');
  const endArr   = text.lastIndexOf(']');
  
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    const jsonPart = text.slice(startArr, endArr + 1);
    try {
      const parsed = JSON.parse(jsonPart);
      
      // Case A: Array of objects or strings
      if (Array.isArray(parsed)) {
        // Special Case: Simple pair ["Nikita", "spouse"]
        if (parsed.length === 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string' && !parsed[0].includes('{')) {
           const result = validate({ name: parsed[0], relationship: parsed[1] });
           return result ? [result] : [];
        }
        
        return parsed.map(validate).filter(Boolean);
      }
      
      // Case B: Single object {...}
      return [validate(parsed)].filter(Boolean);
    } catch (err) {
      console.warn('Relationship parse failed on slice:', jsonPart, err);
    }
  }

  // 3. Fallback: Try to find a single object if no array was found
  const startObj = text.indexOf('{');
  const endObj   = text.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    const jsonPart = text.slice(startObj, endObj + 1);
    try {
      const obj = JSON.parse(jsonPart);
      return [validate(obj)].filter(Boolean);
    } catch (_) { return []; }
  }

  return [];
}

function validate(item) {
  // If LLM returned a stringified object inside an array, try to parse it
  let obj = item;
  if (typeof item === 'string' && item.includes('{')) {
    try { obj = JSON.parse(item); } catch (_) { return null; }
  }
  
  if (obj && typeof obj === 'object' && obj.name && obj.relationship) {
    return {
      name: toTitleCase(String(obj.name).trim()),
      relationship: String(obj.relationship).toLowerCase().trim(),
      category: categorize(String(obj.relationship))
    };
  }
  return null;
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
`Analyze the text and extract any people mentioned (other than ${speakerName}) and their relationship to ${speakerName}.

Text: "${said.replace(/"/g, "'")}"

Instructions:
- Return ONLY a raw JSON array of objects.
- Each object MUST have "name" (the person's name) and "relationship" (their role).
- Relationships can be roles (friend, dad), statuses (spouse, ex), or labels (stranger, enemy).
- Be careful to find single names like "Don" or "Nikita".

Examples:
"I'm going to see my therapist Don" -> [{"name":"Don","relationship":"therapist"}]
"Terry disowned me, I am a stranger" -> [{"name":"Terry","relationship":"stranger"}]
"Nikita and me got married" -> [{"name":"Nikita","relationship":"spouse"}]

Return [] if no other people are named. JSON ONLY.`;

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

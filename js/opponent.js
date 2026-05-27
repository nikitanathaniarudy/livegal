import { OLLAMA_URL } from './config.js';

// ── Cue extraction via LLM ────────────────────────────────────────────

/**
 * Sends a single statement (what the other person said) to Ollama and
 * extracts 4 personality signal scores (0.0–1.0 each).
 * Fire-and-forget safe — always resolves, returns null on failure.
 */
export async function extractOpponentCues(said, model, isScenario = false) {
  if (!said?.trim()) return null;
  if (said.trim().split(/\s+/).length < 5) return null; // skip one-liners
  try {
    const scenarioNote = isScenario
      ? `IMPORTANT: The speaker is playing a roleplay character in a social scenario game. ` +
        `Ignore what the content is about (the story, the scenario premise, what they reveal about the plot). ` +
        `Rate ONLY the actual communication style — the real energy, tone, and warmth they bring to how they speak. ` +
        `A guarded character played warmly still scores high warmth.\n\n`
      : '';

    const prompt =
      scenarioNote +
      `Analyse the communication STYLE of this statement — HOW the person speaks, not what they're talking about.\n` +
      `Rate on exactly 4 dimensions from 0.0 to 1.0:\n` +
      `- warmth: 0=cold/distant/clipped tone, 1=warm/caring/friendly tone\n` +
      `- humor: 0=flat/serious delivery, 1=playful/witty/light delivery\n` +
      `- openness: 0=guarded phrasing/closed body language in words, 1=naturally expressive and easy manner\n` +
      `- directness: 0=meandering/hedging/vague, 1=clear/confident/straight to the point\n\n` +
      `Statement: "${said.replace(/"/g, "'")}"\n\n` +
      `Return ONLY raw JSON, no explanation, no markdown:\n` +
      `{"warmth":0.0,"humor":0.0,"openness":0.0,"directness":0.0}`;

    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const raw  = data.message?.content || '';
    return parseCues(raw);
  } catch (_) {
    return null;
  }
}

function parseCues(raw) {
  const text = raw.replace(/```json|```/gi, '').trim();
  const m    = text.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    const keys = ['warmth', 'humor', 'openness', 'directness'];
    if (!keys.every(k => typeof obj[k] === 'number')) return null;
    const cues = {};
    keys.forEach(k => { cues[k] = Math.min(1, Math.max(0, obj[k])); });
    return cues;
  } catch (_) {
    return null;
  }
}

// ── Profile computation ───────────────────────────────────────────────

/**
 * Aggregates all saved cue observations into a personality profile
 * for the other person. Returns null if not enough data.
 */
export function computeOpponentProfile(observations) {
  if (!observations?.length || observations.length < 5) return null;

  // All observations count equally — scenarios are still real conversations.
  // HOW someone speaks (warmth, humor, directness) is genuine regardless of topic.
  const n   = observations.length;
  const avg = { warmth: 0, humor: 0, openness: 0, directness: 0 };

  for (const obs of observations) {
    for (const k of Object.keys(avg)) {
      avg[k] += (obs.cues?.[k] ?? 0);
    }
  }
  for (const k of Object.keys(avg)) avg[k] /= n;

  const type       = classifyOpponent(avg);
  const tip        = deriveApproachTip(avg);
  const confidence = Math.min(1, n / 10);

  const axes = [
    { name: 'Warmth',      left: 'Cold',    right: 'Warm',    value: avg.warmth },
    { name: 'Playfulness', left: 'Serious', right: 'Playful', value: avg.humor },
    { name: 'Openness',    left: 'Guarded', right: 'Open',    value: avg.openness },
    { name: 'Directness',  left: 'Vague',   right: 'Direct',  value: avg.directness },
  ];

  return { avg, type, tip, axes, confidence, count: n };
}

function classifyOpponent({ warmth, humor, openness, directness }) {
  if (warmth > 0.60 && openness > 0.60)
    return { name: 'Open Heart',     emoji: '💛', desc: 'Naturally warm and willing to share. Comfortable going into emotional depth without much prompting.' };
  if (warmth > 0.60 && humor > 0.55)
    return { name: 'The Sunflower',  emoji: '🌻', desc: 'Warm and playful — they use humor to connect, not to deflect. Easy to be around.' };
  if (warmth > 0.60 && openness < 0.40)
    return { name: 'Hidden Warmth',  emoji: '🕯️', desc: 'Friendly and caring but keeps the real stuff private. Warmth is there — it just takes patience to reach.' };
  if (humor > 0.60 && warmth < 0.40)
    return { name: 'The Deflector',  emoji: '🌀', desc: 'Humor is their shield. They\'re funnier than they are vulnerable — the jokes come out before the feelings do.' };
  if (humor > 0.55 && openness > 0.55)
    return { name: 'The Jester',     emoji: '🃏', desc: 'Playful and surprisingly open. Laughter is how they let you in — follow that thread.' };
  if (directness > 0.65 && warmth < 0.40)
    return { name: 'The Critic',     emoji: '🔍', desc: 'Direct and unsentimental. They say what they think rather than what you want to hear.' };
  if (openness > 0.60 && warmth < 0.40)
    return { name: 'The Analyst',    emoji: '📡', desc: 'Shares readily but stays in their head — facts and thoughts over feelings. Engaged, just emotionally at a distance.' };
  if (warmth < 0.35 && openness < 0.35)
    return { name: 'The Wall',       emoji: '🧱', desc: 'Measured distance in every direction. Not hostile — just private by default. Hard to read, harder to crack.' };
  return   { name: 'The Balanced',   emoji: '⚖️', desc: 'No extreme tendencies — they shift with the conversation. No strong signature style, which makes them adaptable but hard to predict.' };
}

function deriveApproachTip({ warmth, humor, openness, directness }) {
  if (warmth > 0.60 && openness > 0.60)   return 'Lead with genuine warmth — they\'ll match it and go deeper naturally.';
  if (warmth > 0.60 && openness < 0.40)   return 'Be consistent and patient. They open up on their own timeline, not yours.';
  if (humor > 0.60 && warmth < 0.40)      return 'Match their wit first. Trying to get serious too early will make them retreat.';
  if (warmth < 0.35 && openness < 0.35)   return 'Keep it low-pressure. Direct emotional appeals tend to make them pull back further.';
  if (directness > 0.65)                  return 'Skip the softening — they appreciate straight talk over cushioned phrasing.';
  if (openness > 0.60)                    return 'Ask genuine questions. They like to share and will open up if you show real curiosity.';
  if (humor > 0.55)                       return 'A shared laugh travels further than a serious moment with this person.';
  return 'Read the moment — they adapt, so should you.';
}

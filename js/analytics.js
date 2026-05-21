/**
 * analytics.js — crunches all saved conversation data into personality insights.
 * Pure functions, no side effects, no DOM access.
 */

// ── Archetype definitions ─────────────────────────────────────────────
// Each archetype is triggered by a condition function on the pct object.
// Order matters — first match wins.

const ARCHETYPES = [
  {
    name: 'The Nurturer',
    emoji: '🌸',
    condition: p => p.Kind > 0.60,
    description: 'You lead with warmth, and people feel it immediately. Safety is the atmosphere you create — sometimes at the cost of your own honesty. You give before anyone asks.',
    traits: ['Empathetic', 'Gentle', 'Self-sacrificing'],
  },
  {
    name: 'The Jester',
    emoji: '🃏',
    condition: p => p.Funny > 0.55,
    description: 'Serious moments make you reach for a punchline. It\'s not avoidance — it\'s your native language. People love you for it, and occasionally worry you\'re using it as armour.',
    traits: ['Witty', 'Disarming', 'Deflective'],
  },
  {
    name: 'The Cynic',
    emoji: '🔍',
    condition: p => p.Sarcastic > 0.50,
    description: 'You see through the performance and say it out loud. Sharp-tongued and perceptive. Some call it honesty. Others say you could at least soften the landing.',
    traits: ['Perceptive', 'Dry', 'Unfiltered'],
  },
  {
    name: 'The Ghost',
    emoji: '🌑',
    condition: p => p.Cold > 0.50,
    description: 'Emotionally unreachable by design. You keep interactions transactional, walls up indefinitely. People sense depth they\'re not invited to access.',
    traits: ['Reserved', 'Self-reliant', 'Impenetrable'],
  },
  {
    name: 'The Charmer',
    emoji: '✨',
    condition: p => p.Kind + p.Funny > 0.72,
    description: 'Warmth and levity in equal measure. You rarely create friction and the room visibly relaxes when you enter. Disarming without trying — that might be the trick.',
    traits: ['Magnetic', 'Effortless', 'Likeable'],
  },
  {
    name: 'The Provocateur',
    emoji: '🔥',
    condition: p => p.Sarcastic + p.Cold > 0.70,
    description: 'You challenge people by default. Softness feels like a trap; cutting clarity feels natural. You respect people who push back — almost need it.',
    traits: ['Bold', 'Abrasive', 'Respect-driven'],
  },
  {
    name: 'The Tsundere',
    emoji: '🌪️',
    condition: p => p.Cold > 0.35 && p.Kind > 0.25 && p.Cold > p.Kind,
    description: 'Cold on the outside, warm in the moments you can\'t suppress. You push people away, then quietly check if they\'re okay. A mixed signal with a very soft centre.',
    traits: ['Guarded', 'Secretly caring', 'Contradictory'],
  },
  {
    name: 'The Philosopher',
    emoji: '🎭',
    condition: p => p.Sarcastic > 0.28 && p.Kind > 0.28 && Math.abs(p.Sarcastic - p.Kind) < 0.12,
    description: 'You hold the absurdity and the beauty at the same time. Cutting and caring sometimes in a single sentence. People find you difficult to categorise — which you\'d consider a compliment.',
    traits: ['Complex', 'Contradictory', 'Layered'],
  },
  {
    name: 'The Wildcard',
    emoji: '🎲',
    condition: p => {
      const vals = Object.values(p);
      return Math.max(...vals) - Math.min(...vals) < 0.18;
    },
    description: 'No single mode dominates — you respond to the moment, not a pattern. People never quite know what they\'re going to get. That unpredictability is your most consistent trait.',
    traits: ['Adaptive', 'Spontaneous', 'Unreadable'],
  },
  {
    name: 'The Diplomat',
    emoji: '⚖️',
    condition: () => true,
    description: 'Measured and context-aware. You read the room, adjust your register, and rarely leave a bad impression. Not from fear — from a kind of calculated grace that\'s hard to fake.',
    traits: ['Balanced', 'Perceptive', 'Graceful'],
  },
];

// ── GPC (Gal Personality Code) ────────────────────────────────────────
// 4-axis system: Expressive/Introverted · Heart/Cool · Witty/Serious · Focused/Versatile

const GPC_TYPES = {
  EHWF: { name: 'The Sunbeam',      emoji: '☀️',  desc: 'Warm, witty, and reliably uplifting. You light up rooms without trying. People take your energy before you even notice you\'re giving it.' },
  EHWV: { name: 'The Chameleon',    emoji: '🦋',  desc: 'Warm and funny but fluid — you read the room and shift. No one gets the exact same version of you twice. Somehow that\'s charming rather than unsettling.' },
  EHSF: { name: 'The Anchor',       emoji: '⚓',  desc: 'Steady warmth without performance. You don\'t do jokes — you do presence. People come to you when the world feels unstable.' },
  EHSV: { name: 'The Empath',       emoji: '🌊',  desc: 'Warmth that adapts. You feel everything in the room and respond to it — not consistent by design, but perfectly consistent in care.' },
  ECWF: { name: 'The Spark',        emoji: '⚡',  desc: 'Cool exterior, sharp humor. You don\'t lead with warmth but you make people laugh. Disarming when they least expect it.' },
  ECWV: { name: 'The Enigma',       emoji: '🌙',  desc: 'Cool and witty but hard to pin down. You\'re interesting precisely because you\'re unpredictable. People want to figure you out — you don\'t make it easy.' },
  ECSF: { name: 'The Commander',    emoji: '🗡️',  desc: 'Expressive, direct, not warm. You say exactly what you mean. Respect over likability — if you had to choose, you\'d choose respect every time.' },
  ECSV: { name: 'The Storm',        emoji: '🌩️',  desc: 'Loud energy, shifting moods. You fill space without offering softness. Magnetic in a disruptive way — people feel the weather change when you enter.' },
  IHWF: { name: 'The Trickster',    emoji: '🃏',  desc: 'Quiet but funny. You watch, then strike with precision. Not the loudest person in the room — the most memorable one.' },
  IHWV: { name: 'The Drifter',      emoji: '🍃',  desc: 'Warm and witty in bursts. You\'re at your best in moments — people always want more of you, and you rarely give it all at once.' },
  IHSF: { name: 'The Sage',         emoji: '🔮',  desc: 'Still waters. You don\'t speak often, but when you do, people pause. Reserved warmth hits harder for being rare.' },
  IHSV: { name: 'The Wanderer',     emoji: '🌫️',  desc: 'Warm but hard to reach. Soft in ways that resist definition. People sense depth they can\'t quite access, and they\'re not wrong.' },
  ICWF: { name: 'The Phantom',      emoji: '🕯️',  desc: 'Cold but funny — a dangerous combination. You keep people at arm\'s length while making them laugh. They\'re confused and hooked.' },
  ICWV: { name: 'The Shapeshifter', emoji: '🌀',  desc: 'Cool, witty, and unpredictable. Different every time someone thinks they\'ve mapped you. Frustrating and fascinating in exactly equal measure.' },
  ICSF: { name: 'The Sovereign',    emoji: '🌑',  desc: 'Reserved, serious, and cool. Not unfriendly — operating on a different frequency. People earn your warmth slowly, if they earn it at all.' },
  ICSV: { name: 'The Abyss',        emoji: '🕳️',  desc: 'No clear pattern, no easy warmth. You resist categorisation by nature. Whether that\'s your deepest truth or your best defense, even you might not know.' },
};

function deriveGPC(pct) {
  const social  = pct.Kind + pct.Funny;
  const maxPct  = Math.max(pct.Kind, pct.Funny, pct.Sarcastic, pct.Cold);
  const warmSum = pct.Kind + pct.Cold;

  const code = [
    social > 0.50      ? 'E' : 'I',
    pct.Kind > pct.Cold ? 'H' : 'C',
    pct.Funny > 0.22   ? 'W' : 'S',
    maxPct > 0.42      ? 'F' : 'V',
  ].join('');

  const type = GPC_TYPES[code] || { name: 'The Undefined', emoji: '❓', desc: 'Even the algorithm isn\'t sure what to make of you. Somehow that tracks.' };

  const axes = [
    {
      name: 'Social Energy',
      left: 'Introverted', right: 'Expressive',
      value: Math.min(1, social / 0.75),
    },
    {
      name: 'Warmth',
      left: 'Cool', right: 'Warm',
      value: warmSum > 0.01 ? pct.Kind / warmSum : 0.5,
    },
    {
      name: 'Tone',
      left: 'Serious', right: 'Witty',
      value: Math.min(1, pct.Funny / 0.40),
    },
    {
      name: 'Style',
      left: 'Versatile', right: 'Focused',
      value: Math.min(1, Math.max(0, (maxPct - 0.25) / 0.60)),
    },
  ];

  return { code, ...type, axes };
}

// ── In-memory adapter (no DB) ─────────────────────────────────────────

/**
 * Computes analytics directly from the in-session history array.
 * Used by the prototype before the DB layer is wired up.
 * @param {Array} history - [{said, label, text, cls, affectionDelta?}]
 */
export function computeAnalyticsFromHistory(history) {
  const conv = {
    exchanges: history,
    finalAffection: history.reduce((s, h) => s + (h.affectionDelta || 0), 0),
    endedAt: null,
  };
  return computeAnalytics([], [conv]);
}

// ── Main analytics function ───────────────────────────────────────────

/**
 * @param {Array} people  - all people from DB
 * @param {Array} conversations - all conversations from DB
 * @returns {object} analytics result
 */
export function computeAnalytics(people, conversations) {
  const typeCounts   = { Kind: 0, Funny: 0, Sarcastic: 0, Cold: 0 };
  let totalExchanges = 0;
  let totalAffection = 0;
  let scoredExchanges = 0;

  // Aggregate across all conversations
  conversations.forEach(conv => {
    (conv.exchanges || []).forEach(ex => {
      if (ex.label && typeCounts[ex.label] !== undefined) {
        typeCounts[ex.label]++;
        totalExchanges++;
      }
      if (ex.affectionDelta !== undefined) {
        totalAffection += ex.affectionDelta;
        scoredExchanges++;
      }
    });
  });

  // Percentage of each response type
  const pct = {};
  Object.keys(typeCounts).forEach(k => {
    pct[k] = totalExchanges > 0 ? typeCounts[k] / totalExchanges : 0;
  });

  // Archetype + GPC
  const archetype = totalExchanges >= 3 ? ARCHETYPES.find(a => a.condition(pct)) : null;
  const gpc       = totalExchanges >= 3 ? deriveGPC(pct) : null;

  // Per-person affection (for compatibility ranking)
  const personAffection = people.map(person => {
    const convs = conversations.filter(c => c.personId === person.id);
    const aff   = convs.reduce((sum, c) => sum + (c.finalAffection || 0), 0);
    return { name: person.name, affection: aff, sessions: convs.length };
  }).filter(p => p.sessions > 0)
    .sort((a, b) => b.affection - a.affection);

  // Session affection over time (for trend)
  const sessionTrend = conversations
    .filter(c => c.endedAt)
    .sort((a, b) => new Date(a.endedAt) - new Date(b.endedAt))
    .map(c => ({ date: c.endedAt, affection: c.finalAffection || 0 }));

  return {
    typeCounts,
    pct,
    totalExchanges,
    totalAffection,
    scoredExchanges,
    totalSessions:  conversations.length,
    totalPeople:    personAffection.length,
    avgAffection:   conversations.length > 0
      ? Math.round(totalAffection / conversations.length * 10) / 10
      : 0,
    archetype,
    gpc,
    personAffection,
    sessionTrend,
  };
}

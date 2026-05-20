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
    description: 'You lead with warmth. People feel safe around you — maybe too safe. You prioritise others\' comfort, sometimes at the cost of honesty.',
    traits: ['Empathetic', 'Gentle', 'Supportive'],
  },
  {
    name: 'The Jester',
    emoji: '🃏',
    condition: p => p.Funny > 0.55,
    description: 'You deflect with humour. Serious moments make you reach for a punchline. People love you at parties; they worry about you in private.',
    traits: ['Witty', 'Playful', 'Avoidant'],
  },
  {
    name: 'The Cynic',
    emoji: '😏',
    condition: p => p.Sarcastic > 0.50,
    description: 'Sharp-tongued and perceptive. You see through facades and say it out loud. Some call it honesty. Others call it exhausting.',
    traits: ['Perceptive', 'Dry', 'Unfiltered'],
  },
  {
    name: 'The Ghost',
    emoji: '🌑',
    condition: p => p.Cold > 0.50,
    description: 'Emotionally distant by default. You keep interactions transactional, walls permanently up. People sense something unspoken.',
    traits: ['Reserved', 'Self-reliant', 'Detached'],
  },
  {
    name: 'The Charmer',
    emoji: '✨',
    condition: p => p.Kind + p.Funny > 0.72,
    description: 'Warm, light, and easy to like. You mix kindness with levity and rarely create friction. The room relaxes when you arrive.',
    traits: ['Magnetic', 'Approachable', 'Likeable'],
  },
  {
    name: 'The Provocateur',
    emoji: '🔥',
    condition: p => p.Sarcastic + p.Cold > 0.70,
    description: 'You challenge people instinctively. Cutting remarks come naturally; softness feels like a trap. You respect those who push back.',
    traits: ['Bold', 'Abrasive', 'Direct'],
  },
  {
    name: 'The Tsundere',
    emoji: '🌪️',
    condition: p => p.Cold > 0.35 && p.Kind > 0.25 && p.Cold > p.Kind,
    description: 'Cold on the surface, warm underneath. You push people away, then quietly check if they\'re okay. It\'s a mixed signal with a soft centre.',
    traits: ['Guarded', 'Caring', 'Contradictory'],
  },
  {
    name: 'The Philosopher',
    emoji: '🎭',
    condition: p => p.Sarcastic > 0.28 && p.Kind > 0.28 && Math.abs(p.Sarcastic - p.Kind) < 0.12,
    description: 'You see the absurdity and the beauty simultaneously. Your responses shift between cutting and caring — sometimes in the same breath.',
    traits: ['Complex', 'Thoughtful', 'Contradictory'],
  },
  {
    name: 'The Wildcard',
    emoji: '🎲',
    condition: p => {
      const vals = Object.values(p);
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      return max - min < 0.18; // all four roughly equal
    },
    description: 'Unpredictable and hard to categorise. You respond to the moment, not a pattern. People never quite know what they\'re going to get.',
    traits: ['Spontaneous', 'Adaptive', 'Unreadable'],
  },
  {
    name: 'The Diplomat',
    emoji: '⚖️',
    condition: () => true, // fallback
    description: 'Measured and context-aware. You read the room and adjust. Not from fear — from calculated grace. You rarely leave a bad impression.',
    traits: ['Balanced', 'Adaptable', 'Thoughtful'],
  },
];

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

  // Archetype
  const archetype = totalExchanges >= 3
    ? ARCHETYPES.find(a => a.condition(pct))
    : null;

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
    personAffection,
    sessionTrend,
  };
}

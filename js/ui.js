import { RESPONSE_TYPES }         from './config.js';
import { computeOpponentProfile } from './opponent.js';
import { getStoryProgress }       from './stories.js';

const CLOSENESS_TIERS = [
  { max: 15,  label: 'Stranger',     color: '#4a4560' },
  { max: 30,  label: 'Acquaintance', color: '#6eb8c8' },
  { max: 50,  label: 'Familiar',     color: '#7ec89b' },
  { max: 70,  label: 'Friend',       color: '#9b7fd4' },
  { max: 85,  label: 'Close',        color: '#c87d6e' },
  { max: 100, label: 'Confidant',    color: '#c8a96e' },
];

const TYPE_COLORS = {
  Kind:      'var(--choice-a)',
  Funny:     'var(--choice-b)',
  Sarcastic: 'var(--choice-c)',
  Cold:      'var(--choice-d)',
};

function closenessInfo(val = 0) {
  const tier = CLOSENESS_TIERS.find(t => val <= t.max) || CLOSENESS_TIERS.at(-1);
  return { ...tier, pct: Math.round(val) };
}

// ── Status dot ───────────────────────────────────────────────────────

export function setStatus(state) {
  document.getElementById('status-dot').className = 'status-dot ' + (state || '');
}

// ── Dialogue display ─────────────────────────────────────────────────

export function setDialogue(text) {
  const el = document.getElementById('dialogue-display');
  el.textContent = text;
  el.classList.remove('empty');
}

export function resetDialogue() {
  const el = document.getElementById('dialogue-display');
  el.textContent = 'Type what they said below and press Generate ↓';
  el.classList.add('empty');
}

/**
 * Switch the nameplate between the other person and the player.
 * @param {string} name      - Name to display
 * @param {boolean} isPlayer - true = player speaking (applies .player-speaking style)
 */
export function setNameplate(name, isPlayer = false) {
  const nameEl  = document.getElementById('session-person-name');
  const box     = document.querySelector('.vn-dialogue-box');
  if (nameEl) nameEl.textContent = name;
  if (box)    box.classList.toggle('player-speaking', isPlayer);
}

// ── Error banner ─────────────────────────────────────────────────────

export function showError(html) {
  document.getElementById('error-container').innerHTML =
    `<div class="error-msg">${html}</div>`;
}

export function clearError() {
  document.getElementById('error-container').innerHTML = '';
}

// ── Mic hint text ────────────────────────────────────────────────────

export function setHint(text, active = false) {
  const el = document.getElementById('transcript-hint');
  el.textContent = text;
  el.classList.toggle('active', active);
}

// ── Choice grid ──────────────────────────────────────────────────────

export function showShimmer() {
  document.getElementById('choices-grid').innerHTML =
    RESPONSE_TYPES.map(({ cls }) => `
      <div class="choice-btn ${cls}" style="pointer-events:none">
        <div class="choice-tag">&nbsp;</div>
        <div class="shimmer" style="width:90%"></div>
        <div class="shimmer" style="width:60%"></div>
      </div>
    `).join('');
}

export function showEmptyChoices(msg = 'Options will appear here after you generate') {
  document.getElementById('choices-grid').innerHTML =
    `<div class="empty-choices">${msg}</div>`;
}

/**
 * Renders 4 choice buttons.
 * @param {Array<{label: string, text: string}>} options
 * @param {function(index: number, label: string, text: string): void} onPick
 */
export function renderChoices(options, onPick) {
  document.getElementById('choices-grid').innerHTML =
    options.slice(0, 4).map((opt, i) => {
      const cls = RESPONSE_TYPES[i]?.cls || 'a';
      return `
        <button class="choice-btn ${cls}" data-index="${i}">
          <div class="choice-tag">option ${i + 1}</div>
          <div class="choice-text">${opt.text}</div>
        </button>
      `;
    }).join('');

  document.querySelectorAll('.choice-btn[data-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.index);
      onPick(i, options[i].label, options[i].text);
    });
  });
}

// ── History list ─────────────────────────────────────────────────────

export function renderHistory(history) {
  const list = document.getElementById('history-list');
  if (!history.length) { list.innerHTML = ''; return; }
  list.innerHTML = history.map(h => {
    const hasDelta = h.affectionDelta !== undefined;
    const deltaClass = h.affectionDelta > 0 ? 'pos' : h.affectionDelta < 0 ? 'neg' : 'zero';
    const deltaSign = h.affectionDelta > 0 ? '+' : '';
    const deltaText = hasDelta
      ? `<div class="history-delta ${deltaClass}">${h.emoji || ''} ${deltaSign}${h.affectionDelta}</div>`
      : '';
    return `
      <div class="history-entry">
        <div class="history-said">
          <strong>They said:</strong> ${h.said}
          <span style="display:block;margin-top:4px;color:var(--ink)">↳ ${h.text}</span>
          ${deltaText}
        </div>
        <div class="history-chose badge-${h.cls}">${h.label}</div>
      </div>
    `;
  }).join('');
}

// ── Affection meter ──────────────────────────────────────────────────

/**
 * Updates the affection bar and total display.
 * total ranges from -99 to +99; bar center = 0.
 */
export function updateAffectionMeter(total, sparkData = []) {
  const fill  = document.getElementById('affection-bar-fill');
  const label = document.getElementById('affection-total');
  const spark = document.getElementById('affection-spark');

  const pct    = ((total + 99) / 198) * 100;
  const center = 50;

  if (total >= 0) {
    fill.style.left       = center + '%';
    fill.style.width      = (pct - center) + '%';
    fill.style.background = 'var(--choice-d)';
  } else {
    fill.style.left       = pct + '%';
    fill.style.width      = (center - pct) + '%';
    fill.style.background = 'var(--choice-c)';
  }

  label.textContent = (total > 0 ? '+' : '') + total;
  label.style.color = total > 0 ? 'var(--choice-d)' : total < 0 ? 'var(--choice-c)' : 'var(--ink-dim)';

  if (!spark) return;

  if (sparkData.length < 2) {
    spark.classList.add('hidden');
    return;
  }

  spark.classList.remove('hidden');

  const W = 300, H = 22, PAD = 2;
  const min   = Math.min(0, ...sparkData);
  const max   = Math.max(0, ...sparkData);
  const range = max - min || 1;
  const zeroY = (H - PAD - ((0 - min) / range) * (H - PAD * 2)).toFixed(1);
  const last  = sparkData[sparkData.length - 1];
  const color = last > 0 ? 'var(--choice-d)' : last < 0 ? 'var(--choice-c)' : 'var(--ink-dim)';

  const points = sparkData.map((v, i) => {
    const x = (PAD + (i / (sparkData.length - 1)) * (W - PAD * 2)).toFixed(1);
    const y = (H - PAD - ((v - min) / range) * (H - PAD * 2)).toFixed(1);
    return `${x},${y}`;
  }).join(' ');

  const lastX = (W - PAD).toFixed(1);
  const lastY = (H - PAD - ((last - min) / range) * (H - PAD * 2)).toFixed(1);

  spark.setAttribute('viewBox', `0 0 ${W} ${H}`);
  spark.innerHTML = `
    <line x1="${PAD}" y1="${zeroY}" x2="${W - PAD}" y2="${zeroY}"
      stroke="rgba(220,200,160,0.1)" stroke-width="0.5" stroke-dasharray="3 3"/>
    <polyline points="${points}" fill="none" stroke="${color}"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>
    <circle cx="${lastX}" cy="${lastY}" r="2.5" fill="${color}" opacity="0.9"/>`;
}

// ── Score popup ──────────────────────────────────────────────────────

/**
 * Shows a floating score popup over the camera area.
 * @param {number} delta
 * @param {string} dominant - expression name key
 * @param {Object} emojiMap - map from expression name → emoji
 */
export function showScorePopup(delta, dominant, emojiMap) {
  const popup = document.getElementById('score-popup');
  const sign = delta > 0 ? '+' : '';
  const emoji = emojiMap[dominant] || '😐';
  const color = delta > 0 ? 'var(--choice-d)' : delta < 0 ? 'var(--choice-c)' : 'var(--ink-dim)';

  popup.textContent = `${emoji} ${sign}${delta}`;
  popup.style.color = color;
  popup.classList.remove('show');

  // Force reflow so animation restarts
  void popup.offsetWidth;
  popup.classList.add('show');
}

// ── Camera overlay helpers ───────────────────────────────────────────

export function setCameraOverlayHint(text) {
  document.getElementById('camera-overlay-hint').textContent = text;
}

export function hideCameraOverlay() {
  const el = document.getElementById('camera-overlay');
  el.classList.add('hidden');
  el.style.display = 'none';
}

export function setCameraAnalyzing(active) {
  document.getElementById('camera-preview')?.classList.toggle('analyzing', active);
}

// ── Person selector ──────────────────────────────────────────────────

/**
 * Populates the person <select> dropdown with people from the DB.
 * @param {Array} people
 */
export function populatePersonSelect(people) {
  const sel = document.getElementById('person-select');
  // Keep first two options (placeholder + "New person")
  while (sel.options.length > 2) sel.remove(2);

  people
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
    .forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
}

// ── Session bar ──────────────────────────────────────────────────────

export function showSessionBar(personName) {
  const sel = document.getElementById('person-selector');
  sel.classList.add('hidden');
  sel.style.display = 'none';

  const bar = document.getElementById('session-bar');
  bar.classList.remove('hidden');
  bar.style.display = '';

  // Show the input row when in a session
  const inputRow = document.querySelector('.vn-input-row');
  if (inputRow) {
    inputRow.classList.remove('hidden');
    inputRow.style.display = 'flex';
  }

  document.getElementById('session-person-name').textContent = personName;
}

export function resetToIdleState() {
  const bar = document.getElementById('session-bar');
  if (bar) {
    bar.classList.add('hidden');
    bar.style.display = 'none';
  }

  const inputRow = document.querySelector('.vn-input-row');
  if (inputRow) {
    inputRow.classList.add('hidden');
    inputRow.style.display = 'none';
  }

  const namePlate = document.getElementById('session-person-name');
  if (namePlate) namePlate.textContent = '—';
}

export function showPersonSelector() {
  resetToIdleState();
  const sel = document.getElementById('person-selector');
  if (sel) {
    sel.classList.remove('hidden');
    sel.style.display = 'flex';
  }
}

// ── Directory rendering ──────────────────────────────────────────────

export function renderDirectory(people) {
  const grid = document.getElementById('directory-grid');
  document.getElementById('person-detail').classList.add('hidden');
  document.getElementById('directory-grid').classList.remove('hidden');
  document.getElementById('dir-back-btn').classList.add('hidden');
  document.getElementById('directory-title').textContent = '— people —';

  if (!people.length) {
    grid.innerHTML = `
      <div class="directory-empty">
        No conversations yet.<br>
        Start a session and end it to save your first entry.
      </div>`;
    return;
  }

  const sorted = [...people].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  grid.innerHTML = sorted.map(p => {
    const aff = p.totalAffection;
    const affCls  = aff > 0 ? 'pos' : aff < 0 ? 'neg' : 'neu';
    const affSign = aff > 0 ? '+' : '';
    const lastSeen = formatDate(p.lastSeen);
    const cl = closenessInfo(p.closeness || 0);

    return `
      <div class="person-card affection-${affCls}" data-person-id="${p.id}">
        <button class="person-card-delete" data-person-id="${p.id}" title="Delete person">×</button>
        <div class="person-card-name">${p.name}</div>
        <div class="closeness-bar-wrap">
          <div class="closeness-bar-fill" style="width:${cl.pct}%;background:${cl.color}"></div>
        </div>
        <div class="closeness-tier" style="color:${cl.color}">${cl.label}</div>
        <div class="person-card-meta">
          <div class="person-meta-item">
            <span>affection</span>
            <span class="person-meta-value ${affCls}">${affSign}${aff}</span>
          </div>
          <div class="person-meta-item">
            <span>sessions</span>
            <span class="person-meta-value">${p.conversationCount}</span>
          </div>
          <div class="person-meta-item">
            <span>last seen</span>
            <span class="person-meta-value">${lastSeen}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Session debrief ──────────────────────────────────────────────────

export function showDebrief(exchanges, personName, totalAffection, scenario = null, chapterPassed = false) {
  const modal = document.getElementById('debrief-modal');
  document.getElementById('debrief-title').textContent = `— ${personName} —`;
  document.getElementById('debrief-body').innerHTML = buildDebriefBody(exchanges, totalAffection, scenario, chapterPassed);
  modal.classList.remove('hidden');

  document.getElementById('debrief-body').querySelectorAll('.debrief-exchange-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const alts   = hdr.parentElement.querySelector('.debrief-alts');
      const toggle = hdr.querySelector('.debrief-alts-toggle');
      if (!alts) return;
      const isOpen = alts.classList.toggle('open');
      if (toggle) toggle.textContent = isOpen ? 'hide ↑' : 'see alternatives ↓';
    });
  });
}

/** Called async after evaluateSession resolves — fills the loading eval card. */
export function updateDebriefEval(evalData) {
  const section = document.getElementById('debrief-eval-section');
  if (!section || !evalData) return;
  const title = section.dataset.scenarioTitle || '';
  section.innerHTML = buildEvalSection(evalData, title);
}

function buildEvalSection(evalData, scenarioTitle = '') {
  const dims = [
    { key: 'honesty',  label: 'Honesty',  color: '#f8c840' },
    { key: 'empathy',  label: 'Empathy',  color: '#a78bfa' },
    { key: 'courage',  label: 'Courage',  color: '#fb923c' },
  ];

  const barsHTML = dims.map(d => {
    const dim = evalData[d.key] || { score: 5, note: '' };
    const pct = Math.max(0, Math.min(10, dim.score)) * 10;
    return `
      <div class="debrief-eval-dim">
        <span class="debrief-eval-dim-label">${d.label}</span>
        <div class="debrief-eval-bar-wrap">
          <div class="debrief-eval-bar" style="width:${pct}%;background:${d.color}"></div>
        </div>
        <span class="debrief-eval-score" style="color:${d.color}">${dim.score}</span>
      </div>
      ${dim.note ? `<div class="debrief-eval-note">${dim.note}</div>` : ''}
    `;
  }).join('');

  const titleLine = scenarioTitle
    ? `<div class="debrief-eval-title">scenario report · ${scenarioTitle}</div>`
    : `<div class="debrief-eval-title">scenario report</div>`;

  const overall = evalData.overall
    ? `<div class="debrief-eval-overall">"${evalData.overall}"</div>`
    : '';

  return titleLine + barsHTML + overall;
}

function renderTimelineGraph(exchanges) {
  if (!exchanges.length) return '';

  const chron = [...exchanges].reverse();
  const W = 716, H = 200;
  const PAD_X = 60, PAD_Y = 40;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  // Map labels to vertical positions (-1 to 1)
  const Y_MAP = {
    Kind:      -0.8,
    Funny:     -0.3,
    Sarcastic:  0.3,
    Cold:       0.8,
  };

  const points = chron.map((ex, i) => {
    const x = PAD_X + (chron.length > 1 ? (i / (chron.length - 1)) * innerW : innerW / 2);
    const yValue = Y_MAP[ex.label] || 0;
    const y = H / 2 + yValue * innerH / 2;
    return { x, y, ...ex };
  });

  // Generate smooth path
  let pathD = '';
  if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      pathD += ` C ${cp1x} ${p0.y}, ${cp2x} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const nodes = points.map((p, i) => {
    const color = TYPE_COLORS[p.label] || 'var(--ink-dim)';
    const delta = p.affectionDelta || 0;
    const isGood = delta > 0;
    const isBad  = delta < 0;
    
    // Label placement
    const labelY = p.y < H / 2 ? p.y - 12 : p.y + 22;
    const timeText = i === 0 ? 'START' : i === points.length - 1 ? 'END' : '';

    return `
      <g class="graph-node" data-index="${i}">
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="${color}" stroke="var(--paper)" stroke-width="2" />
        ${isGood ? `<circle cx="${p.x}" cy="${p.y}" r="8" fill="none" stroke="${color}" stroke-width="1" opacity="0.4" />` : ''}
        <text x="${p.x}" y="${labelY}" text-anchor="middle" font-size="8" fill="${color}" font-weight="600">${p.label.toUpperCase()}</text>
        ${timeText ? `<text x="${p.x}" y="${labelY + (p.y < H / 2 ? -10 : 10)}" text-anchor="middle" font-size="7" fill="var(--ink-dim)" opacity="0.5">${timeText}</text>` : ''}
      </g>
    `;
  }).join('');

  return `
    <div class="debrief-graph-wrap">
      <div class="graph-y-axis">
        <span class="y-label top">EMOTION</span>
        <span class="y-label bottom">LOGIC</span>
      </div>
      <svg class="debrief-graph-svg" viewBox="0 0 ${W} ${H}">
        <!-- Grid lines -->
        <line x1="${PAD_X}" y1="${H / 2}" x2="${W - PAD_X}" y2="${H / 2}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>
        <!-- Connection path -->
        <path d="${pathD}" fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" opacity="0.6" />
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="var(--choice-a)" />
            <stop offset="33%" stop-color="var(--choice-b)" />
            <stop offset="66%" stop-color="var(--choice-c)" />
            <stop offset="100%" stop-color="var(--choice-d)" />
          </linearGradient>
        </defs>
        ${nodes}
      </svg>
    </div>
  `;
}

function buildDebriefBody(exchanges, totalAffection, scenario = null, chapterPassed = false) {
  const chron   = [...exchanges].reverse();
  const scored  = chron.filter(e => e.affectionDelta !== undefined);
  const best    = scored.length ? scored.reduce((b, e) => e.affectionDelta > b.affectionDelta ? e : b) : null;
  const affCls  = totalAffection > 0 ? 'pos' : totalAffection < 0 ? 'neg' : '';
  const affSign = totalAffection > 0 ? '+' : '';

  // Calculate summary stats
  const keyDecisions = scored.filter(e => Math.abs(e.affectionDelta) >= 5).length;
  const topicTurns = chron.reduce((count, ex, i) => {
    if (i === 0) return count;
    const prev = chron[i - 1];
    // A turn is when we switch between warm (Kind/Funny) and cool (Sarcastic/Cold)
    const isWarm = (l) => l === 'Kind' || l === 'Funny';
    if (isWarm(prev.label) !== isWarm(ex.label)) return count + 1;
    return count;
  }, 0);

  const summaryHTML = `
    <div class="debrief-summary-header">
      Total <span class="highlight">${chron.length}</span> exchanges, 
      identified <span class="highlight">${keyDecisions}</span> key decisions 
      and <span class="highlight">${topicTurns}</span> topic turning points.
    </div>
  `;

  const statsHTML = `
    <div class="debrief-stats">
      <div class="debrief-stat">
        <span class="debrief-stat-label">Affection Change</span>
        <span class="debrief-stat-value ${affCls}">${affSign}${totalAffection}</span>
      </div>
      <div class="debrief-stat">
        <span class="debrief-stat-label">Response Balance</span>
        <div class="debrief-balance-bars">
          ${['Kind', 'Funny', 'Sarcastic', 'Cold'].map(l => {
            const count = chron.filter(ex => ex.label === l).length;
            const pct = chron.length ? (count / chron.length) * 100 : 0;
            return `<div class="debrief-balance-bar" title="${l}: ${count}" style="width:${pct}%;background:${TYPE_COLORS[l]}"></div>`;
          }).join('')}
        </div>
      </div>
      <div class="debrief-stat">
        <span class="debrief-stat-label">Peak Resonance</span>
        <span class="debrief-stat-value">${best ? `${best.emoji || ''} ${best.label}` : '—'}</span>
      </div>
    </div>`;

  const graphHTML = renderTimelineGraph(exchanges);

  const timelineHTML = chron.map((ex, i) => {
    const hasDelta = ex.affectionDelta !== undefined;
    const deltaCls = hasDelta ? (ex.affectionDelta > 0 ? 'pos' : ex.affectionDelta < 0 ? 'neg' : 'zero') : '';
    const deltaSign = ex.affectionDelta > 0 ? '+' : '';
    const dotCls   = hasDelta ? (ex.affectionDelta > 0 ? 'good' : ex.affectionDelta < 0 ? 'bad' : 'neutral') : 'neutral';
    const isLast   = i === chron.length - 1;

    const altsHTML = ex.options?.length === 4
      ? ex.options
          .filter((_, oi) => oi !== ex.chosenIndex)
          .map(opt => {
            const cls = RESPONSE_TYPES.find(t => t.label === opt.label)?.cls || 'a';
            return `
              <div class="debrief-alt">
                <span class="choice-tag ${cls}">${opt.label}</span>
                <span class="debrief-alt-text">${opt.text}</span>
              </div>`;
          }).join('')
      : '';

    const hasAlts = altsHTML.length > 0;

    return `
      <div class="debrief-exchange${hasAlts ? ' has-alts' : ''}">
        <div class="debrief-node-col">
          <div class="debrief-dot debrief-dot-${dotCls}"></div>
          ${!isLast ? '<div class="debrief-line"></div>' : ''}
        </div>
        <div class="debrief-content">
          <div class="debrief-said">${ex.said}</div>
          <div class="debrief-exchange-header">
            <div class="debrief-chosen">
              <span class="choice-tag ${ex.cls}">${ex.label}</span>
              <span class="debrief-chosen-text">${ex.text}</span>
            </div>
            <div class="debrief-chosen-meta">
              ${hasDelta ? `<span class="debrief-delta ${deltaCls}">${ex.emoji || ''} ${deltaSign}${ex.affectionDelta}</span>` : ''}
              ${hasAlts ? `<span class="debrief-alts-toggle">see alternatives ↓</span>` : ''}
            </div>
          </div>
          ${hasAlts ? `<div class="debrief-alts">${altsHTML}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Scenario eval card — state depends on whether chapter was passed
  const evalHTML = scenario ? (() => {
    if (!chapterPassed) {
      const needed = 5;
      const have   = exchanges.length;
      return `
        <div id="debrief-eval-section" class="debrief-eval-section debrief-eval-incomplete">
          <div class="debrief-eval-title">chapter not completed · ${scenario.title}</div>
          <div class="debrief-eval-incomplete-msg">
            <span class="debrief-eval-incomplete-icon">○</span>
            You had <strong>${have}</strong> exchange${have !== 1 ? 's' : ''} — need at least <strong>${needed}</strong> to pass this chapter.
            <br>The story won't advance yet. Come back and go deeper with this scene.
          </div>
        </div>`;
    }
    return `
      <div id="debrief-eval-section" class="debrief-eval-section" data-scenario-title="${scenario.title}">
        <div class="debrief-eval-title">scenario report · ${scenario.title}</div>
        <div class="debrief-eval-loading">analyzing your performance<span class="debrief-eval-dots">…</span></div>
      </div>`;
  })() : '';

  return evalHTML + summaryHTML + statsHTML + graphHTML + `<div class="debrief-timeline-label">— event log —</div>` + `<div class="debrief-timeline">${timelineHTML}</div>`;
}

// Close handlers — run once at module load
document.getElementById('debrief-close')?.addEventListener('click', () => {
  document.getElementById('debrief-modal')?.classList.add('hidden');
});
document.getElementById('debrief-backdrop')?.addEventListener('click', () => {
  document.getElementById('debrief-modal')?.classList.add('hidden');
});

// ── Directory: person detail ─────────────────────────────────────────

export function renderPersonDetail(person, conversations, observations = []) {
  document.getElementById('directory-grid').classList.add('hidden');

  const detail = document.getElementById('person-detail');
  detail.classList.remove('hidden');
  document.getElementById('dir-back-btn').classList.remove('hidden');
  document.getElementById('directory-title').innerHTML = `
    — ${person.name} —
    <button class="person-detail-delete" data-person-id="${person.id}" title="Delete this person and all history">delete all</button>
  `;

  const profile    = computeOpponentProfile(observations);
  const profileHTML = opponentProfileCard(person.name, profile, observations.length);
  const cl = closenessInfo(person.closeness || 0);
  const closenessHTML = `
    <div class="closeness-detail-card">
      <div class="closeness-detail-label">closeness</div>
      <div class="closeness-detail-bar-wrap">
        <div class="closeness-detail-bar-fill" style="width:${cl.pct}%;background:${cl.color}"></div>
      </div>
      <div class="closeness-detail-foot">
        <span class="closeness-detail-tier" style="color:${cl.color}">${cl.label}</span>
        <span class="closeness-detail-pct">${cl.pct} / 100</span>
      </div>
    </div>`;

  if (!conversations.length) {
    detail.innerHTML = closenessHTML + profileHTML + `<div class="directory-empty" style="margin-top:16px">No saved conversations yet.</div>`;
    return;
  }

  const convsHTML = conversations.map((c, ci) => {
    const aff     = c.finalAffection;
    const affCls  = aff > 0 ? 'pos' : aff < 0 ? 'neg' : 'zero';
    const affSign = aff > 0 ? '+' : '';
    const date    = formatDate(c.startedAt, true);

    const exchanges = (c.exchanges || []).map(ex => `
      <div class="conv-exchange">
        <div class="conv-exchange-said"><strong>They said:</strong> ${ex.said}</div>
        <div class="conv-exchange-response">↳ ${ex.text}</div>
        <div class="conv-exchange-meta">
          <div class="history-chose badge-${ex.cls}">${ex.label}</div>
          ${ex.affectionDelta !== undefined
            ? `<div class="history-delta ${ex.affectionDelta > 0 ? 'pos' : ex.affectionDelta < 0 ? 'neg' : 'zero'}">${ex.emoji || ''} ${ex.affectionDelta > 0 ? '+' : ''}${ex.affectionDelta}</div>`
            : ''}
        </div>
      </div>`).join('');

    return `
      <div class="conv-card">
        <div class="conv-card-header" data-conv-idx="${ci}">
          <span class="conv-card-date">${date}</span>
          <div class="conv-card-stats">
            <span class="conv-stat">exchanges <span>${c.exchanges?.length || 0}</span></span>
            <span class="conv-affection ${affCls}">${affSign}${aff}</span>
            <button class="conv-review-btn" data-conv-idx="${ci}">review</button>
          </div>
        </div>
        <div class="conv-card-body" id="conv-body-${ci}">
          ${exchanges || '<div class="conv-exchange" style="color:var(--ink-dim)">No exchanges recorded.</div>'}
        </div>
      </div>`;
  }).join('');

  detail.innerHTML = closenessHTML + profileHTML + convsHTML;

  detail.querySelectorAll('.conv-card-header').forEach(hdr => {
    hdr.addEventListener('click', (e) => {
      if (e.target.closest('.conv-review-btn')) return;
      document.getElementById(`conv-body-${hdr.dataset.convIdx}`).classList.toggle('open');
    });
  });

  detail.querySelectorAll('.conv-review-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ci   = Number(btn.dataset.convIdx);
      const conv = conversations[ci];
      showDebrief(conv.exchanges || [], person.name, conv.finalAffection || 0);
    });
  });

  // Animate opponent profile axis sliders
  requestAnimationFrame(() => {
    detail.querySelectorAll('.opp-axis-fill[data-opp-target]').forEach(el => {
      el.style.width = el.dataset.oppTarget + '%';
    });
    detail.querySelectorAll('.opp-axis-dot[data-opp-target]').forEach(el => {
      el.style.left = el.dataset.oppTarget + '%';
    });
  });
}

function opponentProfileCard(name, profile, obsCount) {
  if (!profile) {
    const needed = Math.max(0, 5 - obsCount);
    return `
      <div class="opp-profile-card opp-profile-empty">
        <div class="opp-profile-eyebrow">their personality read</div>
        <div class="opp-profile-pending">
          Analysing ${name}…
          <span class="opp-pending-count">${obsCount} observation${obsCount !== 1 ? 's' : ''} so far — ${needed} more needed for a read</span>
        </div>
      </div>`;
  }

  const confidencePct = Math.round(profile.confidence * 100);
  const axisRows = profile.axes.map(ax => {
    const pct = Math.round(ax.value * 100);
    return `
      <div class="gpc-axis">
        <span class="gpc-axis-name">${ax.name}</span>
        <div class="gpc-axis-row">
          <span class="gpc-axis-pole gpc-axis-pole-l">${ax.left}</span>
          <div class="gpc-axis-track">
            <div class="opp-axis-fill" data-opp-target="${pct}" style="width:0%"></div>
            <div class="opp-axis-dot"  data-opp-target="${pct}" style="left:0%"></div>
          </div>
          <span class="gpc-axis-pole gpc-axis-pole-r">${ax.right}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="opp-profile-card">
      <div class="opp-profile-eyebrow">their personality read</div>
      <div class="opp-profile-header">
        <div class="opp-type-name">${profile.type.emoji} ${profile.type.name}</div>
        <div class="opp-confidence">
          <span class="opp-confidence-label">${profile.count} exchanges observed · ${confidencePct}% confidence</span>
          <div class="opp-confidence-track">
            <div class="opp-confidence-fill" style="width:${confidencePct}%"></div>
          </div>
        </div>
      </div>
      <div class="opp-type-desc">${profile.type.desc}</div>
      <div class="opp-tip">
        <span class="opp-tip-label">how to approach</span>
        ${profile.tip}
      </div>
      <div class="gpc-axes opp-axes">${axisRows}</div>
      <div class="opp-profile-note">
        This reflects <em>communication style</em> — how they speak, not what the scenario asked them to say.
      </div>
    </div>`;
}

// ── Utility ──────────────────────────────────────────────────────────

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffffff';
}

function formatDate(isoString, includeTime = false) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  if (!includeTime) return date;
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

// ── Analytics view ───────────────────────────────────────────────────

export function renderAnalytics(data) {
  const wrap = document.getElementById('analytics-wrap');

  if (!data || data.totalExchanges < 3) {
    wrap.innerHTML = `
      <div class="analytics-empty">
        Not enough data yet — complete a few sessions first.<br>
        You need at least 3 exchanges for a personality reading.
      </div>`;
    return;
  }

  wrap.innerHTML = `
    ${archetypeCard(data)}
    ${statsRow(data)}
    ${compatSection(data.personAffection)}
    ${trendSection(data.sessionTrend)}
  `;

  // Animate bars after render (needs one tick so elements exist)
  requestAnimationFrame(() => animateBars(data));
}

function getSessionAxisValue(conv, metric) {
  const exchanges = conv.exchanges || [];
  if (exchanges.length === 0) return 0.5;

  if (metric === 'Affection') {
    // -20 to +20 range mapped to 0-1
    return Math.max(0, Math.min(1, (conv.finalAffection + 20) / 40));
  }

  const counts = { Kind: 0, Funny: 0, Sarcastic: 0, Cold: 0 };
  exchanges.forEach(ex => { if (counts[ex.label] !== undefined) counts[ex.label]++; });
  
  const total = exchanges.length;
  const pct = {
    Kind: counts.Kind / total,
    Funny: counts.Funny / total,
    Sarcastic: counts.Sarcastic / total,
    Cold: counts.Cold / total
  };

  switch (metric) {
    case 'Social Energy':
      return Math.min(1, (pct.Kind + pct.Funny) / 0.75);
    case 'Warmth':
      const warmSum = pct.Kind + pct.Cold;
      return warmSum > 0 ? pct.Kind / warmSum : 0.5;
    case 'Tone':
      return Math.min(1, pct.Funny / 0.40);
    case 'Style':
      const maxPct = Math.max(pct.Kind, pct.Funny, pct.Sarcastic, pct.Cold);
      return Math.min(1, Math.max(0, (maxPct - 0.25) / 0.60));
    default:
      return 0.5;
  }
}

let historyGraphCanvas = null;
let historyGraphCtx = null;
let historyNodes = []; // { x, y, targetY, currentY, r, conv, person }
let isHistoryAnimating = false;
let historyPanX = 0;
let historyTargetPanX = 0;

export function renderGlobalHistoryGraph(conversations, people) {
  const canvas = document.getElementById('history-graph-canvas');
  const metricSelect = document.getElementById('history-metric-select');
  if (!canvas || !metricSelect) return;
  
  const metric = metricSelect.value;
  historyGraphCanvas = canvas;
  historyGraphCtx = canvas.getContext('2d');
  const personMap = new Map(people.map(p => [p.id, p]));
  const sorted = [...conversations].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  const dpr = window.devicePixelRatio || 1;
  const wrap = canvas.parentElement;
  const W = wrap.clientWidth;
  const H = wrap.clientHeight || 500;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  historyGraphCtx.scale(dpr, dpr);

  if (sorted.length === 0) {
    historyGraphCtx.clearRect(0, 0, W, H);
    historyGraphCtx.font = '12px DM Mono';
    historyGraphCtx.fillStyle = getCSSVar('--ink-dim');
    historyGraphCtx.textAlign = 'center';
    historyGraphCtx.fillText('No sessions yet.', W / 2, H / 2);
    return;
  }

  const PAD_X = 140; 
  const PAD_Y = 100;
  const innerH = H - PAD_Y * 2;
  const stepX = 280; // Fixed width per session for horizontal scrolling

  // Initialize or update nodes
  const newNodes = sorted.map((conv, i) => {
    const person = personMap.get(conv.personId) || { name: 'Unknown' };
    const val = getSessionAxisValue(conv, metric);
    const x = PAD_X + i * stepX;
    const targetY = H - PAD_Y - (val * innerH);
    const r = 18; // Consistent size

    const existing = historyNodes.find(n => n.conv.startedAt === conv.startedAt);
    return {
      x,
      y: existing ? existing.y : targetY,
      targetY,
      r,
      conv,
      person,
      hover: 0
    };
  });

  historyNodes = newNodes;
  
  // Center on latest node if we just started
  if (historyPanX === 0 && historyNodes.length > 0) {
    const latestX = historyNodes[historyNodes.length - 1].x;
    historyTargetPanX = -(latestX - W / 2);
    historyPanX = historyTargetPanX;
  }

  if (!isHistoryAnimating) {
    isHistoryAnimating = true;
    animateHistoryGraph();
  }

  // Event listener for hover/click/pan
  if (!canvas.dataset.listenerAttached) {
    let isDragging = false;
    let startX = 0;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - historyPanX;
      const my = e.clientY - rect.top;
      
      if (isDragging) {
        historyTargetPanX += (e.clientX - startX);
        historyPanX = historyTargetPanX;
        startX = e.clientX;
      }

      historyNodes.forEach(n => {
        const dist = Math.hypot(mx - n.x, my - n.y);
        n.hover = dist < n.r + 10 ? 1 : 0;
      });
    });
    
    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      const clicked = historyNodes.find(n => n.hover);
      if (clicked) showHistoryNodeDetails(clicked);
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      historyTargetPanX -= e.deltaX || e.deltaY;
    }, { passive: false });

    canvas.dataset.listenerAttached = 'true';
  }
}

function animateHistoryGraph() {
  if (!historyGraphCanvas || !document.getElementById('view-history') || document.getElementById('view-history').classList.contains('view-hidden')) {
    isHistoryAnimating = false;
    return;
  }

  const W = historyGraphCanvas.width / (window.devicePixelRatio || 1);
  const H = historyGraphCanvas.height / (window.devicePixelRatio || 1);
  const ctx = historyGraphCtx;
  const metric = document.getElementById('history-metric-select')?.value || 'Warmth';

  ctx.clearRect(0, 0, W, H);
  
  // Smooth panning
  historyPanX += (historyTargetPanX - historyPanX) * 0.1;

  // Background Labels (Static)
  const metricLabels = {
    'Warmth':       { top: 'WARM', bottom: 'COOL' },
    'Social Energy': { top: 'EXPRESSIVE', bottom: 'INTROVERTED' },
    'Tone':         { top: 'WITTY', bottom: 'SERIOUS' },
    'Style':        { top: 'FOCUSED', bottom: 'VERSATILE' },
    'Affection':    { top: 'HIGH IMPACT', bottom: 'LOW IMPACT' }
  };
  const labels = metricLabels[metric] || { top: 'HIGH', bottom: 'LOW' };

  ctx.font = 'bold 10px DM Mono';
  ctx.fillStyle = 'rgba(248, 200, 64, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText(labels.top, W / 2, 40);
  ctx.fillText(labels.bottom, W / 2, H - 30);

  ctx.save();
  ctx.translate(historyPanX, 0);

  // Update node vertical positions
  historyNodes.forEach(node => {
    node.y += (node.targetY - node.y) * 0.1;
  });

  // Timeline path
  if (historyNodes.length > 1) {
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(248, 200, 64, 0.3)';
    ctx.moveTo(historyNodes[0].x, historyNodes[0].y);
    for (let i = 0; i < historyNodes.length - 1; i++) {
      const p0 = historyNodes[i];
      const p1 = historyNodes[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      ctx.bezierCurveTo(cp1x, p0.y, cp2x, p1.y, p1.x, p1.y);
    }
    ctx.stroke();
  }

  // Draw Nodes and Labels
  historyNodes.forEach((node) => {
    const varName = node.conv.finalAffection >= 0 ? '--choice-d' : '--choice-c';
    const color = getCSSVar(varName);
    const hoverScale = 1 + (node.hover * 0.2);
    const r = node.r * hoverScale;

    // Node Circle
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = getCSSVar('--paper2');
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Initial
    ctx.fillStyle = getCSSVar('--ink');
    ctx.font = `bold ${Math.round(11 * hoverScale)}px DM Mono`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.person.name[0], node.x, node.y);

    // NAME AND DATE (Always visible)
    const label = node.person.name.toUpperCase();
    const date = formatDate(node.conv.startedAt);
    
    // Label Pod Background
    ctx.font = 'bold 10px DM Mono';
    const tw = Math.max(ctx.measureText(label).width, ctx.measureText(date).width);
    ctx.fillStyle = 'rgba(20, 16, 35, 0.9)';
    const lx = node.x - tw/2 - 10, ly = node.y + r + 12, lw = tw + 20, lh = 36;
    
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.stroke();
    } else {
      ctx.fillRect(lx, ly, lw, lh);
    }

    // Text
    ctx.fillStyle = node.hover ? 'var(--accent)' : '#ffffff';
    ctx.font = 'bold 11px DM Mono';
    ctx.fillText(label, node.x, node.y + r + 26);
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px DM Mono';
    ctx.fillText(date, node.x, node.y + r + 40);
  });

  ctx.restore();
  requestAnimationFrame(animateHistoryGraph);
}

function showHistoryNodeDetails(node) {
  const panel = document.getElementById('history-node-details');
  const nameEl = document.getElementById('details-person-name');
  const contentEl = document.getElementById('details-content');
  
  nameEl.textContent = `Session with ${node.person.name}`;
  
  const aff = node.conv.finalAffection;
  const affCls = aff > 0 ? 'pos' : aff < 0 ? 'neg' : 'zero';
  const affSign = aff > 0 ? '+' : '';
  
  // Re-use timeline graph rendering inside the details panel
  const graphHTML = renderTimelineGraph(node.conv.exchanges || []);
  
  contentEl.innerHTML = `
    <div class="history-details-meta">
      <div class="history-details-stat">
        <span class="label">DATE</span>
        <span class="value">${formatDate(node.conv.startedAt, true)}</span>
      </div>
      <div class="history-details-stat">
        <span class="label">AFFECTION</span>
        <span class="value ${affCls}">${affSign}${aff}</span>
      </div>
    </div>
    <div class="history-details-graph-wrap">
      ${graphHTML}
    </div>
    <div class="history-details-log">
      ${(node.conv.exchanges || []).map(ex => `
        <div class="details-log-entry">
          <div class="said">${ex.said}</div>
          <div class="resp">↳ ${ex.text}</div>
        </div>
      `).join('')}
    </div>
  `;
  
  panel.classList.remove('hidden');
}

document.getElementById('details-close')?.addEventListener('click', () => {
  document.getElementById('history-node-details').classList.add('hidden');
});

export function renderGlobalHistory(conversations, people) {
  // Keeping this as a fallback or for other uses
  console.log('renderGlobalHistory fallback');
}

function archetypeCard(data) {
  const a   = data.archetype;
  const gpc = data.gpc;

  const emoji  = a?.emoji || gpc?.emoji || '🎭';
  const name   = a?.name  || gpc?.name  || 'Unknown';
  const desc   = a?.description || '';
  const traits = (a?.traits || []).map(t => `<span class="archetype-trait">${t}</span>`).join('');

  // GPC 4-letter code badge
  const subLabels = ['energy', 'warmth', 'tone', 'style'];
  const gpcBadge = gpc ? `
    <div class="gpc-badge">
      ${gpc.code.split('').map((ch, i) => `
        <div class="gpc-letter-box">
          <span class="gpc-letter-char">${ch}</span>
          <span class="gpc-letter-sub">${subLabels[i]}</span>
        </div>`).join('')}
    </div>
    <div class="gpc-type-label">${gpc.emoji} ${gpc.name}</div>
    <div class="gpc-type-desc">${gpc.desc}</div>` : '';

  // 2D personality map (SVG quadrant)
  const qx = (90 + (data.pct.Kind - data.pct.Cold) * 78).toFixed(1);
  const qy = (90 - (data.pct.Funny - data.pct.Sarcastic) * 78).toFixed(1);
  const quadSVG = `
    <div class="gpc-quad-wrap">
      <div class="gpc-quad-eyebrow">personality map</div>
      <svg class="gpc-quad-svg" viewBox="0 0 180 180" width="176" height="176">
        <rect x="1"   y="1"   width="88"  height="88"  fill="rgba(110,184,200,0.07)" rx="2"/>
        <rect x="91"  y="1"   width="88"  height="88"  fill="rgba(126,200,155,0.07)" rx="2"/>
        <rect x="1"   y="91"  width="88"  height="88"  fill="rgba(200,125,110,0.05)" rx="2"/>
        <rect x="91"  y="91"  width="88"  height="88"  fill="rgba(155,127,212,0.07)" rx="2"/>
        <line x1="90" y1="4"   x2="90"  y2="176" stroke="rgba(220,200,160,0.15)" stroke-width="1"/>
        <line x1="4"  y1="90"  x2="176" y2="90"  stroke="rgba(220,200,160,0.15)" stroke-width="1"/>
        <text x="6"   y="11"  font-size="7" fill="rgba(220,200,160,0.4)" font-family="DM Mono,monospace">witty</text>
        <text x="138" y="11"  font-size="7" fill="rgba(220,200,160,0.4)" font-family="DM Mono,monospace">witty</text>
        <text x="6"   y="175" font-size="7" fill="rgba(220,200,160,0.4)" font-family="DM Mono,monospace">serious</text>
        <text x="126" y="175" font-size="7" fill="rgba(220,200,160,0.4)" font-family="DM Mono,monospace">serious</text>
        <text x="4"   y="87"  font-size="7" fill="rgba(220,200,160,0.4)" font-family="DM Mono,monospace">cool</text>
        <text x="152" y="87"  font-size="7" fill="rgba(220,200,160,0.4)" font-family="DM Mono,monospace" text-anchor="end">warm</text>
        <circle cx="${qx}" cy="${qy}" r="14" fill="var(--accent)" opacity="0.15"/>
        <circle cx="${qx}" cy="${qy}" r="5"  fill="var(--accent)"/>
        <circle cx="${qx}" cy="${qy}" r="5"  fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.5"/>
      </svg>
    </div>`;

  // Two-pole axis sliders
  const axisSliders = gpc ? `
    <div class="gpc-axes">
      ${gpc.axes.map(ax => {
        const pct = Math.round(ax.value * 100);
        return `
          <div class="gpc-axis">
            <span class="gpc-axis-name">${ax.name}</span>
            <div class="gpc-axis-row">
              <span class="gpc-axis-pole gpc-axis-pole-l">${ax.left}</span>
              <div class="gpc-axis-track">
                <div class="gpc-axis-fill" data-gpc-target="${pct}" style="width:0%"></div>
                <div class="gpc-axis-dot"  data-gpc-target="${pct}" style="left:0%"></div>
              </div>
              <span class="gpc-axis-pole gpc-axis-pole-r">${ax.right}</span>
            </div>
          </div>`;
      }).join('')}
    </div>` : '';

  return `
    <div class="archetype-card" data-emoji="${emoji}">
      <div class="archetype-eyebrow">your gal personality type</div>
      ${gpcBadge}
      <div class="archetype-divider">— archetype —</div>
      <div class="archetype-name">${emoji} ${name}</div>
      <div class="archetype-desc">${desc}</div>
      <div class="archetype-traits">${traits}</div>
      <div class="archetype-divider">— personality map —</div>
      <div class="gpc-bottom">
        ${quadSVG}
        ${axisSliders}
      </div>
    </div>`;
}

function statsRow(data) {
  const affCls  = data.avgAffection > 0 ? 'pos' : data.avgAffection < 0 ? 'neg' : '';
  const affSign = data.avgAffection > 0 ? '+' : '';

  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">People met</div>
        <div class="stat-value">${data.totalPeople}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${data.totalSessions}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Exchanges</div>
        <div class="stat-value">${data.totalExchanges}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg affection</div>
        <div class="stat-value ${affCls}">${affSign}${data.avgAffection}</div>
      </div>
    </div>`;
}

function compatSection(personAffection) {
  if (!personAffection.length) return '';

  const maxAbs = Math.max(1, ...personAffection.map(p => Math.abs(p.affection)));

  const rows = personAffection.map((p, i) => {
    const aff    = p.affection;
    const cls    = aff > 0 ? 'pos' : aff < 0 ? 'neg' : 'zero';
    const sign   = aff > 0 ? '+' : '';
    const pct    = (Math.abs(aff) / maxAbs) * 100;
    const barLeft = aff >= 0 ? '50%' : `${50 - pct / 2}%`;
    const barW    = `${pct / 2}%`;
    const barCol  = aff >= 0 ? 'var(--choice-d)' : 'var(--choice-c)';

    return `
      <div class="compat-row">
        <span class="compat-rank">${i + 1}</span>
        <span class="compat-name">${p.name}</span>
        <div class="compat-bar-wrap">
          <div class="compat-bar-fill"
            style="left:${barLeft};width:${barW};background:${barCol}"></div>
        </div>
        <span class="compat-score ${cls}">${sign}${aff}</span>
      </div>`;
  }).join('');

  return `
    <div>
      <div class="section-label">— people compatibility —</div>
      <div class="compat-list">${rows}</div>
    </div>`;
}

function trendSection(sessionTrend) {
  if (sessionTrend.length < 2) return '';

  const W = 700, H = 80, PAD = 8;
  const values  = sessionTrend.map(s => s.affection);
  const minVal  = Math.min(0, ...values);
  const maxVal  = Math.max(0, ...values);
  const range   = maxVal - minVal || 1;
  const yZero   = H - PAD - ((0 - minVal) / range) * (H - PAD * 2);

  const points = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - minVal) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  // Area fill path
  const firstX = PAD;
  const lastX  = PAD + (W - PAD * 2);
  const areaPoints = `${firstX},${yZero} ${points} ${lastX},${yZero}`;

  return `
    <div>
      <div class="section-label">— affection trend —</div>
      <div class="trend-card">
        <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--choice-d)" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="var(--choice-d)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <!-- Zero line -->
          <line x1="${PAD}" y1="${yZero}" x2="${W - PAD}" y2="${yZero}"
            stroke="var(--border)" stroke-width="1" stroke-dasharray="3 3"/>
          <!-- Area -->
          <polygon points="${areaPoints}" fill="url(#trendGrad)" opacity="0.6"/>
          <!-- Line -->
          <polyline points="${points}"
            fill="none" stroke="var(--choice-d)" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Dots -->
          ${values.map((v, i) => {
            const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
            const y = H - PAD - ((v - minVal) / range) * (H - PAD * 2);
            return `<circle cx="${x}" cy="${y}" r="3" fill="var(--choice-d)"/>`;
          }).join('')}
        </svg>
      </div>
    </div>`;
}

function animateBars(data) {
  document.querySelectorAll('.blend-bar-fill[data-target]').forEach(el => {
    el.style.width = el.dataset.target + '%';
  });
  document.querySelectorAll('[data-gpc-target]').forEach(el => {
    const val = el.dataset.gpcTarget + '%';
    if (el.classList.contains('gpc-axis-fill')) el.style.width = val;
    if (el.classList.contains('gpc-axis-dot'))  el.style.left  = val;
  });
}

// ── Story Map ─────────────────────────────────────────────────────────

export function renderStoryMap(stories, fullState, onStorySelect) {
  const story    = stories.find(s => s.id === fullState.activeStoryId) ?? stories[0];
  const progress = getStoryProgress(fullState, story.id);

  const canvas   = document.getElementById('story-map-canvas');
  const titleEl  = document.getElementById('story-view-title');
  const tagEl    = document.getElementById('story-view-tagline');
  const progEl   = document.getElementById('story-chapter-progress');
  const detailEl = document.getElementById('story-char-detail');
  const selectorEl = document.getElementById('story-selector');
  if (!canvas) return;

  // ── Progress tracker rows (Story tab — compact, not selection cards) ──
  if (selectorEl) {
    selectorEl.innerHTML = stories.map(s => {
      const sp     = getStoryProgress(fullState, s.id);
      const done   = sp.completedChapters?.length ?? 0;
      const total  = s.chapters.length;
      const pct    = total ? Math.round((done / total) * 100) : 0;
      const active = s.id === story.id;
      const color  = s.cast[0]?.color ?? '#a78bfa';
      const label  = s.players === 1 ? '1p' : `${s.players}p`;

      // Chapter dots — filled if complete, current if next, empty otherwise
      const chDots = s.chapters.map((ch, i) => {
        const isDone    = sp.completedChapters?.includes(i);
        const isCurrent = (sp.completedChapters?.length ?? 0) === i;
        const char      = ch.character ? s.cast.find(c => c.id === ch.character) : null;
        const dotColor  = char?.color ?? color;
        return `<span class="prog-row-dot ${isDone ? 'done' : isCurrent ? 'current' : ''}"
          style="${isDone || isCurrent ? `background:${dotColor};box-shadow:0 0 6px ${dotColor}66` : ''}"></span>`;
      }).join('');

      return `<button
        class="prog-row${active ? ' active' : ''}"
        data-story-id="${s.id}"
        style="--row-color:${color}"
      >
        <span class="prog-row-badge">${label}</span>
        <div class="prog-row-mid">
          <span class="prog-row-title">${s.title}</span>
          <div class="prog-row-dots">${chDots}</div>
        </div>
        <span class="prog-row-pct">${pct}%</span>
      </button>`;
    }).join('');

    selectorEl.querySelectorAll('[data-story-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.storyId;
        if (onStorySelect) onStorySelect(id);
      });
    });
  }

  // ── Active story header ─────────────────────────────────────────
  if (titleEl) titleEl.textContent = `— ${story.title.toLowerCase()} —`;
  if (tagEl)   tagEl.textContent   = story.tagline || '';

  // Chapter progress pills
  if (progEl) {
    progEl.innerHTML = story.chapters.map((ch, i) => {
      const done    = progress.completedChapters?.includes(i);
      const current = (progress.completedChapters?.length ?? 0) === i;
      const cls     = done ? 'prog-pill done' : current ? 'prog-pill current' : 'prog-pill';
      const char    = ch.character ? story.cast.find(c => c.id === ch.character) : null;
      const color   = char?.color || '#888';
      return `<div class="${cls}" title="Chapter ${i + 1}: ${ch.title}" style="${done || current ? `border-color:${color};color:${color}` : ''}">
        ${i + 1}
      </div>`;
    }).join('');
  }

  // ── Canvas map ──────────────────────────────────────────────────
  const wrap = canvas.parentElement;
  const W = wrap.clientWidth  || 700;
  const H = wrap.clientHeight || 380;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const metAssigned = new Set(Object.keys(progress.assignments || {}));

  const EDGE_STYLES = {
    broken:  { color: '#ef4444', dash: [6, 4], width: 1.5, alpha: 0.75 },
    close:   { color: '#f8c840', dash: [],      width: 2,   alpha: 0.85 },
    tension: { color: '#fb923c', dash: [3, 5],  width: 1.5, alpha: 0.65 },
    dim:     { color: '#9ca3af', dash: [3, 7],  width: 1,   alpha: 0.55 },
  };

  const nodePos = (c) => ({ x: c.mapX * W, y: c.mapY * H });

  story.castRelationships.forEach(rel => {
    const fromCast = story.cast.find(c => c.id === rel.from);
    const toCast   = story.cast.find(c => c.id === rel.to);
    if (!fromCast || !toCast) return;

    const p1 = nodePos(fromCast);
    const p2 = nodePos(toCast);
    const st = EDGE_STYLES[rel.style] || EDGE_STYLES.dim;

    ctx.save();
    ctx.globalAlpha = st.alpha;
    ctx.strokeStyle = st.color;
    ctx.lineWidth   = st.width;
    ctx.setLineDash(st.dash);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  });

  const NODE_R = 32;
  story.cast.forEach(char => {
    const { x, y } = nodePos(char);
    const met  = metAssigned.has(char.id);
    const done = story.chapters.some(
      ch => ch.character === char.id && progress.completedChapters?.includes(ch.index)
    );

    ctx.save();

    // Glow for met characters
    if (met) { ctx.shadowColor = char.color; ctx.shadowBlur = 20; }

    // Circle fill + border
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle   = met ? char.color + '30' : char.color + '12';
    ctx.strokeStyle = met ? char.color : char.color + '60';
    ctx.lineWidth   = met ? 2.5 : 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Name inside the circle
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    if (done) {
      // Completed: name on top line, ✓ below
      ctx.shadowColor = '#000';
      ctx.shadowBlur  = 4;
      ctx.font        = `bold 10px sans-serif`;
      ctx.fillStyle   = char.color;
      ctx.globalAlpha = 1;
      ctx.fillText(char.name, x, y - 6);
      ctx.font        = 'bold 13px sans-serif';
      ctx.fillText('✓', x, y + 8);
    } else {
      // Not done: just name centered, dimmer if not yet met
      ctx.shadowColor = '#000';
      ctx.shadowBlur  = 5;
      ctx.font        = `${met ? 'bold ' : ''}11px sans-serif`;
      ctx.fillStyle   = met ? char.color : '#c4c4cc';
      ctx.globalAlpha = met ? 1 : 0.65;
      ctx.fillText(char.name, x, y);
    }

    ctx.restore();
  });

  // Click to inspect a node
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const hit  = story.cast.find(c => {
      const dx = nodePos(c).x - mx;
      const dy = nodePos(c).y - my;
      return Math.sqrt(dx * dx + dy * dy) < NODE_R + 8;
    });
    if (hit && detailEl) {
      const met = metAssigned.has(hit.id);
      const chapterForChar = story.chapters.find(ch => ch.character === hit.id);
      const done = chapterForChar && progress.completedChapters?.includes(chapterForChar.index);
      detailEl.innerHTML = `
        <div class="story-char-detail-name" style="color:${hit.color}">${hit.name}</div>
        <div class="story-char-detail-role">${hit.role}</div>
        <div class="story-char-detail-desc">${hit.description}</div>
        <div class="story-char-detail-status">${
          done ? '✓ chapter complete' :
          met  ? '● in progress' :
          chapterForChar ? `chapter ${chapterForChar.index + 1} — not yet met` : ''
        }</div>
      `;
      detailEl.classList.remove('hidden');
    } else if (detailEl) {
      detailEl.classList.add('hidden');
    }
  };
}


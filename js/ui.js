import { RESPONSE_TYPES }         from './config.js';
import { computeOpponentProfile } from './opponent.js';

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
          <div class="choice-tag">${opt.label}</div>
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

export function showDebrief(exchanges, personName, totalAffection) {
  const modal = document.getElementById('debrief-modal');
  document.getElementById('debrief-title').textContent = `— ${personName} —`;
  document.getElementById('debrief-body').innerHTML = buildDebriefBody(exchanges, totalAffection);
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

function buildDebriefBody(exchanges, totalAffection) {
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

  return summaryHTML + statsHTML + graphHTML + `<div class="debrief-timeline-label">— event log —</div>` + `<div class="debrief-timeline">${timelineHTML}</div>`;
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
          <span class="opp-confidence-label">${profile.count} observations · ${confidencePct}% confidence</span>
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
let historyNodes = []; // { x, y, r, conv, person }

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
  historyNodes = [];

  if (sorted.length === 0) {
    historyGraphCtx.font = '12px DM Mono';
    historyGraphCtx.fillStyle = 'var(--ink-dim)';
    historyGraphCtx.textAlign = 'center';
    historyGraphCtx.fillText('No sessions yet.', W / 2, H / 2);
    return;
  }

  const PAD_X = 120;
  const PAD_Y = 80;
  const innerH = H - PAD_Y * 2;
  const stepX = sorted.length > 1 ? (W - PAD_X * 2) / (sorted.length - 1) : 0;

  // Background Grid and Axis Labels
  const metricLabels = {
    'Warmth':       { top: 'WARM', bottom: 'COOL' },
    'Social Energy': { top: 'EXPRESSIVE', bottom: 'INTROVERTED' },
    'Tone':         { top: 'WITTY', bottom: 'SERIOUS' },
    'Style':        { top: 'FOCUSED', bottom: 'VERSATILE' },
    'Affection':    { top: 'HIGH IMPACT', bottom: 'LOW IMPACT' }
  };
  const labels = metricLabels[metric] || { top: 'HIGH', bottom: 'LOW' };

  historyGraphCtx.font = 'bold 9px DM Mono';
  historyGraphCtx.fillStyle = 'rgba(248, 200, 64, 0.4)';
  historyGraphCtx.textAlign = 'center';
  historyGraphCtx.fillText(labels.top, W / 2, 30);
  historyGraphCtx.fillText(labels.bottom, W / 2, H - 20);

  // Center line
  historyGraphCtx.beginPath();
  historyGraphCtx.setLineDash([5, 5]);
  historyGraphCtx.strokeStyle = 'rgba(192,130,255,0.15)';
  historyGraphCtx.moveTo(PAD_X / 2, H / 2);
  historyGraphCtx.lineTo(W - PAD_X / 2, H / 2);
  historyGraphCtx.stroke();
  historyGraphCtx.setLineDash([]);

  // Calculate nodes
  sorted.forEach((conv, i) => {
    const x = sorted.length > 1 ? PAD_X + i * stepX : W / 2;
    const val = getSessionAxisValue(conv, metric);
    // val=1 is top, val=0 is bottom
    const y = H - PAD_Y - (val * innerH);
    const r = 14 + Math.min(10, (conv.exchanges?.length || 0) * 0.5);
    
    const person = personMap.get(conv.personId) || { name: 'Unknown' };
    historyNodes.push({ x, y, r, conv, person, val });
  });

  // Draw smooth timeline path
  if (historyNodes.length > 1) {
    historyGraphCtx.beginPath();
    historyGraphCtx.lineWidth = 3;
    const grad = historyGraphCtx.createLinearGradient(PAD_X, 0, W - PAD_X, 0);
    grad.addColorStop(0, 'rgba(110, 184, 200, 0.3)');
    grad.addColorStop(0.5, 'rgba(248, 200, 64, 0.4)');
    grad.addColorStop(1, 'rgba(232, 121, 249, 0.3)');
    historyGraphCtx.strokeStyle = grad;

    historyGraphCtx.moveTo(historyNodes[0].x, historyNodes[0].y);
    for (let i = 0; i < historyNodes.length - 1; i++) {
      const p0 = historyNodes[i];
      const p1 = historyNodes[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      historyGraphCtx.bezierCurveTo(cp1x, p0.y, cp2x, p1.y, p1.x, p1.y);
    }
    historyGraphCtx.stroke();
  }

  // Draw nodes with glow and labels
  historyNodes.forEach((node, i) => {
    const varName = node.conv.finalAffection >= 0 ? '--choice-d' : '--choice-c';
    const color = getCSSVar(varName);
    
    // Outer glow
    const shadowSize = 15;
    historyGraphCtx.save();
    historyGraphCtx.shadowBlur = shadowSize;
    historyGraphCtx.shadowColor = color;
    
    // Node circle
    historyGraphCtx.beginPath();
    historyGraphCtx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    historyGraphCtx.fillStyle = getCSSVar('--paper2');
    historyGraphCtx.fill();
    historyGraphCtx.strokeStyle = color;
    historyGraphCtx.lineWidth = 2;
    historyGraphCtx.stroke();
    historyGraphCtx.restore();

    // Initial
    historyGraphCtx.fillStyle = getCSSVar('--ink');
    historyGraphCtx.font = 'bold 11px DM Mono';
    historyGraphCtx.textAlign = 'center';
    historyGraphCtx.textBaseline = 'middle';
    historyGraphCtx.fillText(node.person.name[0], node.x, node.y);

    // Readability background for labels
    const label = node.person.name;
    const date = formatDate(node.conv.startedAt);
    historyGraphCtx.font = 'bold 10px DM Mono';
    const tw = Math.max(historyGraphCtx.measureText(label).width, historyGraphCtx.measureText(date).width);
    
    historyGraphCtx.fillStyle = 'rgba(12, 9, 22, 0.8)';
    const rx = node.x - tw/2 - 5, ry = node.y + node.r + 8, rw = tw + 10, rh = 30;
    if (historyGraphCtx.roundRect) {
      historyGraphCtx.beginPath();
      historyGraphCtx.roundRect(rx, ry, rw, rh, 4);
      historyGraphCtx.fill();
    } else {
      historyGraphCtx.fillRect(rx, ry, rw, rh);
    }

    // Labels
    historyGraphCtx.fillStyle = getCSSVar('--ink');
    historyGraphCtx.textAlign = 'center';
    historyGraphCtx.fillText(label, node.x, node.y + node.r + 20);
    historyGraphCtx.font = '8px DM Mono';
    historyGraphCtx.fillStyle = getCSSVar('--ink-dim');
    historyGraphCtx.fillText(date, node.x, node.y + node.r + 32);
  });

  // Event listener logic remains similar but ensures single attachment
  if (!canvas.dataset.listenerAttached) {
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const clicked = historyNodes.find(n => Math.hypot(mx - n.x, my - n.y) < n.r + 15);
      if (clicked) showHistoryNodeDetails(clicked);
      else document.getElementById('history-node-details').classList.add('hidden');
    });
    canvas.dataset.listenerAttached = 'true';
  }
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

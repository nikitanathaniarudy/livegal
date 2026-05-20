import { RESPONSE_TYPES } from './config.js';

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
export function updateAffectionMeter(total) {
  const fill = document.getElementById('affection-bar-fill');
  const label = document.getElementById('affection-total');

  const pct = ((total + 99) / 198) * 100; // map -99..+99 → 0..100%
  const center = 50;

  if (total >= 0) {
    fill.style.left = center + '%';
    fill.style.width = (pct - center) + '%';
    fill.style.background = 'var(--choice-d)'; // green
  } else {
    fill.style.left = pct + '%';
    fill.style.width = (center - pct) + '%';
    fill.style.background = 'var(--choice-c)'; // red
  }

  label.textContent = (total > 0 ? '+' : '') + total;
  label.style.color = total > 0
    ? 'var(--choice-d)'
    : total < 0 ? 'var(--choice-c)' : 'var(--ink-dim)';
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
  document.getElementById('camera-overlay').classList.add('hidden');
}

export function setCameraAnalyzing(active) {
  document.getElementById('camera-preview').classList.toggle('analyzing', active);
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
  document.getElementById('person-selector').style.display = 'none';
  document.getElementById('session-bar').classList.remove('hidden');
  document.getElementById('session-person-name').textContent = personName;
}

export function showPersonSelector() {
  document.getElementById('person-selector').style.display = '';
  document.getElementById('session-bar').classList.add('hidden');
  document.getElementById('session-person-name').textContent = '—';
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
    const affCls = aff > 0 ? 'pos' : aff < 0 ? 'neg' : 'neu';
    const affSign = aff > 0 ? '+' : '';
    const lastSeen = formatDate(p.lastSeen);

    return `
      <div class="person-card affection-${affCls}" data-person-id="${p.id}">
        <div class="person-card-name">${p.name}</div>
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

export function renderPersonDetail(person, conversations) {
  document.getElementById('directory-grid').classList.add('hidden');

  const detail = document.getElementById('person-detail');
  detail.classList.remove('hidden');
  document.getElementById('dir-back-btn').classList.remove('hidden');
  document.getElementById('directory-title').textContent = `— ${person.name} —`;

  if (!conversations.length) {
    detail.innerHTML = `<div class="directory-empty">No saved conversations yet.</div>`;
    return;
  }

  detail.innerHTML = conversations.map((c, ci) => {
    const aff = c.finalAffection;
    const affCls = aff > 0 ? 'pos' : aff < 0 ? 'neg' : 'zero';
    const affSign = aff > 0 ? '+' : '';
    const date = formatDate(c.startedAt, true);

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
          </div>
        </div>
        <div class="conv-card-body" id="conv-body-${ci}">
          ${exchanges || '<div class="conv-exchange" style="color:var(--ink-dim)">No exchanges recorded.</div>'}
        </div>
      </div>`;
  }).join('');

  // Toggle expand/collapse
  detail.querySelectorAll('.conv-card-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const body = document.getElementById(`conv-body-${hdr.dataset.convIdx}`);
      body.classList.toggle('open');
    });
  });
}

// ── Utility ──────────────────────────────────────────────────────────

function formatDate(isoString, includeTime = false) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  if (!includeTime) return date;
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

// ── Analytics view ───────────────────────────────────────────────────

const TYPE_COLORS = {
  Kind:      'var(--choice-a)',
  Funny:     'var(--choice-b)',
  Sarcastic: 'var(--choice-c)',
  Cold:      'var(--choice-d)',
};

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

function archetypeCard(data) {
  const a    = data.archetype;
  const emoji = a?.emoji || '🎭';
  const name  = a?.name  || 'Unknown';
  const desc  = a?.description || '';
  const traits = (a?.traits || []).map(t => `<span class="archetype-trait">${t}</span>`).join('');

  const blendRows = Object.entries(data.pct).map(([label, pct]) => `
    <div class="blend-row">
      <span class="blend-label">${label}</span>
      <div class="blend-bar-wrap">
        <div class="blend-bar-fill" data-target="${(pct * 100).toFixed(0)}"
          style="width:0%;background:${TYPE_COLORS[label]}"></div>
      </div>
      <span class="blend-pct">${(pct * 100).toFixed(0)}%</span>
    </div>`).join('');

  return `
    <div class="archetype-card" data-emoji="${emoji}">
      <div class="archetype-eyebrow">your personality type</div>
      <div class="archetype-name">${emoji} ${name}</div>
      <div class="archetype-desc">${desc}</div>
      <div class="archetype-traits">${traits}</div>
      <div class="archetype-blend">${blendRows}</div>
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
}

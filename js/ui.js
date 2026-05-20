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

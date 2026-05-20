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
  list.innerHTML = history.map(h => `
    <div class="history-entry">
      <div class="history-said">
        <strong>They said:</strong> ${h.said}
        <span style="display:block;margin-top:4px;color:var(--ink)">↳ ${h.text}</span>
      </div>
      <div class="history-chose badge-${h.cls}">${h.label}</div>
    </div>
  `).join('');
}

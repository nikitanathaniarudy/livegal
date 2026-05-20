import { RESPONSE_TYPES } from './config.js';
import { fetchOptions } from './llm.js';
import { SpeechInput } from './speech.js';
import {
  setStatus, setDialogue, resetDialogue,
  showError, clearError, setHint,
  showShimmer, showEmptyChoices, renderChoices,
  renderHistory,
} from './ui.js';

// ── State ────────────────────────────────────────────────────────────

const history = [];

// ── DOM refs ─────────────────────────────────────────────────────────

const speechInput  = document.getElementById('speech-input');
const generateBtn  = document.getElementById('generate-btn');
const micBtn       = document.getElementById('mic-btn');
const modelInput   = document.getElementById('model-input');

// ── Speech ───────────────────────────────────────────────────────────

const speech = new SpeechInput({
  onStart:   ()    => { micBtn.classList.add('listening'); setHint('🔴 Listening… speak now', true); speechInput.value = ''; },
  onStop:    ()    => { micBtn.classList.remove('listening'); },
  onInterim: text  => { speechInput.value = text; setHint('🔴 ' + text, true); },
  onFinal:   text  => { speechInput.value = text; setHint('✓ Got it — press Generate or speak again'); },
  onError:   msg   => { setHint('⚠ ' + msg); },
});

if (!speech.supported) {
  micBtn.disabled = true;
  micBtn.title = 'Not supported — use Chrome or Edge';
  setHint('Mic unavailable in this browser. Use Chrome or Edge.');
}

micBtn.addEventListener('click', () => speech.toggle());

// ── Generate ─────────────────────────────────────────────────────────

async function generate() {
  const said = speechInput.value.trim();
  if (!said) return;

  generateBtn.disabled = true;
  setStatus('loading');
  clearError();
  setDialogue(said);
  showShimmer();

  try {
    const options = await fetchOptions(said, modelInput.value.trim() || 'llama3.2');
    renderChoices(options, handlePick);
    setStatus('');
  } catch (err) {
    setStatus('error');
    const isNetworkError = err.message.includes('fetch') || err.message.includes('Failed');
    showError(isNetworkError
      ? `Cannot reach Ollama at localhost:11434.<br><br>
         Make sure it is running: <strong>ollama serve</strong><br>
         Pull a model first: <strong>ollama pull llama3.2</strong>`
      : err.message
    );
    showEmptyChoices('Error generating options — see above');
  } finally {
    generateBtn.disabled = false;
  }
}

// ── Pick a choice ─────────────────────────────────────────────────────

function handlePick(index, label, text) {
  const cls = RESPONSE_TYPES[index]?.cls || 'a';
  const said = speechInput.value.trim() || document.getElementById('dialogue-display').textContent;

  history.unshift({ said, label, text, cls });
  renderHistory(history);

  speechInput.value = '';
  resetDialogue();
  showEmptyChoices('Good choice. Enter what they say next ↑');
  clearError();
  setHint('');
  speechInput.focus();
}

// ── Event listeners ───────────────────────────────────────────────────

generateBtn.addEventListener('click', generate);

speechInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') generate();
});

document.getElementById('clear-btn').addEventListener('click', () => {
  history.length = 0;
  renderHistory(history);
});

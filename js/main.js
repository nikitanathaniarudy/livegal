import { RESPONSE_TYPES } from './config.js';
import { fetchOptions } from './llm.js';
import { SpeechInput } from './speech.js';
import { Camera } from './camera.js';
import { AffectionTracker, EXPRESSION_EMOJI } from './affection.js';
import {
  setStatus, setDialogue, resetDialogue,
  showError, clearError, setHint,
  showShimmer, showEmptyChoices, renderChoices,
  renderHistory, updateAffectionMeter, showScorePopup,
  setCameraOverlayHint, hideCameraOverlay, setCameraAnalyzing,
} from './ui.js';

// ── State ────────────────────────────────────────────────────────────

const history = [];

// ── DOM refs ─────────────────────────────────────────────────────────

const speechInput     = document.getElementById('speech-input');
const generateBtn     = document.getElementById('generate-btn');
const micBtn          = document.getElementById('mic-btn');
const modelInput      = document.getElementById('model-input');
const cameraFeed      = document.getElementById('camera-feed');
const cameraStartBtn  = document.getElementById('camera-start-btn');

// ── Camera ───────────────────────────────────────────────────────────

const camera = new Camera();

cameraStartBtn.addEventListener('click', async () => {
  cameraStartBtn.disabled = true;
  setCameraOverlayHint('Requesting camera access…');

  try {
    await camera.start(cameraFeed);
    hideCameraOverlay();
    await loadAffectionModels();
  } catch (err) {
    cameraStartBtn.disabled = false;
    setCameraOverlayHint(
      err.name === 'NotAllowedError'
        ? 'Camera access denied. Allow it in your browser settings.'
        : 'Could not start camera: ' + err.message
    );
  }
});

// ── Affection ────────────────────────────────────────────────────────

const affection = new AffectionTracker();

async function loadAffectionModels() {
  try {
    await affection.load(msg => setCameraOverlayHint(msg));
  } catch (err) {
    setCameraOverlayHint('Face models failed to load: ' + err.message);
  }
}

// ── Speech ───────────────────────────────────────────────────────────

const speech = new SpeechInput({
  onStart:   ()   => { micBtn.classList.add('listening'); setHint('🔴 Listening… speak now', true); speechInput.value = ''; },
  onStop:    ()   => { micBtn.classList.remove('listening'); },
  onInterim: text => { speechInput.value = text; setHint('🔴 ' + text, true); },
  onFinal:   text => { speechInput.value = text; setHint('✓ Got it — press Generate or speak again'); },
  onError:   msg  => { setHint('⚠ ' + msg); },
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

async function handlePick(index, label, text) {
  const cls = RESPONSE_TYPES[index]?.cls || 'a';
  const said = speechInput.value.trim() || document.getElementById('dialogue-display').textContent;

  // Add to history immediately (affection delta added later)
  const entry = { said, label, text, cls };
  history.unshift(entry);
  renderHistory(history);

  // Reset UI for next turn
  speechInput.value = '';
  resetDialogue();
  showEmptyChoices('Good choice. Enter what they say next ↑');
  clearError();
  setHint('');
  speechInput.focus();

  // Affection analysis — only if camera + models are ready
  if (camera.isRunning && affection.isLoaded) {
    setHint('Reading their reaction…');
    setCameraAnalyzing(true);

    const result = await affection.analyzeReaction(cameraFeed);

    setCameraAnalyzing(false);
    setHint('');

    const total = affection.apply(result.delta);
    updateAffectionMeter(total);
    showScorePopup(result.delta, result.dominant, EXPRESSION_EMOJI);

    // Patch the history entry with the result
    entry.affectionDelta = result.delta;
    entry.emoji = EXPRESSION_EMOJI[result.dominant] || '😐';
    renderHistory(history);
  }
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

// Initialise meter at 0
updateAffectionMeter(0);

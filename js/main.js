import { RESPONSE_TYPES } from './config.js';
import { fetchOptions }    from './llm.js';
import { SpeechInput }     from './speech.js';
import { Camera }          from './camera.js';
import { AffectionTracker, EXPRESSION_EMOJI } from './affection.js';
import { RecognitionTracker } from './recognition.js';
import { GalGameDB }       from './db.js';
import { computeAnalytics } from './analytics.js';
import {
  setStatus, setDialogue, resetDialogue,
  showError, clearError, setHint,
  showShimmer, showEmptyChoices, renderChoices, renderHistory,
  updateAffectionMeter, showScorePopup,
  setCameraOverlayHint, hideCameraOverlay, setCameraAnalyzing,
  populatePersonSelect, showSessionBar, showPersonSelector,
  renderDirectory, renderPersonDetail, renderAnalytics,
} from './ui.js';

// ── Core objects ──────────────────────────────────────────────────────

const db          = new GalGameDB();
const camera      = new Camera();
const affection   = new AffectionTracker();
const recognition = new RecognitionTracker();

// ── Session state ─────────────────────────────────────────────────────

let history       = [];
let currentPerson = null;   // person object from DB
let sessionStart  = null;   // ISO string
let isRecognizing = false;

// ── DOM refs ──────────────────────────────────────────────────────────

const speechInput    = document.getElementById('speech-input');
const generateBtn    = document.getElementById('generate-btn');
const micBtn         = document.getElementById('mic-btn');
const modelInput     = document.getElementById('model-input');
const cameraFeed     = document.getElementById('camera-feed');
const cameraStartBtn = document.getElementById('camera-start-btn');
const personSelect   = document.getElementById('person-select');
const personNameInput = document.getElementById('person-name-input');
const startSessionBtn = document.getElementById('start-session-btn');
const endSessionBtn  = document.getElementById('end-session-btn');

// ── Init ──────────────────────────────────────────────────────────────

async function init() {
  await db.open();
  const people = await db.getAllPeople();
  populatePersonSelect(people);
  recognition.updateKnownPeople(people);
  updateAffectionMeter(0);
}

init();

// ── Recognition Loop ──────────────────────────────────────────────────

async function recognitionLoop() {
  if (isRecognizing) return;
  isRecognizing = true;

  while (camera.isRunning) {
    if (currentPerson || !recognition.isLoaded) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    setCameraAnalyzing(true);
    const descriptor = await recognition.getDescriptor(cameraFeed);
    setCameraAnalyzing(false);

    if (descriptor) {
      const match = recognition.recognize(descriptor);
      if (match) {
        startSession(match);
      } else {
        // New person encountered
        setHint('Who are you? (Type name in the box or I will ask)');
        const name = prompt("I don't recognize you. What is your name?");
        if (name) {
          const existing = await db.getPersonByName(name);
          let person;
          if (existing) {
            // Use existing and update descriptor if missing
            person = existing;
            if (!person.faceDescriptor) {
              person = await db.updatePerson(person.id, { faceDescriptor: Array.from(descriptor) });
            }
          } else {
            person = await db.createPerson(name, Array.from(descriptor));
          }
          
          const people = await db.getAllPeople();
          populatePersonSelect(people);
          recognition.updateKnownPeople(people);
          startSession(person);
        } else {
          // If they cancel prompt, wait a bit before trying again
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  isRecognizing = false;
}

function startSession(person) {
  currentPerson = person;
  sessionStart  = new Date().toISOString();
  history       = [];
  affection.total = 0;

  renderHistory(history);
  updateAffectionMeter(0);
  showSessionBar(person.name);
  setHint(`Hello, ${person.name}!`);
  speechInput.focus();
}

// ── Navigation ────────────────────────────────────────────────────────

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const view = tab.dataset.view;
    document.getElementById('view-conversation').classList.toggle('view-hidden', view !== 'conversation');
    document.getElementById('view-directory').classList.toggle('view-hidden', view !== 'directory');
    document.getElementById('view-analytics').classList.toggle('view-hidden', view !== 'analytics');

    if (view === 'directory') {
      const people = await db.getAllPeople();
      renderDirectory(people);
    }

    if (view === 'analytics') {
      const [people, conversations] = await Promise.all([
        db.getAllPeople(),
        db.getAllConversations(),
      ]);
      // Include the live in-progress session so analytics work before ending a session
      const allConversations = history.length > 0
        ? [...conversations, { exchanges: history, finalAffection: affection.total }]
        : conversations;
      const data = computeAnalytics(people, allConversations);
      renderAnalytics(data);
    }
  });
});

// ── Directory interactions ────────────────────────────────────────────

document.getElementById('directory-grid').addEventListener('click', async (e) => {
  const delBtn = e.target.closest('.person-card-delete');
  if (delBtn) {
    e.stopPropagation();
    const personId = Number(delBtn.dataset.personId);
    if (confirm('Are you sure you want to delete this person and all their conversation history?')) {
      await db.deletePerson(personId);
      const people = await db.getAllPeople();
      renderDirectory(people);
      populatePersonSelect(people);
      recognition.updateKnownPeople(people);
    }
    return;
  }

  const card = e.target.closest('.person-card');
  if (!card) return;
  const personId = Number(card.dataset.personId);
  const [person, conversations] = await Promise.all([
    db.getPerson(personId),
    db.getConversationsForPerson(personId),
  ]);
  renderPersonDetail(person, conversations);
});

document.getElementById('directory-title').addEventListener('click', async (e) => {
  const delBtn = e.target.closest('.person-detail-delete');
  if (!delBtn) return;
  
  const personId = Number(delBtn.dataset.personId);
  if (confirm('Are you sure you want to delete this person and all their conversation history?')) {
    await db.deletePerson(personId);
    const people = await db.getAllPeople();
    renderDirectory(people);
    populatePersonSelect(people);
    recognition.updateKnownPeople(people);
  }
});

document.getElementById('dir-back-btn').addEventListener('click', async () => {
  const people = await db.getAllPeople();
  renderDirectory(people);
});

// ── Person selector ───────────────────────────────────────────────────

personSelect.addEventListener('change', () => {
  const isNew = personSelect.value === '__new__';
  personNameInput.style.display = isNew ? '' : 'none';
  personSelect.style.display    = isNew ? 'none' : '';
  if (isNew) personNameInput.focus();
});

startSessionBtn.addEventListener('click', async () => {
  let person;

  if (personSelect.style.display === 'none') {
    // New person flow
    const name = personNameInput.value.trim();
    if (!name) { personNameInput.focus(); return; }
    
    // Capture descriptor if camera is on
    let descriptor = null;
    if (camera.isRunning && recognition.isLoaded) {
      setCameraAnalyzing(true);
      descriptor = await recognition.getDescriptor(cameraFeed);
      setCameraAnalyzing(false);
    }
    
    const existing = await db.getPersonByName(name);
    if (existing) {
      person = existing;
      if (!person.faceDescriptor && descriptor) {
        person = await db.updatePerson(person.id, { faceDescriptor: Array.from(descriptor) });
      }
    } else {
      person = await db.createPerson(name, descriptor ? Array.from(descriptor) : null);
    }

    // Add to dropdown and reset selector UI
    personNameInput.style.display = 'none';
    personSelect.style.display    = '';
    personSelect.value            = '';
    const people = await db.getAllPeople();
    populatePersonSelect(people);
    recognition.updateKnownPeople(people);
  } else {
    const id = Number(personSelect.value);
    if (!id) return;
    person = await db.getPerson(id);
  }

  startSession(person);
});

// ── End session ───────────────────────────────────────────────────────

endSessionBtn.addEventListener('click', async () => {
  if (!currentPerson) return;

  if (history.length > 0) {
    await db.saveConversation(currentPerson.id, history, affection.total, sessionStart);
    await db.updatePerson(currentPerson.id, {
      lastSeen:          new Date().toISOString(),
      totalAffection:    currentPerson.totalAffection + affection.total,
      conversationCount: currentPerson.conversationCount + 1,
    });
  }

  // Reset everything
  currentPerson   = null;
  sessionStart    = null;
  history         = [];
  affection.total = 0;

  renderHistory([]);
  updateAffectionMeter(0);
  resetDialogue();
  showEmptyChoices();
  showPersonSelector();

  // Refresh dropdown
  const people = await db.getAllPeople();
  populatePersonSelect(people);
  recognition.updateKnownPeople(people);
});

// ── Camera ────────────────────────────────────────────────────────────

cameraStartBtn.addEventListener('click', async () => {
  cameraStartBtn.disabled = true;
  setCameraOverlayHint('Requesting camera access…');
  try {
    await camera.start(cameraFeed);
    hideCameraOverlay();
    await loadModels();
    recognitionLoop();
  } catch (err) {
    cameraStartBtn.disabled = false;
    setCameraOverlayHint(
      err.name === 'NotAllowedError'
        ? 'Camera access denied — allow it in browser settings.'
        : 'Could not start camera: ' + err.message
    );
  }
});

async function loadModels() {
  try {
    // Load both affection and recognition models
    await Promise.all([
      affection.load(msg => setCameraOverlayHint(msg)),
      recognition.load(msg => setCameraOverlayHint(msg))
    ]);
  } catch (err) {
    setCameraOverlayHint('Models failed: ' + err.message);
  }
}

// ── Speech ────────────────────────────────────────────────────────────

const speech = new SpeechInput({
  onStart:   ()   => { micBtn.classList.add('listening'); setHint('🔴 Listening…', true); speechInput.value = ''; },
  onStop:    ()   => micBtn.classList.remove('listening'),
  onInterim: text => { speechInput.value = text; setHint('🔴 ' + text, true); },
  onFinal:   text => { speechInput.value = text; setHint('✓ Got it — press Generate or speak again'); },
  onError:   msg  => setHint('⚠ ' + msg),
});

if (!speech.supported) {
  micBtn.disabled = true;
  micBtn.title    = 'Not supported — use Chrome or Edge';
}

micBtn.addEventListener('click', () => speech.toggle());

// ── Generate ──────────────────────────────────────────────────────────

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
    const isNetwork = err.message.includes('fetch') || err.message.includes('Failed');
    showError(isNetwork
      ? `Cannot reach Ollama at localhost:11434.<br><br>Run: <strong>ollama serve</strong> then <strong>ollama pull llama3.2</strong>`
      : err.message
    );
    showEmptyChoices('Error generating options — see above');
  } finally {
    generateBtn.disabled = false;
  }
}

// ── Pick a choice ─────────────────────────────────────────────────────

async function handlePick(index, label, text) {
  const cls  = RESPONSE_TYPES[index]?.cls || 'a';
  const said = speechInput.value.trim()
    || document.getElementById('dialogue-display').textContent;

  const entry = { said, label, text, cls };
  history.unshift(entry);
  renderHistory(history);

  speechInput.value = '';
  resetDialogue();
  showEmptyChoices('Good choice. Enter what they say next ↑');
  clearError();
  setHint('');
  speechInput.focus();

  // Affection analysis
  if (camera.isRunning && affection.isLoaded) {
    setHint('Reading their reaction…');
    setCameraAnalyzing(true);

    const result = await affection.analyzeReaction(cameraFeed);

    setCameraAnalyzing(false);
    setHint('');

    const total = affection.apply(result.delta);
    updateAffectionMeter(total);
    showScorePopup(result.delta, result.dominant, EXPRESSION_EMOJI);

    entry.affectionDelta = result.delta;
    entry.emoji          = EXPRESSION_EMOJI[result.dominant] || '😐';
    renderHistory(history);
  }
}

// ── Event listeners ───────────────────────────────────────────────────

generateBtn.addEventListener('click', generate);
speechInput.addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });
document.getElementById('clear-btn').addEventListener('click', () => {
  history = [];
  renderHistory([]);
});

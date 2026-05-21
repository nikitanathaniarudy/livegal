import { RESPONSE_TYPES, DEFAULT_MODEL } from './config.js';
import { fetchOptions }    from './llm.js';
import { SpeechInput }     from './speech.js';
import { Camera }          from './camera.js';
import { AffectionTracker, EXPRESSION_EMOJI } from './affection.js';
import { RecognitionTracker } from './recognition.js';
import { GalGameDB }           from './db.js';
import { computeAnalytics }    from './analytics.js';
import { ConversationRAG }     from './rag.js';
import { extractRelationships } from './extractor.js';
import { extractOpponentCues }  from './opponent.js';
import { showDebrief }          from './ui.js';
import { RelationshipGraph }   from './graph.js';
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
const rag         = new ConversationRAG();
let   graph       = null;   // lazy-init when Network tab first opens

// ── Session state ─────────────────────────────────────────────────────

let history        = [];
let currentPerson  = null;
let sessionStart   = null;
let isRecognizing  = false;
let pendingOptions = []; // all 4 choices from the most recent generate()

// ── DOM refs ──────────────────────────────────────────────────────────

const speechInput     = document.getElementById('speech-input');
const generateBtn     = document.getElementById('generate-btn');
const micBtn          = document.getElementById('mic-btn');
const modelInput      = document.getElementById('model-input');
const cameraFeed      = document.getElementById('camera-feed');
const cameraStartBtn  = document.getElementById('camera-start-btn');
const personSelect    = document.getElementById('person-select');
const personNameInput = document.getElementById('person-name-input');
const startSessionBtn = document.getElementById('start-session-btn');
const endSessionBtn   = document.getElementById('end-session-btn');
const facePrompt      = document.getElementById('face-prompt');
const facePromptInput = document.getElementById('face-prompt-input');
const facePromptOk    = document.getElementById('face-prompt-ok');
const facePromptSkip  = document.getElementById('face-prompt-skip');

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
        const person = await db.getPerson(match.id);
        if (person) await startSession(person, true);
      } else {
        const nameInput = await askFaceName();
        if (nameInput) {
          const name = toTitleCase(nameInput);
          const existing = await db.getPersonByName(name);
          let person;
          if (existing) {
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
          await startSession(person, false);
        } else {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  isRecognizing = false;
}

function askFaceName() {
  return new Promise(resolve => {
    facePromptInput.value = '';
    facePrompt.classList.remove('hidden');
    facePromptInput.focus();

    const done = (name) => {
      facePrompt.classList.add('hidden');
      facePromptOk.removeEventListener('click', onOk);
      facePromptSkip.removeEventListener('click', onSkip);
      facePromptInput.removeEventListener('keydown', onKey);
      resolve(name || null);
    };

    const onOk   = () => done(facePromptInput.value.trim());
    const onSkip = () => done(null);
    const onKey  = (e) => { if (e.key === 'Enter') done(facePromptInput.value.trim()); };

    facePromptOk.addEventListener('click', onOk);
    facePromptSkip.addEventListener('click', onSkip);
    facePromptInput.addEventListener('keydown', onKey);
  });
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

async function startSession(person, autoRecognized = false) {
  currentPerson   = person;
  sessionStart    = new Date().toISOString();
  history         = [];
  affection.total = 0;

  console.log(`Starting session with: ${person.name} (Auto: ${autoRecognized})`);

  // Load all past memories for this person (cross-session RAG)
  await rag.loadFromDB(db, person.id);

  renderHistory(history);
  updateAffectionMeter(0);
  showSessionBar(person.name);
  
  if (autoRecognized) {
    setHint(`Hello, ${person.name}! (Not you? End session to switch)`);
  } else {
    setHint(`Hello, ${person.name}!`);
  }

  // Refresh graph if we are on that tab to show the active highlight
  const networkTab = document.querySelector('.nav-tab[data-view="network"]');
  if (networkTab && networkTab.classList.contains('active')) {
    const [people, relationships] = await Promise.all([
      db.getAllPeople(),
      db.getAllRelationships(),
    ]);
    if (graph) graph.setData(people, relationships, person.name);
  }
  
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
    document.getElementById('view-network').classList.toggle('view-hidden', view !== 'network');

    if (view === 'directory') {
      const people = await db.getAllPeople();
      renderDirectory(people);
    }

    if (view === 'analytics') {
      const [people, conversations] = await Promise.all([
        db.getAllPeople(),
        db.getAllConversations(),
      ]);
      const allConversations = history.length > 0
        ? [...conversations, { exchanges: history, finalAffection: affection.total }]
        : conversations;
      renderAnalytics(computeAnalytics(people, allConversations));
    }

    if (view === 'network') {
      const canvas = document.getElementById('graph-canvas');
      const emptyEl = document.getElementById('graph-empty');
      const [people, relationships] = await Promise.all([
        db.getAllPeople(),
        db.getAllRelationships(),
      ]);

      if (!graph) graph = new RelationshipGraph(canvas);
      
      // Ensure click handler is ALWAYS set, even if graph was already initialized
      graph.onNodeClick = (node) => {
        console.log(`Graph node clicked: ${node.label}`, node.traits);
        const traits = node.traits || [];
        if (traits.length > 0) {
          setHint(`[${node.label}] traits: ${traits.join(', ')}`, true);
        } else {
          setHint(`[${node.label}] No specific traits recorded.`, true);
        }
      };

      const hasData = people.length > 0 || relationships.length > 0;
      emptyEl.classList.toggle('hidden', hasData);
      if (hasData) graph.setData(people, relationships, currentPerson?.name);
    }
  });
});

// ── Directory interactions ────────────────────────────────────────────

document.getElementById('directory-grid').addEventListener('click', async (e) => {
  const delBtn = e.target.closest('.person-card-delete');
  if (delBtn) {
    e.stopPropagation();
    const personId = Number(delBtn.dataset.personId);
    if (confirm('Delete this person and all their history?')) {
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
  const [person, conversations, observations] = await Promise.all([
    db.getPerson(personId),
    db.getConversationsForPerson(personId),
    db.getOpponentObservationsForPerson(personId),
  ]);
  renderPersonDetail(person, conversations, observations);
});

document.getElementById('directory-title').addEventListener('click', async (e) => {
  const delBtn = e.target.closest('.person-detail-delete');
  if (!delBtn) return;

  const personId = Number(delBtn.dataset.personId);
  if (!confirm('Delete this person and all their history?')) return;

  await db.deletePerson(personId);
  const people = await db.getAllPeople();
  renderDirectory(people);
  populatePersonSelect(people);
  recognition.updateKnownPeople(people);
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
    const rawName = personNameInput.value.trim();
    if (!rawName) { personNameInput.focus(); return; }
    const name = toTitleCase(rawName);

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

  await startSession(person, false);
});

// ── End session ───────────────────────────────────────────────────────

endSessionBtn.addEventListener('click', async () => {
  if (!currentPerson) return;

  // Capture before clearing
  const sessionExchanges  = [...history];
  const sessionPersonName = currentPerson.name;
  const sessionAffection  = affection.total;

  if (history.length > 0) {
    await db.saveConversation(currentPerson.id, history, affection.total, sessionStart);
    await db.updatePerson(currentPerson.id, {
      lastSeen:          new Date().toISOString(),
      totalAffection:    currentPerson.totalAffection + affection.total,
      conversationCount: currentPerson.conversationCount + 1,
    });
  }

  currentPerson   = null;
  sessionStart    = null;
  history         = [];
  affection.total = 0;
  pendingOptions  = [];
  rag.clear();

  renderHistory([]);
  updateAffectionMeter(0);
  resetDialogue();
  showEmptyChoices();
  showPersonSelector();

  const people = await db.getAllPeople();
  populatePersonSelect(people);
  recognition.updateKnownPeople(people);

  if (sessionExchanges.length > 0) {
    showDebrief(sessionExchanges, sessionPersonName, sessionAffection);
  }
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
    await Promise.all([
      affection.load(msg => setCameraOverlayHint(msg)),
      recognition.load(msg => setCameraOverlayHint(msg)),
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

  // Extract relationships and discovery immediately in background
  if (currentPerson) {
    const model = modelInput.value.trim() || DEFAULT_MODEL;
    console.log(`Extracting relationships from: "${said}" (Speaker: ${currentPerson.name})`);
    extractRelationships(said, model, currentPerson.name).then(async found => {
      let anyNew = false;
      for (const { name, relationship, traits, category } of found) {
        // Filter out the current speaker to avoid "Raynard is stubborn" being added as a link to himself
        if (name === currentPerson.name) {
          // But still update traits for the current person!
          if (traits && traits.length > 0) {
            const newTraits = [...new Set([...(currentPerson.traits || []), ...traits])];
            await db.updatePerson(currentPerson.id, { traits: newTraits });
            anyNew = true;
          }
          continue;
        }

        let mentionedPerson = await db.getPersonByName(name);
        if (!mentionedPerson) {
          console.log(`Discovered NEW person via mention: ${name}`);
          mentionedPerson = await db.createPerson(name);
          anyNew = true;
        }

        // 1. Update traits (adjectives)
        if (traits && traits.length > 0) {
          const newTraits = [...new Set([...(mentionedPerson.traits || []), ...traits])];
          await db.updatePerson(mentionedPerson.id, { traits: newTraits });
          anyNew = true;
        }

        // 2. Update relationship (roles)
        if (relationship) {
          console.log(`Saving relationship: ${currentPerson.name} -> ${name} (${relationship})`);
          await db.saveRelationship(currentPerson.id, currentPerson.name, name, relationship, category, said);
          anyNew = true;
        }
      }

      if (anyNew) {
        const people = await db.getAllPeople();
        populatePersonSelect(people);
        recognition.updateKnownPeople(people);

        const networkTab = document.querySelector('.nav-tab[data-view="network"]');
        if (networkTab && networkTab.classList.contains('active')) {
          console.log(`Refreshing network graph with new data (Active: ${currentPerson?.name})...`);
          const relationships = await db.getAllRelationships();
          if (graph) graph.setData(people, relationships, currentPerson?.name);
        }
      }
    });
  }

  try {
    const [context, relationships] = await Promise.all([
      rag.retrieve(said),
      currentPerson ? db.getRelationshipsForPerson(currentPerson.id) : Promise.resolve([]),
    ]);
    const options = await fetchOptions(said, modelInput.value.trim() || DEFAULT_MODEL, context, relationships);
    pendingOptions = options;
    renderChoices(options, handlePick);
    setStatus('');
  } catch (err) {
    setStatus('error');
    const isNetwork = err.message.includes('fetch') || err.message.includes('Failed');
    showError(isNetwork
      ? `Cannot reach Ollama at localhost:11434.<br><br>Run: <strong>ollama serve</strong> then <strong>ollama pull ${DEFAULT_MODEL}</strong>`
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

  const entry = { said, label, text, cls, chosenIndex: index, options: [...pendingOptions] };
  history.unshift(entry);
  renderHistory(history);

  speechInput.value = '';
  resetDialogue();
  showEmptyChoices('Good choice. Enter what they say next ↑');
  clearError();
  setHint('');
  speechInput.focus();

  // Persist memory for RAG — fire-and-forget
  if (currentPerson) {
    rag.addAndPersist(entry, db, currentPerson.id);

    // Opponent personality cue extraction — fire-and-forget
    const model = modelInput.value.trim() || DEFAULT_MODEL;
    extractOpponentCues(said, model).then(cues => {
      if (cues) db.saveOpponentObservation(currentPerson.id, said, cues);
    });
  }

  // Affection analysis via camera
  if (camera.isRunning && affection.isLoaded) {
    setHint('Reading their reaction…');
    setCameraAnalyzing(true);

    const result = await affection.analyzeReaction(cameraFeed);

    setCameraAnalyzing(false);
    setHint('');

    const total = affection.apply(result.delta);
    entry.affectionDelta = result.delta;

    const sparkData = [...history].reverse()
      .reduce((acc, e) => {
        if (e.affectionDelta !== undefined)
          acc.push((acc.length ? acc[acc.length - 1] : 0) + e.affectionDelta);
        return acc;
      }, []);

    updateAffectionMeter(total, sparkData);
    showScorePopup(result.delta, result.dominant, EXPRESSION_EMOJI);
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
  // RAG memories intentionally NOT cleared — they persist across sessions per person
});

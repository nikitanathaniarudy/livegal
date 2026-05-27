import { RESPONSE_TYPES, DEFAULT_MODEL } from './config.js';
console.log('main.js loaded [v3 - registration-root]');
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
import { RelationshipGraph }   from './graph.js';
import {
  setStatus, setDialogue, resetDialogue,
  showError, clearError, setHint,
  showShimmer, showEmptyChoices, renderChoices, renderHistory,
  updateAffectionMeter, showScorePopup,
  setCameraOverlayHint, hideCameraOverlay, setCameraAnalyzing,
  populatePersonSelect, showSessionBar, showPersonSelector, resetToIdleState,
  renderDirectory, renderPersonDetail, renderAnalytics,
  showDebrief, renderGlobalHistory, renderGlobalHistoryGraph,
} from './ui.js';

// ── Core objects ──────────────────────────────────────────────────────

const db          = new GalGameDB();
const camera      = new Camera();
const affection   = new AffectionTracker();
const recognition = new RecognitionTracker();
const rag         = new ConversationRAG();
let   graph       = null;   // lazy-init when Network tab first opens

// ── Player identity ───────────────────────────────────────────────────

let playerName = localStorage.getItem('playerName') || '';

function setPlayerName(name) {
  playerName = name.trim();
  localStorage.setItem('playerName', playerName);
  document.getElementById('player-name-display').textContent = playerName || '—';
}

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
const cameraManualBtn = document.getElementById('camera-manual-btn');
const personSelect    = document.getElementById('person-select');
const personNameInput = document.getElementById('person-name-input');
const startSessionBtn = document.getElementById('start-session-btn');
const endSessionBtn   = document.getElementById('end-session-btn');
const cameraSelect    = document.getElementById('camera-select');

// ── Init ──────────────────────────────────────────────────────────────

async function init() {
  await db.open();
  const people = await db.getAllPeople();
  populatePersonSelect(people);
  recognition.updateKnownPeople(people);
  updateAffectionMeter(0);
  resetToIdleState();

  // Player identity setup
  document.getElementById('player-name-display').textContent = playerName || '—';
  if (!playerName) {
    document.getElementById('player-setup-modal').classList.remove('hidden');
    document.getElementById('player-setup-input').focus();
  }
}

init();

// ── Player name setup events ──────────────────────────────────────────

document.getElementById('player-setup-ok').addEventListener('click', () => {
  const val = document.getElementById('player-setup-input').value.trim();
  if (!val) return;
  setPlayerName(val);
  document.getElementById('player-setup-modal').classList.add('hidden');
});

document.getElementById('player-setup-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('player-setup-ok').click();
});

document.getElementById('player-name-display').addEventListener('click', () => {
  const input = document.getElementById('player-setup-input');
  input.value = playerName;
  document.getElementById('player-setup-modal').classList.remove('hidden');
  input.focus();
});

// ── Recognition Loop ──────────────────────────────────────────────────

let detectionStreak = { id: null, count: 0, descriptor: null };
const STREAK_THRESHOLD = 2; // frames to confirm (faster)

async function recognitionLoop() {
  if (isRecognizing) return;
  isRecognizing = true;

  while (camera.isRunning) {
    const conversationView = document.getElementById('view-conversation');
    const isConversationViewActive = conversationView && !conversationView.classList.contains('view-hidden');

    // Skip if already in a session, models not loaded, or NOT on the conversation tab
    if (currentPerson || !recognition.isLoaded || !isConversationViewActive) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    setCameraAnalyzing(true);
    const descriptor = await recognition.getDescriptor(cameraFeed);
    setCameraAnalyzing(false);

    if (descriptor) {
      console.log('Face descriptor captured, attempting recognition...');
      const match = recognition.recognize(descriptor);
      const matchedId = match ? match.id : 'unknown';

      console.log(`Current streak: ${detectionStreak.id} (${detectionStreak.count}/${STREAK_THRESHOLD}) | Match: ${matchedId}`);

      // If we are already talking to this person, keep streak at 0
      if (currentPerson && currentPerson.id === matchedId) {
        detectionStreak = { id: null, count: 0, descriptor: null };
      } else {
        if (detectionStreak.id === matchedId) {
          detectionStreak.count++;
          detectionStreak.descriptor = descriptor; // Keep latest descriptor
        } else {
          detectionStreak = { id: matchedId, count: 1, descriptor };
        }

        if (detectionStreak.count >= STREAK_THRESHOLD) {
          console.log(`Streak reached! Proceeding with identification for: ${matchedId}`);
          const finalDescriptor = detectionStreak.descriptor;
          const finalId = detectionStreak.id;
          detectionStreak = { id: null, count: 0, descriptor: null };

          if (finalId === 'unknown') {
            console.log('Triggering name prompt for new face...');
            try {
              console.log('Type of initiateFaceRegistration:', typeof initiateFaceRegistration);
              const nameInput = await initiateFaceRegistration();
              if (nameInput) {
                const name = toTitleCase(nameInput);
                const existing = await db.getPersonByName(name);
                let person;
                if (existing) {
                  person = existing;
                  if (!person.faceDescriptor) {
                    person = await db.updatePerson(person.id, { faceDescriptor: Array.from(finalDescriptor) });
                  }
                } else {
                  person = await db.createPerson(name, Array.from(finalDescriptor));
                }
                const people = await db.getAllPeople();
                populatePersonSelect(people);
                recognition.updateKnownPeople(people);
                
                if (currentPerson) await endCurrentSession(false);
                await startSession(person, false);
              }
            } catch (err) {
              console.error('Error during face registration or session start:', err);
            }
          } else {
            // Known person (different from current) detected
            const person = await db.getPerson(finalId);
            if (person) {
              if (currentPerson) await endCurrentSession(false);
              await startSession(person, true);
            }
          }
        }
      }
    } else {
      // No face detected, reset streak
      detectionStreak = { id: null, count: 0, descriptor: null };
    }

    await new Promise(r => setTimeout(r, 1000)); // faster polling
  }

  isRecognizing = false;
}

function initiateFaceRegistration() {
  console.log('initiateFaceRegistration() called');
  return new Promise(resolve => {
    const el = document.getElementById('face-reg-modal');
    const backdrop = document.getElementById('face-reg-backdrop');
    const input = document.getElementById('face-reg-input');
    const okBtn = document.getElementById('face-reg-ok');
    const skipBtn = document.getElementById('face-reg-skip');

    if (!el || !input || !okBtn || !skipBtn) {
      console.error('Registration modal elements missing from DOM!', { el, input, okBtn, skipBtn });
      resolve(null);
      return;
    }

    input.value = '';
    el.classList.remove('hidden');
    el.style.display = 'flex';
    if (backdrop) {
      backdrop.classList.remove('hidden');
      backdrop.style.display = 'block';
    }
    input.focus();
    
    console.log('Registration modal should be visible now', { 
      display: el.style.display, 
      className: el.className,
      zIndex: window.getComputedStyle(el).zIndex 
    });

    const done = (name) => {
      console.log('Registration modal done, result:', name);
      el.classList.add('hidden');
      el.style.display = 'none';
      if (backdrop) {
        backdrop.classList.add('hidden');
        backdrop.style.display = 'none';
      }
      okBtn.removeEventListener('click', onOk);
      skipBtn.removeEventListener('click', onSkip);
      input.removeEventListener('keydown', onKey);
      resolve(name || null);
    };

    const onOk   = () => done(input.value.trim());
    const onSkip = () => done(null);
    const onKey  = (e) => { if (e.key === 'Enter') done(input.value.trim()); };

    okBtn.addEventListener('click', onOk);
    skipBtn.addEventListener('click', onSkip);
    input.addEventListener('keydown', onKey);
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

// ── Global History State ──────────────────────────────────────────────

let lastHistoryData = { conversations: [], people: [] };

document.getElementById('history-metric-select')?.addEventListener('change', () => {
  renderGlobalHistoryGraph(lastHistoryData.conversations, lastHistoryData.people);
});

// ── Navigation ────────────────────────────────────────────────────────

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    console.log('Tab clicked:', tab.dataset.view);
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const view = tab.dataset.view;
    document.getElementById('view-conversation').classList.toggle('view-hidden', view !== 'conversation');
    document.getElementById('view-directory').classList.toggle('view-hidden', view !== 'directory');
    document.getElementById('view-history').classList.toggle('view-hidden', view !== 'history');
    document.getElementById('view-analytics').classList.toggle('view-hidden', view !== 'analytics');
    document.getElementById('view-network').classList.toggle('view-hidden', view !== 'network');

    if (view === 'directory') {
      const people = await db.getAllPeople();
      renderDirectory(people);
    }

    if (view === 'history') {
      const [people, conversations] = await Promise.all([
        db.getAllPeople(),
        db.getAllConversations(),
      ]);
      lastHistoryData = { conversations, people };
      renderGlobalHistoryGraph(conversations, people);
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

async function endCurrentSession(showModal = true) {
  if (!currentPerson) {
    console.warn('endCurrentSession called but currentPerson is null');
    return;
  }

  console.log(`Ending session with: ${currentPerson.name}`);

  // Capture before clearing
  const sessionExchanges  = [...history];
  const sessionPersonName = currentPerson.name;
  const sessionAffection  = affection.total;

  try {
    if (history.length > 0) {
      const closenessGain = Math.ceil(history.length * 1.5 + Math.max(0, affection.total * 0.5));
      const newCloseness  = Math.min(100, (currentPerson.closeness || 0) + closenessGain);
      
      console.log('Saving conversation and updating person data...');
      await db.saveConversation(currentPerson.id, history, affection.total, sessionStart);
      await db.updatePerson(currentPerson.id, {
        lastSeen:          new Date().toISOString(),
        totalAffection:    currentPerson.totalAffection + affection.total,
        conversationCount: currentPerson.conversationCount + 1,
        closeness:         newCloseness,
      });
    }
  } catch (err) {
    console.error('Failed to save session data to DB:', err);
    showError('Failed to save session data. Check console for details.');
  }

  // ALWAYS clear state even if DB failed
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
  resetToIdleState();
  
  // Consistently hide the session bar and decide what to show next
  if (camera.isRunning) {
    setHint('Scanning for faces…', true);
    // Explicitly hide both to be safe
    const bar = document.getElementById('session-bar');
    bar.classList.add('hidden');
    bar.style.display = 'none';

    const sel = document.getElementById('person-selector');
    sel.classList.add('hidden');
    sel.style.display = 'none';
  } else {
    showPersonSelector();
  }

  try {
    const people = await db.getAllPeople();
    populatePersonSelect(people);
    recognition.updateKnownPeople(people);
  } catch (err) {
    console.error('Failed to refresh people list:', err);
  }

  if (showModal && sessionExchanges.length > 0) {
    showDebrief(sessionExchanges, sessionPersonName, sessionAffection);
  } else if (showModal) {
    setHint(`Session with ${sessionPersonName} ended.`);
  }
}

if (endSessionBtn) {
  endSessionBtn.addEventListener('click', async () => {
    await endCurrentSession(true);
  });
}

// ── Camera ────────────────────────────────────────────────────────────

const cameraSelectRow = document.getElementById('camera-select-row');
const cameraRefreshBtn = document.getElementById('camera-refresh-btn');
let cameraPermissionGranted = false;

async function enumerateCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(d => d.kind === 'videoinput');
  const prev = cameraSelect.value;
  cameraSelect.innerHTML = cameras.map((d, i) =>
    `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`
  ).join('');
  if (prev && [...cameraSelect.options].some(o => o.value === prev)) {
    cameraSelect.value = prev;
  }
  cameraSelectRow.classList.toggle('hidden', cameras.length === 0);
}

cameraStartBtn.addEventListener('click', async () => {
  cameraStartBtn.disabled = true;
  setCameraOverlayHint('Requesting camera access…');

  // Get permission first so device labels are readable
  if (!cameraPermissionGranted) {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());
      cameraPermissionGranted = true;
    } catch (err) {
      cameraStartBtn.disabled = false;
      setCameraOverlayHint(
        err.name === 'NotAllowedError'
          ? 'Camera access denied — allow it in browser settings.'
          : 'Could not start camera: ' + err.message
      );
      return;
    }
    await enumerateCameras();
  }

  // If multiple cameras exist, show selector and wait for a second click
  const cameraCount = cameraSelect.options.length;
  if (cameraCount > 1 && cameraSelectRow.classList.contains('hidden')) {
    cameraSelectRow.classList.remove('hidden');
    cameraStartBtn.disabled = false;
    cameraStartBtn.textContent = 'Start with selected camera';
    setCameraOverlayHint('Select your camera above, then click Start. Use ↺ if iPhone Camera is missing.');
    return;
  }

  // Single camera or user already chose — start immediately
  setCameraOverlayHint('Starting camera…');
  try {
    const deviceId = cameraSelect.value || null;
    await camera.start(cameraFeed, deviceId);
    hideCameraOverlay();
    resetToIdleState();
    
    // Auto-mode: hide the manual person selector once camera is active
    const sel = document.getElementById('person-selector');
    sel.classList.add('hidden');
    sel.style.display = 'none';
    
    setHint('Scanning for faces…', true);

    await loadModels();
    recognitionLoop();
  } catch (err) {
    cameraStartBtn.disabled = false;
    setCameraOverlayHint('Could not start camera: ' + err.message);
  }
});

cameraRefreshBtn.addEventListener('click', async () => {
  cameraRefreshBtn.textContent = '…';
  await enumerateCameras();
  cameraRefreshBtn.textContent = '↺';
  setCameraOverlayHint('List refreshed — select your camera and click Start.');
});

cameraManualBtn.addEventListener('click', () => {
  hideCameraOverlay();
  showPersonSelector();
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

        // Hard gate: skip anyone with no stated relationship — prevents fictional
        // characters, celebrities, and topic-only mentions from entering the graph.
        if (!relationship) continue;

        let mentionedPerson = await db.getPersonByName(name);
        if (!mentionedPerson) {
          console.log(`Discovered NEW person via mention: ${name} (${relationship})`);
          mentionedPerson = await db.createPerson(name);
          anyNew = true;
        }

        // 1. Update traits (adjectives)
        if (traits && traits.length > 0) {
          const newTraits = [...new Set([...(mentionedPerson.traits || []), ...traits])];
          await db.updatePerson(mentionedPerson.id, { traits: newTraits });
          anyNew = true;
        }

        // 2. Save relationship edge
        console.log(`Saving relationship: ${currentPerson.name} -> ${name} (${relationship})`);
        await db.saveRelationship(currentPerson.id, currentPerson.name, name, relationship, category, said);
        anyNew = true;
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
    const [memories, relationships] = await Promise.all([
      rag.retrieve(said),
      currentPerson ? db.getRelationshipsForPerson(currentPerson.id) : Promise.resolve([]),
    ]);

    // Pass the last 5 exchanges from current session as immediate history
    const recentHistory = [...history].slice(0, 5).reverse();

    const options = await fetchOptions(
      said, 
      modelInput.value.trim() || DEFAULT_MODEL, 
      recentHistory,
      memories, 
      relationships, 
      playerName
    );
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

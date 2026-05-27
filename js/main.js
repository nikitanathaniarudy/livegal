import { RESPONSE_TYPES, DEFAULT_MODEL, CHARACTERS, LANGUAGES } from './config.js';
console.log('main.js loaded [v4 - story-mode]');
import { fetchOptions, evaluateSession } from './llm.js';
import { SpeechInput }     from './speech.js';
import { Camera }          from './camera.js';
import { AffectionTracker, EXPRESSION_EMOJI } from './affection.js';
import { RecognitionTracker } from './recognition.js';
import { GalGameDB }           from './db.js';
import { computeAnalytics }    from './analytics.js';
import { ConversationRAG }     from './rag.js';
import { extractOpponentCues }  from './opponent.js';
import {
  setStatus, setDialogue, resetDialogue, setNameplate,
  showError, clearError, setHint,
  showShimmer, showEmptyChoices, renderChoices, renderHistory,
  updateAffectionMeter, showScorePopup,
  setCameraOverlayHint, hideCameraOverlay, setCameraAnalyzing,
  populatePersonSelect, showSessionBar, showPersonSelector, resetToIdleState,
  renderDirectory, renderPersonDetail, renderAnalytics,
  showDebrief, updateDebriefEval, renderGlobalHistory, renderGlobalHistoryGraph,
  renderStoryMap,
} from './ui.js';
import { SpriteCharacter, LABEL_TO_EXPR } from './sprite.js';
import {
  STORIES, getStory, getNextChapter, getCharacter, fillChapter,
  buildStoryMemory, getStoryState, saveStoryState, assignCharacter, completeChapter,
} from './stories.js';

// ── Core objects ──────────────────────────────────────────────────────

const db          = new GalGameDB();
const camera      = new Camera();
const affection   = new AffectionTracker();
const recognition = new RecognitionTracker();
const rag         = new ConversationRAG();

// ── Character sprite ──────────────────────────────────────────────────
const sprite = new SpriteCharacter(document.getElementById('sprite-canvas'));
sprite.load();


// ── Player identity ───────────────────────────────────────────────────

let playerName = localStorage.getItem('playerName') || '';

// ── Character & language ──────────────────────────────────────────────

let activeCharacter = localStorage.getItem('characterKey') || 'default';
let activeLanguage  = localStorage.getItem('language') || '';

function setPlayerName(name) {
  playerName = name.trim();
  localStorage.setItem('playerName', playerName);
  document.getElementById('player-name-display').textContent = playerName || '—';
}

// ── Session state ─────────────────────────────────────────────────────

let history           = [];
let currentPerson     = null;
let sessionStart      = null;
let isRecognizing     = false;
let pendingOptions    = [];
let activeScenario    = null;
let activeStoryMemory = '';    // story-so-far block passed to LLM
let sessionPending    = false; // true while scenario screen is open

// ── Story state ───────────────────────────────────────────────────────
let storyState  = getStoryState();
const activeStory = getStory(storyState.storyId);

// ── DOM refs ──────────────────────────────────────────────────────────

const speechInput     = document.getElementById('speech-input');
const generateBtn     = document.getElementById('generate-btn');
const micBtn          = document.getElementById('mic-btn');
const cameraFeed      = document.getElementById('camera-feed');
const cameraStartBtn  = document.getElementById('camera-start-btn');
const cameraManualBtn = document.getElementById('camera-manual-btn');
const personSelect    = document.getElementById('person-select');
const personNameInput = document.getElementById('person-name-input');
const startSessionBtn = document.getElementById('start-session-btn');
const endSessionBtn   = document.getElementById('end-session-btn');
const cameraSelect    = document.getElementById('camera-select');
const charSelect      = document.getElementById('char-select');
const langSelect      = document.getElementById('lang-select');
const setupCharSelect = document.getElementById('setup-char-select');
const setupLangSelect = document.getElementById('setup-lang-select');

// ── Init ──────────────────────────────────────────────────────────────

function populateCharOptions(el) {
  if (!el) return;
  el.innerHTML = Object.entries(CHARACTERS)
    .map(([key, c]) => `<option value="${key}">${c.emoji} ${c.name}</option>`)
    .join('');
  el.value = activeCharacter;
}

function populateLangOptions(el) {
  if (!el) return;
  el.innerHTML = Object.entries(LANGUAGES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join('');
  el.value = activeLanguage;
}

function initCharacterSelect() {
  populateCharOptions(charSelect);
  charSelect?.addEventListener('change', () => {
    activeCharacter = charSelect.value;
    localStorage.setItem('characterKey', activeCharacter);
    if (setupCharSelect) setupCharSelect.value = activeCharacter;
  });
}

function initLanguageSelect() {
  populateLangOptions(langSelect);
  langSelect?.addEventListener('change', () => {
    activeLanguage = langSelect.value;
    localStorage.setItem('language', activeLanguage);
    if (setupLangSelect) setupLangSelect.value = activeLanguage;
  });
}

function openSetupModal() {
  const modal = document.getElementById('player-setup-modal');
  const nameInput = document.getElementById('player-setup-input');
  populateCharOptions(setupCharSelect);
  populateLangOptions(setupLangSelect);
  nameInput.value = playerName;
  modal.classList.remove('hidden');
  nameInput.focus();
}

function initHomepage() {
  const hp        = document.getElementById('homepage');
  const nameInput = document.getElementById('hp-name');
  const hpChar    = document.getElementById('hp-char');
  const hpLang    = document.getElementById('hp-lang');
  const startBtn  = document.getElementById('hp-start');

  // Populate selects
  populateCharOptions(hpChar);
  populateLangOptions(hpLang);

  // Pre-fill saved values for returning users
  if (playerName) nameInput.value = playerName;
  if (hpChar)     hpChar.value    = activeCharacter;
  if (hpLang)     hpLang.value    = activeLanguage;

  const start = () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); nameInput.style.borderColor = 'var(--accent)'; return; }

    setPlayerName(name);
    activeCharacter = hpChar?.value || 'default';
    activeLanguage  = hpLang?.value || '';
    localStorage.setItem('characterKey', activeCharacter);
    localStorage.setItem('language', activeLanguage);
    if (charSelect) charSelect.value = activeCharacter;
    if (langSelect) langSelect.value = activeLanguage;

    hp.classList.add('fading');
    setTimeout(() => { hp.style.display = 'none'; }, 560);
  };

  startBtn.addEventListener('click', start);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
}

async function init() {
  await db.open();
  const people = await db.getAllPeople();
  populatePersonSelect(people);
  recognition.updateKnownPeople(people);
  updateAffectionMeter(0);
  resetToIdleState();
  initCharacterSelect();
  initLanguageSelect();

  // Player identity setup
  document.getElementById('player-name-display').textContent = playerName || '—';
  initHomepage();
}

init();

// ── Player name setup events ──────────────────────────────────────────

function finishSetup() {
  const val = document.getElementById('player-setup-input').value.trim();
  if (!val) { document.getElementById('player-setup-input').focus(); return; }

  setPlayerName(val);

  if (setupCharSelect) {
    activeCharacter = setupCharSelect.value;
    localStorage.setItem('characterKey', activeCharacter);
    if (charSelect) charSelect.value = activeCharacter;
  }
  if (setupLangSelect) {
    activeLanguage = setupLangSelect.value;
    localStorage.setItem('language', activeLanguage);
    if (langSelect) langSelect.value = activeLanguage;
  }

  document.getElementById('player-setup-modal').classList.add('hidden');
}

document.getElementById('player-setup-ok').addEventListener('click', finishSetup);

document.getElementById('player-setup-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') finishSetup();
});

document.getElementById('player-name-display').addEventListener('click', () => {
  openSetupModal();
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

    // Skip if already in a session, scenario screen is open, models not loaded, or NOT on the conversation tab
    if (currentPerson || sessionPending || !recognition.isLoaded || !isConversationViewActive) {
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

function showScenarioScreen(person, autoRecognized, onBegin) {
  sessionPending = true;

  // Get next story chapter and record character assignment
  const chapter   = getNextChapter(activeStory, storyState);
  if (!chapter) {
    // Story complete — fall back to idle
    sessionPending = false;
    setHint('Story complete. All chapters finished.');
    return;
  }

  // Link this real person to the story character for this chapter
  if (chapter.character) {
    storyState = assignCharacter(storyState, chapter.character, person.id);
  }

  const filledChapter = fillChapter(chapter, playerName);
  activeScenario = {
    id:         chapter.id,
    title:      chapter.title,
    character:  chapter.character,
    chapterIndex: chapter.index,
    setup:      filledChapter.setup,
    playerRole: filledChapter.playerRole,
    friendRole: filledChapter.friendRole,
    llmContext: filledChapter.llmContext,
  };

  const castMember = chapter.character ? getCharacter(activeStory, chapter.character) : null;
  const totalChapters = activeStory.chapters.length;
  const chapterNum    = chapter.index + 1;

  const screen       = document.getElementById('scenario-screen');
  const eyebrowEl    = document.getElementById('scenario-eyebrow');
  const titleEl      = document.getElementById('scenario-title');
  const charLabelEl  = document.getElementById('scenario-char-label');
  const textEl       = document.getElementById('scenario-text');
  const rolesEl      = document.getElementById('scenario-roles');
  const playerRoleEl = document.getElementById('scenario-role-player');
  const friendRoleEl = document.getElementById('scenario-role-friend');
  const beginBtn     = document.getElementById('scenario-begin-btn');

  if (eyebrowEl)   eyebrowEl.textContent   = `chapter ${chapterNum} of ${totalChapters}`;
  titleEl.textContent      = chapter.title;
  if (charLabelEl) charLabelEl.textContent = castMember ? `— ${castMember.name} —` : '';
  textEl.textContent       = '';
  playerRoleEl.textContent = filledChapter.playerRole;
  friendRoleEl.textContent = filledChapter.friendRole;
  rolesEl.classList.add('hidden');
  screen.classList.remove('hidden');

  // Build story-so-far prefix then typewriter the setup
  const storyMemoryBlock = buildStoryMemory(activeStory, storyState);
  const fullText = chapter.setup;
  let i = 0;
  const SPEED = 22;

  function type() {
    if (i < fullText.length) {
      textEl.textContent += fullText[i++];
      setTimeout(type, SPEED);
    } else {
      rolesEl.classList.remove('hidden');
    }
  }
  type();

  textEl.addEventListener('click', () => {
    i = fullText.length;
    textEl.textContent = fullText;
    rolesEl.classList.remove('hidden');
  }, { once: true });

  beginBtn.onclick = () => {
    sessionPending = false;
    screen.classList.add('hidden');
    onBegin(storyMemoryBlock);
  };
}

async function startSession(person, autoRecognized = false) {
  showScenarioScreen(person, autoRecognized, async (storyMemory) => {
    currentPerson        = person;
    sessionStart         = new Date().toISOString();
    history              = [];
    affection.total      = 0;
    activeStoryMemory    = storyMemory || '';

    await rag.loadFromDB(db, person.id);

    renderHistory(history);
    updateAffectionMeter(0);
    showSessionBar(person.name);
    sprite.setExpression('neutral');

    const castMember = activeScenario?.character
      ? getCharacter(activeStory, activeScenario.character)
      : null;
    setHint(autoRecognized
      ? `${person.name} detected — ${activeScenario?.title || 'chapter'}`
      : `Chapter ${(activeScenario?.chapterIndex ?? 0) + 1}: ${activeScenario?.title || ''}`);

    speechInput.focus();
  });
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
    document.getElementById('view-story').classList.toggle('view-hidden', view !== 'story');

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

    if (view === 'story') {
      renderStoryMap(activeStory, storyState);
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
  const sessionScenario   = activeScenario; // capture before state is cleared

  try {
    if (history.length > 0) {
      const closenessGain = Math.ceil(history.length * 1.5 + Math.max(0, affection.total * 0.5));
      const newCloseness  = Math.min(100, (currentPerson.closeness || 0) + closenessGain);

      console.log('Saving conversation and updating person data...');
      await db.saveConversation(
        currentPerson.id, history, affection.total, sessionStart,
        sessionScenario?.id || null, sessionScenario?.title || null,
      );
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
  currentPerson        = null;
  sessionStart         = null;
  history              = [];
  affection.total      = 0;
  pendingOptions       = [];
  activeStoryMemory    = '';
  activeScenario       = null;
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
    // Show debrief immediately — eval section starts in "analyzing…" state
    showDebrief(sessionExchanges, sessionPersonName, sessionAffection, sessionScenario);

    // Run scenario eval + story event recording in background
    if (sessionScenario) {
      const scenarioCtx = `${sessionScenario.llmContext}\nPlayer role: ${sessionScenario.playerRole}`;

      if (sessionExchanges.length >= 3) {
        evaluateSession(sessionExchanges, scenarioCtx, DEFAULT_MODEL)
          .then(evalResult => {
            if (evalResult) updateDebriefEval(evalResult);

            // Record story event summary from the eval
            if (evalResult?.overall && sessionScenario.chapterIndex != null) {
              storyState = completeChapter(
                storyState,
                sessionScenario.chapterIndex,
                evalResult.overall,
              );
            }
          })
          .catch(err => console.warn('Scenario eval failed:', err));
      } else if (sessionScenario.chapterIndex != null) {
        // Short session — complete chapter without summary
        storyState = completeChapter(storyState, sessionScenario.chapterIndex, '');
      }
    }
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
  setNameplate(currentPerson?.name || '—', false);  // back to the other person
  sprite.setExpression('curious');                   // thinking face while generating
  showShimmer();

  try {
    const [context] = await Promise.all([
      rag.retrieve(said),
    ]);
    // Build rich scenario context: story memory + chapter context + player's inner state
    const scenarioCtx = activeScenario
      ? `${activeStoryMemory}${activeScenario.llmContext}\nYour inner state going into this conversation: ${activeScenario.playerRole}`
      : '';
    const options = await fetchOptions(said, DEFAULT_MODEL, context, [], playerName, activeCharacter, activeLanguage, scenarioCtx);
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
  // Show chosen response in the textbox with the player's name
  setDialogue(text);
  setNameplate(playerName || 'You', true);
  showEmptyChoices('Good choice. Enter what they say next ↑');
  clearError();
  setHint('');

  // Sprite reacts to the response type immediately
  sprite.setFromLabel(label);

  speechInput.focus();

  // Persist memory for RAG — fire-and-forget
  if (currentPerson) {
    rag.addAndPersist(entry, db, currentPerson.id);

    // Opponent personality cue extraction — fire-and-forget.
    // Still runs during scenarios because HOW someone speaks (warmth, humor) is
    // real even in roleplay. Pass isScenario so the prompt stays style-focused.
    const model = DEFAULT_MODEL;
    const isScenario = !!activeScenario;
    extractOpponentCues(said, model, isScenario).then(cues => {
      if (cues) db.saveOpponentObservation(currentPerson.id, said, cues, isScenario);
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

    // Refine sprite expression based on actual detected emotion
    sprite.setFromDetection(result.dominant);

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

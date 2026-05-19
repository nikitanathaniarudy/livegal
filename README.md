# LiveGal — Real-time Conversation Simulator

A galgame-style live conversation tracker built with React + Vite.

## What's built

**Step 1 — capture and UI**
- Live camera feed (getUserMedia)
- Continuous speech recognition (Web Speech API) with selectable language
- 4 response option cards (Kind / Witty / Assertive / Cold)
- Affection meter (placeholder delta scoring)
- Session transcript with turn labels
- End-of-session summary with response breakdown

**Step 2 — Claude-generated options (NEW)**
- After each thing the other person says, Claude reads the recent transcript and generates 4 in-character replies in the conversation's language.
- Falls back to placeholder text if no API key is configured.

## Steps coming next

| Step | Feature |
|------|---------|
| 3 | face-api.js — emotion detection + affection scoring from reactions |
| 3 | face-api.js — face recognition to auto-identify returning people |
| 4 | IndexedDB — persist all conversations and people profiles |
| 4 | Radar chart — personality profile across all conversations |

## Requirements

- **Node.js** 18+
- **Chrome or Edge** (Web Speech API and getUserMedia work best here)
- Camera and microphone connected
- An Anthropic API key (optional — placeholders are used if not set)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic key for Step 2 options
cp .env.example .env.local
# then edit .env.local and paste your key

# 3. Start dev server
npm run dev

# 4. Open in Chrome
# http://localhost:5173
```

### About the API key

`VITE_ANTHROPIC_API_KEY` is read at build time by Vite and **shipped in the browser bundle**. That is fine for local development on your own machine, but do not deploy this build publicly with a real key in it. For production, replace the direct `fetch` in `src/hooks/useClaudeOptions.js` with a call to your own server endpoint that holds the key.

## Troubleshooting the transcript

If the status says "Listening" but nothing appears in the transcript:

1. **Check the language picker on the setup screen.** Speech recognition only produces results when the spoken language matches the selected one. If you speak Indonesian with `English (US)` selected, Chrome will hear sound but emit nothing.
2. **Check the browser console.** The speech hook now logs every error (`no-speech`, `audio-capture`, `network`, `language-not-supported`, …) with the prefix `[useSpeech]`.
3. **Check the error banner at the bottom of the HUD.** Permission, mic, and network errors are surfaced there now instead of being silently swallowed.
4. **Make sure you're on `http://localhost`** or `https://` — Chrome blocks `getUserMedia` and speech recognition on plain `http://` non-localhost origins.

## Project structure

```
src/
├── App.jsx                  # Main state + screen router
├── main.jsx                 # React entry point
├── styles.css               # All global styles
├── components/
│   ├── SetupScreen.jsx      # Name + language input + start
│   ├── HUD.jsx              # Main gameplay screen
│   ├── CameraPanel.jsx      # Video feed + corners + interim text
│   ├── TranscriptPanel.jsx  # Scrolling conversation log
│   ├── OptionsBar.jsx       # 4 response cards (live from Claude)
│   ├── AffectionBar.jsx     # Bottom meter strip
│   └── SummaryScreen.jsx    # Post-session breakdown
└── hooks/
    ├── useCamera.js         # getUserMedia stream management
    ├── useSpeech.js         # Web Speech API (continuous recognition)
    ├── useClaudeOptions.js  # Claude API — generates 4 reply styles
    └── useTimer.js          # Session elapsed time
```

## Notes

- Speech recognition requires **Chrome or Edge** — Firefox does not support the Web Speech API.
- Camera permission must be granted when the browser prompts.
- All data is in-memory for now — IndexedDB persistence comes in Step 4.

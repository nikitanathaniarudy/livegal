# Live Gal Game — Prototype

A real-life visual novel simulator. Point a camera at someone, listen to what they say, pick from 4 AI-generated responses, and track how the conversation unfolds.

## Project structure

```
galgame/
├── index.html        # HTML structure only
├── css/
│   └── style.css     # All styles
├── js/
│   ├── config.js     # Constants (API URL, response types)
│   ├── llm.js        # Ollama API + JSON parsing
│   ├── speech.js     # Web Speech API wrapper
│   ├── ui.js         # DOM rendering functions
│   └── main.js       # App entry point, wires everything together
└── README.md
```

## Setup

### 1. Install Ollama
Download from https://ollama.com and install for your OS.

### 2. Pull a model
```bash
ollama pull llama3.2
```

### 3. Run a local server
ES modules require a server — you can't just open index.html directly.

```bash
# Option A: Python (no install needed)
python3 -m http.server 8080

# Option B: Node (if you have Node installed)
npx serve .
```

Then open http://localhost:8080 in Chrome or Edge.

### 4. Use it
- Type what someone said (or click 🎙 to speak — Chrome/Edge only)
- Hit **Generate →**
- Pick your response: Kind, Funny, Sarcastic, or Cold
- Conversation history builds up below

## Milestones

- [x] Milestone 1 — Text input → 4 AI options → history log
- [x] Milestone 2 — Microphone / speech-to-text input
- [x] Milestone 3 — Camera + facial expression → affection scoring
- [x] Milestone 4 — Database + people directory
- [x] Milestone 5 — Personality analytics dashboard

## Changing the model
Edit the model name in the top-right pill, or change the default in `js/config.js`.

## Goals
### Priority
- [ ] Overarching stories
- [ ] Make UI for story like a book
- [ ] Migration to phone
- [ ] Deployment

### Less Priority
- [ ] Code cleaning

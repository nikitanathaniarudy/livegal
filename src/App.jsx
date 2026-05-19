import { useState, useCallback } from 'react'
import SetupScreen from './components/SetupScreen'
import HUD from './components/HUD'
import SummaryScreen from './components/SummaryScreen'

const INITIAL_STATE = {
  screen: 'setup',
  personName: '',
  lang: 'en-US',
  engine: 'browser',
  sessionStart: null,
  transcript: [],
  choices: [],
  affection: 50,
}

// Affection delta per response type — Step 3 will replace this
// with face-api.js reaction scoring
const AFFECTION_DELTA = { kind: 3, witty: 2, assertive: 1, cold: -2 }

export default function App() {
  const [state, setState] = useState(INITIAL_STATE)

  const startSession = useCallback((name, lang = 'en-US', engine = 'browser') => {
    setState({
      ...INITIAL_STATE,
      screen: 'hud',
      personName: name,
      lang,
      engine,
      sessionStart: Date.now(),
    })
  }, [])

  const addTurn = useCallback((turn) => {
    setState(prev => ({ ...prev, transcript: [...prev.transcript, turn] }))
  }, [])

  // Called when user picks one of the 4 response options
  const pickChoice = useCallback((type, text) => {
    setState(prev => ({
      ...prev,
      transcript: [
        ...prev.transcript,
        {
          speaker: 'You',
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          choiceType: type,
        },
      ],
      choices: [...prev.choices, { type, time: Date.now() }],
      affection: Math.max(0, Math.min(100, prev.affection + (AFFECTION_DELTA[type] ?? 0))),
    }))
  }, [])

  const endSession = useCallback(() => {
    setState(prev => ({ ...prev, screen: 'summary' }))
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return (
    <div className="app-root">
      {state.screen === 'setup' && (
        <SetupScreen onStart={startSession} />
      )}
      {state.screen === 'hud' && (
        <HUD
          personName={state.personName}
          lang={state.lang}
          engine={state.engine}
          sessionStart={state.sessionStart}
          transcript={state.transcript}
          affection={state.affection}
          onAddTurn={addTurn}
          onPickChoice={pickChoice}
          onEnd={endSession}
        />
      )}
      {state.screen === 'summary' && (
        <SummaryScreen
          personName={state.personName}
          transcript={state.transcript}
          choices={state.choices}
          affection={state.affection}
          onReset={reset}
        />
      )}
    </div>
  )
}

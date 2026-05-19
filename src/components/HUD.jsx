import { useState, useCallback, useEffect, useRef } from 'react'
import { useCamera } from '../hooks/useCamera'
import { useSpeech } from '../hooks/useSpeech'
import { useTimer } from '../hooks/useTimer'
import { useClaudeOptions } from '../hooks/useClaudeOptions'
import { useMicLevel } from '../hooks/useMicLevel'
import { useLocalWhisper } from '../hooks/useLocalWhisper'
import CameraPanel from './CameraPanel'
import TranscriptPanel from './TranscriptPanel'
import OptionsBar from './OptionsBar'
import AffectionBar from './AffectionBar'

export default function HUD({
  personName,
  lang = 'en-US',
  engine = 'browser',
  sessionStart,
  transcript,
  affection,
  onAddTurn,
  onPickChoice,
  onEnd,
}) {
  const [showOptions, setShowOptions] = useState(false)
  const elapsed = useTimer(sessionStart)

  const { options, loading: optionsLoading, error: claudeError, generate, reset: resetOptions } =
    useClaudeOptions()

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript

  const handleSpeech = useCallback(
    (text) => {
      const turn = {
        speaker: personName,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      onAddTurn(turn)
      const nextTranscript = [...transcriptRef.current, turn]
      generate(nextTranscript, personName, lang)
      setTimeout(() => setShowOptions(true), 450)
    },
    [personName, lang, onAddTurn, generate]
  )

  const handlePick = useCallback(
    (type, text) => {
      setShowOptions(false)
      resetOptions()
      onPickChoice(type, text)
    },
    [onPickChoice, resetOptions]
  )

  const { videoRef, ready: camReady, error: camError } = useCamera(true)
  
  // Use the selected speech engine
  const browserSpeech = useSpeech({
    active: engine === 'browser',
    lang,
    onFinalResult: handleSpeech,
  })

  const whisperSpeech = useLocalWhisper({
    active: engine === 'whisper',
    lang,
    onFinalResult: handleSpeech,
  })

  const { listening, interim, error: speechError, noSpeechStreak, stages } = 
    engine === 'whisper' ? whisperSpeech : browserSpeech

  const { level: micLevel, hasAudio: micHasAudio, error: micError } = useMicLevel(true)

  // How long the recognizer has detected speech but produced no result —
  // the smoking gun for a blocked Google Speech API endpoint
  const [speechWithoutResultSecs, setSpeechWithoutResultSecs] = useState(0)
  useEffect(() => {
    if (!stages.speech || stages.result) {
      setSpeechWithoutResultSecs(0)
      return
    }
    const id = setInterval(() => setSpeechWithoutResultSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [stages.speech, stages.result])

  // Track how long we've been listening with no audio at all
  const [noAudioSeconds, setNoAudioSeconds] = useState(0)
  useEffect(() => {
    if (!listening) {
      setNoAudioSeconds(0)
      return
    }
    if (micHasAudio) {
      setNoAudioSeconds(0)
      return
    }
    const id = setInterval(() => setNoAudioSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [listening, micHasAudio])

  // Diagnostic hints — softer than the red error banner. Ordered by specificity.
  let micHint = null
  if (micError) {
    micHint = `Mic level monitor: ${micError}`
  } else if (listening && noAudioSeconds >= 5) {
    micHint = "Chrome isn't receiving any audio from the mic. Check chrome://settings/content/microphone — the selected input device may be wrong, or another app (e.g. Notion) is holding the mic."
  } else if (speechWithoutResultSecs >= 4 && !stages.result) {
    // The killer case: audio → sound → speech all fired, but no result ever came back.
    // This means Chrome heard you but Google's speech servers never replied.
    micHint = "Speech was detected but no transcription came back. Chrome's Web Speech API needs to reach Google's speech servers (speech.googleapis.com / www.google.com). Likely causes: ad-blocker / privacy extension (uBlock, Ghostery, Privacy Badger), a VPN that blocks Google, corporate/school firewall, or a region where Google APIs are restricted. Disable extensions and try again."
  } else if (noSpeechStreak >= 3 && micHasAudio) {
    micHint = `Audio is reaching Chrome, but speech recognition isn't matching the "${lang}" language. Try a different language on the setup screen, or speak louder/closer to the mic.`
  }

  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const secs = (elapsed % 60).toString().padStart(2, '0')
  const anyError = camError || speechError || claudeError

  // Map level (0..1) to visible meter segments
  const meterPct = Math.round(micLevel * 100)

  return (
    <div className="hud">
      {/* Top bar */}
      <header className="hud-topbar">
        <div className="hud-person">
          <div className="hud-avatar" aria-hidden="true">
            {personName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="hud-name">{personName}</div>
            <div className="hud-session">Session 1 · {mins}:{secs} · {lang}</div>
          </div>
        </div>

        <div className="hud-right">
          {/* Mic level meter — diagnostic */}
          <div className="mic-meter" title="Live microphone input level">
            <div className="mic-meter-bar" style={{ width: `${meterPct}%` }} />
            <span className="mic-meter-label">MIC</span>
          </div>
          {/* Speech API stage indicator — shows exactly where recognition stalls */}
          <div className="stage-strip" title="Speech recognition pipeline">
            <span className={`stage-pill ${stages.audio  ? 'on' : ''}`}>AUD</span>
            <span className={`stage-pill ${stages.sound  ? 'on' : ''}`}>SND</span>
            <span className={`stage-pill ${stages.speech ? 'on' : ''}`}>SPK</span>
            <span className={`stage-pill ${stages.result ? 'on' : ''}`}>RES</span>
          </div>
          <div className="hud-status" aria-live="polite">
            <div className={`status-dot ${listening ? 'status-pulse' : ''}`} />
            <span className="status-label">{listening ? 'Listening' : 'Standby'}</span>
          </div>
          <button className="end-btn" onClick={onEnd}>
            End session
          </button>
        </div>
      </header>

      {/* Main content: camera + transcript side by side */}
      <div className="hud-main">
        <CameraPanel videoRef={videoRef} ready={camReady} interim={interim} />
        <TranscriptPanel transcript={transcript} personName={personName} />
      </div>

      {/* Response options or waiting indicator */}
      <OptionsBar
        showOptions={showOptions}
        personName={personName}
        onPick={handlePick}
        loading={optionsLoading}
        options={options}
      />

      {/* Affection meter */}
      <AffectionBar personName={personName} affection={affection} />

      {/* Soft diagnostic hint — appears when we can see *why* nothing is being transcribed */}
      {!anyError && micHint && (
        <div className="hint-bar" role="status">
          {micHint}
        </div>
      )}

      {/* Hard error banner */}
      {anyError && (
        <div className="error-bar" role="alert">
          {anyError}
        </div>
      )}
    </div>
  )
}

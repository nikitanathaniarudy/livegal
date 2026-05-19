import { useEffect, useRef, useState } from 'react'

/**
 * Manages continuous Web Speech API recognition.
 * Calls onFinalResult(text) whenever the speaker finishes a sentence.
 * Exposes interim text for the live "hearing..." display.
 *
 * The hook also tracks the full event lifecycle (audio → sound → speech → result)
 * so the HUD can show *which* stage is failing when recognition isn't working.
 *
 * @param {{
 *   active: boolean,
 *   lang?: string,                       // BCP-47 tag, default 'en-US'
 *   onFinalResult: (text: string) => void
 * }}
 * @returns {{
 *   listening, interim, error, noSpeechStreak, stages
 * }}
 *   stages: { audio, sound, speech, result } booleans — sticky once true
 */
export function useSpeech({ active, lang = 'en-US', onFinalResult }) {
  const recRef = useRef(null)
  const activeRef = useRef(active)
  const onResultRef = useRef(onFinalResult)
  const restartTimerRef = useRef(null)
  const errorBurstRef = useRef({ count: 0, lastAt: 0 })

  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const [noSpeechStreak, setNoSpeechStreak] = useState(0)
  const [stages, setStages] = useState({
    audio: false,   // onaudiostart fired
    sound: false,   // onsoundstart fired (any sound captured)
    speech: false,  // onspeechstart fired (sound interpreted as speech)
    result: false,  // onresult fired with any data
  })

  activeRef.current = active
  onResultRef.current = onFinalResult

  useEffect(() => {
    if (!active) {
      try { recRef.current?.stop() } catch (_) {}
      setListening(false)
      setInterim('')
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition requires Chrome or Edge.')
      return
    }

    setError(null)

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang
    rec.maxAlternatives = 1

    rec.onstart = () => {
      console.log('[useSpeech] onstart')
      setListening(true)
      errorBurstRef.current = { count: 0, lastAt: 0 }
    }

    rec.onaudiostart = () => {
      console.log('[useSpeech] onaudiostart — capturing audio')
      setStages(s => ({ ...s, audio: true }))
    }

    rec.onsoundstart = () => {
      console.log('[useSpeech] onsoundstart — sound detected')
      setStages(s => ({ ...s, sound: true }))
    }

    rec.onspeechstart = () => {
      console.log('[useSpeech] onspeechstart — speech detected')
      setStages(s => ({ ...s, speech: true }))
    }

    rec.onspeechend = () => {
      console.log('[useSpeech] onspeechend')
    }

    rec.onnomatch = () => {
      console.log('[useSpeech] onnomatch — speech heard but no recognition match')
    }

    rec.onend = () => {
      console.log('[useSpeech] onend')
      setListening(false)
      if (!activeRef.current) return

      const burst = errorBurstRef.current
      const since = Date.now() - burst.lastAt
      const delay = burst.count >= 3 && since < 5000 ? 2000 : 300

      restartTimerRef.current = setTimeout(() => {
        if (!activeRef.current) return
        try { rec.start() } catch (err) {
          if (err && err.name !== 'InvalidStateError') {
            console.warn('[useSpeech] restart failed:', err)
          }
        }
      }, delay)
    }

    rec.onerror = (e) => {
      const code = e?.error || 'unknown'
      console.warn('[useSpeech] error:', code, e)

      errorBurstRef.current = {
        count: errorBurstRef.current.count + 1,
        lastAt: Date.now(),
      }

      switch (code) {
        case 'not-allowed':
        case 'service-not-allowed':
          setError('Microphone access denied — allow mic access in your browser settings, then refresh.')
          break
        case 'audio-capture':
          setError('No microphone detected. Check that a mic is connected and selected as the input device.')
          break
        case 'network':
          setError("Network error reaching Google's speech servers. Chrome's Web Speech API requires unrestricted access to googleapis.com — check VPN, ad-blocker, extensions, or firewall.")
          break
        case 'language-not-supported':
          setError(`Language "${lang}" is not supported by this browser. Try a different one in setup.`)
          break
        case 'no-speech':
          setError(null)
          setNoSpeechStreak(s => s + 1)
          break
        case 'aborted':
          break
        default:
          setError(`Speech recognition error: ${code}`)
      }
    }

    rec.onresult = (event) => {
      let interimText = ''
      let gotAny = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        gotAny = true
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          console.log('[useSpeech] FINAL result:', text)
          if (text.length > 2) {
            setInterim('')
            onResultRef.current(text)
          }
        } else {
          interimText += result[0].transcript
        }
      }

      if (gotAny) {
        setNoSpeechStreak(0)
        setStages(s => ({ ...s, result: true }))
      }
      setInterim(interimText)
    }

    recRef.current = rec
    try {
      rec.start()
    } catch (err) {
      console.warn('[useSpeech] initial start failed:', err)
    }

    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try { rec.stop() } catch (_) {}
    }
  }, [active, lang])

  return { listening, interim, error, noSpeechStreak, stages }
}

import { useEffect, useRef, useState } from 'react'

/**
 * A local alternative to useSpeech that uses a Python Whisper backend via WebSockets.
 * 
 * Captures audio chunks using MediaRecorder and sends them to ws://localhost:8000/ws/transcribe.
 */
export function useLocalWhisper({ active, lang = 'en-US', onFinalResult }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const [stages, setStages] = useState({
    audio: false,   // Mic stream active
    sound: false,   // Sound detected (simulated)
    speech: false,  // Recording loop active
    result: false,  // Received text from backend
  })

  const wsRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const activeRef = useRef(active)
  const onResultRef = useRef(onFinalResult)

  activeRef.current = active
  onResultRef.current = onFinalResult

  useEffect(() => {
    if (!active) {
      stopAll()
      return
    }

    startAll()

    return () => stopAll()
  }, [active])

  async function startAll() {
    console.log('[useLocalWhisper] Starting local Whisper client...')
    setError(null)
    setStages({ audio: false, sound: false, speech: false, result: false })

    try {
      // 1. Connect WebSocket to local backend
      // Using 127.0.0.1 explicitly to avoid issues with localhost IPv6/IPv4 resolution
      const ws = new WebSocket('ws://127.0.0.1:8000/ws/transcribe')
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useLocalWhisper] WebSocket connected')
        setListening(true)
        setError(null)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'final' && data.text) {
            console.log('[useLocalWhisper] Received transcription:', data.text)
            setStages(s => ({ ...s, result: true }))
            onResultRef.current(data.text)
          } else if (data.type === 'error') {
            console.warn('[useLocalWhisper] Backend error:', data.message)
            setError(`Whisper Error: ${data.message}`)
          }
        } catch (err) {
          console.error('[useLocalWhisper] Failed to parse message:', err)
        }
      }

      ws.onerror = (e) => {
        console.error('[useLocalWhisper] WebSocket error details:', e)
        // If the server is up (which we know from curl), but WS fails, 
        // it might be a protocol mismatch or browser security policy.
        setError('Local Whisper WebSocket connection failed. Check the browser console (F12) for detailed errors.')
      }

      ws.onclose = (event) => {
        console.log('[useLocalWhisper] WebSocket closed. Code:', event.code, 'Reason:', event.reason)
        setListening(false)
        if (activeRef.current && event.code !== 1000) {
          setError(`Connection lost (${event.code}). Retrying in 3s...`)
          setTimeout(() => {
            if (activeRef.current) startAll()
          }, 3000)
        }
      }

      // 2. Request Mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      streamRef.current = stream
      setStages(s => ({ ...s, audio: true, sound: true }))

      // 3. Audio Recording Loop
      // We record in short segments (3s) and send each as a complete file to Whisper.
      // This is the simplest way to get results from a batch model like Whisper.
      const startRecording = () => {
        if (!activeRef.current || ws.readyState !== WebSocket.OPEN) return
        
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        recorderRef.current = recorder

        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const buffer = await event.data.arrayBuffer()
            ws.send(buffer)
          }
        }

        recorder.onstop = () => {
          if (activeRef.current) {
            // Short pause before next segment
            setTimeout(startRecording, 100)
          }
        }

        recorder.start()
        setStages(s => ({ ...s, speech: true }))

        // Stop after 3.5 seconds to send the chunk
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        }, 3500)
      }

      // Wait a moment for WS to be open before first record
      setTimeout(startRecording, 500)

    } catch (err) {
      console.error('[useLocalWhisper] Start failed:', err)
      setError(err.message || 'Failed to access microphone or connect to backend.')
    }
  }

  function stopAll() {
    console.log('[useLocalWhisper] Stopping...')
    activeRef.current = false
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch (_) {}
      recorderRef.current = null
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    
    setListening(false)
    setInterim('')
  }

  return { listening, interim, error, noSpeechStreak: 0, stages }
}

import { useEffect, useRef, useState } from 'react'

/**
 * Independently monitors microphone input level using Web Audio API.
 * This is purely diagnostic — it lets the UI tell the user whether Chrome
 * is actually receiving any audio, separately from whether the Web Speech
 * API is producing transcription results.
 *
 * The Web Speech API does NOT expose the audio stream it uses, so we open
 * our own getUserMedia({audio:true}) stream. Modern Chrome shares the mic
 * device between concurrent consumers, so this does not steal audio from
 * the recognizer.
 *
 * @param {boolean} active
 * @returns {{ level: number, hasAudio: boolean, error: string|null }}
 *   level:    0..1 normalized RMS, updated ~30x/sec
 *   hasAudio: true once we've seen any sample above the noise floor
 *   error:    permission / device error if any
 */
export function useMicLevel(active) {
  const [level, setLevel] = useState(0)
  const [hasAudio, setHasAudio] = useState(false)
  const [error, setError] = useState(null)

  const ctxRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream

        const AC = window.AudioContext || window.webkitAudioContext
        const ctx = new AC()
        ctxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)

        const buf = new Float32Array(analyser.fftSize)

        const tick = () => {
          if (cancelled) return
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
          const rms = Math.sqrt(sum / buf.length)
          // Compress dynamic range so soft speech is still visible
          const normalized = Math.min(1, rms * 6)
          setLevel(normalized)
          if (rms > 0.01) setHasAudio(true)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not access microphone for level monitor.')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (ctxRef.current) {
        try { ctxRef.current.close() } catch (_) {}
        ctxRef.current = null
      }
    }
  }, [active])

  return { level, hasAudio, error }
}

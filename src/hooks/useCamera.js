import { useEffect, useRef, useState } from 'react'

/**
 * Manages the getUserMedia camera stream.
 * Step 3 will add face-api.js emotion detection on top of this stream.
 *
 * @param {boolean} active - whether to start the camera
 * @returns {{ videoRef, ready, error }}
 */
export function useCamera(active) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!active) return

    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        setReady(true)
      } catch (err) {
        if (!cancelled) {
          setError('Camera access denied — allow camera access in your browser settings.')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setReady(false)
    }
  }, [active])

  return { videoRef, ready, error }
}

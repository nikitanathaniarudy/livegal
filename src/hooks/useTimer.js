import { useState, useEffect } from 'react'

/**
 * Returns elapsed seconds since startTime.
 * Updates every second.
 */
export function useTimer(startTime) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startTime])

  return elapsed
}

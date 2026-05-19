import { useCallback, useRef, useState } from 'react'

/**
 * Generates 4 styled response options from Claude based on the live transcript.
 *
 * Reads the API key from `import.meta.env.VITE_ANTHROPIC_API_KEY`.
 * If the key is missing, returns nulls — the OptionsBar will fall back to placeholders.
 *
 * NOTE: Calling the Anthropic API directly from the browser is only appropriate
 * during local development. For production, proxy through a server so the key
 * is never shipped to the client.
 *
 * @returns {{ options, loading, error, generate, reset }}
 *   options: { kind, witty, assertive, cold } | null
 *   loading: boolean
 *   error:   string | null
 *   generate(transcript, personName, lang): Promise<void>
 *   reset(): void
 */
export function useClaudeOptions() {
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Used to ignore stale responses if the user speaks again before the
  // previous request resolves
  const requestIdRef = useRef(0)

  const reset = useCallback(() => {
    setOptions(null)
    setError(null)
    setLoading(false)
  }, [])

  const generate = useCallback(async (transcript, personName, lang = 'en-US') => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      // No key — let OptionsBar show placeholders. Surface a soft error
      // so the user knows why options aren't AI-generated.
      setOptions(null)
      setError('No VITE_ANTHROPIC_API_KEY set — showing placeholder options.')
      return
    }

    const myRequestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    // Build a recent-transcript window — last 10 turns is enough context
    const recent = transcript.slice(-10).map(t => `${t.speaker}: ${t.text}`).join('\n')

    const systemPrompt = `You are helping a person navigate a real-time conversation with ${personName}. Given the recent conversation, generate exactly 4 short reply options the person could say next, one in each of these styles:

- kind: warm, empathetic, supportive
- witty: light, clever, playful
- assertive: direct, confident, takes a position
- cold: dismissive or distant, but not rude

Constraints:
- Each reply must be 1 sentence, max 18 words.
- Match the conversation language: ${lang}.
- Sound natural, like something a real person would actually say out loud.
- Do NOT include the speaker label, quotes, or any prefix — just the reply text.

Respond with ONLY a JSON object, no prose, in this exact shape:
{"kind":"...","witty":"...","assertive":"...","cold":"..."}`

    const userMsg = `Recent conversation:\n${recent || '(no turns yet)'}\n\nGenerate the 4 reply options now.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`)
      }

      const data = await res.json()
      const text = data?.content?.[0]?.text?.trim() || ''

      // Tolerate the model wrapping JSON in ``` or extra prose
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('Claude did not return JSON: ' + text.slice(0, 120))
      }
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))

      // Validate shape
      const need = ['kind', 'witty', 'assertive', 'cold']
      for (const k of need) {
        if (typeof parsed[k] !== 'string' || !parsed[k].trim()) {
          throw new Error(`Missing "${k}" option in Claude response`)
        }
      }

      // Drop stale responses
      if (myRequestId !== requestIdRef.current) return

      setOptions({
        kind: parsed.kind.trim(),
        witty: parsed.witty.trim(),
        assertive: parsed.assertive.trim(),
        cold: parsed.cold.trim(),
      })
    } catch (err) {
      if (myRequestId !== requestIdRef.current) return
      console.warn('[useClaudeOptions] generate failed:', err)
      setError(err.message || 'Failed to generate options')
      setOptions(null)
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  return { options, loading, error, generate, reset }
}

/**
 * OptionsBar
 *
 * Step 1: showed hardcoded placeholder responses.
 * Step 2: now displays live options from Claude (via useClaudeOptions in HUD),
 *         falling back to the placeholders when no options have been generated yet.
 */

export const OPTION_TYPES = [
  {
    key: 'kind',
    label: 'Kind',
    placeholder: "That sounds really tough — I'm here for you.",
  },
  {
    key: 'witty',
    label: 'Witty',
    placeholder: "Sounds like a Monday wrapped in a Tuesday.",
  },
  {
    key: 'assertive',
    label: 'Assertive',
    placeholder: "Here's what I'd actually do in your position.",
  },
  {
    key: 'cold',
    label: 'Cold',
    placeholder: "That's one way to look at it, I guess.",
  },
]

export default function OptionsBar({
  showOptions,
  personName,
  onPick,
  loading = false,
  options = null, // { kind, witty, assertive, cold } | null
}) {
  // Pick the live option text, or fall back to the placeholder
  const textFor = (key) =>
    (options && options[key]) ||
    OPTION_TYPES.find(o => o.key === key)?.placeholder ||
    ''

  return (
    <div className="options-bar">
      {showOptions ? (
        <>
          <div className="options-label">
            {loading ? 'Claude is thinking…' : 'Choose your response'}
          </div>
          <div className="options-grid">
            {OPTION_TYPES.map(opt => {
              const text = textFor(opt.key)
              return (
                <button
                  key={opt.key}
                  className={`option-card option-${opt.key}`}
                  onClick={() => onPick(opt.key, text)}
                  disabled={loading}
                >
                  <div className="option-type">{opt.label}</div>
                  {loading ? (
                    <div className="option-loading">
                      <span className="dot-bounce" />
                      <span className="dot-bounce" />
                      <span className="dot-bounce" />
                    </div>
                  ) : (
                    <p className="option-text">{text}</p>
                  )}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="awaiting" role="status">
          <span className="dot-bounce" />
          <span className="dot-bounce" />
          <span className="dot-bounce" />
          <span className="awaiting-text">
            Waiting for {personName} to speak...
          </span>
        </div>
      )}
    </div>
  )
}

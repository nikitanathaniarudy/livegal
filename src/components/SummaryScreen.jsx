const OPTION_TYPES = [
  { key: 'kind',      label: 'Kind',      color: '#10b981' },
  { key: 'witty',     label: 'Witty',     color: '#818cf8' },
  { key: 'assertive', label: 'Assertive', color: '#f59e0b' },
  { key: 'cold',      label: 'Cold',      color: '#9ca3af' },
]

export default function SummaryScreen({ personName, transcript, choices, affection, onReset }) {
  const total = choices.length
  const counts = { kind: 0, witty: 0, assertive: 0, cold: 0 }
  choices.forEach(c => counts[c.type]++)

  const topType = total > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : null

  const PROFILES = {
    kind:      'Empathetic · Warm · People-first',
    witty:     'Playful · Sharp · Socially confident',
    assertive: 'Direct · Self-assured · Goal-oriented',
    cold:      'Guarded · Selective · Independent',
  }

  return (
    <div className="summary-screen">
      <div className="summary-header">
        <h2 className="summary-title">Conversation with {personName}</h2>
        <p className="summary-date">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* Quick stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-label">Affection score</div>
          <div className="stat-value">
            {affection}<span className="stat-unit"> / 100</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Exchanges</div>
          <div className="stat-value">{transcript.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Choices made</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top style</div>
          <div className="stat-value stat-value-sm">
            {topType
              ? topType.charAt(0).toUpperCase() + topType.slice(1)
              : '—'}
          </div>
        </div>
      </div>

      {/* Response breakdown bars */}
      <div className="breakdown-card">
        <div className="breakdown-title">Response breakdown</div>
        {OPTION_TYPES.map(opt => {
          const pct = total > 0 ? Math.round((counts[opt.key] / total) * 100) : 0
          return (
            <div key={opt.key} className="breakdown-row">
              <div className="breakdown-type" style={{ color: opt.color }}>
                {opt.label}
              </div>
              <div className="breakdown-track">
                <div
                  className="breakdown-fill"
                  style={{ width: `${pct}%`, background: opt.color }}
                />
              </div>
              <div className="breakdown-pct">{pct}%</div>
            </div>
          )
        })}
      </div>

      {/* Personality hint */}
      {topType && (
        <div className="personality-hint">
          <div className="personality-hint-label">Current dominant trait</div>
          <div className="personality-hint-value">
            {topType.charAt(0).toUpperCase() + topType.slice(1)}
            <span className="personality-hint-desc"> · {PROFILES[topType]}</span>
          </div>
          <p className="personality-hint-note">
            Full radar chart unlocks in Step 4 once you have more conversations
          </p>
        </div>
      )}

      <div className="summary-actions">
        <button className="sum-btn" onClick={onReset}>
          New conversation
        </button>
        <button
          className="sum-btn sum-btn-primary"
          onClick={() => alert('Radar chart coming in Step 4!')}
        >
          View profile →
        </button>
      </div>
    </div>
  )
}

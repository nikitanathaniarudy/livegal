/**
 * AffectionBar
 *
 * Bottom strip showing the running affection score for the current person.
 * Step 3 replaces the hardcoded delta in App.jsx with face-api.js reaction scores.
 */
export default function AffectionBar({ personName, affection }) {
  const color = affection >= 70
    ? '#10b981'   // positive
    : affection >= 40
      ? '#c084fc' // neutral
      : '#ef4444' // negative

  return (
    <div className="affection-bar">
      <div className="aff-label">{personName}</div>
      <div className="aff-track" role="meter" aria-valuenow={affection} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="aff-fill"
          style={{ width: `${affection}%`, background: color }}
        />
      </div>
      <div className="aff-score" style={{ color }}>{affection}</div>
    </div>
  )
}

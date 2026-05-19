import { useEffect, useRef } from 'react'

export default function TranscriptPanel({ transcript, personName }) {
  const bottomRef = useRef(null)

  // Auto-scroll to latest turn
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript.length])

  return (
    <div className="transcript-panel">
      <div className="transcript-header">
        <span>Transcript</span>
        <span className="transcript-count">{transcript.length}</span>
      </div>

      <div className="transcript-body">
        {transcript.length === 0 ? (
          <div className="transcript-empty">
            <p className="transcript-empty-text">
              Conversation will appear here as you talk
            </p>
          </div>
        ) : (
          transcript.map((turn, i) => (
            <div
              key={i}
              className={`turn ${turn.speaker === 'You' ? 'turn-you' : 'turn-them'}`}
            >
              <div className="turn-header">
                <span className="turn-speaker">{turn.speaker}</span>
                {turn.choiceType && (
                  <span className={`turn-badge badge-${turn.choiceType}`}>
                    {turn.choiceType}
                  </span>
                )}
              </div>
              <p className="turn-text">{turn.text}</p>
              <span className="turn-time">{turn.time}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

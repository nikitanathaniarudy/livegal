import { useState } from 'react'

export const LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'id-ID', label: 'Bahasa Indonesia' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'zh-CN', label: '中文 (普通话)' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'pt-BR', label: 'Português (BR)' },
]

export default function SetupScreen({ onStart }) {
  const [name, setName] = useState('')
  const [lang, setLang] = useState('en-US')

  const handleStart = () => {
    if (name.trim()) onStart(name.trim(), lang)
  }

  return (
    <div className="setup-screen">
      <div className="setup-hero">
        <h1 className="setup-logo">
          Live<span className="logo-accent">Gal</span>
        </h1>
        <p className="setup-tagline">Real-time conversation simulator</p>
      </div>

      <div className="setup-form">
        <div className="form-field">
          <label className="form-label" htmlFor="person-name">
            Who are you talking to?
          </label>
          <input
            id="person-name"
            className="form-input"
            type="text"
            placeholder="Enter their name..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="lang-select">
            What language will they speak?
          </label>
          <select
            id="lang-select"
            className="form-input"
            value={lang}
            onChange={e => setLang(e.target.value)}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <button
          className="setup-btn"
          onClick={handleStart}
          disabled={!name.trim()}
        >
          Start conversation →
        </button>

        <p className="setup-note">
          Your browser will ask for camera &amp; microphone access
        </p>
      </div>

      <div className="setup-steps">
        <div className="step-item">
          <div className="step-num">01</div>
          <div className="step-text">Camera reads their face &amp; reactions</div>
        </div>
        <div className="step-item">
          <div className="step-num">02</div>
          <div className="step-text">Mic captures what they say</div>
        </div>
        <div className="step-item">
          <div className="step-num">03</div>
          <div className="step-text">You pick how to respond</div>
        </div>
        <div className="step-item">
          <div className="step-num">04</div>
          <div className="step-text">Build your conversation profile</div>
        </div>
      </div>
    </div>
  )
}

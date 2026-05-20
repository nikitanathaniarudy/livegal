/**
 * Wraps the Web Speech API (Chrome/Edge only).
 * Calls onInterim(text) while listening, onFinal(text) when done, onError(msg) on failure.
 */
export class SpeechInput {
  constructor({ onInterim, onFinal, onStart, onStop, onError }) {
    this.onInterim = onInterim;
    this.onFinal = onFinal;
    this.onStart = onStart;
    this.onStop = onStop;
    this.onError = onError;
    this.isListening = false;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.supported = false;
      return;
    }

    this.supported = true;
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStart?.();
    };

    this.recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      if (e.results[e.results.length - 1].isFinal) {
        this.onFinal?.(transcript);
      } else {
        this.onInterim?.(transcript);
      }
    };

    this.recognition.onerror = (e) => {
      const msg = e.error === 'not-allowed'
        ? 'Microphone access denied — allow it in your browser settings'
        : 'Speech error: ' + e.error;
      this.onError?.(msg);
      this._stopped();
    };

    this.recognition.onend = () => { this._stopped(); };
  }

  toggle() {
    if (!this.supported) return;
    this.isListening ? this.stop() : this.start();
  }

  start() {
    if (!this.supported || this.isListening) return;
    try { this.recognition.start(); } catch (_) {}
  }

  stop() {
    if (!this.supported) return;
    try { this.recognition.stop(); } catch (_) {}
  }

  _stopped() {
    this.isListening = false;
    this.onStop?.();
  }
}

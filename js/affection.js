// face-api.js is loaded as a global <script> tag in index.html
// We access it via window.faceapi

const WEIGHTS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

// Maps face-api expression names → display emoji
export const EXPRESSION_EMOJI = {
  happy:     '😊',
  surprised: '😮',
  neutral:   '😐',
  sad:       '😢',
  angry:     '😠',
  disgusted: '🤢',
  fearful:   '😨',
  away:      '👀',
};

export class AffectionTracker {
  constructor() {
    this.total = 0;
    this.isLoaded = false;
  }

  /**
   * Downloads the two lightweight models needed (~800 KB total).
   * @param {function(string): void} onStatus - called with progress messages
   */
  async load(onStatus) {
    const faceapi = window.faceapi;
    if (!faceapi) throw new Error('face-api.js not available');

    onStatus('Loading face detection models…');
    await faceapi.nets.tinyFaceDetector.loadFromUri(WEIGHTS_URL);

    onStatus('Loading expression models…');
    await faceapi.nets.faceExpressionNet.loadFromUri(WEIGHTS_URL);

    this.isLoaded = true;
    onStatus('');
  }

  /**
   * Analyzes a single video frame for facial expressions.
   * Waits `delayMs` first so the person has time to react.
   *
   * @param {HTMLVideoElement} videoEl
   * @param {number} delayMs - how long to wait before capturing (default 1500ms)
   * @returns {Promise<{delta: number, dominant: string, expressions: object|null}>}
   */
  async analyzeReaction(videoEl, delayMs = 1500) {
    await delay(delayMs);

    const faceapi = window.faceapi;
    const result = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
      .withFaceExpressions();

    if (!result) {
      return { delta: -2, dominant: 'away', expressions: null };
    }

    const e = result.expressions;

    // Positive: happiness and pleasant surprise
    const positive = (e.happy * 10) + (e.surprised * 3);
    // Negative: sadness, anger, disgust, fear
    const negative = (e.sad * 5) + (e.angry * 8) + (e.disgusted * 7) + (e.fearful * 3);

    const raw = Math.round(positive - negative);
    const delta = Math.max(-5, Math.min(5, raw));

    const dominant = Object.entries(e)
      .sort((a, b) => b[1] - a[1])[0][0];

    return { delta, dominant, expressions: e };
  }

  /**
   * Applies a delta to the running total and returns the new total.
   */
  apply(delta) {
    this.total = Math.max(-99, Math.min(99, this.total + delta));
    return this.total;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

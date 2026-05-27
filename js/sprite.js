// ── Expression → filename mapping ────────────────────────────────────
const FILES = {
  neutral:  'vampire_girl_neutral',
  blushing: 'vampire_girl_blushing',
  laughing: 'vampire_girl_laughing',
  curious:  'vampire_girl_curious',
  naughty:  'vampire_girl_naughty',
  sorry:    'vampire_girl_sorry',
};

// Camera face-api detection → sprite expression
const DETECT_MAP = {
  happy:     'laughing',
  surprised: 'curious',
  sad:       'sorry',
  fearful:   'sorry',
  disgusted: 'naughty',
  angry:     'naughty',
  neutral:   'neutral',
};

// Response label → sprite expression
export const LABEL_TO_EXPR = {
  Kind:      'blushing',
  Funny:     'laughing',
  Sarcastic: 'naughty',
  Cold:      'sorry',
};

export class SpriteCharacter {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.current = null;
    this.ready   = false;
    this._cache  = {};
  }

  async load() {
    await Promise.all(Object.keys(FILES).map(e => this._loadImg(e)));
    this.ready = true;
    this.setExpression('neutral');
  }

  _loadImg(expr) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width  = img.naturalWidth;
        off.height = img.naturalHeight;
        const ctx  = off.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Only remove black backgrounds when the image isn't already transparent
        const id      = ctx.getImageData(0, 0, off.width, off.height);
        const d       = id.data;
        const cornerA = d[3]; // alpha at top-left pixel

        if (cornerA > 10) {
          // Opaque background — remove dark pixels
          for (let i = 0; i < d.length; i += 4) {
            const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
            if (brightness < 14)       d[i + 3] = 0;
            else if (brightness < 38)  d[i + 3] = Math.round(((brightness - 14) / 24) * 255);
          }
          ctx.putImageData(id, 0, 0);
        }
        // If already transparent (cornerA === 0) → use as-is, no removal needed

        this._cache[expr] = off;
        resolve();
      };
      img.onerror = resolve;
      img.src = `assets/sprite/${FILES[expr]}.png`;
    });
  }

  setExpression(rawExpr) {
    const expr = rawExpr in this._cache ? rawExpr : 'neutral';
    if (!this.ready || !this._cache[expr] || expr === this.current) return;
    this.current = expr;

    this.canvas.style.opacity = '0';
    setTimeout(() => {
      const src = this._cache[expr];
      this.canvas.width  = src.width;
      this.canvas.height = src.height;
      this.ctx.clearRect(0, 0, src.width, src.height);
      this.ctx.drawImage(src, 0, 0);
      this.canvas.style.opacity = '1';
    }, 160);
  }

  setFromDetection(dominant) {
    this.setExpression(DETECT_MAP[dominant] || 'neutral');
  }

  setFromLabel(label) {
    this.setExpression(LABEL_TO_EXPR[label] || 'neutral');
  }
}

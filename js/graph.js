const REPULSION  = 7000;
const ATTRACTION = 0.045;
const DAMPING    = 0.80;
const GRAVITY    = 0.035;
const REST_LEN   = 170;
const KE_THRESH  = 0.08;
const MAX_TICKS  = 500;

const R_DB       = 30;   // radius: person in DB
const R_MENTION  = 20;   // radius: mentioned only

const CAT_COLOR = {
  friend:   '#6eb8c8',
  family:   '#9b7fd4',
  romantic: '#c87d6e',
  work:     '#7ec89b',
  other:    '#9a9080',
};

export class RelationshipGraph {
  constructor(canvas) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._nodes   = new Map();   // key → { x, y, vx, vy, r, type, label }
    this._edges   = [];          // { from, to, relationship, category }
    this._raf     = null;
    this._ticks   = 0;
    this._drag    = null;        // node being dragged
    this._hovered = null;        // node under cursor

    canvas.addEventListener('mousedown',  this._onDown.bind(this));
    canvas.addEventListener('mousemove',  this._onMove.bind(this));
    canvas.addEventListener('mouseup',    this._onUp.bind(this));
    canvas.addEventListener('mouseleave', this._onUp.bind(this));
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * @param {Array} dbPeople      - rows from people store
   * @param {Array} relationships - rows from relationships store
   */
  setData(dbPeople, relationships) {
    cancelAnimationFrame(this._raf);
    this._nodes.clear();
    this._edges = [];
    this._ticks = 0;

    const W = this._canvas.width / (window.devicePixelRatio || 1);
    const H = this._canvas.height / (window.devicePixelRatio || 1);
    const cx = W / 2, cy = H / 2;

    // Collect all node keys
    const keys = new Set();
    dbPeople.forEach(p => keys.add(p.name));
    relationships.forEach(r => { keys.add(r.fromName); keys.add(r.toName); });

    const keyArr = [...keys];
    const dbNames = new Set(dbPeople.map(p => p.name));

    keyArr.forEach((name, i) => {
      const angle = (i / keyArr.length) * Math.PI * 2;
      const rad   = Math.min(W, H) * 0.28;
      this._nodes.set(name, {
        x: cx + rad * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: cy + rad * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0,
        r:    dbNames.has(name) ? R_DB : R_MENTION,
        type: dbNames.has(name) ? 'db' : 'mention',
        label: name,
      });
    });

    // Deduplicate edges: combine duplicate from→to into one with multiple labels
    const edgeMap = new Map();
    for (const r of relationships) {
      const key = `${r.fromName}||${r.toName}`;
      const rkey = `${r.toName}||${r.fromName}`;
      const existing = edgeMap.get(key) || edgeMap.get(rkey);
      if (existing) {
        if (!existing.labels.includes(r.relationship)) existing.labels.push(r.relationship);
      } else {
        edgeMap.set(key, {
          from: r.fromName,
          to:   r.toName,
          labels: [r.relationship],
          category: r.category,
        });
      }
    }
    this._edges = [...edgeMap.values()];

    this._resize();
    this._loop();
  }

  // ── Force simulation ─────────────────────────────────────────────

  _loop() {
    this._tick();
    const ke = this._kineticEnergy();
    if (ke > KE_THRESH && this._ticks < MAX_TICKS) {
      this._raf = requestAnimationFrame(this._loop.bind(this));
    } else {
      this._draw(); // final static frame
    }
  }

  _tick() {
    this._ticks++;
    const nodes = [...this._nodes.values()];
    const W = this._canvas.width / (window.devicePixelRatio || 1);
    const H = this._canvas.height / (window.devicePixelRatio || 1);
    const cx = W / 2, cy = H / 2;

    // Reset forces
    for (const n of nodes) { n.fx = 0; n.fy = 0; }

    // Repulsion between every pair
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const f  = REPULSION / (dist * dist);
        const fx = f * dx / dist, fy = f * dy / dist;
        a.fx -= fx; a.fy -= fy;
        b.fx += fx; b.fy += fy;
      }
    }

    // Attraction along edges
    for (const e of this._edges) {
      const a = this._nodes.get(e.from), b = this._nodes.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const f  = ATTRACTION * (dist - REST_LEN);
      const fx = f * dx / dist, fy = f * dy / dist;
      a.fx += fx; a.fy += fy;
      b.fx -= fx; b.fy -= fy;
    }

    // Weak center gravity
    for (const n of nodes) {
      n.fx += GRAVITY * (cx - n.x);
      n.fy += GRAVITY * (cy - n.y);
    }

    // Integrate (skip dragged node)
    for (const n of nodes) {
      if (n === this._drag) continue;
      n.vx = (n.vx + n.fx) * DAMPING;
      n.vy = (n.vy + n.fy) * DAMPING;
      n.x  = Math.max(n.r, Math.min(W - n.r, n.x + n.vx));
      n.y  = Math.max(n.r, Math.min(H - n.r, n.y + n.vy));
    }

    this._draw();
  }

  _kineticEnergy() {
    let ke = 0;
    for (const n of this._nodes.values()) ke += n.vx * n.vx + n.vy * n.vy;
    return ke;
  }

  // ── Drawing ──────────────────────────────────────────────────────

  _draw() {
    const canvas = this._canvas;
    const ctx    = this._ctx;
    const dpr    = window.devicePixelRatio || 1;
    const W      = canvas.width / dpr;
    const H      = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Edges
    for (const e of this._edges) {
      const a = this._nodes.get(e.from), b = this._nodes.get(e.to);
      if (!a || !b) continue;
      const color = CAT_COLOR[e.category] || CAT_COLOR.other;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label at midpoint
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const labelText = e.labels.join(', ');
      ctx.font = '9px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(labelText).width;

      ctx.fillStyle = '#0d0b14';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(mx - tw / 2 - 4, my - 7, tw + 8, 14);
      ctx.globalAlpha = 1;

      ctx.fillStyle = color;
      ctx.fillText(labelText, mx, my);
    }

    // Nodes
    for (const [, n] of this._nodes) {
      const isDB      = n.type === 'db';
      const isHovered = n === this._hovered;

      // Glow ring on hover
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
        ctx.fillStyle = isDB ? 'rgba(200,169,110,0.15)' : 'rgba(155,127,212,0.12)';
        ctx.fill();
      }

      // Circle fill
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = isDB ? '#1a1628' : '#13101e';
      ctx.fill();

      // Circle border
      ctx.strokeStyle = isDB ? '#c8a96e' : '#4a4560';
      ctx.lineWidth   = isDB ? 1.5 : 1;
      ctx.stroke();

      // Name label
      const maxChars = isDB ? 10 : 8;
      const display  = n.label.length > maxChars ? n.label.slice(0, maxChars - 1) + '…' : n.label;
      ctx.font        = `${isDB ? 11 : 9}px DM Mono, monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = isDB ? '#e8e0d4' : '#9a9080';
      ctx.fillText(display, n.x, n.y);
    }

    ctx.restore();
  }

  // ── Interaction ──────────────────────────────────────────────────

  _nodeAt(mx, my) {
    for (const [, n] of this._nodes) {
      if (Math.hypot(mx - n.x, my - n.y) <= n.r + 4) return n;
    }
    return null;
  }

  _canvasXY(e) {
    const rect = this._canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onDown(e) {
    const { x, y } = this._canvasXY(e);
    const node = this._nodeAt(x, y);
    if (!node) return;
    this._drag = node;
    // Resume animation while dragging
    cancelAnimationFrame(this._raf);
    this._ticks = 0;
    this._loop();
  }

  _onMove(e) {
    const { x, y } = this._canvasXY(e);
    if (this._drag) {
      this._drag.x = x;
      this._drag.y = y;
      this._drag.vx = 0;
      this._drag.vy = 0;
    } else {
      const prev = this._hovered;
      this._hovered = this._nodeAt(x, y);
      this._canvas.style.cursor = this._hovered ? 'grab' : 'default';
      if (prev !== this._hovered) this._draw();
    }
  }

  _onUp() {
    if (this._drag) {
      this._drag.vx = 0;
      this._drag.vy = 0;
      this._drag = null;
    }
  }

  // ── Resize ───────────────────────────────────────────────────────

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const wrap = this._canvas.parentElement;
    const W    = wrap.clientWidth;
    const H    = wrap.clientHeight || 520;
    this._canvas.width        = W * dpr;
    this._canvas.height       = H * dpr;
    this._canvas.style.width  = W + 'px';
    this._canvas.style.height = H + 'px';
  }
}

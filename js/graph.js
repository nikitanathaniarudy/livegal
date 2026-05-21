const REPULSION  = 12000; // Increased significantly to push nodes apart
const ATTRACTION = 0.03;   // Slightly weaker to allow expansion
const DAMPING    = 0.92;   // More fluid motion (was 0.80)
const GRAVITY    = 0.015;  // Much weaker center pull (was 0.035)
const REST_LEN   = 220;    // More space between connected nodes (was 170)
const KE_THRESH  = 0.01;   // Settle more precisely
const MAX_TICKS  = 1500;   // Allow longer for complex graphs to settle

const R_DB       = 28;
const R_MENTION  = 18;

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
    this._selected = null;       // node clicked for details
    this.onNodeClick = null;     // callback: (node) => void

    canvas.addEventListener('mousedown',  this._onDown.bind(this));
    canvas.addEventListener('mousemove',  this._onMove.bind(this));
    canvas.addEventListener('mouseup',    this._onUp.bind(this));
    canvas.addEventListener('mouseleave', this._onUp.bind(this));
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * @param {Array} dbPeople      - rows from people store
   * @param {Array} relationships - rows from relationships store
   * @param {string} activeName   - name of the currently active person
   */
  setData(dbPeople, relationships, activeName = null) {
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
    const peopleMap = new Map(dbPeople.map(p => [p.name, p]));

    keyArr.forEach((name, i) => {
      const angle = (i / keyArr.length) * Math.PI * 2;
      const rad   = Math.min(W, H) * 0.28;
      const person = peopleMap.get(name);
      
      // A node is "talked to" if it has history OR it is the person we are currently talking to
      const isTalked = (person && person.conversationCount > 0) || (activeName && name === activeName);

      this._nodes.set(name, {
        x: cx + rad * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: cy + rad * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0,
        r:    isTalked ? R_DB : R_MENTION,
        type: isTalked ? 'talked' : 'mention',
        label: name,
        isActive: activeName && name === activeName,
        traits: person ? (person.traits || []) : [],
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

    // Repulsion between every pair + Collision avoidance
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(0.1, Math.hypot(dx, dy));
        
        // Repulsion
        const f  = REPULSION / (dist * dist);
        const fx = f * dx / dist, fy = f * dy / dist;
        a.fx -= fx; a.fy -= fy;
        b.fx += fx; b.fy += fy;

        // Hard collision avoidance
        const minHighlight = a.r + b.r + 20;
        if (dist < minHighlight) {
          const push = (minHighlight - dist) * 0.5;
          const px = push * dx / dist, py = push * dy / dist;
          a.fx -= px; a.fy -= py;
          b.fx += px; b.fy += py;
        }
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
      ctx.lineWidth   = 0.8; // Thinner lines
      ctx.globalAlpha = 0.25; // More subtle edges
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label at midpoint (only if not too crowded or on hover? let's keep it subtle)
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const labelText = e.labels.join(', ');
      ctx.font = '8px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(labelText).width;

      ctx.fillStyle = '#0d0b14';
      ctx.globalAlpha = 0.4; // More transparent label background
      ctx.fillRect(mx - tw / 2 - 2, my - 6, tw + 4, 12);
      ctx.globalAlpha = 1;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.fillText(labelText, mx, my);
      ctx.globalAlpha = 1;
    }

    // Nodes
    for (const [, n] of this._nodes) {
      const isTalked  = n.type === 'talked';
      const isHovered = n === this._hovered;
      const isActive  = n.isActive;

      ctx.save();
      if (!isTalked) ctx.globalAlpha = 0.4;

      // Pulse/Glow for the person we are currently talking to
      if (isActive) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(110, 184, 200, 0.15)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(110, 184, 200, 0.1)';
        ctx.fill();
      }

      // Glow ring on hover
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 8, 0, Math.PI * 2);
        ctx.fillStyle = isTalked ? 'rgba(200,169,110,0.1)' : 'rgba(155,127,212,0.08)';
        ctx.fill();
      }

      // Circle fill
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = isTalked ? '#1a1628' : '#13101e';
      ctx.fill();

      // Circle border
      ctx.strokeStyle = isTalked ? (isActive ? '#6eb8c8' : '#c8a96e') : '#3a3550';
      ctx.lineWidth   = isTalked ? 1.5 : 1;
      ctx.stroke();

      // Name label
      const maxChars = isTalked ? 12 : 10;
      const display  = n.label.length > maxChars ? n.label.slice(0, maxChars - 1) + '…' : n.label;
      ctx.font        = `${isTalked ? 10 : 8}px DM Mono, monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = isTalked ? '#e8e0d4' : '#8a8070';
      ctx.fillText(display, n.x, n.y);

      ctx.restore();
    }

    // Details Panel (Top Right)
    if (this._selected) {
      const p = this._selected;
      const traits = p.traits || [];
      const roles = this._edges
        .filter(e => e.from === p.label || e.to === p.label)
        .map(e => e.labels.join(', '))
        .join(', ');

      const panelW = 160;
      const panelH = 60 + (traits.length * 12);
      const px = W - panelW - 20;
      const py = 20;

      // Background
      ctx.fillStyle = 'rgba(13, 11, 20, 0.85)';
      ctx.strokeStyle = '#c8a96e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, 4);
      ctx.fill();
      ctx.stroke();

      // Title
      ctx.font = 'bold 12px DM Mono, monospace';
      ctx.fillStyle = '#e8e0d4';
      ctx.textAlign = 'left';
      ctx.fillText(p.label, px + 12, py + 22);

      // Roles
      ctx.font = '9px DM Mono, monospace';
      ctx.fillStyle = '#8a8070';
      ctx.fillText(roles || 'no roles', px + 12, py + 36);

      // Divider
      ctx.strokeStyle = 'rgba(232, 224, 212, 0.1)';
      ctx.beginPath();
      ctx.moveTo(px + 10, py + 42);
      ctx.lineTo(px + panelW - 10, py + 42);
      ctx.stroke();

      // Traits
      ctx.font = '9px DM Mono, monospace';
      ctx.fillStyle = '#6eb8c8';
      if (traits.length > 0) {
        traits.forEach((t, i) => {
          ctx.fillText(`• ${t}`, px + 12, py + 56 + (i * 12));
        });
      } else {
        ctx.fillStyle = '#4a4560';
        ctx.fillText('no traits recorded', px + 12, py + 56);
      }
    }

    ctx.restore();
  }

  // ── Interaction ──────────────────────────────────────────────────

  _nodeAt(mx, my) {
    for (const [, n] of this._nodes) {
      if (Math.hypot(mx - n.x, my - n.y) <= n.r + 15) return n; // Increased tolerance from 4 to 15
    }
    return null;
  }

  _canvasXY(e) {
    const rect = this._canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onDown(e) {
    const { x, y } = this._canvasXY(e);
    console.log(`Canvas down at ${x}, ${y}`);
    const node = this._nodeAt(x, y);
    
    this._selected = node; // Set selected node (could be null to deselect)
    
    if (!node) {
      console.log('No node found at click location');
      this._draw();
      return;
    }
    
    console.log(`Node found: ${node.label}`);
    if (this.onNodeClick) this.onNodeClick(node);
    
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

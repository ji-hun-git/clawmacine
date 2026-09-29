// Shared palette and the tin-can drawing used by the machine, the reveal card and the roster.
window.ART = (() => {
  const C = {
    INK: '#1c1b1f', TIN: '#d9dcdf', STEEL: '#8f969e', WHITE: '#ffffff',
    TOMATO: '#e2372c', COBALT: '#2447b5', MUSTARD: '#f3b21b', MINT: '#46b089',
    PLUM: '#7a3e8e', ORANGE: '#ef7d22', TEAL: '#1f97ad',
  };
  // one printed ink per group (pockets on the wheel, swatches, tickets)
  const GROUP = [
    { bg: C.TOMATO, fg: C.WHITE }, { bg: C.COBALT, fg: C.WHITE }, { bg: C.MUSTARD, fg: C.INK }, { bg: C.MINT, fg: C.INK },
    { bg: C.INK, fg: C.WHITE }, { bg: C.PLUM, fg: C.WHITE }, { bg: C.ORANGE, fg: C.INK }, { bg: C.TEAL, fg: C.WHITE },
  ];
  // can label designs; each student always gets the same one (hashed from the name)
  const LABELS = [
    { bg: C.WHITE, band: C.TOMATO, text: C.INK, sub: C.TOMATO, motif: 'stars' },
    { bg: C.TOMATO, band: C.MUSTARD, text: C.WHITE, sub: C.MUSTARD, motif: 'stripes' },
    { bg: C.COBALT, band: C.WHITE, text: C.WHITE, sub: C.MUSTARD, motif: 'dots' },
    { bg: C.MUSTARD, band: C.INK, text: C.INK, sub: C.TOMATO, motif: 'chevron' },
    { bg: C.MINT, band: C.WHITE, text: C.INK, sub: C.WHITE, motif: 'stars' },
    { bg: C.WHITE, band: C.COBALT, text: C.COBALT, sub: C.INK, motif: 'stripes' },
    { bg: C.INK, band: C.MUSTARD, text: C.MUSTARD, sub: C.WHITE, motif: 'dots' },
  ];
  const TAU = Math.PI * 2;

  function hash(s) {
    let h = 2166136261;
    for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function canStyle(name) {
    const h = hash(name.trim().toLowerCase());
    return { label: h % LABELS.length, lot: String(10 + (h >>> 7) % 90) };
  }
  function splitName(n) {
    const p = n.trim().split(/\s+/);
    return p.length === 1 ? [p[0], ''] : [p[0], p.slice(1).join(' ')];
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  }
  function star(g, x, y, R, r = R * .45) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath();
  }
  function rivet(g, x, y, r) {
    const gr = g.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#a9afb5'); gr.addColorStop(1, '#4d5358');
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = C.INK; g.stroke();
  }
  function tinGrad(g, x0, x1) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, '#767d85'); gr.addColorStop(.16, '#e3e6e9'); gr.addColorStop(.4, '#b3b9bf');
    gr.addColorStop(.68, '#f6f7f8'); gr.addColorStop(1, '#6f767e');
    return gr;
  }
  function fitFont(g, text, weight, family, maxW, maxSize, minSize) {
    g.font = `${weight} ${maxSize}px ${family}`;
    const w = g.measureText(text).width;
    return Math.max(minSize, Math.min(maxSize, maxSize * maxW / Math.max(1, w)));
  }

  function motif(g, L, x, y, w, h) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.globalAlpha = .22; g.fillStyle = L.band; g.strokeStyle = L.band;
    if (L.motif === 'stripes') for (let i = x + 3; i < x + w; i += 7) g.fillRect(i, y, 2.5, h);
    if (L.motif === 'dots') for (let j = y + 3, r = 0; j < y + h; j += 5, r++) for (let i = x + (r % 2) * 2.5; i < x + w; i += 5) { g.beginPath(); g.arc(i, j, 1.1, 0, TAU); g.fill(); }
    if (L.motif === 'chevron') { g.globalAlpha = .35; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(x + i * w / 8, y + h * .93 - (i % 2) * 4); g.stroke(); }
    if (L.motif === 'stars') { g.globalAlpha = .9; g.fillStyle = L.sub; const s = Math.max(2.5, w * .06); star(g, x + s + 3, y + h * .16, s); g.fill(); star(g, x + w - s - 3, y + h * .16, s); g.fill(); }
    g.restore();
  }

  // Draw one tin can centred at (x, y), rotated by ang. `squash` (0..1) crushes it flat.
  function drawCan(g, can, x, y, ang, w, h, o = {}) {
    const L = LABELS[can.label];
    const sq = o.squash || 0;
    g.save(); g.translate(x, y); g.rotate(ang);
    if (sq) g.scale(1 + sq * .55, 1 - sq * .72);
    const hw = w / 2, hh = h / 2, rim = Math.max(4, h * .08);
    // shadow under the can when drawn flat on a card
    if (o.shadow) { g.fillStyle = 'rgba(28,27,31,.18)'; g.beginPath(); g.ellipse(4, hh + 4, hw * 1.05, 5, 0, 0, TAU); g.fill(); }
    rr(g, -hw, -hh, w, h, 3); g.fillStyle = tinGrad(g, -hw, hw); g.fill();
    // printed label
    const ly0 = -hh + rim + 1.5, ly1 = hh - rim - 1.5, lh = ly1 - ly0;
    g.fillStyle = L.bg; g.fillRect(-hw, ly0, w, lh);
    motif(g, L, -hw, ly0, w, lh);
    const bh = Math.max(2, lh * .06);
    g.fillStyle = L.band; g.fillRect(-hw, ly0 + bh * .6, w, bh); g.fillRect(-hw, ly1 - bh * 1.6, w, bh);
    // name
    const [first, rest] = splitName(can.name);
    const F = first.toUpperCase(), R = rest.toUpperCase();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const SLAB = '"Alfa Slab One", Rockwell, Georgia, serif', COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
    const fs = fitFont(g, F, '400', SLAB, w - 8, lh * .3, 6);
    g.font = `${fs}px ${SLAB}`; g.fillStyle = L.text;
    g.fillText(F, 0, ly0 + lh * (R ? .42 : .5));
    if (R) {
      const fs2 = fitFont(g, R, '700', COND, w - 8, lh * .16, 5);
      g.font = `700 ${fs2}px ${COND}`; g.fillStyle = L.sub;
      g.fillText(R, 0, ly0 + lh * .64);
    }
    if (lh > 34) {
      g.font = `600 ${Math.max(6, lh * .1)}px ${COND}`;
      g.fillStyle = L.text; g.globalAlpha = .7; g.fillText(`NO. ${can.lot}`, 0, ly0 + lh * .83); g.globalAlpha = 1;
    }
    // cylinder shading over the label
    const sh = g.createLinearGradient(-hw, 0, hw, 0);
    sh.addColorStop(0, 'rgba(0,0,0,.34)'); sh.addColorStop(.22, 'rgba(255,255,255,.16)');
    sh.addColorStop(.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.38)');
    g.fillStyle = sh; g.fillRect(-hw, ly0, w, lh);
    // rolled rims
    for (const ry of [-hh, hh - rim]) {
      rr(g, -hw - 1.5, ry, w + 3, rim, 2); g.fillStyle = tinGrad(g, -hw, hw); g.fill();
      g.lineWidth = 1.5; g.strokeStyle = C.INK; g.stroke();
      g.strokeStyle = 'rgba(28,27,31,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-hw, ry + rim / 2); g.lineTo(hw, ry + rim / 2); g.stroke();
    }
    rr(g, -hw, -hh, w, h, 3); g.lineWidth = 2.4; g.strokeStyle = C.INK; g.stroke();
    // glint
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-hw + w * .16, -hh + 2, Math.max(2, w * .05), h - 4);
    // crushed-can creases
    if (sq > .15) {
      g.strokeStyle = C.INK; g.lineWidth = 1.6; g.globalAlpha = Math.min(1, sq * 1.6);
      g.beginPath(); g.moveTo(-hw, -hh * .2); g.lineTo(-hw * .3, hh * .25); g.lineTo(hw * .2, -hh * .3); g.lineTo(hw, hh * .15); g.stroke();
      g.globalAlpha = 1;
    }
    g.restore();
  }

  return { C, GROUP, LABELS, TAU, hash, canStyle, splitName, rr, star, rivet, tinGrad, drawCan };
})();

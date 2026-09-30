// Red panda (Ailurus fulgens). A rust-red show-off in a cobalt racing neckerchief: it bounds like a
// ferret, steers with a ringed tail as long as its body, and rides the crane with that tail looped
// round the cable like a safety line. The white brow spots double as its eyebrows.
// Modelled as a painted vinyl figure under the game's one lamp (AKIT.LIGHT): every part is a lit
// volume, markings are painted onto those volumes and take the same light, and edges come from
// shading and contact darkening, not from ink.
(() => {
  const { C, TAU, bib, cyc, ao, cast, eye3d, mix, shade, tint, LIGHT } = AKIT;

  const RUST = '#c64a1e', RUST_DK = '#8a2a12', OCHRE = '#f0c47e', RUST_FAR = '#9b3815', OCHRE_FAR = '#c99a5e',
    FUR = C.CREAM, FUR_FAR = '#e2d5bd',
    LEG = '#3e251d', LEG_FAR = '#2a1812', BELLY = '#2f1c16', SCARF = C.COBALT, SCARF_DK = '#1b3180',
    MOUTH = '#4a1410', TONGUE = '#e98079', NOSE = '#261a1c', LINE = '#2b1411',
    EDGE = 'rgba(22,12,14,.6)', CONTOUR = '#170d10', SHADE_A = 'rgba(40,8,10,.088)';
  const PI = Math.PI, HR = 17, RING = [7, 8], RING_OFF = 7, STITCH = [1.6, 2.4], SOLID = [];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  // brow spots: [near angle, far angle, near dy, far dy]
  const BROWS = {
    focus: [.5, -.5, 1.4, 1.4], worry: [-.5, .5, -2.2, -2.2], cheer: [-.2, .2, -3.2, -3.2],
    sad: [-.42, .42, .6, .6], smug: [.22, -.32, .8, -2.8],
  };

  // ---------- light ----------
  // lx, ly: the lamp's direction in the current drawing frame (so a rotated head still lights from the lamp)
  const LN = Math.hypot(LIGHT.x, LIGHT.y), LX = LIGHT.x / LN, LY = LIGHT.y / LN;
  const M = { a: 1, b: 0, c: 0, d: 1 };
  let lx = LX, ly = LY;
  function frame(g) {
    const m = typeof g.getTransform === 'function' ? g.getTransform() : null;
    if (m && typeof m.a === 'number' && isFinite(m.a)) { M.a = m.a; M.b = m.b; M.c = m.c; M.d = m.d; }
    else { M.a = 1; M.b = 0; M.c = 0; M.d = 1; }
    const det = M.a * M.d - M.b * M.c || 1;
    const x = (M.d * LX - M.c * LY) / det, y = (-M.b * LX + M.a * LY) / det, n = Math.hypot(x, y) || 1;
    lx = x / n; ly = y / n;
  }
  const TONE = new Map();
  // k > 0 toward the lamp's colour, k < 0 toward the room's shadow (cached: the palette is small)
  function tone(c, k) {
    const key = c + k; let v = TONE.get(key);
    if (v === undefined) { v = k >= 0 ? tint(c, k) : shade(c, -k); TONE.set(key, v); }
    return v;
  }
  // AKIT.vol's body gradient with the clear coat's specular folded into its first stops, so a part costs
  // one fill. A marking filled with it (same centre and radius) sits on the form and rolls into its shade.
  const LIT = new Map();
  function lit(g, c, cx, cy, r, soft = .3, depth = .6, gloss = 0) {
    const key = c + soft + '|' + depth + '|' + gloss; let s = LIT.get(key);
    if (!s) {
      const hi = tone(c, .28 - soft * .12);
      s = gloss > 0 ? [0, mix(hi, '#fffaf0', gloss), .1 + soft * .1, mix(hi, '#fffaf0', gloss * .22)] : [0, hi];
      s.push(.36 + soft * .15, c, .78, tone(c, -depth * .55), 1, tone(c, -depth));
      LIT.set(key, s);
    }
    const gr = g.createRadialGradient(cx + lx * r * .45, cy + ly * r * .45, r * .05, cx - lx * r * .15, cy - ly * r * .15, r * (1.15 + soft * .25));
    for (let i = 0; i < s.length; i += 2) gr.addColorStop(s[i], s[i + 1]);
    return gr;
  }
  // a small part as one lit volume (the current path, centre and radius matching the part)
  function blob(g, c, cx, cy, r, soft, depth, gloss, edge = 0) {
    frame(g);
    g.fillStyle = lit(g, c, cx, cy, r, soft, depth, gloss); g.fill();
    if (edge) { g.lineWidth = edge; g.strokeStyle = EDGE; g.lineJoin = 'round'; g.stroke(); }
  }
  // Contact darkening. AKIT.ao where big parts meet; dab() is the same soft blob from a cached sprite,
  // for the small frequent spots (paws on the ground, eye sockets) so they stay cheap.
  let AOS = null;
  function dab(g, x, y, rx, ry, a) {
    if (!AOS) {
      AOS = document.createElement('canvas'); AOS.width = AOS.height = 32;
      const c = AOS.getContext('2d');
      if (c) { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(12,8,12,1)'); gr.addColorStop(1, 'rgba(12,8,12,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); }
    }
    const pa = typeof g.globalAlpha === 'number' ? g.globalAlpha : 1;
    g.globalAlpha = pa * a; g.drawImage(AOS, x - rx, y - ry, rx * 2, ry * 2); g.globalAlpha = pa;
  }
  // Fill the current path as one lit volume. The light is carried by the ellipse (cx, cy, rx, ry, rot), so a
  // long body shades across its girth, not along its length. marks(fill) paints markings inside the same
  // frame; fill(colour) hands back the form's own gradient in that colour.
  function form(g, c, cx, cy, rx, ry, rot, o, marks) {
    const soft = o.soft ?? .3, depth = o.depth ?? .6, gloss = o.gloss || 0;
    g.lineJoin = 'round'; g.lineWidth = o.edge ?? 1.5; g.strokeStyle = EDGE; g.stroke();   // only the outer half survives
    if (!marks && !rot && rx === ry) {   // a round form needs no frame of its own
      frame(g); g.fillStyle = lit(g, c, cx, cy, rx, soft, depth, gloss); g.fill(); return;
    }
    g.save(); g.clip();
    g.translate(cx, cy); if (rot) g.rotate(rot); if (ry !== rx) g.scale(1, ry / rx);
    frame(g);
    g.fillStyle = lit(g, c, 0, 0, rx, soft, depth, gloss); g.fillRect(-rx * 1.6, -rx * 1.6, rx * 3.2, rx * 3.2);
    if (marks) marks(col => lit(g, col, 0, 0, rx, soft, depth, gloss), rx, ry / rx);
    g.restore();
    frame(g);
  }

  // round tube (legs, arms): each straight run is a cylinder lit across its girth, with a gloss line
  // where the lamp reflects. Profiles are cached per colour and per screen angle.
  const TUBE = new Map(), HZ = LIGHT.z + 1, HN = Math.hypot(LIGHT.x, LIGHT.y, HZ);
  function tubeStops(c, q, gloss) {
    const key = c + q + '|' + gloss; let s = TUBE.get(key); if (s) return s;
    const an = q / 48 * TAU, nx = Math.cos(an), ny = Math.sin(an);
    const k = LIGHT.x * nx + LIGHT.y * ny, kh = k / HN, us = kh / Math.hypot(kh, HZ / HN);
    const U = [1, .86, .62, .36, .1, -.16, -.42, -.66, -.86, -1, us - .14, us, us + .14].filter(u => u >= -1 && u <= 1).sort((a, b) => b - a);
    s = [];
    for (const u of U) {
      const d = Math.max(0, u * k + Math.sqrt(1 - u * u) * LIGHT.z), b = .16 + .88 * d;
      let col = b > .74 ? tint(c, (b - .74) * .55) : shade(c, (.74 - b) * 1.05);
      const sp = gloss * Math.exp(-(((u - us) / .16) ** 2));
      if (sp > .03) col = mix(col, '#fff4e6', sp);
      s.push((1 - u) / 2, col);
    }
    TUBE.set(key, s); return s;
  }
  // linear gradient across a round limb whose +n side faces local direction (nx, ny), spanning +-h around (cx, cy)
  function across(g, c, cx, cy, nx, ny, h, gloss) {
    const sx = M.a * nx + M.c * ny, sy = M.b * nx + M.d * ny;
    const q = ((Math.round(Math.atan2(sy, sx) / TAU * 48) % 48) + 48) % 48, s = tubeStops(c, q, gloss);
    const gr = g.createLinearGradient(cx + nx * h, cy + ny * h, cx - nx * h, cy - ny * h);
    for (let j = 0; j < s.length; j += 2) gr.addColorStop(s[j], s[j + 1]);
    return gr;
  }
  // a paw on the ground: soft contact darkening under it
  function contact(g, x, y, a = 1) {
    const k = a * clamp(1 - (-y - 4) / 9, 0, 1);
    if (k > .02) dab(g, x, -.3, 6.5, 1.8, .55 * k);
  }

  // ---------- rig helpers ----------
  // two-bone IK: anchor -> knee -> foot; bend +1 puts the joint behind (elbow), -1 in front (knee)
  function ik(ax, ay, fx, fy, l1, l2, bend) {
    const dx = fx - ax, dy = fy - ay, d0 = Math.hypot(dx, dy) || 1e-3, ux = dx / d0, uy = dy / d0;
    const d = clamp(d0, Math.abs(l1 - l2) + .5, l1 + l2 - .01);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [ax + ux * a - uy * h * bend, ay + uy * a + ux * h * bend, ax + ux * d, ay + uy * d];
  }
  // One sculpted limb: a haunch that tapers through a rounded knee to a slim ankle, lit across its girth
  // as a single volume, ending in a mitten paw.
  function leg(g, ax, ay, fx, fy, l1, l2, bend, pa, w, col, pl = 5) {
    const k = ik(ax, ay, fx, fy, l1, l2, bend), kx = k[0], ky = k[1], ex = k[2], ey = k[3];
    let ux = kx - ax, uy = ky - ay; const d1 = Math.hypot(ux, uy) || 1; ux /= d1; uy /= d1;
    let vx = ex - kx, vy = ey - ky; const d2 = Math.hypot(vx, vy) || 1; vx /= d2; vy /= d2;
    let nx = -uy - vy, ny = ux + vx; const nn = Math.hypot(nx, ny) || 1; nx /= nn; ny /= nn;
    const hA = w * .7, hK = w * .52 / Math.max(.55, -uy * nx + ux * ny), hE = w * .46;
    const pax = ax - uy * hA, pay = ay + ux * hA, pkx = kx + nx * hK, pky = ky + ny * hK, pex = ex - vy * hE, pey = ey + vx * hE;
    const qax = ax + uy * hA, qay = ay - ux * hA, qkx = kx - nx * hK, qky = ky - ny * hK, qex = ex + vy * hE, qey = ey - vx * hE;
    g.beginPath(); g.moveTo(pax, pay); g.lineTo((pax + pkx) / 2, (pay + pky) / 2);
    g.quadraticCurveTo(pkx, pky, (pkx + pex) / 2, (pky + pey) / 2); g.lineTo(pex, pey);
    g.quadraticCurveTo(ex + vx * hE * 1.5, ey + vy * hE * 1.5, qex, qey);
    g.lineTo((qex + qkx) / 2, (qey + qky) / 2); g.quadraticCurveTo(qkx, qky, (qkx + qax) / 2, (qky + qay) / 2); g.lineTo(qax, qay);
    g.quadraticCurveTo(ax - ux * hA * 1.45, ay - uy * hA * 1.45, pax, pay); g.closePath();
    frame(g);
    const far = col !== LEG, ca = Math.cos(pa), sa = Math.sin(pa), px = ex + ca * pl * .5, py = ey + sa * pl * .5, rx = pl * .5 + w * .56, ry = w * .44;
    // the far paw rides in the leg's own fill (same winding, so it unions); the near one is its own volume
    if (far) { g.moveTo(px + ca * rx, py + sa * rx); g.ellipse(px, py, rx, ry, pa, 0, TAU, true); }
    g.fillStyle = across(g, col, (kx + ex) / 2, (ky + ey) / 2, -vy, vx, hE * 1.2, far ? .14 : .26); g.fill();
    if (!far) {
      g.beginPath(); g.ellipse(px, py, rx, ry, pa, 0, TAU);
      g.fillStyle = lit(g, col, px, py, ry * 1.25, .35, .62, .22); g.fill();
    }
  }

  // torso as a bean between a hip circle and a chest circle; arch bows the back, belly the underside
  function bean(g, hx, hy, rH, cx, cy, rC, arch, belly) {
    let dx = cx - hx, dy = cy - hy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = dy, ny = -dx, mx = (hx + cx) / 2, my = (hy + cy) / 2, rm = (rH + rC) / 2, k = 1.33;
    g.beginPath(); g.moveTo(hx + nx * rH, hy + ny * rH);
    g.quadraticCurveTo(mx + nx * (rm + 2 * arch), my + ny * (rm + 2 * arch), cx + nx * rC, cy + ny * rC);
    g.bezierCurveTo(cx + nx * rC + dx * rC * k, cy + ny * rC + dy * rC * k, cx - nx * rC + dx * rC * k, cy - ny * rC + dy * rC * k, cx - nx * rC, cy - ny * rC);
    g.quadraticCurveTo(mx - nx * (rm + 2 * belly), my - ny * (rm + 2 * belly), hx - nx * rH, hy - ny * rH);
    g.bezierCurveTo(hx - nx * rH - dx * rH * k, hy - ny * rH - dy * rH * k, hx + nx * rH - dx * rH * k, hy + ny * rH - dy * rH * k, hx + nx * rH, hy + ny * rH);
    g.closePath();
  }
  // rust coat over a soot-black belly, one volume lit across its girth
  function torso(g, hx, hy, rH, cx, cy, rC, arch, belly) {
    const dx = cx - hx, dy = cy - hy, L = Math.hypot(dx, dy) || 1, rm = (rH + rC) / 2, k = rm * 1.05 + belly;
    const rx = L / 2 + rm * .98, ry = rm + Math.max(0, arch) * .5;
    bean(g, hx, hy, rH, cx, cy, rC, arch, belly);
    form(g, RUST, (hx + cx) / 2, (hy + cy) / 2, rx, ry, Math.atan2(dy, dx), { soft: .34, depth: .7, gloss: .38 }, (fill, r, s) => {
      g.beginPath(); g.ellipse(0, k / s, L * .62 + rm * .7, rm * .62 / s, 0, 0, TAU);
      g.fillStyle = fill(BELLY); g.fill();
    });
  }

  // the ringed brush. sp = spine points (flat x,y list); draws the stretch of spine points a..b, so a
  // tail can be drawn in pieces (behind and in front of the cable) that still join up. The rings are
  // one dashed stroke along the spine, clipped to the fur outline, so they bend with the tail and
  // never slide; the girth shading is laid over them, so they roll into shade with the fur. open = no
  // edge across the cut ends (for a piece laid over another); far = the darker paint of a stretch that
  // passes behind something; edge = a thin dark contour, for a stretch that lies over the body.
  function tail(g, sp, wMax, a = 0, b = sp.length / 2 - 1, { taper = true, open = false, far = false, edge = false } = {}) {
    const nT = sp.length / 2 - 1, n = b - a, N2 = n * 2, tip = b === nT, L = [], R = [], W = [], P = sp.slice(a * 2, b * 2 + 2);
    let tx = 1, ty = 0, off = RING_OFF;
    for (let i = 1; i <= a; i++) off += Math.hypot(sp[i * 2] - sp[i * 2 - 2], sp[i * 2 + 1] - sp[i * 2 - 1]);
    for (let i = a; i <= b; i++) {
      const p = Math.max(0, i - 1) * 2, q = Math.min(nT, i + 1) * 2;
      tx = sp[q] - sp[p]; ty = sp[q + 1] - sp[p + 1];
      const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      const w = wMax * (taper ? .58 + .42 * Math.sin(Math.min(1, i / nT / .3) * PI / 2) : 1) * (i % 2 ? .9 : 1) * (tip && i === nT ? .82 : 1);
      L.push(sp[i * 2] - ty * w, sp[i * 2 + 1] + tx * w); R.push(sp[i * 2] + ty * w, sp[i * 2 + 1] - tx * w); W.push(w);
    }
    const ext = tip ? wMax * .95 : 0, ex = P[N2] + tx * ext, ey = P[N2 + 1] + ty * ext;
    const sideL = () => { for (let i = 1; i < n; i++) g.quadraticCurveTo(L[i * 2], L[i * 2 + 1], (L[i * 2] + L[i * 2 + 2]) / 2, (L[i * 2 + 1] + L[i * 2 + 3]) / 2); };
    const sideR = () => { for (let i = n - 1; i >= 1; i--) g.quadraticCurveTo(R[i * 2], R[i * 2 + 1], (R[i * 2] + R[i * 2 - 2]) / 2, (R[i * 2 + 1] + R[i * 2 - 1]) / 2); g.lineTo(R[0], R[1]); };
    const tipEnd = () => { g.quadraticCurveTo(L[N2], L[N2 + 1], ex, ey); g.quadraticCurveTo(R[N2], R[N2 + 1], (R[N2] + R[N2 - 2]) / 2, (R[N2 + 1] + R[N2 - 1]) / 2); };
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 1.6; g.strokeStyle = EDGE;
    if (open) {   // edge the long sides (and the tip) but not the cut ends; the fill trims it to the outer half
      g.beginPath(); g.moveTo(L[0], L[1]); sideL();
      if (tip) tipEnd(); else { g.lineTo(L[N2], L[N2 + 1]); g.moveTo(R[N2], R[N2 + 1]); g.lineTo((R[N2] + R[N2 - 2]) / 2, (R[N2 + 1] + R[N2 - 1]) / 2); }
      sideR(); g.stroke();
    }
    g.beginPath(); g.moveTo(L[0], L[1]); sideL();
    if (tip) tipEnd(); else { g.lineTo(L[N2], L[N2 + 1]); g.lineTo(R[N2], R[N2 + 1]); g.lineTo((R[N2] + R[N2 - 2]) / 2, (R[N2 + 1] + R[N2 - 1]) / 2); }
    sideR(); g.closePath();
    if (edge && !open) g.stroke();
    g.fillStyle = far ? RUST_FAR : RUST; g.fill();
    g.save(); g.clip();
    const ex2 = ex + tx * 6, ey2 = ey + ty * 6;
    g.beginPath(); g.moveTo(P[0], P[1]);
    for (let i = 1; i < n; i++) g.quadraticCurveTo(P[i * 2], P[i * 2 + 1], (P[i * 2] + P[i * 2 + 2]) / 2, (P[i * 2 + 1] + P[i * 2 + 3]) / 2);
    g.lineTo(P[N2], P[N2 + 1]); g.lineTo(ex2, ey2);
    g.lineCap = 'butt'; g.lineWidth = wMax * 2.1 + 1; g.strokeStyle = far ? OCHRE_FAR : OCHRE;
    g.setLineDash(RING); g.lineDashOffset = off; g.stroke(); g.setLineDash(SOLID);
    if (tip) {   // soot-dark brush tip
      g.beginPath(); g.moveTo((P[N2 - 2] + P[N2]) / 2, (P[N2 - 1] + P[N2 + 1]) / 2); g.lineTo(P[N2], P[N2 + 1]); g.lineTo(ex2, ey2);
      g.strokeStyle = RUST_DK; g.stroke();
    }
    // girth: copies of the outline pushed away from the lamp by growing shares of the local radius. Each
    // leaves a wider strip along the lamp side uncovered, so the layers pile up into a roll from the lit
    // crown to the shaded underside, in proportion to the girth wherever the brush tapers. The ends run
    // on past the cut so a tail drawn in pieces shades as one.
    frame(g);
    let t0x = P[2] - P[0], t0y = P[3] - P[1]; const t0 = Math.hypot(t0x, t0y) || 1, X = wMax * 2.2; t0x /= t0; t0y /= t0;
    const hull = f => {
      let o = -f * W[0];
      g.beginPath(); g.moveTo(L[0] - t0x * X + lx * o, L[1] - t0y * X + ly * o);
      for (let i = 0; i <= n; i++) { o = -f * W[i]; g.lineTo(L[i * 2] + lx * o, L[i * 2 + 1] + ly * o); }
      if (tip) g.lineTo(ex2 + lx * o, ey2 + ly * o);
      else { g.lineTo(L[N2] + tx * X + lx * o, L[N2 + 1] + ty * X + ly * o); g.lineTo(R[N2] + tx * X + lx * o, R[N2 + 1] + ty * X + ly * o); }
      for (let i = n; i >= 0; i--) { o = -f * W[i]; g.lineTo(R[i * 2] + lx * o, R[i * 2 + 1] + ly * o); }
      g.lineTo(R[0] - t0x * X + lx * o, R[1] - t0y * X + ly * o); g.closePath();
    };
    g.fillStyle = SHADE_A;
    for (let f = .42; f < 1.8; f += .17) { hull(f); g.fill(); }
    // the clear coat's gloss line along the crown
    let o = W[0] * .5;
    g.beginPath(); g.moveTo(P[0] + lx * o, P[1] + ly * o);
    for (let i = 1; i < n; i++) {
      const oi = W[i] * .5, om = (W[i] + W[i + 1]) * .25;
      g.quadraticCurveTo(P[i * 2] + lx * oi, P[i * 2 + 1] + ly * oi, (P[i * 2] + P[i * 2 + 2]) / 2 + lx * om, (P[i * 2 + 1] + P[i * 2 + 3]) / 2 + ly * om);
    }
    o = W[n] * .5; g.lineTo(P[N2] + lx * o, P[N2 + 1] + ly * o);
    g.lineJoin = 'round'; g.lineWidth = wMax * .22; g.strokeStyle = 'rgba(255,250,240,.28)'; g.stroke();
    g.restore();
  }

  // ---------- head ----------
  function ear(g, x, y, a, k, far) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
    g.beginPath(); g.moveTo(-7.5, 3); g.quadraticCurveTo(-7.6, -9, 0, -15.5); g.quadraticCurveTo(7.6, -9, 7.5, 3); g.closePath();
    // a thin flap: lit across its face, white rim toward the lamp
    frame(g);
    if (far) g.fillStyle = tone(FUR_FAR, -.12);   // mostly behind the head: one flat shade
    else {
      const og = g.createLinearGradient(lx * 8, -5 + ly * 8, -lx * 8, -5 - ly * 8);
      og.addColorStop(0, tone(FUR, .2)); og.addColorStop(.42, FUR); og.addColorStop(1, tone(FUR, -.5));
      g.fillStyle = og;
    }
    g.fill();
    // the cup: its far wall faces the lamp, the near wall throws shade into it
    g.beginPath(); g.moveTo(-4.2, 3); g.quadraticCurveTo(-4.3, -5.5, 0, -10.4); g.quadraticCurveTo(4.3, -5.5, 4.2, 3); g.closePath();
    if (far) g.fillStyle = tone(RUST_DK, -.2);
    else {
      const cg = g.createLinearGradient(-lx * 4.5, -3.5 - ly * 4.5, lx * 4.5, -3.5 + ly * 4.5);
      cg.addColorStop(0, tone(RUST, .06)); cg.addColorStop(.5, tone(RUST, -.3)); cg.addColorStop(1, tone(RUST_DK, -.55));
      g.fillStyle = cg;
    }
    g.fill();
    g.restore();
  }
  // fur eyelids over the tops of both eyes (k = how far they are shut), painted with the head's own light
  const EYES = [[-HR * .13, -HR * .1, 4.4, .18], [HR * .62, -HR * .12, 3.7, -.18]];
  function lids(g, k, HG) {
    g.save(); g.beginPath();
    for (const [x, y, r] of EYES) { g.moveTo(x + r * 1.02, y); g.ellipse(x, y, r * 1.02, r * 1.1, 0, 0, TAU); }
    g.clip();
    const edge = (u, v, x, y, c, s, line) => g[line](x + u * c - v * s, y + u * s + v * c);
    g.beginPath();
    for (const [x, y, r, tl] of EYES) {
      const yl = -r * 1.1 + 2.2 * r * k, c = Math.cos(tl), s = Math.sin(tl);
      edge(-r * 1.6, -r * 1.7, x, y, c, s, 'moveTo'); edge(r * 1.6, -r * 1.7, x, y, c, s, 'lineTo');
      edge(r * 1.6, yl, x, y, c, s, 'lineTo'); edge(-r * 1.6, yl, x, y, c, s, 'lineTo'); g.closePath();
    }
    g.fillStyle = HG; g.fill();
    g.beginPath();
    for (const [x, y, r, tl] of EYES) {
      const yl = -r * 1.1 + 2.2 * r * k, c = Math.cos(tl), s = Math.sin(tl);
      edge(-r * 1.6, yl, x, y, c, s, 'moveTo'); edge(r * 1.6, yl, x, y, c, s, 'lineTo');
    }
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(40,12,8,.85)'; g.stroke();
    g.restore();
  }
  function mouth(g, R, m) {
    g.lineWidth = 1.5; g.strokeStyle = LINE; g.lineCap = 'round'; g.lineJoin = 'round';
    if (m === 'grin') {
      g.beginPath(); g.moveTo(R * .28, R * .56); g.quadraticCurveTo(R * .62, R * .64, R * .94, R * .5);
      g.quadraticCurveTo(R * .66, R * 1.12, R * .28, R * .56);
      const mg = g.createLinearGradient(0, R * .55, 0, R * .95);
      mg.addColorStop(0, '#1e0706'); mg.addColorStop(1, MOUTH);
      g.fillStyle = mg; g.fill(); g.stroke();
      g.beginPath(); g.ellipse(R * .6, R * .76, R * .17, R * .08, -.1, 0, TAU);
      const tg = g.createLinearGradient(0, R * .69, 0, R * .84);
      tg.addColorStop(0, tone(TONGUE, .25)); tg.addColorStop(1, tone(TONGUE, -.3));
      g.fillStyle = tg; g.fill();
      return;
    }
    g.beginPath(); g.moveTo(R * .66, R * .45); g.lineTo(R * .64, R * .58);
    if (m === 'focus') {   // tongue tip poking out of the corner: concentrating hard
      g.stroke();
      g.beginPath(); g.ellipse(R * .86, R * .63, 2.8, 2.1, .6, 0, TAU);
      blob(g, TONGUE, R * .86, R * .63, 2.8, .1, .45, .6, .7);
      g.lineWidth = 1.5; g.strokeStyle = LINE;
      g.beginPath(); g.moveTo(R * .42, R * .6); g.quadraticCurveTo(R * .62, R * .7, R * .86, R * .56);
    } else if (m === 'wavy') {
      g.moveTo(R * .4, R * .66); g.quadraticCurveTo(R * .47, R * .58, R * .55, R * .65);
      g.quadraticCurveTo(R * .63, R * .72, R * .71, R * .64); g.quadraticCurveTo(R * .78, R * .57, R * .85, R * .64);
    } else if (m === 'frown') {
      g.moveTo(R * .42, R * .73); g.quadraticCurveTo(R * .63, R * .56, R * .84, R * .7);
    } else {   // smirk: one corner hooked up
      g.moveTo(R * .42, R * .62); g.quadraticCurveTo(R * .64, R * .7, R * .86, R * .52);
    }
    g.stroke();
  }
  function blush(g, x, y, r) {
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, 'rgba(238,86,80,.5)'); bg.addColorStop(1, 'rgba(238,86,80,0)');
    g.fillStyle = bg; g.beginPath(); g.ellipse(x, y, r, r * .7, 0, 0, TAU); g.fill();
  }
  function sweat(g, x, y) {
    g.beginPath(); g.moveTo(x, y - 6); g.quadraticCurveTo(x + 4, y, x, y + 3); g.quadraticCurveTo(x - 4, y, x, y - 6);
    blob(g, '#9fd3ff', x, y, 3.6, 0, .4, .9, .7);
  }
  function headPath(g, R) {
    g.beginPath(); g.moveTo(0, -R);
    g.bezierCurveTo(R * .8, -R, R * 1.1, -R * .5, R * 1.06, R * .08);
    g.bezierCurveTo(R * 1.02, R * .72, R * .5, R * .98, 0, R * .94);
    g.bezierCurveTo(-R * .62, R * .92, -R * 1.08, R * .6, -R * 1.08, 0);
    g.bezierCurveTo(-R * 1.08, -R * .62, -R * .72, -R, 0, -R);
  }
  // head in a 3/4 turn toward +x, centred at (x, y)
  function head(g, x, y, a, f) {
    const R = HR, B = BROWS[f.brow] || BROWS.smug, HRr = R * 1.1;
    g.save(); g.translate(x, y); g.rotate(a);
    ear(g, R * .52, -R * .7, f.eF, .84, true);
    ear(g, -R * .45, -R * .72, f.eN, 1, false);
    headPath(g, R);
    form(g, RUST, 0, 0, HRr, HRr, 0, { soft: .32, depth: .7, gloss: .38, edge: 1.4 });
    const HG = lit(g, RUST, 0, 0, HRr, .32, .7, .38), FG = lit(g, FUR, 0, 0, HRr, .32, .7, .38);
    // white cheek ruffs flaring past the jaw, sculpted proud of the face: each throws a crisp shadow
    // onto the rust away from the lamp before it is painted with the head's own light
    const sx = -lx * 1.3, sy = -ly * 1.3;
    for (let k = 0; k < 2; k++) {
      const ox = k ? 0 : sx, oy = k ? 0 : sy;
      g.beginPath(); g.moveTo(-R * .32 + ox, R * .1 + oy);
      g.quadraticCurveTo(-R * .85 + ox, oy, -R * 1.32 + ox, R * .3 + oy); g.lineTo(-R * 1.03 + ox, R * .45 + oy); g.lineTo(-R * 1.22 + ox, R * .68 + oy);
      g.quadraticCurveTo(-R * .62 + ox, R * 1.02 + oy, -R * .12 + ox, R * .76 + oy); g.quadraticCurveTo(-R * .06 + ox, R * .36 + oy, -R * .32 + ox, R * .1 + oy);
      g.moveTo(R * .86 + ox, R * .04 + oy);
      g.quadraticCurveTo(R * 1.18 + ox, R * .1 + oy, R * 1.27 + ox, R * .36 + oy); g.lineTo(R * 1.04 + ox, R * .46 + oy);
      g.quadraticCurveTo(R * 1.0 + ox, R * .74 + oy, R * .76 + ox, R * .68 + oy); g.quadraticCurveTo(R * .74 + ox, R * .3 + oy, R * .86 + ox, R * .04 + oy);
      if (k) {   // brow spots ride in the same fill
        g.moveTo(-R * .14 + 3.9, -R * .55 + B[2]); g.ellipse(-R * .14, -R * .55 + B[2], 3.9, 2.3, B[0], 0, TAU);
        g.moveTo(R * .62 + 3.2, -R * .55 + B[3]); g.ellipse(R * .62, -R * .55 + B[3], 3.2, 2.1, B[1], 0, TAU);
      }
      g.fillStyle = k ? FG : 'rgba(58,12,4,.42)'; g.fill();
    }
    // muzzle: its own bump, throwing a little shade down onto the cheek
    dab(g, R * .44, R * .66, R * .52, R * .36, .35);
    g.beginPath(); g.ellipse(R * .37, R * .5, R * .43, R * .33, -.08, 0, TAU);
    blob(g, FUR, R * .37, R * .47, R * .42, .3, .5, .25, .7);
    // tear tracks from each eye to the mouth corner, painted on (the shading shows through)
    g.lineCap = 'round'; g.strokeStyle = 'rgba(122,30,10,.72)'; g.lineWidth = 2.9;
    g.beginPath(); g.moveTo(-R * .14, R * .12); g.quadraticCurveTo(-R * .1, R * .46, R * .06, R * .74);
    g.moveTo(R * .64, R * .1); g.quadraticCurveTo(R * .8, R * .36, R * .8, R * .64); g.stroke();
    // eyes set into sockets
    const wide = !!f.wide, eo = { t: f.t, look: f.look || 0, lookX: f.lookX == null ? .3 : f.lookX, wide, seed: f.seed || 0 };
    const ws = wide ? 1.2 : 1;
    dab(g, -R * .1, -R * .06, 6.6 * ws, 6.4 * ws, .38); dab(g, R * .64, -R * .08, 5.6 * ws, 5.4 * ws, .38);
    eye3d(g, -R * .13, -R * .1, 4.4, eo);
    eye3d(g, R * .62, -R * .12, 3.7, eo);
    if (f.lid) lids(g, f.lid, HG);
    // wet nose
    g.beginPath(); g.moveTo(R * .5, R * .27); g.quadraticCurveTo(R * .65, R * .17, R * .82, R * .27);
    g.quadraticCurveTo(R * .74, R * .45, R * .66, R * .46); g.quadraticCurveTo(R * .56, R * .44, R * .5, R * .27);
    blob(g, NOSE, R * .66, R * .31, R * .2, 0, .4, .9);
    mouth(g, R, f.mouth);
    if (f.blush) blush(g, -R * .6, R * .46, 5.4);
    if (f.sweat) sweat(g, -R * 1.05, -R * .28 + 1.2 * cyc(f.t, .9));
    g.restore();
  }

  // ---------- costume ----------
  // neckerchief: band round the neck, a point on the chest, a knot at the nape
  function scarf(g, x, y, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(-1, 2); g.lineTo(13, 0); g.lineTo(6.5, 12); g.closePath();
    blob(g, SCARF, 6, 4, 8.5, .45, .62, .16);
    g.beginPath(); g.moveTo(-11, -3); g.quadraticCurveTo(0, 7, 13, -2);
    g.lineCap = 'round'; g.lineWidth = 7.3; g.strokeStyle = CONTOUR; g.stroke();
    const bg = g.createLinearGradient(.5 + lx * 3.2, 2.2 + ly * 3.2, .5 - lx * 3.2, 2.2 - ly * 3.2);
    bg.addColorStop(0, tone(SCARF, .3)); bg.addColorStop(.4, SCARF); bg.addColorStop(1, tone(SCARF, -.55));
    g.lineWidth = 6; g.strokeStyle = bg; g.stroke();
    g.beginPath(); g.arc(-11, -3, 3.8, 0, TAU);
    blob(g, SCARF_DK, -11, -3, 3.8, .3, .6, .3);
    g.restore();
  }
  const napeX = (x, a) => x - 11 * Math.cos(a) + 3 * Math.sin(a);
  const napeY = (y, a) => y - 11 * Math.sin(a) - 3 * Math.cos(a);
  // one streaming tail of the neckerchief; the wave travels out to the free end. A flat strip of cloth:
  // shaded edge, lit face slid toward the lamp, a stitched hem
  const RIB = new Array(12).fill(0);
  function ribPts(o, x, y, a, len, ph, amp) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 1; j <= 3; j++) { const w = amp * j / 3 * Math.sin(ph - j * 1.1); RIB[o + j * 2 - 2] = x + ca * len * j / 3 - sa * w; RIB[o + j * 2 - 1] = y + sa * len * j / 3 + ca * w; }
  }
  // both streaming tails at once, each pass stroking the pair
  function ribbons(g, x, y, a, ph, amp, len = 15) {
    frame(g);
    ribPts(0, x, y, a + .22, len * .8, ph + 1.3, amp); ribPts(6, x, y, a - .08, len, ph, amp);
    const P = RIB, path = (ox, oy) => {
      g.beginPath();
      for (let o = 0; o < 12; o += 6) {
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(P[o] + ox, P[o + 1] + oy, (P[o] + P[o + 2]) / 2 + ox, (P[o + 1] + P[o + 3]) / 2 + oy); g.quadraticCurveTo(P[o + 2] + ox, P[o + 3] + oy, P[o + 4] + ox, P[o + 5] + oy);
      }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(0, 0); g.lineWidth = 5.6; g.strokeStyle = tone(SCARF, -.62); g.stroke();
    path(lx * .6, ly * .6); g.lineWidth = 3.6; g.strokeStyle = SCARF; g.stroke();
    path(lx * 1.25, ly * 1.25); g.lineWidth = 1.2; g.strokeStyle = tone(SCARF, .32); g.stroke();
    path(0, 0); g.setLineDash(STITCH); g.lineDashOffset = 0; g.lineWidth = .9; g.strokeStyle = 'rgba(255,248,236,.42)'; g.stroke(); g.setLineDash(SOLID);
  }
  // the racing bib: a tin tag standing a little proud of the fur, lit and shaded like everything else
  function tag(g, x, y, b, a) {
    if (!b) return;
    dab(g, x + 1.8, y + 2.4, 12, 9, .45);
    bib(g, x, y, b, { a });
    g.save(); g.translate(x, y); g.rotate(a); frame(g);
    g.beginPath(); if (g.roundRect) g.roundRect(-9, -7, 18, 14, 3); else g.rect(-9, -7, 18, 14);
    const gr = g.createLinearGradient(lx * 10, ly * 8, -lx * 10, -ly * 8);
    gr.addColorStop(0, 'rgba(255,248,236,.34)'); gr.addColorStop(.3, 'rgba(255,248,236,0)');
    gr.addColorStop(.55, 'rgba(18,8,12,0)'); gr.addColorStop(1, 'rgba(18,8,12,.42)');
    g.fillStyle = gr; g.fill();
    g.restore();
  }

  // ---------- poses ----------
  function drawIdle(g, o, t, seed) {
    const br = cyc(t, .42), tw = Math.pow(Math.max(0, cyc(t, .23, .1)), 12);   // breath, a rare ear flick
    cast(g, 82);
    const Hx = -23, Hy = -30, rH = 14.5, Cx = 13, Cy = -32 - br * .5, rC = 12.6 + br * .3;
    contact(g, Cx + 10.5, -5.5, .7); contact(g, Hx - 4.5, -5.5, .7); contact(g, Cx + 5.5, -4); contact(g, Hx + 3.5, -4);
    leg(g, Cx - 2, Cy + 4, Cx + 8, -5.5, 13.5, 13.5, 1, 0, 7.2, LEG_FAR);
    leg(g, Hx - 3, Hy + 3, Hx - 7, -5.5, 12.5, 14, -1, 0, 7.2, LEG_FAR);
    const sp = [];
    let x = Hx - rH * .72, y = Hy - rH * .55; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = PI + .55 - .3 * i + .022 * i * i + .11 * (.3 + i / 8) * cyc(t, .32, -i * .07);
      x += Math.cos(a) * 8; y += Math.sin(a) * 8; sp.push(x, y);
    }
    tail(g, sp, 10.5);
    ao(g, sp[0] + 2, sp[1] + 2, 12, 11, .45);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 2.5, .5);
    ao(g, Cx + 2, Cy + 7, 7.5, 6, .4); ao(g, Hx + 2, Hy + 6, 8.5, 6.5, .4);
    leg(g, Cx + 2, Cy + 4, Cx + 3, -4, 13.5, 13.5, 1, 0, 8, LEG);
    leg(g, Hx + 2, Hy + 3, Hx + 1, -4, 12.5, 14, -1, 0, 8.5, LEG);
    tag(g, (Hx + Cx) / 2 - 6, (Hy + Cy) / 2 - 3, o.bib, -.04);
    const na = .5, nx = Cx + 7, ny = Cy - 8, hx = Cx + 14, hy = Cy - 22 + br * .6;
    ribbons(g, napeX(nx, na), napeY(ny, na), PI * .64 + .07 * cyc(t, .5), t * TAU * .5, 2, 16);
    scarf(g, nx, ny, na);
    ao(g, hx + 2, hy + 15, 15, 7, .5);
    head(g, hx, hy, -.04 + .02 * br, {
      t, seed, look: o.look || 0, lookX: .35 + .45 * cyc(t, .12), brow: 'smug', mouth: 'smirk', lid: .3,
      eN: -.32 - tw * .4, eF: .3,
    });
  }

  function drawRun(g, o, t, seed) {
    const spd = clamp(o.speed == null ? 1 : o.speed, .2, 1.6);
    const th = t * (1.1 + 1.8 * spd) * TAU, S = Math.sin(th);
    // spine: stretched long in the extended flight, bunched and arched as the hind feet swing under
    const bob = -3.2 * S - .8, span = 36 + 7 * S, sq = 1 - .07 * S, pit = 2.6 * Math.sin(th - 1.1);
    const Hx = -4 - span / 2, Cx = -4 + span / 2, Hy = -30 + bob + pit, Cy = -31 + bob - pit;
    const rH = 14.5 * sq, rC = 12.5 * sq, arch = 1.5 + 6.5 * Math.max(0, -S);
    cast(g, 68 + 9 * S, Math.max(0, -bob) * 3);
    const A = 8 + 3.5 * Math.min(1, spd), lift = 6 + 3 * Math.min(1, spd);
    const pF = th + PI / 2, pH = th - PI / 2;
    const fx = (ax, off, p) => ax + off - A * Math.cos(p), fy = p => -4 - lift * Math.max(0, Math.sin(p));
    contact(g, fx(Cx - 1, 5, pF + .55) + 2.5, fy(pF + .55), .7); contact(g, fx(Hx - 3, -2, pH + .5) + 2.5, fy(pH + .5), .7);
    contact(g, fx(Cx + 2, 2, pF) + 2.5, fy(pF)); contact(g, fx(Hx + 2, 1, pH) + 2.5, fy(pH));
    const foot = (ax, ay, off, p, fr, w, col) => {
      leg(g, ax, ay, fx(ax, off, p), fy(p), fr ? 13.5 : 12.5, fr ? 13.5 : 14, fr ? 1 : -1, (fr ? 1.9 : 1.5) * Math.max(0, Math.sin(p)), w, col);
    };
    foot(Cx - 1, Cy + 4, 5, pF + .55, true, 7.2, LEG_FAR);
    foot(Hx - 3, Hy + 3, -2, pH + .5, false, 7.2, LEG_FAR);
    const sp = [];
    let x = Hx - rH * .72, y = Hy - rH * .5; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = PI + .28 - .02 * i + (.1 + .035 * i) * Math.sin(th - 1.7 - i * .55);
      x += Math.cos(a) * 8; y += Math.sin(a) * 8; sp.push(x, y);
    }
    tail(g, sp, 10.5);
    ao(g, sp[0] + 2, sp[1] + 2, 12, 11, .45);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, arch, -arch * .5);
    ao(g, Cx + 3, Cy + 7, 7.5, 6, .4); ao(g, Hx + 3, Hy + 6, 8.5, 6.5, .4);
    foot(Cx + 2, Cy + 4, 2, pF, true, 8, LEG);
    foot(Hx + 2, Hy + 3, 1, pH, false, 8.5, LEG);
    tag(g, (Hx + Cx) / 2 - 5, (Hy + Cy) / 2 - 3, o.bib, Math.atan2(Cy - Hy, Cx - Hx) - .04);
    const na = .55, nx = Cx + 6, ny = Cy - 7, hx = Cx + 13, hy = Cy - 19 + 1.8 * Math.sin(th - 1.4);
    ribbons(g, napeX(nx, na), napeY(ny, na), PI + .1, th * 2, 3.5, 24);
    scarf(g, nx, ny, na);
    ao(g, hx + 2, hy + 15, 15, 7, .5);
    head(g, hx, hy, -.04 + .06 * Math.sin(th - 1.8), {
      t, seed, look: o.look || 0, lookX: .75, brow: 'focus', mouth: 'grin',
      eN: -.75 + .15 * Math.sin(th - 2.2), eF: -.15 + .15 * Math.sin(th - 2.5),
    });
  }

  function drawCheer(g, o, t, seed) {
    // the red panda "surprise stand": up on the hind feet, arms flung high, hopping
    const rate = 1.45, u = ((t * rate) % 1 + 1) % 1, air = u < .7, ua = u / .7;
    const hgt = air ? 68 * ua * (1 - ua) : 0;
    const sq = air ? 0 : Math.sin(PI * (u - .7) / .3), st = air ? .07 * Math.pow(Math.sin(2 * PI * ua), 2) : 0;
    const tuck = air ? 5 * Math.sin(PI * ua) : 0, wv = cyc(t, rate * 2);
    cast(g, 50, hgt);
    contact(g, -3.5, -4 - tuck - hgt, .7); contact(g, 8.5, -4 - tuck - hgt);
    g.save(); g.translate(0, -hgt); g.scale(1 + sq * .1 - st * .5, 1 - sq * .13 + st);
    const Hx = -1, Hy = -23, rH = 13.5, Cx = 1, Cy = -47, rC = 11;
    const sp = [];
    let x = Hx - rH * .75, y = Hy + rH * .3; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = PI - .5 + .24 * i + .16 * (i / 8) * cyc(t, rate, -.12 - i * .05);
      x += Math.cos(a) * 7.5; y += Math.sin(a) * 7.5; sp.push(x, y);
    }
    tail(g, sp, 10);
    ao(g, sp[0] + 2, sp[1], 11, 10, .45);
    leg(g, Hx - 3, Hy + 6, -6, -4 - tuck, 10, 10, -1, 0, 7.2, LEG_FAR);
    leg(g, Cx - 3, Cy - 7, Cx - 23 - 2 * wv, Cy - 23 + 2 * wv, 13, 13, -1, -PI / 2 - .5, 6.8, LEG_FAR, 4);
    ao(g, Cx - 3, Cy - 5, 7, 6, .35);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 1.5, 0);
    ao(g, Hx + 3, Hy + 8, 8, 6, .4);
    leg(g, Hx + 3, Hy + 7, 6, -4 - tuck, 10, 10, -1, 0, 8.5, LEG);
    tag(g, Hx - 3, Hy - 10, o.bib, -.08);
    ao(g, Cx + 5, Cy - 5, 7, 6, .35);
    leg(g, Cx + 4, Cy - 7, Cx + 25 + 2 * wv, Cy - 22 - 2 * wv, 13, 13, 1, -PI / 2 + .5, 8, LEG, 4);
    const na = .12, nx = Cx + 1, ny = Cy - 6, hx = Cx + 2, hy = Cy - 19;
    ribbons(g, napeX(nx, na), napeY(ny, na), PI * .82 - .45 * cyc(t, rate, -.2), t * TAU * 2.5, 2.5, 16);
    scarf(g, nx, ny, na);
    ao(g, hx + 2, hy + 15, 14, 6.5, .5);
    head(g, hx, hy, .07 * cyc(t, rate, .3), {
      t, seed, look: -.5, lookX: .2, brow: 'cheer', mouth: 'grin', blush: true,
      eN: -.2 + .12 * wv, eF: .22 - .12 * wv,
    });
    g.restore();
  }

  function drawWorry(g, o, t, seed) {
    // hunched on its haunches, hugging its own tail, eyes darting
    const fid = cyc(t, 1.7), sw = .035 * cyc(t, .8);
    cast(g, 60);
    ao(g, -3, -.5, 17, 3, .55);
    g.save(); g.rotate(sw); g.translate(.35 * cyc(t, 7), 0);
    const Hx = -5, Hy = -15, rH = 14.5, Cx = 3, Cy = -39, rC = 11;
    leg(g, Cx - 1, Cy + 4, Cx + 13, Cy + 13 + 1.5 * Math.max(0, -fid), 10, 10, 1, -.3, 6.8, LEG_FAR, 4);
    ao(g, Cx - 1, Cy + 6, 7, 6, .35);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 3, 0);
    tag(g, Hx - 5, Hy - 12, o.bib, -.15);
    const sp = [];
    let x = Hx - rH * .5, y = Hy + rH * .45; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = .05 - .235 * i + .05 * (i / 8) * cyc(t, 1.1, -i * .06);
      x += Math.cos(a) * 7; y += Math.sin(a) * 7; sp.push(x, y);
    }
    ao(g, sp[8] + 3, sp[9] + 3, 16, 11, .45);   // the hugged tail shades the belly it lies on
    tail(g, sp, 9.5, 0, 8, { edge: true });
    ao(g, Cx + 5, Cy + 7, 7, 6, .4);
    leg(g, Cx + 3, Cy + 5, Cx + 16, Cy + 16 + 1.5 * Math.max(0, fid), 10, 10, 1, -.2, 8, LEG, 4);
    const na = .15, nx = Cx + 3, ny = Cy - 6, hx = Cx + 5, hy = Cy - 18;
    ribbons(g, napeX(nx, na), napeY(ny, na), PI * .56 + .05 * cyc(t, 6), t * TAU * .8, 1.2, 13);
    scarf(g, nx, ny, na);
    ao(g, hx + 2, hy + 15, 14, 6.5, .5);
    head(g, hx, hy, -.04 + .05 * cyc(t, .8, .2), {
      t, seed, look: .1, lookX: .95 * Math.tanh(2.5 * cyc(t, .45)), wide: true, brow: 'worry', mouth: 'wavy', sweat: true,
      eN: -1 + .06 * fid, eF: .95 - .06 * fid,
    });
    g.restore();
  }

  function drawRide(g, o, t, seed, s) {
    const look = clamp(o.look || 0, -1, 1), emo = ['focus', 'worry', 'cheer', 'sad'].includes(o.emotion) ? o.emotion : 'focus';
    const wor = emo === 'worry', che = emo === 'cheer', sad = emo === 'sad';
    const br = cyc(t, .5), tx = wor ? .6 * cyc(t, 7.5) : 0, wv = cyc(t, 3.2);
    g.save(); g.translate(tx, che ? -3 * Math.abs(Math.sin(PI * 1.8 * t)) : 0);
    // perched on the right end of the hub, leaning out over the edge to peer down
    const lean = .45 + .1 * look + (sad ? .2 : 0) + (wor ? .06 : 0), tl = sad ? 19 : wor ? 20 : 21;
    const Hx = 12, Hy = -12, rH = 12, rC = 10.5 + br * .25;
    const Cx = Hx + tl * Math.sin(lean), Cy = Hy - tl * Math.cos(lean) + br * .4;
    ao(g, Hx + 1, -.4, 13, 2.8, .55);   // seated on the hub top
    // tail wrapped round the cable (x = 0) like a safety line: out from under the haunch and round
    // behind the cable (darker, with a stub of cable over it), then back across in front
    const wag = che ? 3 * cyc(t, 3) : wor ? .7 * cyc(t, 8) : 1.2 * cyc(t, .6), dr = sad ? 1 : 0;
    const T = [8, -7, 0, -10, -9, -14, -10, -19, -3, -24, 6, -28, 9, -31, 3, -35, -6, -38, -10, -42,
      -12 - 2 * dr + wag * .3, -50 + 3 * dr, -10 - 9 * dr + wag * .7, -57 + 12 * dr, -5 - 18 * dr + wag, -61 + 21 * dr];
    tail(g, T, 6.5, 0, 6, { far: true });
    // the stub of cable in front of the far stretch: a dark braid with its lit strand, as the machine draws it
    const cw = 1 / s;
    g.lineCap = 'butt';
    g.beginPath(); g.moveTo(-tx, -48); g.lineTo(-tx, -2); g.lineWidth = 2.6 * cw; g.strokeStyle = '#2d3136'; g.stroke();
    g.beginPath(); g.moveTo(-tx - .55 * cw, -48); g.lineTo(-tx - .55 * cw, -2); g.lineWidth = .9 * cw; g.strokeStyle = 'rgba(157,164,170,.75)'; g.stroke();
    tail(g, T, 6.5, 6, 12, { open: true });
    // far arm: grips the hub edge, or reaches up to hang on to the cable while cheering
    if (che) leg(g, Cx - 2, Cy - 4, 1.5 - tx, Cy - 20, 12.5, 12, -1, PI, 6.8, LEG_FAR, 4);
    else leg(g, Cx - 1, Cy + 4, 12.5, -3.2, 12.5, 12, 1, .9, 6.8, LEG_FAR, 4);
    ao(g, Cx - 1, Cy + 5, 6.5, 5.5, .35);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 1.5, 0);
    tag(g, Cx - 10, Cy + 7, o.bib, lean - .5);
    ao(g, Cx + 4, Cy + 5, 6.5, 5.5, .38);
    if (che) leg(g, Cx + 6, Cy - 2, Cx + 29 + wv, Cy - 16 - 4 * wv, 12.5, 12, 1, -PI / 2 + .3 + .3 * wv, 8, LEG, 4);
    else {
      leg(g, Cx + 3, Cy + 5, 19.5, -3.2, 12.5, 12, 1, .9, 8, LEG, 4);
      // claws hooked over the edge
      g.beginPath(); g.moveTo(21.6, -1.8); g.lineTo(23, 1.2); g.moveTo(19.8, -.6); g.lineTo(20.8, 2.4);
      g.lineWidth = 1.3; g.strokeStyle = '#e9dcc6'; g.lineCap = 'round'; g.stroke();
    }
    const hx = Cx + 5 + 2 * look, hy = Cy - 18 + 3 * look + (sad ? 2 : 0) + (che ? -2 : 0);
    scarf(g, Cx + 5, Cy - 6, .3);
    ao(g, hx + 2, hy + 15, 14, 6.5, .5);
    head(g, hx, hy, .3 * look + (sad ? .12 : 0) + (che ? -.08 + .06 * cyc(t, 1.8) : 0), {
      t, seed, look, lookX: .2, brow: emo, wide: wor, lid: sad ? .55 : 0, blush: che, sweat: wor,
      mouth: che ? 'grin' : wor ? 'wavy' : sad ? 'frown' : 'focus',
      eN: wor ? -1 : sad ? -1.15 : che ? -.2 + .1 * wv : -.35, eF: wor ? .95 : sad ? 1.05 : che ? .2 : .32,
    });
    g.restore();
  }

  function draw(g, o) {
    const s = o.scale || 1, t = o.t || 0, seed = o.bib ? (parseFloat(o.bib.n) || 0) * .61 : 0;
    g.save(); g.scale(s, s);
    if (o.mode === 'run') drawRun(g, o, t, seed);
    else if (o.mode === 'ride') drawRide(g, o, t, seed, s);
    else if (o.mode === 'cheer') drawCheer(g, o, t, seed);
    else if (o.mode === 'worry') drawWorry(g, o, t, seed);
    else drawIdle(g, o, t, seed);
    g.restore();
  }

  AKIT.register({
    key: 'redpanda', name: 'Red Panda', status: 'Endangered',
    fact: 'Red pandas wrap their bushy tails around themselves like a blanket to keep warm.',
    draw,
  });
})();

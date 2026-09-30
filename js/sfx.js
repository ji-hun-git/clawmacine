// Sound for the tin roulette, the crane and the race, all synthesised with Web Audio; nothing loads from disk.
// Struck tin, brass and wood are modal (a few sine partials, each with its own decay), air and friction are
// filtered noise, crane sounds pass through a short comb that plays the glass cabinet, and everything sits in
// one small room built from decaying noise. slow() darkens and lowers the whole mix for slow motion.
window.SFX = (() => {
  const LEVELS = { Off: 0, Low: .25, Room: .7 };
  // [ratio, amplitude, decay seconds]
  const TIN = [[1, 1, .2], [1.53, .72, .15], [2.21, .55, .11], [2.97, .42, .08], [3.64, .3, .06], [4.83, .2, .045]];
  const WOOD = [[1, 1, .055], [2.57, .42, .028], [4.21, .18, .015]];
  const BRASS = [[1, 1, .035], [1.62, .55, .022], [2.43, .3, .013]];
  const BAR = [[1, 1, 1.4], [2.756, .3, .45], [5.404, .09, .18]];
  const MARIMBA = [[1, 1, .55], [3.93, .15, .09], [9.2, .04, .03]];
  const BELL = [[.5, .3, 2.8], [1, 1, 1.9], [1.183, .42, 1.3], [1.506, .28, 1.05], [2, .38, .9], [2.514, .15, .6], [2.662, .12, .5], [3.011, .06, .4]];
  const COIN = [[1, 1, .55], [1.59, .55, .38], [2.14, .42, .28], [2.3, .3, .22], [2.65, .18, .16]];

  // the mix, in dB per sound (measured in an OfflineAudioContext against the loops at their working levels)
  const MIX = { relay: 0, clank: 3, tick: 2, tickLow: 5, clunk: 0, clack: 5, ballDrop: 5, whoosh: 6, coin: 7, ding: 2, fanfare: 6, popTop: 0,
    stamp: 2, crush: 6, buzz: 3, miss: 5, beep: 2, sting: 0, pistol: -1.5, shutter: 3, crowd: 6.5, gasp: 6.5, screech: 3, latch: 0, whoomp: -3 };

  let ac = null, on = true, lvl = 'Room', paused = false;
  let mix, duck, lp, vol, roomIn, roomOut, boxIn, heartIn, white, pink, top = 18000;
  let T = 0, rate = 1, ts = 1, hushUntil = 0, ends = [];
  let M = null, R = null, D = null;
  let lastClank = -1e9, clanks = [], lastTick = -1e9, tock = false, lastRelay = -1e9;
  try { const s = localStorage.getItem('tcr-vol'); if (s === 'Low' || s === 'Room') lvl = s; } catch (e) {}

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ready = () => ac && on && !paused;
  const busy = () => { const n = ac.currentTime; if (ends.length > 48) ends = ends.filter(e => e > n); return ends.length; };

  function unlock() {
    if (!ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC(); build();
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended' && !paused) try { const p = ac.resume(); p && p.catch && p.catch(() => {}); } catch (e) {}
  }

  // ---------- the rig: voices -> mix -> duck -> slow-motion lowpass -> volume -> soft limiter ----------
  // (a static curve, not a DynamicsCompressor: Chrome's auto makeup gain lifts quiet loops ~9 dB and squashes
  // a lone hit harder than a run of them, so the balance would change with what else is playing)
  function build() {
    top = Math.min(18000, ac.sampleRate / 2 - 200);
    white = noiseBuf(2, false); pink = noiseBuf(4, true);
    vol = gain(on ? LEVELS[lvl] : 0);
    const pre = gain(.5), lim = ac.createWaveShaper(); lim.curve = limitCurve(); lim.oversample = '2x';
    lp = filt('lowpass', top, .5); duck = gain(1); mix = gain(1);
    mix.connect(duck); duck.connect(lp); lp.connect(vol); vol.connect(pre); pre.connect(lim); lim.connect(ac.destination);
    roomIn = gain(1); roomOut = gain(1); roomOut.connect(mix);
    if (ac.createConvolver) { const cv = ac.createConvolver(); cv.buffer = roomIR(); roomIn.connect(cv); cv.connect(roomOut); }
    else { comb(roomIn, roomOut, .043, .45, 2600, .5); comb(roomIn, roomOut, .067, .4, 2200, .4); }
    boxIn = gain(1); comb(boxIn, mix, .0037, .46, 3000, .45); comb(boxIn, mix, .0059, .38, 2400, .35);
    heartIn = gain(1);
    const sh = ac.createWaveShaper(), hl = filt('lowpass', 1100, .6);
    const ho = gain(.34); sh.curve = softClip(2.4); heartIn.connect(sh); sh.connect(hl); hl.connect(ho); ho.connect(mix);
    loops();
  }
  function gain(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function osc(type, f) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function loopNoise() { const s = ac.createBufferSource(); s.buffer = white; s.loop = true; return s; }
  function comb(inp, out, dt, fb, fc, g) {
    const d = ac.createDelay(1), f = filt('lowpass', fc, .5), k = gain(fb), o = gain(g);
    d.delayTime.value = dt; inp.connect(d); d.connect(f); f.connect(k); k.connect(d); f.connect(o); o.connect(out);
  }
  function limitCurve() { // unity below -3 dBFS, then a soft shoulder that never reaches full scale
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = (i / (n - 1) * 2 - 1) * 2, m = Math.abs(a); c[i] = Math.sign(a) * (m < .7 ? m : .7 + .3 * Math.tanh((m - .7) / .3)); }
    return c;
  }
  function softClip(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  function noiseBuf(sec, pinkish) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (!pinkish) { d[i] = w; continue; }
      b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
      b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
    }
    return b;
  }
  // a plaster classroom: a few early reflections, then noise that darkens as it dies (about 0.9 s)
  function roomIR() {
    const sr = ac.sampleRate, n = Math.floor(sr * 1.1), b = ac.createBuffer(2, n, sr);
    const taps = [.0071, .0113, .0158, .0217, .0283, .0349, .0431];
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, a = Math.exp(-2 * Math.PI * (7000 * Math.exp(-t * 3.2) + 900) / sr);
        y = (1 - a) * (Math.random() * 2 - 1) + a * y;
        d[i] = y * Math.exp(-t / .15) * Math.min(1, t / .018);
      }
      taps.forEach((t, k) => { const i = Math.floor(t * (c ? 1.06 : .95) * sr); if (i < n) d[i] += (k % 2 ? -.5 : .5) * Math.exp(-t / .05); });
    }
    return b;
  }
  // a two-hand snare roll as one oscillator cycle: a hard stroke, then a softer one, each dying fast
  function strokes() {
    const N = 24, S = 256, re = new Float32Array(N), im = new Float32Array(N); let mean = 0;
    const f = p => (p < .5 ? Math.exp(-10 * p) : .74 * Math.exp(-10 * (p - .5)));
    for (let s = 0; s < S; s++) {
      const p = s / S, v = f(p); mean += v / S;
      for (let k = 1; k < N; k++) { re[k] += 2 * v * Math.cos(2 * Math.PI * k * p) / S; im[k] += 2 * v * Math.sin(2 * Math.PI * k * p) / S; }
    }
    return { wave: ac.createPeriodicWave ? ac.createPeriodicWave(re, im, { disableNormalization: true }) : null, mean };
  }

  // ---------- the three running loops: gantry motor, rolling ball, snare roll ----------
  function loops() {
    // DC gear motor: a saw whose harmonics sit where small speakers can play them, gear whine, brush rattle
    M = { l: 0, p: -1, r: 0, rl: 0, rp: 1, run: false };
    M.o = osc('sawtooth', 110); M.w = osc('triangle', 660); M.lfo = osc('square', 16);
    const ml = filt('lowpass', 800, .7), mp = filt('peaking', 230, 1.2), n = loopNoise(), rb = filt('bandpass', 1300, 1.1);
    mp.gain.value = 8; M.wb = filt('bandpass', 660, 6); M.wg = gain(0); M.am = gain(.5); M.out = gain(0);
    const lg = gain(.5), hum = gain(.8), rat = gain(.15);
    M.o.connect(ml); ml.connect(mp); mp.connect(hum); hum.connect(M.out);
    n.connect(rb); rb.connect(M.am); M.lfo.connect(lg); lg.connect(M.am.gain); M.am.connect(rat); rat.connect(M.out);
    M.w.connect(M.wb); M.wb.connect(M.wg); M.wg.connect(mix);
    M.out.connect(mix); send(M.out, boxIn, .5);
    // steel ball on a wooden track: bright rolling hiss, a low body rumble, a flutter that follows speed
    R = { l: 0, r: 0, rl: 0 };
    const rn = loopNoise(), lo = filt('lowpass', 240, .7), lob = gain(1.1);
    R.bp = filt('bandpass', 900, 1.3); R.am = gain(.75); R.lfo = osc('sine', 9); R.g = gain(0);
    const rg = gain(.25);
    rn.connect(R.bp); R.bp.connect(R.am); rn.connect(lo); lo.connect(lob); lob.connect(R.am);
    R.lfo.connect(rg); rg.connect(R.am.gain); R.am.connect(R.g); R.g.connect(mix); send(R.g, roomIn, .12);
    // snare roll: noise through the snare band, cut into strokes by a shaped oscillator; a little shell tone
    D = { l: 0, r: 0, rl: 0 };
    const sw = strokes(), dn = loopNoise(), dh = filt('highpass', 650, .7), shell = osc('triangle', 186), sg = gain(.2);
    D.bp = filt('bandpass', 2400, .8); D.am = gain(sw.wave ? sw.mean : .5); D.lfo = osc('sawtooth', 8.5); D.g = gain(0);
    if (sw.wave) D.lfo.setPeriodicWave(sw.wave);
    const dl = gain(sw.wave ? 1 : -.5);
    dn.connect(dh); dh.connect(D.bp); D.bp.connect(D.am); shell.connect(sg); sg.connect(D.am);
    D.lfo.connect(dl); dl.connect(D.am.gain); D.am.connect(D.g); D.g.connect(mix); send(D.g, roomIn, .3);
    [M.o, M.w, M.lfo, n, rn, R.lfo, dn, shell, D.lfo].forEach(s => s.start());
  }

  // ---------- one-shot helpers ----------
  function begin() { T = ac.currentTime + .006; if (ends.length > 128) ends = ends.filter(e => e > T); }
  function env(p, t, peak, att, hold, dec) {
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att);
    if (hold) p.setValueAtTime(peak, t + att + hold);
    p.setTargetAtTime(0, t + att + hold, dec / 6.9);
    return t + att + hold + dec;
  }
  function send(x, to, k) { const s = gain(k); x.connect(s); s.connect(to); }
  function route(n, o) {
    let x = n;
    if ((o.pan || o.panTo !== undefined) && ac.createStereoPanner) {
      const p = ac.createStereoPanner(); p.pan.setValueAtTime(clamp(o.pan || 0, -1, 1), T);
      if (o.panTo !== undefined) p.pan.linearRampToValueAtTime(clamp(o.panTo, -1, 1), T + (o.panT || .4));
      x.connect(p); x = p;
    }
    x.connect(o.out || mix);
    if (o.room) send(x, roomIn, o.room);
    if (o.box) send(x, boxIn, o.box);
  }
  function bus(key, o) { const g = gain(Math.pow(10, (MIX[key] || 0) / 20)); route(g, o); return g; }
  function tone(f, d, o = {}) {
    const t = T + (o.at || 0), s = ac.createOscillator(), g = ac.createGain();
    s.type = o.type || 'sine'; s.frequency.setValueAtTime(clamp(f * rate, 10, top), t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(clamp(o.to * rate, 10, top), t + (o.glide || d));
    if (o.detune) s.detune.setValueAtTime(o.detune, t);
    const end = env(g.gain, t, o.vol ?? .1, o.att ?? .002, o.hold || 0, d / rate);
    let n = s; if (o.lp) { n = filt('lowpass', o.lp, o.q ?? .7); s.connect(n); }
    n.connect(g); if (o.dest) g.connect(o.dest); else route(g, o);
    s.start(t); s.stop(end + .02); ends.push(end);
  }
  function noise(d, o = {}) {
    const t = T + (o.at || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), b = o.pink ? pink : white;
    s.buffer = b; s.loop = true; f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(clamp((o.freq || 1000) * rate, 20, top), t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(clamp(o.to * rate, 20, top), t + (o.glide || d));
    const end = env(g.gain, t, o.vol ?? .2, o.att ?? .001, o.hold || 0, d / rate);
    s.connect(f); f.connect(g); if (o.dest) g.connect(o.dest); else route(g, o);
    s.start(t, Math.random() * (b.duration - .05)); s.stop(end + .02); ends.push(end);
  }
  // struck object: modes = [[ratio, amp, decay]]; o.modes limits how many ring (soft hits excite fewer),
  // o.jit detunes each mode a little, o.vary moves the strike point (mode amplitudes change from hit to hit)
  function strike(f, modes, o = {}) {
    const n = Math.min(o.modes || modes.length, modes.length), j = o.jit || 0, w = o.vary || 0;
    for (let i = 0; i < n; i++) {
      const [r, a, dec] = modes[i]; if (f * r * rate > top) break;
      tone(f * r * (1 + j * (Math.random() - .5)), dec * (o.ring || 1), { at: o.at, dest: o.dest, vol: (o.vol ?? .05) * a * (i ? rnd(1 - w, 1 + w * .4) : 1), att: o.att ?? .0015, detune: o.detune });
    }
  }
  function knock(at, a, b) { // steel ball on turned wood
    noise(.007, { vol: .3 * a, freq: 3800, q: 1, at, dest: b });
    strike(rnd(1420, 1560), WOOD, { vol: .1 * a, at, dest: b });
    tone(250, .05, { vol: .09 * a, to: 170, at, dest: b });
    tone(rnd(6200, 6600), .04, { vol: .012 * a, at, dest: b });
  }
  function relay(closing) { // the contactor that switches the gantry motor
    begin(); const b = bus('relay', { box: .6, room: .06 });
    noise(.006, { vol: .14, freq: closing ? 2700 : 2100, q: 2, dest: b });
    strike(closing ? 940 : 810, [[1, 1, .03], [2.31, .4, .02]], { vol: .03, dest: b });
    tone(closing ? 130 : 110, .03, { vol: .06, to: 90, dest: b });
  }

  // ---------- loops ----------
  function motor(level, pitch = 1) {
    if (!ac) return;
    const t = ac.currentTime, hushed = t < hushUntil;
    M.rl = num(level, 0); M.rp = num(pitch, 1);
    const l = on && !hushed ? clamp(M.rl, 0, 1) : 0, p = clamp(M.rp, .2, 2.5);
    const run = M.run ? l > .02 : l > .06;
    if (run !== M.run) {
      M.run = run;
      if (ready() && !hushed && t - lastRelay > .22) { lastRelay = t; relay(run); }
    }
    if (Math.abs(l - M.l) > .004) { M.l = l; M.out.gain.setTargetAtTime(l * .05, t, .05); M.wg.gain.setTargetAtTime(l * l * .017, t, .08); }
    if (Math.abs(p - M.p) > .005 || M.r !== rate) {
      M.p = p; M.r = rate; const f = (46 + 62 * p) * rate;
      M.o.frequency.setTargetAtTime(f, t, .07); M.w.frequency.setTargetAtTime(f * 6, t, .07);
      M.wb.frequency.setTargetAtTime(f * 6, t, .07); M.lfo.frequency.setTargetAtTime(f / 7, t, .07);
    }
  }
  function roll(level) {
    if (!ac) return;
    const t = ac.currentTime; R.rl = num(level, 0);
    const l = on && t >= hushUntil ? clamp(R.rl, 0, 1.2) : 0;
    if (Math.abs(l - R.l) < .004 && R.r === rate) return;
    R.l = l; R.r = rate; const k = Math.min(1, l);
    R.g.gain.setTargetAtTime(k * .22, t, .05);
    R.bp.frequency.setTargetAtTime((520 + 1500 * k) * rate, t, .05);
    R.lfo.frequency.setTargetAtTime((3 + 15 * l) * rate, t, .08);
  }
  function drum(level) {
    if (!ac) return;
    const t = ac.currentTime; D.rl = num(level, 0);
    const l = on && t >= hushUntil ? clamp(D.rl, 0, 1) : 0;
    if (Math.abs(l - D.l) < .004 && D.r === rate) return;
    D.l = l; D.r = rate;
    D.g.gain.setTargetAtTime(l * (.6 + .4 * l) * 1.15, t, .06);
    D.bp.frequency.setTargetAtTime((1700 + 1500 * l) * rate, t, .06);
    D.lfo.frequency.setTargetAtTime((8.2 + .9 * l) * rate, t, .1);
  }
  function quiet() { if (!ac) return; const t = ac.currentTime; [M.out, M.wg, R.g, D.g].forEach(x => { x.gain.cancelScheduledValues(t); x.gain.setTargetAtTime(0, t, .008); }); M.l = R.l = D.l = 0; }
  function apply() {
    if (!ac) return;
    vol.gain.setTargetAtTime(on ? LEVELS[lvl] : 0, ac.currentTime, .03);
    if (!on) quiet(); else { motor(M.rl, M.rp); roll(R.rl); drum(D.rl); }
  }

  // ---------- struck, dropped and blown things ----------
  function clank(v = 3) {
    if (!ready()) return;
    const n = ac.currentTime; if (n - lastClank < .06) return;
    clanks = clanks.filter(x => n - x < .2); if (clanks.length >= 3 || busy() > 90) return;
    clanks.push(n); lastClank = n; begin(); T += rnd(0, .012);
    const e = clamp(num(v, 3) / 6, .1, 1), b = bus('clank', { pan: rnd(-.35, .35), room: .12, box: .55 });
    strike(rnd(560, 940), TIN, { vol: .045 + .05 * e, modes: 3 + Math.round(e * 3), jit: .025, vary: .6, dest: b });
    noise(.01 + .02 * e, { vol: .16 * e, freq: 2600 + 2400 * e, q: 1.5, dest: b });
    if (e > .45) tone(rnd(140, 180), .05, { vol: .07 * e, to: 95, dest: b });
  }
  function tick(v = 1) {
    if (!ready()) return;
    const n = ac.currentTime; if (n - lastTick < .018 || busy() > 90) return; lastTick = n; begin();
    const e = clamp(num(v, 1), .1, 1.6) / 1.6, b = bus('tick', { pan: rnd(-.15, .15), room: .1 });
    noise(.005, { vol: .35 * e, freq: 4600, q: .9, dest: b });
    strike(rnd(2600, 2900), BRASS, { vol: .07 * e, dest: b });
    strike(rnd(1080, 1200), WOOD, { vol: .055 * e, modes: 2, dest: b });
  }
  function tickLow() { // a wall clock: escapement click, wooden case, a low body; tick and tock differ
    if (!ready()) return; begin(); tock = !tock;
    const b = bus('tickLow', { room: .28 });
    noise(.012, { vol: .34, freq: tock ? 1500 : 1900, q: 3, dest: b });
    strike(tock ? 380 : 452, WOOD, { vol: .12, ring: 1.6, dest: b });
    tone(tock ? 88 : 104, .1, { vol: .18, to: tock ? 62 : 74, att: .003, dest: b });
  }
  function clunk() { // the claw bottoms out: solenoid and steel, inside the cabinet
    if (!ready()) return; begin();
    const b = bus('clunk', { room: .15, box: .6 });
    tone(96, .17, { vol: .34, to: 52, att: .002, dest: b });
    noise(.07, { vol: .32, freq: 520, q: .8, type: 'lowpass', dest: b });
    strike(310, [[1, 1, .13], [2.43, .5, .07], [3.9, .3, .05]], { vol: .07, dest: b });
    noise(.02, { vol: .12, freq: 2400, q: 1.2, dest: b });
  }
  function clack() { // relay snap / ball on a steel diamond
    if (!ready()) return; begin();
    const b = bus('clack', { room: .15, box: .3 });
    noise(.016, { vol: .3, freq: 2300, q: 1.6, dest: b });
    strike(rnd(1150, 1240), [[1, 1, .05], [2.31, .6, .035], [3.7, .3, .02]], { vol: .085, dest: b });
    tone(160, .045, { vol: .12, to: 110, dest: b });
  }
  function ballDrop() { // the ball lands on the wood and bounces, each bounce shorter and softer
    if (!ready()) return; begin();
    const b = bus('ballDrop', { room: .18, pan: -.1 });
    [[0, 1], [.13, .55], [.215, .32], [.27, .18], [.305, .1]].forEach(([at, a]) => knock(at, a, b));
  }
  function whoosh() { // a can thrown up past the lamp
    if (!ready()) return; begin();
    const s = Math.random() < .5 ? -1 : 1, b = bus('whoosh', { pan: -.5 * s, panTo: .5 * s, panT: .4, room: .22 });
    noise(.36, { vol: .26, freq: 380, to: 1700, glide: .2, q: .9, att: .1, dest: b });
    noise(.3, { vol: .1, freq: 900, to: 3200, glide: .18, q: 1.4, att: .08, at: .02, dest: b });
  }
  function coin() { // a coin down an old mech: it rattles, rings once, drops into the cash box
    if (!ready()) return; begin();
    const b = bus('coin', { room: .25, box: .3 });
    [0, .045, .08].forEach((at, i) => noise(.01, { vol: .12 * (1 - i * .2), freq: 3600, q: 2, at, dest: b }));
    strike(2380, COIN, { vol: .035, at: .1, dest: b });
    tone(180, .08, { vol: .13, to: 120, at: .42, dest: b });
    noise(.04, { vol: .16, freq: 900, q: 1, at: .42, dest: b });
    strike(1930, COIN, { vol: .014, at: .42, ring: .4, dest: b });
  }
  function ding() { // one low bell, hit once by its clapper
    if (!ready()) return; begin();
    const b = bus('ding', { room: .45 });
    noise(.01, { vol: .14, freq: 3000, q: 1.5, dest: b });
    strike(392, BELL, { vol: .07, att: .003, dest: b });
    strike(392 * 1.004, [[1, .45, 1.9]], { vol: .07, att: .003, dest: b });
  }
  function fanfare() { // the three-rod chime unit rising, then the win bell rattling on its clapper
    if (!ready()) return; begin();
    const b = bus('fanfare', { room: .35, box: .12 });
    [[523.25, 0], [659.25, .11], [783.99, .22], [1046.5, .38]].forEach(([f, at]) => {
      noise(.006, { vol: .16, freq: 5000, q: 1, at, dest: b }); strike(f, BAR, { vol: .06, at, dest: b });
    });
    [659.25, 783.99].forEach(f => strike(f, BAR, { vol: .03, at: .38, dest: b }));
    for (let i = 0; i < 9; i++) strike(1760, [[1, 1, .3], [2.02, .4, .18], [2.95, .2, .1]], { vol: .022 * (1 - i / 12), at: .52 + i * .046, jit: .004, dest: b });
  }
  function popTop() { // ring-pull: the score line cracks, the tab rings, the air hisses out
    if (!ready()) return; begin();
    const b = bus('popTop', { room: .1 });
    noise(.004, { vol: .3, freq: 3000, q: .5, type: 'highpass', dest: b });
    strike(3300, [[1, 1, .05], [1.7, .5, .03]], { vol: .04, dest: b });
    noise(.3, { vol: .17, freq: 5500, to: 3400, q: .7, type: 'highpass', att: .006, at: .004, dest: b });
    tone(700, .06, { vol: .06, to: 1450, at: .01, dest: b });
  }
  function stamp() { // rubber stamp on paper on a desk
    if (!ready()) return; begin();
    const b = bus('stamp', { room: .2 });
    tone(78, .2, { vol: .42, to: 44, att: .002, dest: b });
    tone(160, .07, { vol: .12, to: 110, dest: b });
    noise(.12, { vol: .5, freq: 300, q: .7, type: 'lowpass', dest: b });
    noise(.03, { vol: .15, freq: 1300, q: .9, dest: b });
    strike(420, [[1, 1, .09], [2.7, .4, .05]], { vol: .05, dest: b });
  }
  function crush() { // thin tin buckling, softly, crinkles bunched at the start
    if (!ready()) return; begin();
    const b = bus('crush', { room: .15, box: .2 });
    noise(.3, { vol: .12, freq: 900, q: .7, type: 'lowpass', dest: b });
    for (let i = 0; i < 14; i++) noise(rnd(.005, .015), { vol: .17 * (1 - i / 18), freq: rnd(1800, 6000), q: rnd(3, 7), at: .35 * Math.pow(i / 14, 1.6), dest: b });
    for (let i = 0; i < 3; i++) strike(rnd(700, 1100), TIN, { vol: .025, modes: 3, at: i * .09, dest: b });
    tone(220, .25, { vol: .05, to: 140, dest: b });
  }
  function buzz() { // not a buzzer: two soft wooden notes stepping down
    if (!ready()) return; begin();
    const b = bus('buzz', { room: .3 });
    [[659.25, 0], [440, .17]].forEach(([f, at]) => { noise(.005, { vol: .08, freq: 2000, q: 1, at, dest: b }); strike(f, MARIMBA, { vol: .075, at, dest: b }); });
  }
  function miss() { // the claw comes back empty: the motor spins down, the prongs spring shut
    if (!ready()) return; begin();
    const b = bus('miss', { room: .2, box: .4 });
    tone(140, .55, { type: 'sawtooth', vol: .05, to: 55, glide: .5, lp: 600, att: .01, dest: b });
    noise(.01, { vol: .15, freq: 2800, q: 2, at: .05, dest: b });
    strike(520, [[1, 1, .3], [2.76, .3, .15]], { vol: .03, at: .06, dest: b });
    strike(392, MARIMBA, { vol: .05, at: .2, dest: b }); strike(311.13, MARIMBA, { vol: .05, at: .38, dest: b });
  }
  function beep(hi) { // starter's timer: a short sine pip, an octave up for the last one
    if (!ready()) return; begin();
    const f = hi ? 1318.5 : 659.25, b = bus('beep', { room: .2 });
    tone(f, .06, { vol: .07, att: .004, hold: .09, dest: b });
    tone(f * 3, .04, { vol: .005, att: .004, hold: .06, dest: b });
  }
  function heart(v = 1) { // lub-dub, soft-clipped so its overtones reach small speakers
    if (!ready()) return; begin();
    const a = clamp(num(v, 1), 0, 1.5), b = gain(1); b.connect(heartIn);
    [[0, 1, 60, 38, .14], [.165, .7, 68, 44, .11]].forEach(([at, k, f, to, d]) => {
      tone(f, d, { vol: .5 * a * k, to, glide: d * .8, att: .008, at, dest: b });
      tone(f * 2.1, d * .5, { vol: .12 * a * k, to: to * 2, att: .005, at, dest: b });
      noise(d * .6, { vol: .25 * a * k, freq: 190, q: .7, type: 'lowpass', att: .004, at, dest: b });
    });
  }
  function sting() { // the name cuts in: a sub hit under a low open chord that opens and closes
    if (!ready()) return; begin();
    const b = bus('sting', { room: .5 }), fl = filt('lowpass', 220, .8);
    fl.frequency.setValueAtTime(220, T); fl.frequency.exponentialRampToValueAtTime(1600, T + .06);
    fl.frequency.exponentialRampToValueAtTime(420, T + 1.3); fl.connect(b);
    noise(.004, { vol: .3, freq: 6000, q: 1, type: 'highpass', dest: b });
    tone(62, .7, { vol: .4, to: 48, att: .004, dest: b });
    [130.81, 196, 261.63, 392].forEach(f => [-7, 7].forEach(dt => tone(f, 1.4, { type: 'sawtooth', vol: .028, detune: dt, att: .012, dest: fl })));
  }
  function pistol() { // starter's pistol and its slap back off the stand
    if (!ready()) return; begin();
    const b = bus('pistol', { room: .6 });
    noise(.004, { vol: .85, freq: 9000, q: .3, type: 'lowpass', att: .0005, dest: b });
    noise(.09, { vol: .68, freq: 1800, q: .5, att: .0008, dest: b });
    noise(.25, { vol: .27, freq: 700, q: .6, type: 'lowpass', at: .01, dest: b });
    tone(120, .12, { vol: .5, to: 38, att: .001, dest: b });
    [[.19, .26], [.34, .12]].forEach(([at, a]) => noise(.12, { vol: a, freq: 1100, q: .6, type: 'lowpass', at, dest: b }));
  }
  function shutter() { // photo finish: first curtain, mirror slap, second curtain, then the film winds on
    if (!ready()) return; begin();
    const b = bus('shutter', { room: .12 }), click = (at, a, f) => {
      noise(.005, { vol: .63 * a, freq: f, q: 1.8, at, dest: b });
      strike(f * .62, [[1, 1, .025], [1.73, .5, .015]], { vol: .055 * a, at, dest: b });
    };
    click(0, 1, 4200); tone(170, .05, { vol: .22, to: 120, at: .004, dest: b }); click(.055, .8, 3600);
    for (let i = 0; i < 11; i++) noise(.004, { vol: .12, freq: 2600 + i * 40, q: 4, at: .14 + i * .014, dest: b });
  }
  function crowd() { // a class on its feet: breath through vowel bands, single cheers, scattered claps
    if (!ready()) return; begin();
    const b = bus('crowd', { room: .35 });
    [[700, 5, .5], [1150, 6, .34], [2600, 5, .12]].forEach(([f, q, a]) => noise(1.8, { pink: true, vol: .88 * a, freq: f, q, att: .6, hold: .9, dest: b }));
    const vowels = [[800, 1200], [500, 1900], [650, 1080], [400, 2200]];
    for (let i = 0; i < 12; i++) {
      const at = rnd(.08, 1.1), d = rnd(.4, 1), f0 = rnd(250, 480), [f1, f2] = vowels[i % 4];
      const s = osc('sawtooth', f0), vib = osc('sine', rnd(5, 7)), vg = gain(f0 * .02), g = gain(0), a = filt('bandpass', f1, 6), c = filt('bandpass', f2, 8);
      s.frequency.setValueAtTime(f0 * rate, T + at); s.frequency.linearRampToValueAtTime(f0 * 1.25 * rate, T + at + d * .4);
      s.frequency.linearRampToValueAtTime(f0 * rate, T + at + d);
      vib.connect(vg); vg.connect(s.frequency); s.connect(a); s.connect(c); a.connect(g); c.connect(g);
      const end = env(g.gain, T + at, .1, .05, d * .4, d * .6);
      route(g, { pan: rnd(-.7, .7), out: b });
      s.start(T + at); vib.start(T + at); s.stop(end + .02); vib.stop(end + .02); ends.push(end);
    }
    for (let i = 0; i < 30; i++) noise(.012, { vol: rnd(.07, .15), freq: rnd(1000, 2500), q: rnd(1.2, 2.2), at: .2 + 2.1 * Math.pow(Math.random(), 1.4), pan: rnd(-.8, .8), out: b });
  }
  function gasp() { // the room catches its breath
    if (!ready()) return; begin();
    const b = bus('gasp', { room: .3 });
    noise(.32, { pink: true, vol: .5, freq: 1100, to: 1700, q: 2.5, att: .2, dest: b });
    noise(.3, { pink: true, vol: .09, freq: 2600, q: 1.2, att: .2, dest: b });
    for (let i = 0; i < 4; i++) { const f0 = rnd(230, 380); tone(f0, .35, { type: 'sawtooth', vol: .012, att: .12, to: f0 * 1.12, lp: 900, at: rnd(.08, .16), dest: b }); }
  }
  function screech() { // a can dragging on a prong: stick-slip ticks over a scraped resonance
    if (!ready()) return; begin();
    const b = bus('screech', { room: .12, box: .5 });
    noise(.22, { vol: .7, freq: 2600, to: 1900, q: 9, dest: b });
    tone(1900, .2, { type: 'sawtooth', vol: .03, to: 1300, lp: 3500, dest: b });
    for (let i = 0; i < 9; i++) noise(.004, { vol: .25, freq: 3400 - i * 120, q: 6, at: i * .022, dest: b });
  }
  function latch() { // the pawl drops in: two quick clicks, then the claw's weight settles
    if (!ready()) return; begin();
    const b = bus('latch', { room: .12, box: .6 });
    [0, .028].forEach((at, i) => { noise(.005, { vol: .18 - i * .05, freq: 3000, q: 2, at, dest: b }); strike(1320, [[1, 1, .04], [2.4, .4, .02]], { vol: .035, at, dest: b }); });
    tone(118, .12, { vol: .22, to: 70, at: .03, dest: b });
    strike(rnd(620, 700), TIN, { vol: .04, modes: 3, at: .05, dest: b });
  }
  function whoomp() { // a big thing moving air close by
    if (!ready()) return; begin();
    const b = bus('whoomp', { room: .15 });
    tone(90, .25, { vol: .3, to: 45, att: .02, dest: b });
    noise(.25, { vol: .22, freq: 320, q: .7, type: 'lowpass', att: .05, dest: b });
  }

  return {
    unlock,
    get on() { return on; },
    get level() { return on ? lvl : 'Off'; },
    toggle() { on = !on; apply(); return on; },
    cycle() {
      const next = !on ? 'Room' : lvl === 'Room' ? 'Low' : 'Off';
      if (next === 'Off') on = false;
      else { on = true; lvl = next; try { localStorage.setItem('tcr-vol', lvl); } catch (e) {} }
      apply(); return next;
    },
    pause(b) {
      paused = b === undefined ? !paused : !!b;
      if (ac) try { const p = paused ? ac.suspend() : ac.resume(); p && p.catch && p.catch(() => {}); } catch (e) {}
      return paused;
    },
    motor, roll, drum, clank, tick, tickLow, clunk, clack, ballDrop, whoosh, coin, ding, fanfare, popTop, stamp,
    crush, buzz, miss, beep, heart, sting, pistol, shutter, crowd, gasp, screech, latch, whoomp,
    vacuum(ms = 280) { // everything drops out: loops cut, the rest ducked to a whisper, then back
      if (!ac) return;
      const t = ac.currentTime, d = clamp(num(ms, 280), 0, 5000) / 1000;
      hushUntil = t + d; quiet();
      duck.gain.cancelScheduledValues(t); duck.gain.setTargetAtTime(.15, t, .008); duck.gain.setTargetAtTime(1, t + d, .05);
    },
    slow(v) { // slow motion: the whole mix darkens, pitches drop, the room gets bigger
      if (!ac) return;
      const s = num(v, 1) >= .999 ? 1 : clamp(num(v, 1), .05, 1);
      if (s === ts || (s < 1 && Math.abs(s - ts) < .005)) return;
      ts = s; rate = .6 + .4 * s; const t = ac.currentTime;
      lp.frequency.setTargetAtTime(600 + 5000 * s + (top - 5600) * Math.pow(s, 8), t, .06);
      roomOut.gain.setTargetAtTime(1 + (1 - s) * .8, t, .12);
      motor(M.rl, M.rp); roll(R.rl); drum(D.rl);
    },
  };
})();
